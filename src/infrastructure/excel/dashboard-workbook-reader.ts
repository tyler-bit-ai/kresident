import path from "node:path";

import * as XLSX from "xlsx";

import type { DownloadRecord } from "../../domain/download";

export interface ParsedDashboardWorkbookRow {
  continentName: string | null;
  countryName: string;
  gender: "total" | "male" | "female";
  totalPopulationCount: number;
  shortTermVisitorsTotal: number;
}

export interface ParsedDashboardWorkbook {
  source: DownloadRecord;
  period: {
    year: number;
    month: number;
    periodKey: string;
  };
  rows: ParsedDashboardWorkbookRow[];
  monthlyTotal: number;
  genderTotals: {
    total: number;
    male: number;
    female: number;
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

function normalizeVisaHeader(value: string): string {
  return value.toUpperCase().replace(/[\s()-]/g, "");
}

function parsePeriod(record: DownloadRecord): {
  year: number;
  month: number;
  periodKey: string;
} {
  const titleMatch = record.articleTitle.match(/(\d{4})년\s*(\d{1,2})월/);
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

function findPrimarySheet(workbook: XLSX.WorkBook): XLSX.WorkSheet {
  const sheetName =
    workbook.SheetNames.find((name) => {
      const sheet = workbook.Sheets[name];
      if (!sheet) {
        return false;
      }
      return normalizeText(sheet.A1?.v).includes("체류외국인");
    }) ?? workbook.SheetNames[0];

  const sheet = sheetName ? workbook.Sheets[sheetName] : undefined;
  if (!sheet) {
    throw new Error("Workbook does not contain a readable primary sheet.");
  }

  return sheet;
}

function sheetToMatrix(sheet: XLSX.WorkSheet): SheetMatrix {
  return XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    defval: null,
    raw: true,
  });
}

function isTargetWorkbookTitle(value: string): boolean {
  return value.includes("체류외국인") || value.includes("장단기체류외국인");
}

function findHeaderRowIndex(matrix: SheetMatrix): number {
  const headerIndex = matrix.findIndex((row) => {
    const normalizedRow = row.map(normalizeText);
    const normalizedVisaHeaders = normalizedRow.map(normalizeVisaHeader);
    return (
      normalizedRow.some(
        (cell) => cell === "국적" || cell === "국적명" || cell === "국적∙지역",
      ) &&
      normalizedVisaHeaders.some((cell) => cell.includes("B1")) &&
      normalizedVisaHeaders.some((cell) => cell.includes("C3")) &&
      normalizedVisaHeaders.some((cell) => cell.includes("C4"))
    );
  });

  if (headerIndex === -1) {
    throw new Error("Unable to locate dashboard workbook header row.");
  }

  return headerIndex;
}

function mapGender(value: string): "total" | "male" | "female" | null {
  if (value === "총계" || value === "(T)" || value === "총합계") {
    return "total";
  }
  if (value === "남성" || value === "(M)") {
    return "male";
  }
  if (value === "여성" || value === "(F)") {
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

function createShortTermColumnIndexes(header: string[]): number[] {
  return SHORT_TERM_CODE_CANDIDATES.map((code) =>
    findColumnIndex(header, (value) => normalizeVisaHeader(value).includes(code)),
  );
}

function findTotalPopulationColumnIndex(header: string[]): number {
  const index = header.findIndex(
    (value) => value === "총계" || value === "총합계",
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

export function parseDashboardWorkbook(
  record: DownloadRecord,
): ParsedDashboardWorkbook | null {
  const workbook = XLSX.readFile(record.localPath, { cellDates: false });
  const sheet = findPrimarySheet(workbook);
  const matrix = sheetToMatrix(sheet);
  const title = normalizeText(matrix[0]?.[0]);

  if (!isTargetWorkbookTitle(title)) {
    return null;
  }

  const headerRowIndex = findHeaderRowIndex(matrix);
  const header = matrix[headerRowIndex]?.map(normalizeText) ?? [];
  const genderIndex = findColumnIndex(header, (value) => value === "성별");
  const countryIndex = findColumnIndex(
    header,
    (value) => value === "국적" || value === "국적명" || value === "국적∙지역",
  );
  const continentIndex = header.findIndex((value) => value === "대륙");
  const totalPopulationIndex = findTotalPopulationColumnIndex(header);
  const shortTermIndexes = createShortTermColumnIndexes(header);

  const rows: ParsedDashboardWorkbookRow[] = [];
  const genderTotals = { total: 0, male: 0, female: 0 };
  let monthlyTotal = 0;

  for (const rawRow of matrix.slice(headerRowIndex + 1)) {
    const expandedRows = expandRawRow(rawRow, {
      genderIndex,
      countryIndex,
      continentIndex,
      numericIndexes: [1, 3, ...shortTermIndexes],
    });

    for (const expandedRow of expandedRows) {
      const countryName = normalizeCountryName(
        normalizeText(expandedRow[countryIndex]),
      );
      const gender = mapGender(normalizeText(expandedRow[genderIndex]));

      if (!countryName || !gender) {
        continue;
      }

      const shortTermVisitorsTotal = shortTermIndexes.reduce(
        (sum, index) => sum + toNumber(expandedRow[index] ?? null),
        0,
      );
      const totalPopulationCount = toNumber(expandedRow[totalPopulationIndex] ?? null);

      if (shortTermVisitorsTotal <= 0 && totalPopulationCount <= 0) {
        continue;
      }

      const continentName =
        continentIndex >= 0 ? normalizeText(expandedRow[continentIndex]) : "";
      const isGlobalSummary =
        countryName.includes("총합계") ||
        (countryName.includes("총계") &&
          (!continentName ||
            continentName.includes("총합계") ||
            continentName.includes("총계")));
      const isRegionalSummary =
        countryName.includes("아시아주계") ||
        (countryName.includes("총계") &&
          Boolean(continentName) &&
          !continentName.includes("총합계") &&
          !continentName.includes("총계"));

      if (isGlobalSummary || isRegionalSummary) {
        if (isGlobalSummary && gender === "total") {
          monthlyTotal = shortTermVisitorsTotal;
        } else if (isGlobalSummary) {
          genderTotals[gender] = shortTermVisitorsTotal;
        }
        continue;
      }

      rows.push({
        continentName: continentName || null,
        countryName,
        gender,
        totalPopulationCount,
        shortTermVisitorsTotal,
      });
    }
  }

  if (genderTotals.male === 0 || genderTotals.female === 0) {
    for (const row of rows) {
      if (row.gender === "male") {
        genderTotals.male += row.shortTermVisitorsTotal;
      }
      if (row.gender === "female") {
        genderTotals.female += row.shortTermVisitorsTotal;
      }
    }
  }

  return {
    source: record,
    period: parsePeriod(record),
    rows,
    monthlyTotal,
    genderTotals,
  };
}
