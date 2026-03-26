import process from "node:process";

import type { DownloadRecord } from "../domain/download";
import { parseDashboardWorkbook } from "../infrastructure/excel/dashboard-workbook-reader";

async function main(): Promise<void> {
  const encodedRecord = process.argv[2];
  if (!encodedRecord) {
    throw new Error("Encoded download record argument is required.");
  }

  const record = JSON.parse(
    Buffer.from(encodedRecord, "base64").toString("utf8"),
  ) as DownloadRecord;
  const workbook = parseDashboardWorkbook(record);

  process.stdout.write(JSON.stringify(workbook));
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
