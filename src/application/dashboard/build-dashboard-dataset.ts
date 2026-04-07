import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import type {
  CountryShareRow,
  DashboardDataset,
  DetailTableRow,
  GenderShareRow,
  MonthlyTrendPoint,
  SourceFileReference,
} from "../../domain/dashboard";
import type { DownloadRecord } from "../../domain/download";
import type { AppConfig } from "../../domain/types";
import {
  getSupportedCountryGroups,
  normalizeCountryGroup,
} from "./country-normalization";
import type { ParsedDashboardWorkbook } from "../../infrastructure/excel/dashboard-workbook-reader";
import { listDashboardSourceRecords } from "./dashboard-source-records";

const execFileAsync = promisify(execFile);
const MIN_INCLUDED_PERIOD_KEY = "2015-01";

export function createSourceFileReference(record: DownloadRecord): SourceFileReference {
  return {
    articleId: record.articleId,
    articleTitle: record.articleTitle,
    publishedAt: record.publishedAt,
    localPath: record.localPath,
  };
}

export function createMonthlyTrendPoint(
  workbook: ParsedDashboardWorkbook,
): MonthlyTrendPoint {
  return {
    ...workbook.period,
    shortTermVisitorsTotal: workbook.monthlyTotals.total,
    b1ShortTermVisitorsTotal: workbook.monthlyTotals.b1,
    b2ShortTermVisitorsTotal: workbook.monthlyTotals.b2,
    nonB1B2ShortTermVisitorsTotal: workbook.monthlyTotals.nonB1B2,
    sourceFile: createSourceFileReference(workbook.source),
  };
}

