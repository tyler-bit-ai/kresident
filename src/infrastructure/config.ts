import path from "node:path";
import process from "node:process";
import dotenv from "dotenv";

import type { AppConfig } from "../domain/types";

dotenv.config();

function parseNumber(name: string, fallback: number): number {
  const rawValue = process.env[name];
  if (!rawValue) {
    return fallback;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Environment variable ${name} must be a valid integer.`);
  }

  return parsed;
}

function resolveDir(defaultRelativePath: string, envValue?: string): string {
  const target = envValue ?? defaultRelativePath;
  return path.resolve(process.cwd(), target);
}

export function loadConfig(): AppConfig {
  return {
    baseUrl: process.env.BASE_URL ?? "https://www.immigration.go.kr",
    boardUrl:
      process.env.BOARD_URL ??
      "https://www.immigration.go.kr/immigration/1569/subview.do",
    boardId: process.env.BOARD_ID ?? "227",
    boardName: process.env.BOARD_NAME ?? "immigration-monthly-statistics",
    dataDir: resolveDir("./data", process.env.DATA_DIR),
    rawDir: resolveDir("./data/raw", process.env.RAW_DIR),
    metadataDir: resolveDir("./data/metadata", process.env.METADATA_DIR),
    logDir: resolveDir("./logs", process.env.LOG_DIR),
    requestTimeoutMs: parseNumber("REQUEST_TIMEOUT_MS", 15000),
    requestRetryCount: parseNumber("REQUEST_RETRY_COUNT", 3),
    requestRetryDelayMs: parseNumber("REQUEST_RETRY_DELAY_MS", 1000),
    userAgent: process.env.USER_AGENT ?? "kresident-downloader/0.1",
  };
}
