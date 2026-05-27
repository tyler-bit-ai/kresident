import fs from "node:fs/promises";
import path from "node:path";

import type {
  DashboardDataset,
  DetailTableRow,
  MonthlyTrendPoint,
} from "../../domain/dashboard";
import type {
  DashboardWorkbookFormatSignature,
  RawDashboardVerificationCase,
  RawDashboardVerificationIssue,
  RawDashboardVerificationReport,
} from "../../domain/dashboard-verification";
import type { AppConfig } from "../../domain/types";
import { createDetailRows, createMonthlyTrendPoint } from "./build-dashboard-dataset";
import { listDashboardSourceRecords } from "./dashboard-source-records";
import {
  inspectDashboardWorkbookFormat,
  parseDashboardWorkbook,
} from "../../infrastructure/excel/dashboard-workbook-reader";

const MIN_INCLUDED_PERIOD_KEY = "2015-01";
const DETAIL_VALUE_KEYS: Array<keyof DetailTableRow> = [
  "shortTermVisitorsTotal",
  "b2ShortTermVisitorsTotal",
  "nonB1B2ShortTermVisitorsTotal",
  "totalPopulationCount",
  "maleShortTermVisitors",
  "femaleShortTermVisitors",
  "maleB2ShortTermVisitors",
  "femaleB2ShortTermVisitors",
  "maleNonB1B2ShortTermVisitors",
  "femaleNonB1B2ShortTermVisitors",
];

function normalizeLocalPath(value: string): string {
  return path.normalize(value).toLowerCase();
}

function compareNumberLike(
  expected: number | null | undefined,
  actual: number | null | undefined,
): boolean {
  return (expected ?? null) === (actual ?? null);
}

function createIssueDefaults(normalizedCountryKey?: string): Pick<
  RawDashboardVerificationIssue,
  "likelyCause" | "suggestedTouchpoints"
> {
  if (normalizedCountryKey === "기타") {
    return {
      likelyCause: "`기타` 국가군 대륙 정책 또는 국가군 정규화 규칙 불일치 가능성",
      suggestedTouchpoints: [
        "src/application/dashboard/country-normalization.ts",
        "src/application/dashboard/build-dashboard-dataset.ts",
      ],
    };
  }

  return {
    likelyCause: "국가군 alias 정규화 또는 workbook header 해석 차이 가능성",
    suggestedTouchpoints: [
      "src/application/dashboard/country-normalization.ts",
      "src/infrastructure/excel/dashboard-workbook-reader.ts",
      "src/application/dashboard/build-dashboard-dataset.ts",
    ],
  };
}

async function readDashboardDataset(datasetPath: string): Promise<DashboardDataset> {
  const content = await fs.readFile(datasetPath, "utf8");
  return JSON.parse(content) as DashboardDataset;
}

function selectRepresentativeCases(
  items: Array<{
    periodKey: string;
    formatSignature: DashboardWorkbookFormatSignature;
    localPath: string;
  }>,
): typeof items {
  const sorted = [...items].sort((left, right) => {
    const periodCompare = left.periodKey.localeCompare(right.periodKey);
    if (periodCompare !== 0) {
      return periodCompare;
    }
    return left.localPath.localeCompare(right.localPath);
  });

  const representatives = new Map<string, (typeof items)[number]>();
  for (const item of sorted) {
    if (!representatives.has(item.formatSignature.signatureKey)) {
      representatives.set(item.formatSignature.signatureKey, item);
    }
  }

  return [...representatives.values()];
}

function findMonthlyTrendPoint(
  dataset: DashboardDataset,
  periodKey: string,
  localPathValue: string,
): MonthlyTrendPoint | undefined {
  const normalizedPath = normalizeLocalPath(localPathValue);
  return (
    dataset.monthlyTrend.find(
      (row) =>
        row.periodKey === periodKey &&
        normalizeLocalPath(row.sourceFile.localPath) === normalizedPath,
    ) ?? dataset.monthlyTrend.find((row) => row.periodKey === periodKey)
  );
}

function findDetailRows(
  dataset: DashboardDataset,
  periodKey: string,
  localPathValue: string,
): DetailTableRow[] {
  const normalizedPath = normalizeLocalPath(localPathValue);
  const exactRows = dataset.detailTable.filter(
    (row) =>
      row.periodKey === periodKey &&
      normalizeLocalPath(row.sourceFile.localPath) === normalizedPath,
  );
  if (exactRows.length > 0) {
    return exactRows;
  }
  return dataset.detailTable.filter((row) => row.periodKey === periodKey);
}

