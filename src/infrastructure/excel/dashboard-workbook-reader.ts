import path from "node:path";

import * as XLSX from "xlsx";

import type { DownloadRecord } from "../../domain/download";
import type { DashboardWorkbookFormatSignature } from "../../domain/dashboard-verification";

export interface ParsedDashboardWorkbookRow {
  continentName: string | null;
  countryName: string;
  gender: "total" | "male" | "female";
  totalPopulationCount: number;
  shortTermVisitorsTotal: number;
  b1ShortTermVisitorsTotal: number;
  b2ShortTermVisitorsTotal: number;
  nonB1B2ShortTermVisitorsTotal: number;
}

export interface ParsedDashboardWorkbook {
  source: DownloadRecord;
  period: {
    year: number;
    month: number;
    periodKey: string;
  };
  rows: ParsedDashboardWorkbookRow[];
  monthlyTotals: {
    total: number;
    b1: number;
    b2: number;
    nonB1B2: number;
  };
  genderTotals: Record<
    "total" | "male" | "female",
    {
      total: number;
      b1: number;
      b2: number;
      nonB1B2: number;
    }
  >;
  hasGenderBreakdown: boolean;
}

interface DashboardWorkbookInspectionContext {
  header: string[];
  headerRowIndex: number;
  countryIndex: number;
  genderIndex: number;
  continentIndex: number;
  totalPopulationIndex: number;
  shortTermIndexes: number[];
}

interface ShortTermBucket {
  total: number;
  b1: number;
  b2: number;
  nonB1B2: number;
}

function createShortTermBucket(): ShortTermBucket {
  return {
    total: 0,
    b1: 0,
    b2: 0,
    nonB1B2: 0,
  };
}

const SHORT_TERM_CODE_CANDIDATES = [
  "B1",
  "B2",
  "C1",
  "C3",
  "C4",
] as const;

type SheetMatrix = Array<Array<string | number | null>>;

function normalizeText(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCountryName(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function compactText(value: string): string {
  return normalizeText(value).replace(/[\s().,·∙_/-]/g, "").trim();
}

function normalizeVisaHeader(value: string): string {
  return value.toUpperCase().replace(/[\s()-]/g, "");
}

function extractVisaCode(value: string): string | null {
  const normalized = normalizeVisaHeader(value);
  const normalizedMatch = normalized.match(/^([A-Z])(\d{1,2})(\d{1,2})?/);
  if (normalizedMatch?.[1] && normalizedMatch[2]) {
    return `${normalizedMatch[1]}${normalizedMatch[2]}${normalizedMatch[3] ?? ""}`;
  }

  const match =
    value.match(/\(([A-Z])\s*-\s*(\d{1,2})(?:\s*-\s*(\d{1,2}))?\)/i) ??
    value.match(/\b([A-Z])\s*-\s*(\d{1,2})(?:\s*-\s*(\d{1,2}))?\b/i);
  if (!match?.[1] || !match[2]) {
    return null;
  }

  const tail = match[3] ? match[3] : "";
  return `${match[1].toUpperCase()}${match[2]}${tail}`;
}

function parsePeriod(record: DownloadRecord): {
  year: number;
  month: number;
  periodKey: string;
} {
  const titleMatch = record.articleTitle.match(/(\d{4})년(?:도)?\s*(\d{1,2})월/);
  if (titleMatch?.[1] && titleMatch?.[2]) {
    const year = Number.parseInt(titleMatch[1], 10);
    const month = Number.parseInt(titleMatch[2], 10);
    return {
      year,
      month,
      periodKey: `${year}-${String(month).padStart(2, "0")}`,
    };
  }

  const pathMatch = path.normalize(record.localPath).match(/(\d{4})-(\d{2})/);
  if (pathMatch?.[1] && pathMatch?.[2]) {
    const year = Number.parseInt(pathMatch[1], 10);
    const month = Number.parseInt(pathMatch[2], 10);
    return {
      year,
      month,
      periodKey: `${year}-${String(month).padStart(2, "0")}`,
    };
  }

  throw new Error(`Unable to determine period for ${record.localPath}`);
}

function parsePeriodFromWorkbookTitle(title: string): {
  year: number;
  month: number;
  periodKey: string;
} | null {
  const match = title.match(/(\d{4})\.\s*(\d{1,2})\./);
  if (!match?.[1] || !match[2]) {
    return null;
  }

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  return {
    year,
    month,
    periodKey: `${year}-${String(month).padStart(2, "0")}`,
  };
}

function findPrimarySheet(workbook: XLSX.WorkBook): XLSX.WorkSheet {
  const sheetName =
    workbook.SheetNames.find((name) => {
      const sheet = workbook.Sheets[name];
      if (!sheet) {
        return false;
      }
      return [sheet.A1?.v, sheet.B1?.v, sheet.C1?.v]
        .map(normalizeText)
        .some((value) => value.includes("입국자"));
    }) ?? workbook.SheetNames[0];

  const sheet = sheetName ? workbook.Sheets[sheetName] : undefined;
  if (!sheet) {
    throw new Error("Workbook does not contain a readable primary sheet.");
  }

  return sheet;
}

function sheetToMatrix(sheet: XLSX.WorkSheet): SheetMatrix {
  const matrix = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    defval: null,
    raw: true,
    blankrows: false,
  });

  return matrix
    .map((row) => {
      let end = row.length;
      while (end > 0) {
        const cell = row[end - 1];
        if (cell !== null && normalizeText(cell).length > 0) {
          break;
        }
        end -= 1;
      }
      return row.slice(0, end);
    })
    .filter((row) =>
      row.some((cell) => cell !== null && normalizeText(cell).length > 0),
    );
}

