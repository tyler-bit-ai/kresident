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
