export type GenderKey = "total" | "male" | "female";

export interface SourceFileReference {
  articleId: string;
  articleTitle: string;
  publishedAt: string;
  localPath: string;
}

export interface MonthlyTrendPoint {
  year: number;
  month: number;
  periodKey: string;
  shortTermVisitorsTotal: number;
  sourceFile: SourceFileReference;
}

export interface CountryMonthlyAggregate {
  year: number;
  month: number;
  periodKey: string;
  countryName: string;
  continentName: string | null;
  shortTermVisitorsTotal: number;
  sourceFile: SourceFileReference;
}

export interface CountryShareRow {
  year: number;
  month: number;
  periodKey: string;
  rank: number;
  normalizedCountryKey: string;
  countryName: string;
  shortTermVisitorsTotal: number;
  totalPopulationCount: number | null;
  shortTermVisaRatio: number | null;
  shareRatio: number;
}

export interface GenderShareRow {
  year: number;
  month: number;
  periodKey: string;
  gender: GenderKey;
  shortTermVisitorsTotal: number;
  shareRatio: number;
}

export interface DetailTableRow {
  year: number;
  month: number;
  periodKey: string;
  continentName: string | null;
  countryName: string;
  normalizedCountryKey: string;
  normalizedCountryLabel: string;
  shortTermVisitorsTotal: number;
  totalPopulationCount: number | null;
  shortTermVisaRatio: number | null;
  maleShortTermVisitors: number | null;
  femaleShortTermVisitors: number | null;
  monthlyShareRatio: number;
  sourceFile: SourceFileReference;
}

export interface DashboardDatasetMetadata {
  generatedAt: string;
  sourceRecordCount: number;
  skippedSourceRecordCount: number;
  supportedVisaCodes: string[];
  defaultTopCountryBasis: "latest_month";
  supportedCountryGroups: string[];
  notes: string[];
  skippedSources: Array<{
    articleId: string;
    articleTitle: string;
    localPath: string;
    reason: string;
  }>;
}

export interface DashboardDataset {
  metadata: DashboardDatasetMetadata;
  monthlyTrend: MonthlyTrendPoint[];
  topCountryShares: CountryShareRow[];
  genderShares: GenderShareRow[];
  detailTable: DetailTableRow[];
}
