import process from "node:process";

import { verifyDashboardRawData } from "../application/dashboard/verify-dashboard-raw";
import { loadConfig } from "../infrastructure/config";

function isStrictMode(): boolean {
  return process.argv.includes("--strict");
}

async function main(): Promise<void> {
  const config = loadConfig();
  const report = await verifyDashboardRawData(config);

  console.info(
    JSON.stringify(
      {
        reportPath: report.reportPath,
        formatGroupCount: report.formatGroupCount,
        representativeCaseCount: report.representativeCaseCount,
        passedCaseCount: report.passedCaseCount,
        failedCaseCount: report.failedCaseCount,
        failedPeriods: report.cases
          .filter((item) => !item.passed)
          .map((item) => item.periodKey),
      },
      null,
      2,
    ),
  );

  if (isStrictMode() && report.failedCaseCount > 0) {
    process.exitCode = 1;
  }
}

void main().catch((error) => {
  console.error("Failed to verify dashboard raw data.", error);
  process.exitCode = 1;
});
