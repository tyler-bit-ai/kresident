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
    (record) => `${record.articleId}:${record.attachmentId}:${record.localPath}`,
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
    shortTermVisitorsTotal: workbook.monthlyTotal,
    sourceFile: createSourceFileReference(workbook.source),
  }));

  const genderShares: GenderShareRow[] = parsedWorkbooks.flatMap((workbook) =>
    (["male", "female"] as const).map((gender) => ({
      ...workbook.period,
      gender,
      shortTermVisitorsTotal: workbook.genderTotals[gender],
      shareRatio:
        workbook.monthlyTotal > 0
          ? workbook.genderTotals[gender] / workbook.monthlyTotal
          : 0,
    })),
  );

  const detailTable: DetailTableRow[] = parsedWorkbooks.flatMap((workbook) => {
    const byCountry = new Map<
      string,
      {
        continentName: string | null;
        shortTermVisitorsTotal: number;
        totalPopulationCount: number | null;
        male: number | null;
        female: number | null;
      }
    >();

    for (const row of workbook.rows) {
      const normalized = normalizeCountryGroup(row.countryName);
      const current = byCountry.get(normalized.normalizedCountryKey) ?? {
        continentName: row.continentName,
        shortTermVisitorsTotal: 0,
        totalPopulationCount: null,
        male: null,
        female: null,
      };

      if (!current.continentName && row.continentName) {
        current.continentName = row.continentName;
      }
      if (row.gender === "total") {
        current.shortTermVisitorsTotal += row.shortTermVisitorsTotal;
        current.totalPopulationCount =
          (current.totalPopulationCount ?? 0) + row.totalPopulationCount;
      }
      if (row.gender === "male") {
        current.male = (current.male ?? 0) + row.shortTermVisitorsTotal;
      }
      if (row.gender === "female") {
        current.female = (current.female ?? 0) + row.shortTermVisitorsTotal;
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
        totalPopulationCount: value.totalPopulationCount,
        shortTermVisaRatio:
          value.totalPopulationCount && value.totalPopulationCount > 0
            ? value.shortTermVisitorsTotal / value.totalPopulationCount
            : null,
        maleShortTermVisitors: value.male,
        femaleShortTermVisitors: value.female,
        monthlyShareRatio:
          workbook.monthlyTotal > 0
            ? value.shortTermVisitorsTotal / workbook.monthlyTotal
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
      totalPopulationCount: row.totalPopulationCount,
      shortTermVisaRatio: row.shortTermVisaRatio,
      shareRatio: row.monthlyShareRatio,
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