function isTargetWorkbookTitle(value: string): boolean {
  return value.includes("입국자");
}

function findWorkbookTitle(matrix: SheetMatrix): string {
  for (const row of matrix.slice(0, 3)) {
    for (const cell of row) {
      const value = normalizeText(cell);
      if (value.includes("입국자")) {
        return value;
      }
    }
  }

  return normalizeText(matrix[0]?.find((cell) => normalizeText(cell).length > 0));
}

function findHeaderRowIndex(matrix: SheetMatrix): number {
  const headerIndex = matrix.findIndex((row) => {
    const compactRow = row.map((cell) => compactText(normalizeText(cell)));
    const visaCodeCount = SHORT_TERM_CODE_CANDIDATES.filter((code) =>
      compactRow.some((cell) => normalizeVisaHeader(cell).includes(code)),
    ).length;

    return (
      compactRow.some((cell) =>
        ["국적", "국적명", "국적지역"].includes(cell),
      ) &&
      compactRow.includes("성별") &&
      visaCodeCount >= 3
    );
  });

  if (headerIndex === -1) {
    throw new Error("Unable to locate dashboard workbook header row.");
  }

  return headerIndex;
}

function mapGender(value: string): "total" | "male" | "female" | null {
  const compact = compactText(value);
  if (compact === "총계" || compact === "총합계" || compact === "T" || compact === "계") {
    return "total";
  }
  if (compact === "남성" || compact === "M" || compact === "남") {
    return "male";
  }
  if (compact === "여성" || compact === "F" || compact === "여") {
    return "female";
  }
  return null;
}

function findColumnIndex(
  header: string[],
  predicate: (value: string) => boolean,
): number {
  const index = header.findIndex(predicate);
  if (index === -1) {
    throw new Error("Required column not found in dashboard workbook.");
  }
  return index;
}

function findVisaGroupColumnIndexes(header: string[], targetCode: string): number[] {
  const indexedCodes = header.map((value, index) => ({
    index,
    code: extractVisaCode(value),
    normalizedHeader: normalizeVisaHeader(value),
  }));
  const exactIndexes = indexedCodes
    .filter(
      (entry) =>
        entry.code === targetCode || entry.normalizedHeader === targetCode,
    )
    .map((entry) => entry.index);

  if (exactIndexes.length > 0) {
    return [exactIndexes[0]!];
  }

  return indexedCodes
    .filter((entry) => entry.code?.startsWith(targetCode) && entry.code !== targetCode)
    .map((entry) => entry.index);
}

