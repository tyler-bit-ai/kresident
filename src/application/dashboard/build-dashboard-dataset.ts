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
import { loadDownloadRegistry } from "../../infrastructure/registry/load-download-registry";

const execFileAsync = promisify(execFile);
const MIN_INCLUDED_PERIOD_KEY = "2015-01";

function createSourceFileReference(record: DownloadRecord): SourceFileReference {
  return {
    articleId: record.articleId,
    articleTitle: record.articleTitle,
    publishedAt: record.publishedAt,
    localPath: record.localPath,
  };
}

function uniqueBy<T>(items: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function resolveRecordLocalPath(record: DownloadRecord): Promise<DownloadRecord> {
  if (await pathExists(record.localPath)) {
    return record;
  }

  const parentDir = path.dirname(record.localPath);
  if (!(await pathExists(parentDir))) {
    return record;
  }

  const siblingFiles = (await fs.readdir(parentDir, { withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(parentDir, entry.name));

  if (siblingFiles.length === 1) {
    return {
      ...record,
      localPath: siblingFiles[0]!,
    };
  }

  return record;
}

async function discoverManualRawRecords(
  rawDir: string,
  existingRecords: DownloadRecord[],
): Promise<DownloadRecord[]> {
  const knownPaths = new Set(existingRecords.map((record) => path.normalize(record.localPath)));
  const yearDirs = (await fs.readdir(rawDir, { withFileTypes: true }).catch(() => []))
    .filter((entry) => entry.isDirectory());
  const manualRecords: DownloadRecord[] = [];

  for (const yearDir of yearDirs) {
    const monthDirs = (await fs.readdir(path.join(rawDir, yearDir.name), { withFileTypes: true }))
      .filter((entry) => entry.isDirectory());

    for (const monthDir of monthDirs) {
      const periodMatch = monthDir.name.match(/^(\d{4})-(\d{2})$/);
      if (!periodMatch?.[1] || !periodMatch[2]) {
        continue;
      }

      const fileEntries = (await fs.readdir(path.join(rawDir, yearDir.name, monthDir.name), {
        withFileTypes: true,
      }))
        .filter((entry) => entry.isFile());

      for (const fileEntry of fileEntries) {
        const localPath = path.join(rawDir, yearDir.name, monthDir.name, fileEntry.name);
        if (knownPaths.has(path.normalize(localPath))) {
          continue;
        }

        manualRecords.push({
          sourceBoardId: "manual",
          sourceBoardName: "manual-raw-files",
          articleId: `manual-${monthDir.name}-${fileEntry.name}`,
          articleTitle: `${Number(periodMatch[1])}년 ${Number(periodMatch[2])}월 수동 추가 raw 파일`,
          publishedAt: "",
          attachmentId: `manual-${fileEntry.name}`,
          attachmentName: fileEntry.name,
          attachmentUrl: "",
          localPath,
          downloadedAt: new Date().toISOString(),
          status: "downloaded",
          checksum: "",
        });
      }
    }
  }

  return manualRecords;
}

function createDetailRows(
  workbook: ParsedDashboardWorkbook,
): DetailTableRow[] {
  const byCountry = new Map<
    string,
    {
      countryName: string;
      continentName: string | null;
      shortTermVisitorsTotal: number;
      b2ShortTermVisitorsTotal: number;
      nonB2ShortTermVisitorsTotal: number;
      totalPopulationCount: number | null;
      male: number | null;
      female: number | null;
      maleB2: number | null;
      femaleB2: number | null;
      maleNonB2: number | null;
      femaleNonB2: number | null;
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
      b2ShortTermVisitorsTotal: 0,
      nonB2ShortTermVisitorsTotal: 0,
      totalPopulationCount: null,
      male: null,
      female: null,
      maleB2: null,
      femaleB2: null,
      maleNonB2: null,
      femaleNonB2: null,
      hasExplicitTotalRow: false,
      fallbackTotalPopulationCount: null,
    };

    if (!current.continentName && row.continentName) {
      current.continentName = row.continentName;
    }
    if (row.gender === "total") {
      current.hasExplicitTotalRow = true;
      current.shortTermVisitorsTotal += row.shortTermVisitorsTotal;
      current.b2ShortTermVisitorsTotal += row.b2ShortTermVisitorsTotal;
      current.nonB2ShortTermVisitorsTotal += row.nonB2ShortTermVisitorsTotal;
      current.totalPopulationCount =
        (current.totalPopulationCount ?? 0) + row.totalPopulationCount;
    }
    if (row.gender === "male") {
      current.fallbackTotalPopulationCount = Math.max(
        current.fallbackTotalPopulationCount ?? 0,
        row.totalPopulationCount,
      );
      current.male = (current.male ?? 0) + row.shortTermVisitorsTotal;
      current.maleB2 = (current.maleB2 ?? 0) + row.b2ShortTermVisitorsTotal;
      current.maleNonB2 = (current.maleNonB2 ?? 0) + row.nonB2ShortTermVisitorsTotal;
    }
    if (row.gender === "female") {
      current.fallbackTotalPopulationCount = Math.max(
        current.fallbackTotalPopulationCount ?? 0,
        row.totalPopulationCount,
      );
      current.female = (current.female ?? 0) + row.shortTermVisitorsTotal;
      current.femaleB2 = (current.femaleB2 ?? 0) + row.b2ShortTermVisitorsTotal;
      current.femaleNonB2 =
        (current.femaleNonB2 ?? 0) + row.nonB2ShortTermVisitorsTotal;
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
      b2ShortTermVisitorsTotal: number;
      nonB2ShortTermVisitorsTotal: number;
      totalPopulationCount: number | null;
      maleShortTermVisitors: number | null;
      femaleShortTermVisitors: number | null;
      maleB2ShortTermVisitors: number | null;
      femaleB2ShortTermVisitors: number | null;
      maleNonB2ShortTermVisitors: number | null;
      femaleNonB2ShortTermVisitors: number | null;
    }
  >();

  for (const value of byCountry.values()) {
    const derivedShortTermVisitorsTotal = value.hasExplicitTotalRow
      ? value.shortTermVisitorsTotal
      : (value.male ?? 0) + (value.female ?? 0);
    const derivedB2ShortTermVisitorsTotal = value.hasExplicitTotalRow
      ? value.b2ShortTermVisitorsTotal
      : (value.maleB2 ?? 0) + (value.femaleB2 ?? 0);
    const derivedNonB2ShortTermVisitorsTotal = value.hasExplicitTotalRow
      ? value.nonB2ShortTermVisitorsTotal
      : (value.maleNonB2 ?? 0) + (value.femaleNonB2 ?? 0);
    const totalPopulationCount =
      value.totalPopulationCount && value.totalPopulationCount > 0
        ? value.totalPopulationCount
        : value.fallbackTotalPopulationCount;

    const normalized = normalizeCountryGroup(value.countryName);
    const current = byCountryGroup.get(normalized.normalizedCountryKey) ?? {
      continentName: value.continentName,
      countryName: normalized.normalizedCountryKey,
      normalizedCountryLabel: normalized.normalizedCountryLabel,
      shortTermVisitorsTotal: 0,
      b2ShortTermVisitorsTotal: 0,
      nonB2ShortTermVisitorsTotal: 0,
      totalPopulationCount: null,
      maleShortTermVisitors: null,
      femaleShortTermVisitors: null,
      maleB2ShortTermVisitors: null,
      femaleB2ShortTermVisitors: null,
      maleNonB2ShortTermVisitors: null,
      femaleNonB2ShortTermVisitors: null,
    };

    if (!current.continentName && value.continentName) {
      current.continentName = value.continentName;
    }

    current.shortTermVisitorsTotal += derivedShortTermVisitorsTotal;
    current.b2ShortTermVisitorsTotal += derivedB2ShortTermVisitorsTotal;
    current.nonB2ShortTermVisitorsTotal += derivedNonB2ShortTermVisitorsTotal;
    current.totalPopulationCount =
      totalPopulationCount === null
        ? current.totalPopulationCount
        : (current.totalPopulationCount ?? 0) + totalPopulationCount;
    current.maleShortTermVisitors =
      (current.maleShortTermVisitors ?? 0) + (value.male ?? 0);
    current.femaleShortTermVisitors =
      (current.femaleShortTermVisitors ?? 0) + (value.female ?? 0);
    current.maleB2ShortTermVisitors =
      (current.maleB2ShortTermVisitors ?? 0) + (value.maleB2 ?? 0);
    current.femaleB2ShortTermVisitors =
      (current.femaleB2ShortTermVisitors ?? 0) + (value.femaleB2 ?? 0);
    current.maleNonB2ShortTermVisitors =
      (current.maleNonB2ShortTermVisitors ?? 0) + (value.maleNonB2 ?? 0);
    current.femaleNonB2ShortTermVisitors =
      (current.femaleNonB2ShortTermVisitors ?? 0) + (value.femaleNonB2 ?? 0);

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
      b2ShortTermVisitorsTotal: value.b2ShortTermVisitorsTotal,
      nonB2ShortTermVisitorsTotal: value.nonB2ShortTermVisitorsTotal,
      totalPopulationCount: value.totalPopulationCount,
      shortTermVisaRatio:
        value.totalPopulationCount && value.totalPopulationCount > 0
          ? value.shortTermVisitorsTotal / value.totalPopulationCount
          : null,
      b2ShortTermVisaRatio:
        value.totalPopulationCount && value.totalPopulationCount > 0
          ? value.b2ShortTermVisitorsTotal / value.totalPopulationCount
          : null,
      nonB2ShortTermVisaRatio:
        value.totalPopulationCount && value.totalPopulationCount > 0
          ? value.nonB2ShortTermVisitorsTotal / value.totalPopulationCount
          : null,
      maleShortTermVisitors: value.maleShortTermVisitors,
      femaleShortTermVisitors: value.femaleShortTermVisitors,
      maleB2ShortTermVisitors: value.maleB2ShortTermVisitors,
      femaleB2ShortTermVisitors: value.femaleB2ShortTermVisitors,
      maleNonB2ShortTermVisitors: value.maleNonB2ShortTermVisitors,
      femaleNonB2ShortTermVisitors: value.femaleNonB2ShortTermVisitors,
      monthlyShareRatio:
        workbook.monthlyTotals.total > 0
          ? value.shortTermVisitorsTotal / workbook.monthlyTotals.total
          : 0,
      b2MonthlyShareRatio:
        workbook.monthlyTotals.b2 > 0
          ? value.b2ShortTermVisitorsTotal / workbook.monthlyTotals.b2
          : 0,
      nonB2MonthlyShareRatio:
        workbook.monthlyTotals.nonB2 > 0
          ? value.nonB2ShortTermVisitorsTotal / workbook.monthlyTotals.nonB2
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
  const registry = await loadDownloadRegistry(
    path.join(config.metadataDir, "download-registry.json"),
  );

  const downloadedRecords = uniqueBy(
    registry.records.filter((record) => record.status === "downloaded"),
    (record) => path.normalize(record.localPath),
  );
  const resolvedDownloadedRecords = await Promise.all(
    downloadedRecords.map((record) => resolveRecordLocalPath(record)),
  );
  const manualRecords = await discoverManualRawRecords(config.rawDir, resolvedDownloadedRecords);
  const allDownloadedRecords = uniqueBy(
    [...resolvedDownloadedRecords, ...manualRecords],
    (record) => path.normalize(record.localPath),
  );

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
      monthlyTrend.push({
        ...workbook.period,
        shortTermVisitorsTotal: workbook.monthlyTotals.total,
        b2ShortTermVisitorsTotal: workbook.monthlyTotals.b2,
        nonB2ShortTermVisitorsTotal: workbook.monthlyTotals.nonB2,
        sourceFile: createSourceFileReference(workbook.source),
      });

      if (workbook.hasGenderBreakdown) {
        genderShares.push(
          ...(["male", "female"] as const).map((gender) => ({
            ...workbook.period,
            gender,
            shortTermVisitorsTotal: workbook.genderTotals[gender].total,
            b2ShortTermVisitorsTotal: workbook.genderTotals[gender].b2,
            nonB2ShortTermVisitorsTotal: workbook.genderTotals[gender].nonB2,
            shareRatio:
              workbook.monthlyTotals.total > 0
                ? workbook.genderTotals[gender].total / workbook.monthlyTotals.total
                : 0,
            b2ShareRatio:
              workbook.monthlyTotals.b2 > 0
                ? workbook.genderTotals[gender].b2 / workbook.monthlyTotals.b2
                : 0,
            nonB2ShareRatio:
              workbook.monthlyTotals.nonB2 > 0
                ? workbook.genderTotals[gender].nonB2 / workbook.monthlyTotals.nonB2
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
      b2ShortTermVisitorsTotal: row.b2ShortTermVisitorsTotal,
      nonB2ShortTermVisitorsTotal: row.nonB2ShortTermVisitorsTotal,
      totalPopulationCount: row.totalPopulationCount,
      shortTermVisaRatio: row.shortTermVisaRatio,
      b2ShortTermVisaRatio: row.b2ShortTermVisaRatio,
      nonB2ShortTermVisaRatio: row.nonB2ShortTermVisaRatio,
      shareRatio: row.monthlyShareRatio,
      b2ShareRatio: row.b2MonthlyShareRatio,
      nonB2ShareRatio: row.nonB2MonthlyShareRatio,
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
        "GitHub Pages 정적 대시보드용 사전 집계 산출물",
        "대시보드 기본 top 10 비중은 최신 월 기준",
        ...(skippedSources.length > 0
          ? [`${skippedSources.length}개의 원본 파일이 파싱 불가로 제외됨`]
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
