import process from "node:process";

import { runMonthlyDownload } from "../app/run-monthly-download";

function parseArgs(argv: string[]): {
  months?: number;
  dryRun: boolean;
  crawlAllPages: boolean;
} {
  const parsed: { months?: number; dryRun: boolean; crawlAllPages: boolean } = {
    dryRun: false,
    crawlAllPages: false,
  };

  for (const arg of argv) {
    if (arg === "--dry-run") {
      parsed.dryRun = true;
      continue;
    }

    if (arg === "--all-pages") {
      parsed.crawlAllPages = true;
      continue;
    }

    if (arg.startsWith("--months=")) {
      const rawValue = arg.split("=")[1];
      const months = Number.parseInt(rawValue ?? "", 10);
      if (Number.isNaN(months) || months <= 0) {
        throw new Error("--months must be a positive integer.");
      }
      parsed.months = months;
      continue;
    }
  }

  return parsed;
}

async function main(): Promise<void> {
  try {
    const options = parseArgs(process.argv.slice(2));
    const result = await runMonthlyDownload(options);
    console.info(
      JSON.stringify(
        {
          options,
          summary: {
            downloaded: result.downloaded,
            skipped: result.skipped,
            failed: result.failed,
          },
          downloadedItems: result.downloadedItems,
          skippedItems: result.skippedItems,
          failedItems: result.failedItems,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    console.error("Failed to run downloader.", error);
    process.exitCode = 1;
  }
}

void main();