export function createDetailRows(
  workbook: ParsedDashboardWorkbook,
): DetailTableRow[] {
  const byCountry = new Map<
    string,
    {
      countryName: string;
      continentName: string | null;
      shortTermVisitorsTotal: number;
      b1ShortTermVisitorsTotal: number;
      b2ShortTermVisitorsTotal: number;
      nonB1B2ShortTermVisitorsTotal: number;
      totalPopulationCount: number | null;
      male: number | null;
      female: number | null;
      maleB1: number | null;
      femaleB1: number | null;
      maleB2: number | null;
      femaleB2: number | null;
      maleNonB1B2: number | null;
      femaleNonB1B2: number | null;
      hasExplicitTotalRow: boolean;
      fallbackTotalPopulationCount: number | null;
    }
  >();

  for (const row of workbook.rows) {
    const normalized = normalizeCountryGroup(row.countryName);
    const countryKey = row.countryName.replace(/\s+/g, " ").trim();
    const current = byCountry.get(countryKey) ?? {
      countryName: countryKey,
      continentName: row.continentName,
      shortTermVisitorsTotal: 0,
      b1ShortTermVisitorsTotal: 0,
      b2ShortTermVisitorsTotal: 0,
      nonB1B2ShortTermVisitorsTotal: 0,
      totalPopulationCount: null,
      male: null,
      female: null,
      maleB1: null,
      femaleB1: null,
      maleB2: null,
      femaleB2: null,
      maleNonB1B2: null,
      femaleNonB1B2: null,
      hasExplicitTotalRow: false,
      fallbackTotalPopulationCount: null,
    };

    if (!current.continentName && row.continentName) {
      current.continentName = row.continentName;
    }
    if (row.gender === "total") {
      current.hasExplicitTotalRow = true;
      current.shortTermVisitorsTotal += row.shortTermVisitorsTotal;
      current.b1ShortTermVisitorsTotal += row.b1ShortTermVisitorsTotal;
      current.b2ShortTermVisitorsTotal += row.b2ShortTermVisitorsTotal;
      current.nonB1B2ShortTermVisitorsTotal += row.nonB1B2ShortTermVisitorsTotal;
      current.totalPopulationCount =
        (current.totalPopulationCount ?? 0) + row.totalPopulationCount;
    }
    if (row.gender === "male") {
      current.fallbackTotalPopulationCount = Math.max(
        current.fallbackTotalPopulationCount ?? 0,
        row.totalPopulationCount,
      );
      current.male = (current.male ?? 0) + row.shortTermVisitorsTotal;
      current.maleB1 = (current.maleB1 ?? 0) + row.b1ShortTermVisitorsTotal;
      current.maleB2 = (current.maleB2 ?? 0) + row.b2ShortTermVisitorsTotal;
      current.maleNonB1B2 =
        (current.maleNonB1B2 ?? 0) + row.nonB1B2ShortTermVisitorsTotal;
    }
    if (row.gender === "female") {
      current.fallbackTotalPopulationCount = Math.max(
        current.fallbackTotalPopulationCount ?? 0,
        row.totalPopulationCount,
      );
      current.female = (current.female ?? 0) + row.shortTermVisitorsTotal;
      current.femaleB1 = (current.femaleB1 ?? 0) + row.b1ShortTermVisitorsTotal;
      current.femaleB2 = (current.femaleB2 ?? 0) + row.b2ShortTermVisitorsTotal;
      current.femaleNonB1B2 =
        (current.femaleNonB1B2 ?? 0) + row.nonB1B2ShortTermVisitorsTotal;
    }

    byCountry.set(countryKey, current);
  }

  const byCountryGroup = new Map<
    string,
    {
      continentName: string | null;
      countryName: string;
      normalizedCountryLabel: string;
      shortTermVisitorsTotal: number;
      b1ShortTermVisitorsTotal: number;
      b2ShortTermVisitorsTotal: number;
      nonB1B2ShortTermVisitorsTotal: number;
      totalPopulationCount: number | null;
      maleShortTermVisitors: number | null;
      femaleShortTermVisitors: number | null;
      maleB1ShortTermVisitors: number | null;
      femaleB1ShortTermVisitors: number | null;
      maleB2ShortTermVisitors: number | null;
      femaleB2ShortTermVisitors: number | null;
      maleNonB1B2ShortTermVisitors: number | null;
      femaleNonB1B2ShortTermVisitors: number | null;
    }
  >();

  for (const value of byCountry.values()) {
    const derivedShortTermVisitorsTotal = value.hasExplicitTotalRow
      ? value.shortTermVisitorsTotal
      : (value.male ?? 0) + (value.female ?? 0);
    const derivedB1ShortTermVisitorsTotal = value.hasExplicitTotalRow
      ? value.b1ShortTermVisitorsTotal
      : (value.maleB1 ?? 0) + (value.femaleB1 ?? 0);
    const derivedB2ShortTermVisitorsTotal = value.hasExplicitTotalRow
      ? value.b2ShortTermVisitorsTotal
      : (value.maleB2 ?? 0) + (value.femaleB2 ?? 0);
    const derivedNonB1B2ShortTermVisitorsTotal = value.hasExplicitTotalRow
      ? value.nonB1B2ShortTermVisitorsTotal
      : (value.maleNonB1B2 ?? 0) + (value.femaleNonB1B2 ?? 0);
    const totalPopulationCount =
      value.totalPopulationCount && value.totalPopulationCount > 0
        ? value.totalPopulationCount
        : value.fallbackTotalPopulationCount;

    const normalized = normalizeCountryGroup(value.countryName);
    const isOtherCountryGroup = normalized.normalizedCountryKey === "기타";
    const current = byCountryGroup.get(normalized.normalizedCountryKey) ?? {
      continentName: isOtherCountryGroup ? null : value.continentName,
      countryName: normalized.normalizedCountryKey,
      normalizedCountryLabel: normalized.normalizedCountryLabel,
      shortTermVisitorsTotal: 0,
      b1ShortTermVisitorsTotal: 0,
      b2ShortTermVisitorsTotal: 0,
      nonB1B2ShortTermVisitorsTotal: 0,
      totalPopulationCount: null,
      maleShortTermVisitors: null,
      femaleShortTermVisitors: null,
      maleB1ShortTermVisitors: null,
      femaleB1ShortTermVisitors: null,
      maleB2ShortTermVisitors: null,
      femaleB2ShortTermVisitors: null,
      maleNonB1B2ShortTermVisitors: null,
      femaleNonB1B2ShortTermVisitors: null,
    };

    if (!isOtherCountryGroup && !current.continentName && value.continentName) {
      current.continentName = value.continentName;
    }

    current.shortTermVisitorsTotal += derivedShortTermVisitorsTotal;
    current.b1ShortTermVisitorsTotal += derivedB1ShortTermVisitorsTotal;
    current.b2ShortTermVisitorsTotal += derivedB2ShortTermVisitorsTotal;
    current.nonB1B2ShortTermVisitorsTotal += derivedNonB1B2ShortTermVisitorsTotal;
    current.totalPopulationCount =
      totalPopulationCount === null
        ? current.totalPopulationCount
        : (current.totalPopulationCount ?? 0) + totalPopulationCount;
    current.maleShortTermVisitors =
      (current.maleShortTermVisitors ?? 0) + (value.male ?? 0);
    current.femaleShortTermVisitors =
      (current.femaleShortTermVisitors ?? 0) + (value.female ?? 0);
    current.maleB1ShortTermVisitors =
      (current.maleB1ShortTermVisitors ?? 0) + (value.maleB1 ?? 0);
    current.femaleB1ShortTermVisitors =
      (current.femaleB1ShortTermVisitors ?? 0) + (value.femaleB1 ?? 0);
    current.maleB2ShortTermVisitors =
      (current.maleB2ShortTermVisitors ?? 0) + (value.maleB2 ?? 0);
    current.femaleB2ShortTermVisitors =
      (current.femaleB2ShortTermVisitors ?? 0) + (value.femaleB2 ?? 0);
    current.maleNonB1B2ShortTermVisitors =
      (current.maleNonB1B2ShortTermVisitors ?? 0) + (value.maleNonB1B2 ?? 0);
    current.femaleNonB1B2ShortTermVisitors =
      (current.femaleNonB1B2ShortTermVisitors ?? 0) + (value.femaleNonB1B2 ?? 0);

    byCountryGroup.set(normalized.normalizedCountryKey, current);
  }

  return [...byCountryGroup.entries()]
    .map(([normalizedCountryKey, value]) => ({
      ...workbook.period,
      continentName: value.continentName,
      countryName: value.countryName,
      normalizedCountryKey,
      normalizedCountryLabel: value.normalizedCountryLabel,
      shortTermVisitorsTotal: value.shortTermVisitorsTotal,
      b1ShortTermVisitorsTotal: value.b1ShortTermVisitorsTotal,
      b2ShortTermVisitorsTotal: value.b2ShortTermVisitorsTotal,
      nonB1B2ShortTermVisitorsTotal: value.nonB1B2ShortTermVisitorsTotal,
      totalPopulationCount: value.totalPopulationCount,
      shortTermVisaRatio:
        value.totalPopulationCount && value.totalPopulationCount > 0
          ? value.shortTermVisitorsTotal / value.totalPopulationCount
          : null,
      b1ShortTermVisaRatio:
        value.totalPopulationCount && value.totalPopulationCount > 0
          ? value.b1ShortTermVisitorsTotal / value.totalPopulationCount
          : null,
      b2ShortTermVisaRatio:
        value.totalPopulationCount && value.totalPopulationCount > 0
          ? value.b2ShortTermVisitorsTotal / value.totalPopulationCount
          : null,
      nonB1B2ShortTermVisaRatio:
        value.totalPopulationCount && value.totalPopulationCount > 0
          ? value.nonB1B2ShortTermVisitorsTotal / value.totalPopulationCount
          : null,
      maleShortTermVisitors: value.maleShortTermVisitors,
      femaleShortTermVisitors: value.femaleShortTermVisitors,
      maleB1ShortTermVisitors: value.maleB1ShortTermVisitors,
      femaleB1ShortTermVisitors: value.femaleB1ShortTermVisitors,
      maleB2ShortTermVisitors: value.maleB2ShortTermVisitors,
      femaleB2ShortTermVisitors: value.femaleB2ShortTermVisitors,
      maleNonB1B2ShortTermVisitors: value.maleNonB1B2ShortTermVisitors,
      femaleNonB1B2ShortTermVisitors: value.femaleNonB1B2ShortTermVisitors,
      monthlyShareRatio:
        workbook.monthlyTotals.total > 0
          ? value.shortTermVisitorsTotal / workbook.monthlyTotals.total
          : 0,
      b1MonthlyShareRatio:
        workbook.monthlyTotals.b1 > 0
          ? value.b1ShortTermVisitorsTotal / workbook.monthlyTotals.b1
          : 0,
      b2MonthlyShareRatio:
        workbook.monthlyTotals.b2 > 0
          ? value.b2ShortTermVisitorsTotal / workbook.monthlyTotals.b2
          : 0,
      nonB1B2MonthlyShareRatio:
        workbook.monthlyTotals.nonB1B2 > 0
          ? value.nonB1B2ShortTermVisitorsTotal / workbook.monthlyTotals.nonB1B2
          : 0,
      sourceFile: createSourceFileReference(workbook.source),
    }))
    .filter((row) => row.shortTermVisitorsTotal > 0);
}

