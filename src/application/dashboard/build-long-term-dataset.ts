import fs from "node:fs/promises";
import path from "node:path";

import type {
  LongTermDataset,
  LongTermDetailRow,
  LongTermModeKey,
  LongTermMonthlyTrendPoint,
  LongTermReconciliationEntry,
  LongTermVisitModeDefinition,
  SourceFileReference,
} from "../../domain/dashboard";
import type { DownloadRecord } from "../../domain/download";
import type {
  LongTermBucket,
  ParsedDashboardWorkbook,
} from "../../infrastructure/excel/dashboard-workbook-reader";
import {
  getSupportedCountryGroups,
  normalizeCountryGroup,
} from "./country-normalization";

type Gender = "total" | "male" | "female";
type BucketKey = keyof LongTermBucket;

const BUCKET_KEYS: BucketKey[] = ["total", "d2", "d4", "f4", "other"];

const MODE_TO_BUCKET: Record<LongTermModeKey, BucketKey> = {
  all: "total",
  d2: "d2",
  d4: "d4",
  f4: "f4",
  other: "other",
};

const MODE_LABELS: Record<LongTermModeKey, { label: string; shortLabel: string }> = {
  all: { label: "전체", shortLabel: "전체" },
  d2: { label: "D2(유학)", shortLabel: "D2" },
  d4: { label: "D4(일반연수)", shortLabel: "D4" },
  f4: { label: "F4(재외동포)", shortLabel: "F4" },
  other: { label: "장기관광객(D2,D4,F4 제외)", shortLabel: "D2,D4,F4 제외" },
};

const LONG_TERM_VISA_CODES = [
  "D1~D10",
  "E1~E10",
  "F1~F6",
  "G1",
  "H1",
  "H2",
];

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

function getFieldNames(mode: LongTermModeKey): LongTermVisitModeDefinition["fields"] {
  const infix = mode === "all" ? "" : capitalize(mode);
  const prefix = mode === "all" ? "longTerm" : `${mode}LongTerm`;
  return {
    total: `${prefix}VisitorsTotal`,
    male: `male${infix}LongTermVisitors`,
    female: `female${infix}LongTermVisitors`,
    share: `${prefix}MonthlyShareRatio`,
    ratio: `${prefix}VisaRatio`,
  };
}

export const LONG_TERM_VISIT_MODES: LongTermVisitModeDefinition[] = (
  Object.keys(MODE_LABELS) as LongTermModeKey[]
).map((key) => ({
  key,
  ...MODE_LABELS[key],
  fields: getFieldNames(key),
}));

const emptyBucket = (): LongTermBucket => ({ total: 0, d2: 0, d4: 0, f4: 0, other: 0 });

function addBucket(target: LongTermBucket, source: LongTermBucket): void {
  for (const key of BUCKET_KEYS) {
    target[key] += source[key];
  }
}

/** 수동 소스는 절대경로/OS 구분자를 쓰므로 어느 PC에서 생성해도 같은 값이 되게 정규화한다. */
function toRepoRelativePosix(value: string): string {
  const relative = path.isAbsolute(value) ? path.relative(process.cwd(), value) : value;
  return relative.split(path.sep).join("/");
}

function createSourceFileReference(record: DownloadRecord): SourceFileReference {
  return {
    articleId: record.articleId,
    articleTitle: record.articleTitle.replace(/\\/g, "/"),
    publishedAt: record.publishedAt,
    localPath: toRepoRelativePosix(record.localPath),
  };
}

function createMonthlyTrendPoint(
  workbook: ParsedDashboardWorkbook,
): LongTermMonthlyTrendPoint {
  const point: LongTermMonthlyTrendPoint = {
    ...workbook.period,
    sourceFile: createSourceFileReference(workbook.source),
  };
  for (const mode of LONG_TERM_VISIT_MODES) {
    point[mode.fields.total] = workbook.longTermMonthlyTotals[MODE_TO_BUCKET[mode.key]];
  }
  return point;
}

interface CountryAccumulator {
  countryName: string;
  continentName: string | null;
  total: LongTermBucket;
  male: LongTermBucket;
  female: LongTermBucket;
  totalPopulationCount: number | null;
  hasExplicitTotalRow: boolean;
  fallbackTotalPopulationCount: number | null;
}