function compareVerificationCase(
  dataset: DashboardDataset,
  expectedMonthlyTrend: MonthlyTrendPoint,
  expectedDetailRows: DetailTableRow[],
  formatSignature: DashboardWorkbookFormatSignature,
): RawDashboardVerificationCase {
  const issues: RawDashboardVerificationIssue[] = [];
  const actualMonthlyTrend = findMonthlyTrendPoint(
    dataset,
    expectedMonthlyTrend.periodKey,
    expectedMonthlyTrend.sourceFile.localPath,
  );

  if (!actualMonthlyTrend) {
    issues.push({
      code: "missing_monthly_trend",
      message: `대시보드 monthlyTrend에 ${expectedMonthlyTrend.periodKey} 행이 없습니다.`,
      likelyCause: "월별 trend 집계 누락 또는 source file 매핑 불일치 가능성",
      suggestedTouchpoints: ["src/application/dashboard/build-dashboard-dataset.ts"],
    });
  } else {
    for (const key of [
      "shortTermVisitorsTotal",
      "b2ShortTermVisitorsTotal",
      "nonB1B2ShortTermVisitorsTotal",
    ] as const) {
      if (!compareNumberLike(expectedMonthlyTrend[key], actualMonthlyTrend[key])) {
        issues.push({
          code: "monthly_total_mismatch",
          message: `${expectedMonthlyTrend.periodKey} monthlyTrend의 ${key} 값이 다릅니다.`,
          metric: key,
          expected: expectedMonthlyTrend[key],
          actual: actualMonthlyTrend[key],
          likelyCause: "월별 합계 계산 또는 summary row 인식 차이 가능성",
          suggestedTouchpoints: [
            "src/infrastructure/excel/dashboard-workbook-reader.ts",
            "src/application/dashboard/build-dashboard-dataset.ts",
          ],
        });
      }
    }
  }

  const actualDetailRows = findDetailRows(
    dataset,
    expectedMonthlyTrend.periodKey,
    expectedMonthlyTrend.sourceFile.localPath,
  );
  const expectedMap = new Map(
    expectedDetailRows.map((row) => [row.normalizedCountryKey, row] as const),
  );
  const actualMap = new Map(
    actualDetailRows.map((row) => [row.normalizedCountryKey, row] as const),
  );

  for (const [normalizedCountryKey, expectedRow] of expectedMap.entries()) {
    const actualRow = actualMap.get(normalizedCountryKey);
    if (!actualRow) {
      issues.push({
        code: "missing_detail_row",
        message: `${expectedMonthlyTrend.periodKey} 대시보드 detailTable에 ${normalizedCountryKey} 행이 없습니다.`,
        normalizedCountryKey,
        ...createIssueDefaults(normalizedCountryKey),
      });
      continue;
    }

    if (expectedRow.continentName !== actualRow.continentName) {
      issues.push({
        code: "detail_continent_mismatch",
        message: `${expectedMonthlyTrend.periodKey} ${normalizedCountryKey}의 continentName 값이 다릅니다.`,
        normalizedCountryKey,
        metric: "continentName",
        expected: expectedRow.continentName,
        actual: actualRow.continentName,
        ...createIssueDefaults(normalizedCountryKey),
      });
    }

    for (const key of DETAIL_VALUE_KEYS) {
      if (!compareNumberLike(expectedRow[key] as number | null, actualRow[key] as number | null)) {
        issues.push({
          code: "detail_value_mismatch",
          message: `${expectedMonthlyTrend.periodKey} ${normalizedCountryKey}의 ${key} 값이 다릅니다.`,
          normalizedCountryKey,
          metric: key,
          expected: expectedRow[key] as number | null,
          actual: actualRow[key] as number | null,
          ...createIssueDefaults(normalizedCountryKey),
        });
      }
    }
  }

  for (const normalizedCountryKey of actualMap.keys()) {
    if (!expectedMap.has(normalizedCountryKey)) {
      issues.push({
        code: "unexpected_detail_row",
        message: `${expectedMonthlyTrend.periodKey} 대시보드 detailTable에 예상하지 못한 ${normalizedCountryKey} 행이 있습니다.`,
        normalizedCountryKey,
        ...createIssueDefaults(normalizedCountryKey),
      });
    }
  }

  return {
    periodKey: expectedMonthlyTrend.periodKey,
    sourceFile: expectedMonthlyTrend.sourceFile,
    formatSignature,
    issueCount: issues.length,
    passed: issues.length === 0,
    monthlyTrendVerified: Boolean(actualMonthlyTrend),
    detailRowCount: {
      expected: expectedDetailRows.length,
      actual: actualDetailRows.length,
    },
    issues,
  };
}

export async function verifyDashboardRawData(
  config: AppConfig,
): Promise<RawDashboardVerificationReport> {
  const datasetPath = path.join(process.cwd(), "site", "data", "dashboard_data.json");
  const dataset = await readDashboardDataset(datasetPath);
  const sourceRecords = await listDashboardSourceRecords(config);

  const inspectionItems = sourceRecords.flatMap((record) => {
    try {
      const formatSignature = inspectDashboardWorkbookFormat(record);
      const workbook = parseDashboardWorkbook(record);
      if (!formatSignature || !workbook) {
        return [];
      }
      if (workbook.period.periodKey < MIN_INCLUDED_PERIOD_KEY) {
        return [];
      }
      return [
        {
          periodKey: workbook.period.periodKey,
          formatSignature,
          localPath: record.localPath,
        },
      ];
    } catch {
      return [];
    }
  });
  const representativeItems = selectRepresentativeCases(inspectionItems);

  const cases: RawDashboardVerificationCase[] = [];
  for (const representative of representativeItems) {
    const workbookRecord = sourceRecords.find(
      (record) => normalizeLocalPath(record.localPath) === normalizeLocalPath(representative.localPath),
    );
    if (!workbookRecord) {
      continue;
    }

    const workbook = parseDashboardWorkbook(workbookRecord);
    if (!workbook) {
      continue;
    }

    const verificationCase = compareVerificationCase(
      dataset,
      createMonthlyTrendPoint(workbook),
      createDetailRows(workbook),
      representative.formatSignature,
    );
    cases.push(verificationCase);
  }

  const reportPath = path.join(config.logDir, "dashboard-raw-verification.json");
  await fs.mkdir(path.dirname(reportPath), { recursive: true });

  const report: RawDashboardVerificationReport = {
    generatedAt: new Date().toISOString(),
    representativeCaseCount: cases.length,
    formatGroupCount: representativeItems.length,
    passedCaseCount: cases.filter((item) => item.passed).length,
    failedCaseCount: cases.filter((item) => !item.passed).length,
    reportPath,
    cases,
  };

  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return report;
}