async function parseDashboardWorkbookInSubprocess(
  record: DownloadRecord,
): Promise<ParsedDashboardWorkbook | null> {
  const payload = Buffer.from(JSON.stringify(record), "utf8").toString("base64");
  const tsxPackageJsonPath = require.resolve("tsx/package.json");
  const tsxCliPath = path.join(path.dirname(tsxPackageJsonPath), "dist", "cli.mjs");
  const scriptPath = path.join(
    process.cwd(),
    "src",
    "cli",
    "parse-dashboard-workbook.ts",
  );
  const { stdout } = await execFileAsync(
    process.execPath,
    [tsxCliPath, scriptPath, payload],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_OPTIONS: "--max-old-space-size=8192",
      },
      maxBuffer: 10 * 1024 * 1024,
    },
  );

  return JSON.parse(stdout.trim()) as ParsedDashboardWorkbook | null;
}

export async function buildDashboardDataset(
  config: AppConfig,
): Promise<DashboardDataset> {
  const allDownloadedRecords = await listDashboardSourceRecords(config);

  const skippedSources: DashboardDataset["metadata"]["skippedSources"] = [];
  const monthlyTrend: MonthlyTrendPoint[] = [];
  const genderShares: GenderShareRow[] = [];
  const detailTable: DetailTableRow[] = [];
  let parsedWorkbookCount = 0;

  for (const record of allDownloadedRecords) {
    try {
      const workbook = await parseDashboardWorkbookInSubprocess(record);
      if (!workbook) {
        skippedSources.push({
          articleId: record.articleId,
          articleTitle: record.articleTitle,
          localPath: record.localPath,
          reason: "Workbook title did not match target entry-statistics format.",
        });
        continue;
      }
      if (workbook.period.periodKey < MIN_INCLUDED_PERIOD_KEY) {
        skippedSources.push({
          articleId: record.articleId,
          articleTitle: record.articleTitle,
          localPath: record.localPath,
          reason: `Excluded by dataset minimum period: ${MIN_INCLUDED_PERIOD_KEY}`,
        });
        continue;
      }
      parsedWorkbookCount += 1;
      monthlyTrend.push(createMonthlyTrendPoint(workbook));

      if (workbook.hasGenderBreakdown) {
        genderShares.push(
          ...(["male", "female"] as const).map((gender) => ({
            ...workbook.period,
            gender,
            shortTermVisitorsTotal: workbook.genderTotals[gender].total,
            b1ShortTermVisitorsTotal: workbook.genderTotals[gender].b1,
            b2ShortTermVisitorsTotal: workbook.genderTotals[gender].b2,
            nonB1B2ShortTermVisitorsTotal: workbook.genderTotals[gender].nonB1B2,
            shareRatio:
              workbook.monthlyTotals.total > 0
                ? workbook.genderTotals[gender].total / workbook.monthlyTotals.total
                : 0,
            b1ShareRatio:
              workbook.monthlyTotals.b1 > 0
                ? workbook.genderTotals[gender].b1 / workbook.monthlyTotals.b1
                : 0,
            b2ShareRatio:
              workbook.monthlyTotals.b2 > 0
                ? workbook.genderTotals[gender].b2 / workbook.monthlyTotals.b2
                : 0,
            nonB1B2ShareRatio:
              workbook.monthlyTotals.nonB1B2 > 0
                ? workbook.genderTotals[gender].nonB1B2 / workbook.monthlyTotals.nonB1B2
                : 0,
          })),
        );
      }
      detailTable.push(...createDetailRows(workbook));
    } catch (error) {
      skippedSources.push({
        articleId: record.articleId,
        articleTitle: record.articleTitle,
        localPath: record.localPath,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  monthlyTrend.sort((left, right) => left.periodKey.localeCompare(right.periodKey));
  genderShares.sort((left, right) => {
    const periodCompare = left.periodKey.localeCompare(right.periodKey);
    if (periodCompare !== 0) {
      return periodCompare;
    }
    return left.gender.localeCompare(right.gender);
  });
  detailTable.sort((left, right) => {
    const periodCompare = left.periodKey.localeCompare(right.periodKey);
    if (periodCompare !== 0) {
      return periodCompare;
    }
    return left.normalizedCountryKey.localeCompare(right.normalizedCountryKey);
  });

  const latestPeriodKey = monthlyTrend[monthlyTrend.length - 1]?.periodKey ?? "";
  const topCountryShares: CountryShareRow[] = detailTable
    .filter((row) => row.periodKey === latestPeriodKey)
    .sort((left, right) => right.shortTermVisitorsTotal - left.shortTermVisitorsTotal)
    .slice(0, 10)
    .map((row, index) => ({
      year: row.year,
      month: row.month,
      periodKey: row.periodKey,
      rank: index + 1,
      normalizedCountryKey: row.normalizedCountryKey,
      countryName: row.countryName,
      shortTermVisitorsTotal: row.shortTermVisitorsTotal,
      b1ShortTermVisitorsTotal: row.b1ShortTermVisitorsTotal,
      b2ShortTermVisitorsTotal: row.b2ShortTermVisitorsTotal,
      nonB1B2ShortTermVisitorsTotal: row.nonB1B2ShortTermVisitorsTotal,
      totalPopulationCount: row.totalPopulationCount,
      shortTermVisaRatio: row.shortTermVisaRatio,
      b1ShortTermVisaRatio: row.b1ShortTermVisaRatio,
      b2ShortTermVisaRatio: row.b2ShortTermVisaRatio,
      nonB1B2ShortTermVisaRatio: row.nonB1B2ShortTermVisaRatio,
      shareRatio: row.monthlyShareRatio,
      b1ShareRatio: row.b1MonthlyShareRatio,
      b2ShareRatio: row.b2MonthlyShareRatio,
      nonB1B2ShareRatio: row.nonB1B2MonthlyShareRatio,
    }));

  return {
    metadata: {
      generatedAt: new Date().toISOString(),
      sourceRecordCount: parsedWorkbookCount,
      skippedSourceRecordCount: skippedSources.length,
      supportedVisaCodes: ["B1", "B2", "C1", "C3", "C4"],
      defaultTopCountryBasis: "latest_month",
      supportedCountryGroups: getSupportedCountryGroups(),
      notes: [
        "2015.01 이후 기준 집계",
        "단기관광객(B1, B2 제외)는 전체 단기 입국자에서 B1, B2를 제외한 값",
        ...(skippedSources.length > 0
          ? ["일부 원본 파일 제외"]
          : []),
      ],
      skippedSources,
    },
    monthlyTrend,
    topCountryShares,
    genderShares,
    detailTable,
  };
}

export async function writeDashboardDataset(
  dataset: DashboardDataset,
): Promise<string> {
  const outputPath = path.join(process.cwd(), "site", "data", "dashboard_data.json");
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(dataset, null, 2)}\n`, "utf8");
  return outputPath;
}
