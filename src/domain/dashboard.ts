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
  b1ShortTermVisitorsTotal: number;
  nonB1ShortTermVisitorsTotal: number;
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
  b1ShortTermVisitorsTotal: number;
  nonB1ShortTermVisitorsTotal: number;
  totalPopulationCount: number | null;
  shortTermVisaRatio: number | null;
  b1ShortTermVisaRatio: number | null;
  nonB1ShortTermVisaRatio: number | null;
  shareRatio: number;
  b1ShareRatio: number;
  nonB1ShareRatio: number;
}

export interface GenderShareRow {
  year: number;
  month: number;
  periodKey: string;
  gender: GenderKey;
  shortTermVisitorsTotal: number;
  b1ShortTermVisitorsTotal: number;
  nonB1ShortTermVisitorsTotal: number;
  shareRatio: number;
  b1ShareRatio: number;
  nonB1ShareRatio: number;
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
  b1ShortTermVisitorsTotal: number;
  nonB1ShortTermVisitorsTotal: number;
  totalPopulationCount: number | null;
  shortTermVisaRatio: number | null;
  b1ShortTermVisaRatio: number | null;
  nonB1ShortTermVisaRatio: number | null;
  maleShortTermVisitors: number | null;
  femaleShortTermVisitors: number | null;
  maleB1ShortTermVisitors: number | null;
  femaleB1ShortTermVisitors: number | null;
  maleNonB1ShortTermVisitors: number | null;
  femaleNonB1ShortTermVisitors: number | null;
  monthlyShareRatio: number;
  b1MonthlyShareRatio: number;
  nonB1MonthlyShareRatio: number;
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
