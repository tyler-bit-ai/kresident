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
  nonB1B2ShortTermVisitorsTotal: number;
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
  nonB1B2ShortTermVisitorsTotal: number;
  totalPopulationCount: number | null;
  shortTermVisaRatio: number | null;
  b1ShortTermVisaRatio: number | null;
  b2ShortTermVisaRatio: number | null;
  nonB1B2ShortTermVisaRatio: number | null;
  shareRatio: number;
  b1ShareRatio: number;
  b2ShareRatio: number;
  nonB1B2ShareRatio: number;
}

export interface GenderShareRow {
  year: number;
  month: number;
  periodKey: string;
  gender: GenderKey;
  shortTermVisitorsTotal: number;
  b1ShortTermVisitorsTotal: number;
  b2ShortTermVisitorsTotal: number;
  nonB1B2ShortTermVisitorsTotal: number;
  shareRatio: number;
  b1ShareRatio: number;
  b2ShareRatio: number;
  nonB1B2ShareRatio: number;
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
  nonB1B2ShortTermVisitorsTotal: number;
  totalPopulationCount: number | null;
  shortTermVisaRatio: number | null;
  b1ShortTermVisaRatio: number | null;
  b2ShortTermVisaRatio: number | null;
  nonB1B2ShortTermVisaRatio: number | null;
  maleShortTermVisitors: number | null;
  femaleShortTermVisitors: number | null;
  maleB1ShortTermVisitors: number | null;
  femaleB1ShortTermVisitors: number | null;
  maleB2ShortTermVisitors: number | null;
  femaleB2ShortTermVisitors: number | null;
  maleNonB1B2ShortTermVisitors: number | null;
  femaleNonB1B2ShortTermVisitors: number | null;
  monthlyShareRatio: number;
  b1MonthlyShareRatio: number;
  b2MonthlyShareRatio: number;
  nonB1B2MonthlyShareRatio: number;
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

/* ── 장기입국자 (D1~H2 장기 체류자격) ── */

export type LongTermModeKey = "all" | "d2" | "d4" | "f4" | "other";

export interface LongTermVisitModeDefinition {
  key: LongTermModeKey;
  label: string;
  shortLabel: string;
  /** detailTable 행에서 해당 입국 구분 값을 읽는 필드명 */
  fields: {
    total: string;
    male: string;
    female: string;
    share: string;
    ratio: string;
  };
}

/**
 * 장기 데이터셋의 행은 입국 구분(all/d2/d4/f4/other)별 필드가 반복되므로
 * 공통 필드만 명시하고 나머지는 `LongTermVisitModeDefinition.fields`의 이름으로 접근한다.
 */
export interface LongTermDetailRow {
  year: number;
  month: number;
  periodKey: string;
  continentName: string | null;
  countryName: string;
  normalizedCountryKey: string;
  normalizedCountryLabel: string;
  totalPopulationCount: number | null;
  sourceFile: SourceFileReference;
  [metric: string]: unknown;
}

export interface LongTermMonthlyTrendPoint {
  year: number;
  month: number;
  periodKey: string;
  sourceFile: SourceFileReference;
  [metric: string]: unknown;
}

export interface LongTermReconciliationEntry {
  periodKey: string;
  grandTotal: number;
  shortTerm: number;
  longTerm: number;
  /** 단기·장기 외 열 합계 (기타, 관광상륙(T-1) 등, 승무원 제외) */
  unclassified: number;
  crew: number;
  /** 총합계 − 단기 − 장기 − 기타 열 (승무원 제외). 승무원 포함 레이아웃이면 residual === crew 여야 정합 */
  residual: number;
}

export interface LongTermDatasetMetadata
  extends Omit<DashboardDatasetMetadata, "defaultTopCountryBasis"> {
  defaultTopCountryBasis: "latest_month";
  visitModes: LongTermVisitModeDefinition[];
  reconciliation: {
    checkedMonths: number;
    mismatchedMonths: number;
    entries: LongTermReconciliationEntry[];
  };
}

export interface LongTermDataset {
  metadata: LongTermDatasetMetadata;
  monthlyTrend: LongTermMonthlyTrendPoint[];
  topCountryShares: Array<Record<string, unknown>>;
  genderShares: Array<Record<string, unknown>>;
  detailTable: LongTermDetailRow[];
}