export function createLongTermDetailRows(
  workbook: ParsedDashboardWorkbook,
): LongTermDetailRow[] {
  const byCountry = new Map<string, CountryAccumulator>();

  for (const row of workbook.rows) {
    const countryKey = row.countryName.replace(/\s+/g, " ").trim();
    const current: CountryAccumulator = byCountry.get(countryKey) ?? {
      countryName: countryKey,
      continentName: row.continentName,
      total: emptyBucket(),
      male: emptyBucket(),
      female: emptyBucket(),
      totalPopulationCount: null,
      hasExplicitTotalRow: false,
      fallbackTotalPopulationCount: null,
    };

    if (!current.continentName && row.continentName) {
      current.continentName = row.continentName;
    }
    const gender: Gender = row.gender;
    if (gender === "total") {
      current.hasExplicitTotalRow = true;
      addBucket(current.total, row.longTerm);
      current.totalPopulationCount =
        (current.totalPopulationCount ?? 0) + row.totalPopulationCount;
    } else {
      current.fallbackTotalPopulationCount = Math.max(
        current.fallbackTotalPopulationCount ?? 0,
        row.totalPopulationCount,
      );
      addBucket(gender === "male" ? current.male : current.female, row.longTerm);
    }

    byCountry.set(countryKey, current);
  }

  interface GroupAccumulator {
    continentName: string | null;
    countryName: string;
    normalizedCountryLabel: string;
    total: LongTermBucket;
    male: LongTermBucket;
    female: LongTermBucket;
    totalPopulationCount: number | null;
  }
  const byCountryGroup = new Map<string, GroupAccumulator>();

  for (const value of byCountry.values()) {
    const derivedTotal = emptyBucket();
    for (const key of BUCKET_KEYS) {
      derivedTotal[key] = value.hasExplicitTotalRow
        ? value.total[key]
        : value.male[key] + value.female[key];
    }
    const totalPopulationCount =
      value.totalPopulationCount && value.totalPopulationCount > 0
        ? value.totalPopulationCount
        : value.fallbackTotalPopulationCount;

    const normalized = normalizeCountryGroup(value.countryName, "long");
    const isOtherCountryGroup = normalized.normalizedCountryKey === "기타";
    const current: GroupAccumulator = byCountryGroup.get(normalized.normalizedCountryKey) ?? {
      continentName: isOtherCountryGroup ? null : value.continentName,
      countryName: normalized.normalizedCountryKey,
      normalizedCountryLabel: normalized.normalizedCountryLabel,
      total: emptyBucket(),
      male: emptyBucket(),
      female: emptyBucket(),
      totalPopulationCount: null,
    };

    if (!isOtherCountryGroup && !current.continentName && value.continentName) {
      current.continentName = value.continentName;
    }
    addBucket(current.total, derivedTotal);
    addBucket(current.male, value.male);
    addBucket(current.female, value.female);
    current.totalPopulationCount =
      totalPopulationCount === null
        ? current.totalPopulationCount
        : (current.totalPopulationCount ?? 0) + totalPopulationCount;

    byCountryGroup.set(normalized.normalizedCountryKey, current);
  }

  return [...byCountryGroup.entries()]
    .filter(([, value]) => value.total.total > 0)
    .map(([normalizedCountryKey, value]) => {
      const row: LongTermDetailRow = {
        ...workbook.period,
        continentName: value.continentName,
        countryName: value.countryName,
        normalizedCountryKey,
        normalizedCountryLabel: value.normalizedCountryLabel,
        totalPopulationCount: value.totalPopulationCount,
        sourceFile: createSourceFileReference(workbook.source),
      };
      for (const mode of LONG_TERM_VISIT_MODES) {
        const bucket = MODE_TO_BUCKET[mode.key];
        const monthlyTotal = workbook.longTermMonthlyTotals[bucket];
        row[mode.fields.total] = value.total[bucket];
        row[mode.fields.male] = value.male[bucket];
        row[mode.fields.female] = value.female[bucket];
        row[mode.fields.share] = monthlyTotal > 0 ? value.total[bucket] / monthlyTotal : 0;
        row[mode.fields.ratio] =
          value.totalPopulationCount && value.totalPopulationCount > 0
            ? value.total[bucket] / value.totalPopulationCount
            : null;
      }
      return row;
    });
}

function createGenderShareRows(workbook: ParsedDashboardWorkbook) {
  return (["male", "female"] as const).map((gender) => {
    const row: Record<string, unknown> = { ...workbook.period, gender };
    for (const mode of LONG_TERM_VISIT_MODES) {
      const bucket = MODE_TO_BUCKET[mode.key];
      const monthlyTotal = workbook.longTermMonthlyTotals[bucket];
      row[mode.fields.total] = workbook.longTermGenderTotals[gender][bucket];
      row[`${mode.key}ShareRatio`] =
        monthlyTotal > 0 ? workbook.longTermGenderTotals[gender][bucket] / monthlyTotal : 0;
    }
    return row;
  });
}

