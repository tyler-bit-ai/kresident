import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { runMonthlyDownload } from "../app/run-monthly-download";
import { loadConfig } from "../infrastructure/config";

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
    const report = {
      options,
      summary: {
        downloaded: result.downloaded,
        skipped: result.skipped,
        failed: result.failed,
      },
      downloadedItems: result.downloadedItems,
      skippedItems: result.skippedItems,
      failedItems: result.failedItems,
    };

    console.info(JSON.stringify(report, null, 2));

    // Written alongside the console report so callers (e.g. CI) can read a
    // structured result without parsing stdout, which may carry unrelated
    // banner output (dotenv, npm) ahead of the JSON.
    const config = loadConfig();
    const reportPath = path.join(config.logDir, "download-result.json");
    await fs.mkdir(config.logDir, { recursive: true });
    await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  } catch (error) {
    console.error("Failed to run downloader.", error);
    process.exitCode = 1;
  }
}

void main();
