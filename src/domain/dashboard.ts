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
  b2ShortTermVisitorsTotal: number;
  nonB2ShortTermVisitorsTotal: number;
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
  b2ShortTermVisitorsTotal: number;
  nonB2ShortTermVisitorsTotal: number;
  totalPopulationCount: number | null;
  shortTermVisaRatio: number | null;
  b1ShortTermVisaRatio: number | null;
  b2ShortTermVisaRatio: number | null;
  nonB2ShortTermVisaRatio: number | null;
  shareRatio: number;
  b1ShareRatio: number;
  b2ShareRatio: number;
  nonB2ShareRatio: number;
}

export interface GenderShareRow {
  year: number;
  month: number;
  periodKey: string;
  gender: GenderKey;
  shortTermVisitorsTotal: number;
  b1ShortTermVisitorsTotal: number;
  b2ShortTermVisitorsTotal: number;
  nonB2ShortTermVisitorsTotal: number;
  shareRatio: number;
  b1ShareRatio: number;
  b2ShareRatio: number;
  nonB2ShareRatio: number;
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
  b2ShortTermVisitorsTotal: number;
  nonB2ShortTermVisitorsTotal: number;
  totalPopulationCount: number | null;
  shortTermVisaRatio: number | null;
  b1ShortTermVisaRatio: number | null;
  b2ShortTermVisaRatio: number | null;
  nonB2ShortTermVisaRatio: number | null;
  maleShortTermVisitors: number | null;
  femaleShortTermVisitors: number | null;
  maleB1ShortTermVisitors: number | null;
  femaleB1ShortTermVisitors: number | null;
  maleB2ShortTermVisitors: number | null;
  femaleB2ShortTermVisitors: number | null;
  maleNonB2ShortTermVisitors: number | null;
  femaleNonB2ShortTermVisitors: number | null;
  monthlyShareRatio: number;
  b1MonthlyShareRatio: number;
  b2MonthlyShareRatio: number;
  nonB2MonthlyShareRatio: number;
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
