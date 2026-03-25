import type { AttachmentCandidate, BoardArticle } from "../../domain/article";
import type { DownloadRecord } from "../../domain/download";
import type {
  AppConfig,
  DownloadExecutionResult,
  DownloadOutcome,
} from "../../domain/types";
import { fetchBufferWithRetry } from "../../infrastructure/http/fetch-with-retry";
import { ExecutionLogger } from "../../infrastructure/logging/execution-logger";
import {
  type DownloadRegistryRepository,
  JsonDownloadRegistryRepository,
} from "../../infrastructure/registry";
import { LocalFileStorage } from "../../infrastructure/storage/local-file-storage";

interface DownloaderDependencies {
  config: AppConfig;
  registryRepository?: DownloadRegistryRepository;
  logger?: ExecutionLogger;
  fileStorage?: LocalFileStorage;
}

function createOutcome(
  article: BoardArticle,
  attachment: AttachmentCandidate,
  extra?: Partial<DownloadOutcome>,
): DownloadOutcome {
  return {
    articleId: article.articleId,
    articleTitle: article.title,
    attachmentId: attachment.attachmentId,
    attachmentName: attachment.name,
    ...extra,
  };
}

export class StayForeignersDownloader {
  private readonly registryRepository: DownloadRegistryRepository;
  private readonly logger: ExecutionLogger;
  private readonly fileStorage: LocalFileStorage;

  constructor(private readonly dependencies: DownloaderDependencies) {
    this.registryRepository =
      dependencies.registryRepository ??
      new JsonDownloadRegistryRepository(dependencies.config);
    this.logger =
      dependencies.logger ?? new ExecutionLogger(dependencies.config.logDir);
    this.fileStorage =
      dependencies.fileStorage ?? new LocalFileStorage(dependencies.config.rawDir);
  }

  async download(
    items: Array<{ article: BoardArticle; attachment: AttachmentCandidate }>,
    options: { dryRun?: boolean } = {},
  ): Promise<DownloadExecutionResult> {
    const downloadedItems: DownloadOutcome[] = [];
    const skippedItems: DownloadOutcome[] = [];
    const failedItems: DownloadOutcome[] = [];

    for (const item of items) {
      const { article, attachment } = item;
      const duplicate = await this.registryRepository.isAlreadyDownloaded({
        articleId: article.articleId,
        attachmentName: attachment.name,
      });

      if (duplicate) {
        const outcome = createOutcome(article, attachment, {
          reason: "Already downloaded",
        });
        skippedItems.push(outcome);
        await this.logger.info("Skipped existing attachment", outcome);
        continue;
      }

      if (options.dryRun) {
        const outcome = createOutcome(article, attachment, {
          reason: "Dry run: not downloaded",
        });
        skippedItems.push(outcome);
        await this.logger.info("Dry-run preview for attachment", outcome);
        continue;
      }

      const targetPath = this.fileStorage.resolveTargetPath(article, attachment);
      let tempPath: string | null = null;

      try {
        const content = await fetchBufferWithRetry(
          attachment.downloadUrl,
          this.dependencies.config,
        );

        if (content.byteLength === 0) {
          throw new Error("Downloaded file is empty.");
        }

        tempPath = await this.fileStorage.writeTempFile(targetPath, content);
        await this.fileStorage.finalizeTempFile(tempPath, targetPath);

        const savedFile = await this.fileStorage.statFile(targetPath);
        if (savedFile.size === 0) {
          throw new Error("Saved file size is zero.");
        }

        const record: DownloadRecord = {
          sourceBoardId: this.dependencies.config.boardId,
          sourceBoardName: this.dependencies.config.boardName,
          articleId: article.articleId,
          articleTitle: article.title,
          publishedAt: article.publishedAt,
          attachmentId: attachment.attachmentId,
          attachmentName: attachment.name,
          attachmentUrl: attachment.downloadUrl,
          localPath: targetPath,
          downloadedAt: new Date().toISOString(),
          status: "downloaded",
          checksum: this.fileStorage.createChecksum(content),
        };

        await this.registryRepository.saveRecord(record);

        const outcome = createOutcome(article, attachment, {
          localPath: targetPath,
        });
        downloadedItems.push(outcome);
        await this.logger.info("Downloaded attachment", outcome);
      } catch (error) {
        if (tempPath) {
          await this.fileStorage.removeIfExists(tempPath);
        }

        await this.fileStorage.removeIfExists(targetPath);

        const outcome = createOutcome(article, attachment, {
          reason: error instanceof Error ? error.message : String(error),
        });
        failedItems.push(outcome);
        await this.logger.error("Failed to download attachment", outcome);
      }
    }

    return {
      downloaded: downloadedItems.length,
      skipped: skippedItems.length,
      failed: failedItems.length,
      downloadedItems,
      skippedItems,
      failedItems,
    };
  }
}
