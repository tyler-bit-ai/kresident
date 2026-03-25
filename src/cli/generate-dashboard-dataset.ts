import process from "node:process";

import {
  buildDashboardDataset,
  writeDashboardDataset,
} from "../application/dashboard/build-dashboard-dataset";
import { loadConfig } from "../infrastructure/config";

async function main(): Promise<void> {
  try {
    const config = loadConfig();
    const dataset = await buildDashboardDataset(config);
    const outputPath = await writeDashboardDataset(dataset);

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
