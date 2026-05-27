export interface DashboardWorkbookFormatSignature {
  signatureKey: string;
  headerRowIndex: number;
  hasContinentColumn: boolean;
  countryColumnLabel: string;
  genderColumnLabel: string;
  totalPopulationColumnLabel: string;
  shortTermColumnLabels: string[];
  headerLabels: string[];
}

export interface RawDashboardVerificationIssue {
  code:
    | "missing_monthly_trend"
    | "monthly_total_mismatch"
    | "missing_detail_row"
    | "detail_continent_mismatch"
    | "detail_value_mismatch"
    | "unexpected_detail_row";
  message: string;
  normalizedCountryKey?: string;
  metric?: string;
  expected?: number | string | null;
  actual?: number | string | null;
  likelyCause: string;
  suggestedTouchpoints: string[];
}

export interface RawDashboardVerificationCase {
  periodKey: string;
  sourceFile: {
    articleId: string;
    articleTitle: string;
    publishedAt: string;
    localPath: string;
  };
  formatSignature: DashboardWorkbookFormatSignature;
  issueCount: number;
  passed: boolean;
  monthlyTrendVerified: boolean;
  detailRowCount: {
    expected: number;
    actual: number;
  };
  issues: RawDashboardVerificationIssue[];
}

export interface RawDashboardVerificationReport {
  generatedAt: string;
  representativeCaseCount: number;
  formatGroupCount: number;
  passedCaseCount: number;
  failedCaseCount: number;
  reportPath: string;
  cases: RawDashboardVerificationCase[];
}