function createShortTermColumnIndexes(header: string[]): number[] {
  const indexes = SHORT_TERM_CODE_CANDIDATES.flatMap((code) =>
    findVisaGroupColumnIndexes(header, code),
  );

  if (indexes.length === 0) {
    throw new Error("Unable to locate short-term visa columns in dashboard workbook.");
  }

  return [...new Set(indexes)];
}

function createB2ColumnIndexes(header: string[]): number[] {
  const indexes = findVisaGroupColumnIndexes(header, "B2");
  if (indexes.length === 0) {
    throw new Error("Required B2 column not found in dashboard workbook.");
  }
  return indexes;
}

function createB1ColumnIndexes(header: string[]): number[] {
  const indexes = findVisaGroupColumnIndexes(header, "B1");
  if (indexes.length === 0) {
    throw new Error("Required B1 column not found in dashboard workbook.");
  }
  return indexes;
}

function findTotalPopulationColumnIndex(header: string[]): number {
  const index = header.findIndex(
    (value) => {
      const compact = compactText(value);
      return compact === "총계" || compact === "총합계" || compact === "소계";
    },
  );
  if (index === -1) {
    throw new Error("Required total population column not found.");
  }
  return index;
}

function toNumber(value: string | number | null): number {
  if (value === null || value === "") {
    return 0;
  }
  if (typeof value === "number") {
    return value;
  }
  const parsed = Number.parseFloat(value.replace(/,/g, "").trim());
  return Number.isNaN(parsed) ? 0 : parsed;
}

