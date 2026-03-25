export type DownloadStatus = "downloaded" | "skipped" | "failed";

export interface DownloadRecord {
  sourceBoardId: string;
  sourceBoardName: string;
  articleId: string;
  articleTitle: string;
  publishedAt: string;
  attachmentId: string;
  attachmentName: string;
  attachmentUrl: string;
  localPath: string;
  downloadedAt: string;
  status: DownloadStatus;
  checksum: string | null;
}

export interface DownloadRecordKey {
  articleId: string;
  attachmentName: string;
}

export interface DownloadRegistry {
  version: 1;
  records: DownloadRecord[];
}
