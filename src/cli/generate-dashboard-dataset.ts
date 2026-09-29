import process from "node:process";

import { writeLongTermDataset } from "../application/dashboard/build-long-term-dataset";
import {
  buildDashboardDatasets,
  writeDashboardDataset,
} from "../application/dashboard/build-dashboard-dataset";
import { loadConfig } from "../infrastructure/config";

async function main(): Promise<void> {
  try {
    const config = loadConfig();
    const { shortTerm: dataset, longTerm } = await buildDashboardDatasets(config);
    const outputPath = await writeDashboardDataset(dataset);
    const longTermOutputPath = await writeLongTermDataset(longTerm);

    console.info(
      JSON.stringify(
        {
          outputPath,
          sourceRecordCount: dataset.metadata.sourceRecordCount,
          skippedSourceRecordCount: dataset.metadata.skippedSourceRecordCount,
          monthlyTrendPoints: dataset.monthlyTrend.length,
          topCountryRows: dataset.topCountryShares.length,
          genderRows: dataset.genderShares.length,
          detailRows: dataset.detailTable.length,
          longTerm: {
            outputPath: longTermOutputPath,
            sourceRecordCount: longTerm.metadata.sourceRecordCount,
            monthlyTrendPoints: longTerm.monthlyTrend.length,
            detailRows: longTerm.detailTable.length,
            reconciliation: {
              checkedMonths: longTerm.metadata.reconciliation.checkedMonths,
              mismatchedMonths: longTerm.metadata.reconciliation.mismatchedMonths,
            },
          },
        },
        null,
        2,
      ),
    );
  } catch (error) {
    console.error("Failed to generate dashboard dataset.", error);
    process.exitCode = 1;
  }
}

void main();