function createReconciliationEntry(
  workbook: ParsedDashboardWorkbook,
): LongTermReconciliationEntry {
  const { grandTotal, shortTerm, longTerm, unclassified, crew } = workbook.reconciliation;
  return {
    periodKey: workbook.period.periodKey,
    grandTotal,
    shortTerm,
    longTerm,
    unclassified,
    crew,
    residual: grandTotal - shortTerm - longTerm - unclassified,
  };
}

/**
 * 원본 레이아웃별로 총합계가 승무원 열을 포함/제외/(기타에 중복 포함)하는 세 가지 변형이 있어
 * residual이 0, +crew, -crew 중 하나이면 정합으로 본다. 장기 열 누락·중복이면 이 셋 중 어느 것도 아니다.
 */
function isReconciled(entry: LongTermReconciliationEntry): boolean {
  return (
    entry.residual === 0 ||
    entry.residual === entry.crew ||
    entry.residual === -entry.crew
  );
}

export function buildLongTermDataset(input: {
  workbooks: ParsedDashboardWorkbook[];
  skippedSources: LongTermDataset["metadata"]["skippedSources"];
}): LongTermDataset {
  const { workbooks, skippedSources } = input;
  const monthlyTrend: LongTermMonthlyTrendPoint[] = [];
  const genderShares: Array<Record<string, unknown>> = [];
  const detailTable: LongTermDetailRow[] = [];
  const reconciliationEntries: LongTermReconciliationEntry[] = [];

  for (const workbook of workbooks) {
    monthlyTrend.push(createMonthlyTrendPoint(workbook));
    if (workbook.hasGenderBreakdown) {
      genderShares.push(...createGenderShareRows(workbook));
    }
    detailTable.push(...createLongTermDetailRows(workbook));
    reconciliationEntries.push(createReconciliationEntry(workbook));
  }

  monthlyTrend.sort((left, right) => left.periodKey.localeCompare(right.periodKey));
  genderShares.sort(
    (left, right) =>
      String(left.periodKey).localeCompare(String(right.periodKey)) ||
      String(left.gender).localeCompare(String(right.gender)),
  );
  detailTable.sort(
    (left, right) =>
      left.periodKey.localeCompare(right.periodKey) ||
      left.normalizedCountryKey.localeCompare(right.normalizedCountryKey),
  );
  reconciliationEntries.sort((left, right) => left.periodKey.localeCompare(right.periodKey));

  const totalField = LONG_TERM_VISIT_MODES[0]!.fields;
  const latestPeriodKey = monthlyTrend[monthlyTrend.length - 1]?.periodKey ?? "";
  const topCountryShares = detailTable
    .filter((row) => row.periodKey === latestPeriodKey)
    .sort(
      (left, right) =>
        Number(right[totalField.total] ?? 0) - Number(left[totalField.total] ?? 0),
    )
    .slice(0, 10)
    .map((row, index) => ({ rank: index + 1, ...row }));

  const mismatchedEntries = reconciliationEntries.filter((entry) => !isReconciled(entry));

  return {
    metadata: {
      generatedAt: new Date().toISOString(),
      sourceRecordCount: workbooks.length,
      skippedSourceRecordCount: skippedSources.length,
      supportedVisaCodes: LONG_TERM_VISA_CODES,
      defaultTopCountryBasis: "latest_month",
      supportedCountryGroups: getSupportedCountryGroups("long"),
      notes: [
        "2015.01 이후 기준 집계",
        "장기 입국자는 D1~D10, E1~E10, F1~F6, G1, H1, H2 체류자격 합계 (원본 '기타(others)' 열 제외)",
        "장기관광객(D2, D4, F4 제외)는 전체 장기 입국자에서 D2, D4, F4를 제외한 값",
        ...(skippedSources.length > 0 ? ["일부 원본 파일 제외"] : []),
      ],
      skippedSources,
      visitModes: LONG_TERM_VISIT_MODES,
      reconciliation: {
        checkedMonths: reconciliationEntries.length,
        mismatchedMonths: mismatchedEntries.length,
        entries: mismatchedEntries,
      },
    },
    monthlyTrend,
    topCountryShares,
    genderShares,
    detailTable,
  };
}

export async function writeLongTermDataset(dataset: LongTermDataset): Promise<string> {
  const outputPath = path.join(process.cwd(), "site", "data", "long_term_data.json");
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(dataset, null, 2)}\n`, "utf8");
  return outputPath;
}
