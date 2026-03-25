export interface AppConfig {
  baseUrl: string;
  boardUrl: string;
  boardId: string;
  boardName: string;
  dataDir: string;
  rawDir: string;
  metadataDir: string;
  logDir: string;
  requestTimeoutMs: number;
  requestRetryCount: number;
  requestRetryDelayMs: number;
  userAgent: string;
}

export interface RunSummary {
  downloaded: number;
  skipped: number;
  failed: number;
}

export interface DownloadOutcome {
  articleId: string;
  articleTitle: string;
  attachmentId: string;
  attachmentName: string;
  localPath?: string;
  reason?: string;
}

export interface DownloadExecutionResult extends RunSummary {
  downloadedItems: DownloadOutcome[];
  skippedItems: DownloadOutcome[];
  failedItems: DownloadOutcome[];
}

export interface RunMonthlyDownloadOptions {
  months?: number;
  dryRun?: boolean;
  crawlAllPages?: boolean;
}