function splitMultilineCell(value: string | number | null): string[] {
  if (value === null || value === undefined) {
    return [];
  }

  const text = String(value)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();

  if (!text.includes("\n")) {
    return [text];
  }

  return text
    .split("\n")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function expandRawRow(
  rawRow: Array<string | number | null>,
  indexes: {
    genderIndex: number;
    countryIndex: number;
    continentIndex: number;
    numericIndexes: number[];
  },
): Array<Array<string | number | null>> {
  const genderParts = splitMultilineCell(rawRow[indexes.genderIndex] ?? null);
  const splitCount = genderParts.length;

  if (splitCount <= 1) {
    return [rawRow];
  }

  return Array.from({ length: splitCount }, (_, partIndex) =>
    rawRow.map((cell, columnIndex) => {
      const parts = splitMultilineCell(cell ?? null);

      if (columnIndex === indexes.countryIndex || columnIndex === indexes.continentIndex) {
        return parts[0] ?? cell;
      }

      if (columnIndex === indexes.genderIndex) {
        return parts[partIndex] ?? parts[0] ?? cell;
      }

      if (indexes.numericIndexes.includes(columnIndex)) {
        return parts[partIndex] ?? parts[0] ?? cell;
      }

      return parts[0] ?? cell;
    }),
  );
}

function inspectDashboardWorkbookContext(
  record: DownloadRecord,
): {
  matrix: SheetMatrix;
  title: string;
  recordPeriod: {
    year: number;
    month: number;
    periodKey: string;
  };
  inspection: DashboardWorkbookInspectionContext;
} | null {
  const workbook = XLSX.readFile(record.localPath, {
    cellDates: false,
    dense: true,
  });
  const sheet = findPrimarySheet(workbook);
  const matrix = sheetToMatrix(sheet);
  const title = findWorkbookTitle(matrix);

  if (!isTargetWorkbookTitle(title)) {
    return null;
  }

  const headerRowIndex = findHeaderRowIndex(matrix);
  const header = matrix[headerRowIndex]?.map(normalizeText) ?? [];
  const genderIndex = findColumnIndex(header, (value) => compactText(value) === "성별");
  const countryIndex = findColumnIndex(
    header,
    (value) => ["국적", "국적명", "국적지역"].includes(compactText(value)),
  );
  const continentIndex = header.findIndex((value) => value === "대륙");
  const totalPopulationIndex = findTotalPopulationColumnIndex(header);
  const shortTermIndexes = createShortTermColumnIndexes(header);

  return {
    matrix,
    title,
    recordPeriod: parsePeriod(record),
    inspection: {
      header,
      headerRowIndex,
      countryIndex,
      genderIndex,
      continentIndex,
      totalPopulationIndex,
      shortTermIndexes,
    },
  };
}

export function inspectDashboardWorkbookFormat(
  record: DownloadRecord,
): DashboardWorkbookFormatSignature | null {
  const context = inspectDashboardWorkbookContext(record);
  if (!context) {
    return null;
  }

  const { inspection } = context;
  const shortTermColumnLabels = inspection.shortTermIndexes.map(
    (index) => inspection.header[index] ?? "",
  );
  const compactHeaderLabels = inspection.header.map((value) => compactText(value));

  return {
    signatureKey: [
      `header-row:${inspection.headerRowIndex}`,
      `continent:${inspection.continentIndex >= 0 ? "yes" : "no"}`,
      `country:${compactText(inspection.header[inspection.countryIndex] ?? "")}`,
      `gender:${compactText(inspection.header[inspection.genderIndex] ?? "")}`,
      `total:${compactText(inspection.header[inspection.totalPopulationIndex] ?? "")}`,
      `short-term:${shortTermColumnLabels.map((value) => normalizeVisaHeader(value)).join(",")}`,
      `headers:${compactHeaderLabels.join("|")}`,
    ].join("::"),
    headerRowIndex: inspection.headerRowIndex,
    hasContinentColumn: inspection.continentIndex >= 0,
    countryColumnLabel: inspection.header[inspection.countryIndex] ?? "",
    genderColumnLabel: inspection.header[inspection.genderIndex] ?? "",
    totalPopulationColumnLabel: inspection.header[inspection.totalPopulationIndex] ?? "",
    shortTermColumnLabels,
    headerLabels: inspection.header,
  };
}

export function parseDashboardWorkbook(
  record: DownloadRecord,
): ParsedDashboardWorkbook | null {
  const context = inspectDashboardWorkbookContext(record);
  if (!context) {
    return null;
  }
  const { matrix, title, recordPeriod, inspection } = context;
  const workbookPeriod = parsePeriodFromWorkbookTitle(title);
  const {
    headerRowIndex,
    header,
    genderIndex,
    countryIndex,
    continentIndex,
    totalPopulationIndex,
    shortTermIndexes,
  } = inspection;
  const b1Indexes = createB1ColumnIndexes(header);
  const b2Indexes = createB2ColumnIndexes(header);

  const rows: ParsedDashboardWorkbookRow[] = [];
  const genderTotals = {
    total: createShortTermBucket(),
    male: createShortTermBucket(),
    female: createShortTermBucket(),
  };
  const monthlyTotals = createShortTermBucket();
  let currentCountryName = "";
  let currentContinentName = "";
  let hasGenderBreakdown = false;

  for (const rawRow of matrix.slice(headerRowIndex + 1)) {
    const expandedRows = expandRawRow(rawRow, {
      genderIndex,
      countryIndex,
      continentIndex,
      numericIndexes: [1, 3, ...shortTermIndexes],
    });

    for (const expandedRow of expandedRows) {
      const rawCountryName = normalizeCountryName(normalizeText(expandedRow[countryIndex]));
      const gender = mapGender(normalizeText(expandedRow[genderIndex]));
      const rowContinentName =
        continentIndex >= 0 ? normalizeText(expandedRow[continentIndex]) : "";

      if (rawCountryName) {
        currentCountryName = rawCountryName;
      }
      if (rowContinentName) {
        currentContinentName = rowContinentName;
      }

      const countryName =
        rawCountryName || (gender === "total" ? "" : currentCountryName);
      const continentName =
        rowContinentName || (gender === "total" ? "" : currentContinentName);

      if (!countryName && !gender) {
        continue;
      }
      if (!gender) {
        continue;
      }
      if (gender === "male" || gender === "female") {
        hasGenderBreakdown = true;
      }

      const shortTermVisitorsTotal = shortTermIndexes.reduce(
        (sum, index) => sum + toNumber(expandedRow[index] ?? null),
        0,
      );
      const b1ShortTermVisitorsTotal = b1Indexes.reduce(
        (sum, index) => sum + toNumber(expandedRow[index] ?? null),
        0,
      );
      const b2ShortTermVisitorsTotal = b2Indexes.reduce(
        (sum, index) => sum + toNumber(expandedRow[index] ?? null),
        0,
      );
      const nonB1B2ShortTermVisitorsTotal = Math.max(
        shortTermVisitorsTotal - b1ShortTermVisitorsTotal - b2ShortTermVisitorsTotal,
        0,
      );
      const totalPopulationCount = toNumber(expandedRow[totalPopulationIndex] ?? null);

      if (shortTermVisitorsTotal <= 0 && totalPopulationCount <= 0) {
        continue;
      }

      const compactCountryName = countryName.replace(/\s+/g, "");
      const isGlobalSummary =
        (!countryName && gender === "total") ||
        compactCountryName.includes("총합계") ||
        compactCountryName === "총계" ||
        (compactCountryName.includes("총계") &&
          (!continentName ||
            continentName.includes("총합계") ||
            continentName.includes("총계")));
      const isRegionalSummary =
        /(?:주|지역)계$/.test(compactCountryName) ||
        (compactCountryName.includes("총계") &&
          Boolean(continentName) &&
          !continentName.includes("총합계") &&
          !continentName.includes("총계"));

      if (isGlobalSummary || isRegionalSummary) {
        if (isGlobalSummary && gender === "total") {
          if (monthlyTotals.total === 0) {
            monthlyTotals.total = shortTermVisitorsTotal;
            monthlyTotals.b1 = b1ShortTermVisitorsTotal;
            monthlyTotals.b2 = b2ShortTermVisitorsTotal;
            monthlyTotals.nonB1B2 = nonB1B2ShortTermVisitorsTotal;
          }
        } else if (isGlobalSummary && genderTotals[gender].total === 0) {
          genderTotals[gender].total = shortTermVisitorsTotal;
          genderTotals[gender].b1 = b1ShortTermVisitorsTotal;
          genderTotals[gender].b2 = b2ShortTermVisitorsTotal;
          genderTotals[gender].nonB1B2 = nonB1B2ShortTermVisitorsTotal;
        }
        continue;
      }

      rows.push({
        continentName: continentName || null,
        countryName,
        gender,
        totalPopulationCount,
        shortTermVisitorsTotal,
        b1ShortTermVisitorsTotal,
        b2ShortTermVisitorsTotal,
        nonB1B2ShortTermVisitorsTotal,
      });
    }
  }

  if (genderTotals.male.total === 0 || genderTotals.female.total === 0) {
    for (const row of rows) {
      if (row.gender === "male") {
        genderTotals.male.total += row.shortTermVisitorsTotal;
        genderTotals.male.b1 += row.b1ShortTermVisitorsTotal;
        genderTotals.male.b2 += row.b2ShortTermVisitorsTotal;
        genderTotals.male.nonB1B2 += row.nonB1B2ShortTermVisitorsTotal;
      }
      if (row.gender === "female") {
        genderTotals.female.total += row.shortTermVisitorsTotal;
        genderTotals.female.b1 += row.b1ShortTermVisitorsTotal;
        genderTotals.female.b2 += row.b2ShortTermVisitorsTotal;
        genderTotals.female.nonB1B2 += row.nonB1B2ShortTermVisitorsTotal;
      }
    }
  }

  return {
    source: record,
    period: recordPeriod,
    rows,
    monthlyTotals,
    genderTotals,
    hasGenderBreakdown,
  };
}
