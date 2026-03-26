import fs from "node:fs/promises";
import path from "node:path";

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
import { parseDashboardWorkbook } from "../../infrastructure/excel/dashboard-workbook-reader";
import { loadDownloadRegistry } from "../../infrastructure/registry/load-download-registry";

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

  const skippedSources: DashboardDataset["metadata"]["skippedSources"] = [];
  const parsedWorkbooks = downloadedRecords
    .map((record) => {
      try {
        return parseDashboardWorkbook(record);
      } catch (error) {
        skippedSources.push({
          articleId: record.articleId,
          articleTitle: record.articleTitle,
          localPath: record.localPath,
          reason: error instanceof Error ? error.message : String(error),
        });
        return null;
      }
    })
    .filter((value): value is NonNullable<typeof value> => value !== null)
    .sort((left, right) => left.period.periodKey.localeCompare(right.period.periodKey));

  const monthlyTrend: MonthlyTrendPoint[] = parsedWorkbooks.map((workbook) => ({
    ...workbook.period,
    shortTermVisitorsTotal: workbook.monthlyTotals.total,
    b1ShortTermVisitorsTotal: workbook.monthlyTotals.b1,
    nonB1ShortTermVisitorsTotal: workbook.monthlyTotals.nonB1,
    sourceFile: createSourceFileReference(workbook.source),
  }));

  const genderShares: GenderShareRow[] = parsedWorkbooks.flatMap((workbook) =>
    (["male", "female"] as const).map((gender) => ({
      ...workbook.period,
      gender,
      shortTermVisitorsTotal: workbook.genderTotals[gender].total,
      b1ShortTermVisitorsTotal: workbook.genderTotals[gender].b1,
      nonB1ShortTermVisitorsTotal: workbook.genderTotals[gender].nonB1,
      shareRatio:
        workbook.monthlyTotals.total > 0
          ? workbook.genderTotals[gender].total / workbook.monthlyTotals.total
          : 0,
      b1ShareRatio:
        workbook.monthlyTotals.b1 > 0
          ? workbook.genderTotals[gender].b1 / workbook.monthlyTotals.b1
          : 0,
      nonB1ShareRatio:
        workbook.monthlyTotals.nonB1 > 0
          ? workbook.genderTotals[gender].nonB1 / workbook.monthlyTotals.nonB1
          : 0,
    })),
  );

  const detailTable: DetailTableRow[] = parsedWorkbooks.flatMap((workbook) => {
    const byCountry = new Map<
      string,
      {
        continentName: string | null;
        shortTermVisitorsTotal: number;
        b1ShortTermVisitorsTotal: number;
        nonB1ShortTermVisitorsTotal: number;
        totalPopulationCount: number | null;
        male: number | null;
        female: number | null;
        maleB1: number | null;
        femaleB1: number | null;
        maleNonB1: number | null;
        femaleNonB1: number | null;
      }
    >();

    for (const row of workbook.rows) {
      const normalized = normalizeCountryGroup(row.countryName);
      const current = byCountry.get(normalized.normalizedCountryKey) ?? {
        continentName: row.continentName,
        shortTermVisitorsTotal: 0,
        b1ShortTermVisitorsTotal: 0,
        nonB1ShortTermVisitorsTotal: 0,
        totalPopulationCount: null,
        male: null,
        female: null,
        maleB1: null,
        femaleB1: null,
        maleNonB1: null,
        femaleNonB1: null,
      };

      if (!current.continentName && row.continentName) {
        current.continentName = row.continentName;
      }
      if (row.gender === "total") {
        current.shortTermVisitorsTotal += row.shortTermVisitorsTotal;
        current.b1ShortTermVisitorsTotal += row.b1ShortTermVisitorsTotal;
        current.nonB1ShortTermVisitorsTotal += row.nonB1ShortTermVisitorsTotal;
        current.totalPopulationCount =
          (current.totalPopulationCount ?? 0) + row.totalPopulationCount;
      }
      if (row.gender === "male") {
        current.male = (current.male ?? 0) + row.shortTermVisitorsTotal;
        current.maleB1 = (current.maleB1 ?? 0) + row.b1ShortTermVisitorsTotal;
        current.maleNonB1 = (current.maleNonB1 ?? 0) + row.nonB1ShortTermVisitorsTotal;
      }
      if (row.gender === "female") {
        current.female = (current.female ?? 0) + row.shortTermVisitorsTotal;
        current.femaleB1 = (current.femaleB1 ?? 0) + row.b1ShortTermVisitorsTotal;
        current.femaleNonB1 =
          (current.femaleNonB1 ?? 0) + row.nonB1ShortTermVisitorsTotal;
      }

      byCountry.set(normalized.normalizedCountryKey, current);
    }

    return [...byCountry.entries()]
      .filter(([, value]) => value.shortTermVisitorsTotal > 0)
      .map(([normalizedCountryKey, value]) => ({
        ...workbook.period,
        continentName: value.continentName,
        countryName: normalizedCountryKey,
        normalizedCountryKey,
        normalizedCountryLabel: normalizedCountryKey,
        shortTermVisitorsTotal: value.shortTermVisitorsTotal,
        b1ShortTermVisitorsTotal: value.b1ShortTermVisitorsTotal,
        nonB1ShortTermVisitorsTotal: value.nonB1ShortTermVisitorsTotal,
        totalPopulationCount: value.totalPopulationCount,
        shortTermVisaRatio:
          value.totalPopulationCount && value.totalPopulationCount > 0
            ? value.shortTermVisitorsTotal / value.totalPopulationCount
            : null,
        b1ShortTermVisaRatio:
          value.totalPopulationCount && value.totalPopulationCount > 0
            ? value.b1ShortTermVisitorsTotal / value.totalPopulationCount
            : null,
        nonB1ShortTermVisaRatio:
          value.totalPopulationCount && value.totalPopulationCount > 0
            ? value.nonB1ShortTermVisitorsTotal / value.totalPopulationCount
            : null,
        maleShortTermVisitors: value.male,
        femaleShortTermVisitors: value.female,
        maleB1ShortTermVisitors: value.maleB1,
        femaleB1ShortTermVisitors: value.femaleB1,
        maleNonB1ShortTermVisitors: value.maleNonB1,
        femaleNonB1ShortTermVisitors: value.femaleNonB1,
        monthlyShareRatio:
          workbook.monthlyTotals.total > 0
            ? value.shortTermVisitorsTotal / workbook.monthlyTotals.total
            : 0,
        b1MonthlyShareRatio:
          workbook.monthlyTotals.b1 > 0
            ? value.b1ShortTermVisitorsTotal / workbook.monthlyTotals.b1
            : 0,
        nonB1MonthlyShareRatio:
          workbook.monthlyTotals.nonB1 > 0
            ? value.nonB1ShortTermVisitorsTotal / workbook.monthlyTotals.nonB1
            : 0,
        sourceFile: createSourceFileReference(workbook.source),
      }));
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
      nonB1ShortTermVisitorsTotal: row.nonB1ShortTermVisitorsTotal,
      totalPopulationCount: row.totalPopulationCount,
      shortTermVisaRatio: row.shortTermVisaRatio,
      b1ShortTermVisaRatio: row.b1ShortTermVisaRatio,
      nonB1ShortTermVisaRatio: row.nonB1ShortTermVisaRatio,
      shareRatio: row.monthlyShareRatio,
      b1ShareRatio: row.b1MonthlyShareRatio,
      nonB1ShareRatio: row.nonB1MonthlyShareRatio,
    }));

  return {
    metadata: {
      generatedAt: new Date().toISOString(),
      sourceRecordCount: parsedWorkbooks.length,
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
