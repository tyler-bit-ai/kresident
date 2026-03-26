import type {
  DownloadOutcome,
  DownloadExecutionResult,
  RunMonthlyDownloadOptions,
} from "../domain/types";
import { StayForeignersDownloader } from "../application/downloader/download-stay-foreigners-files";
import { loadConfig } from "../infrastructure/config";
import { ImmigrationBoardClient } from "../infrastructure/immigration-board-client";
import {
  isEntryStatisticsAttachment,
  isLegacySecondFileAttachment,
} from "../infrastructure/parsers/immigration-board-parser";

export async function runMonthlyDownload(
  options: RunMonthlyDownloadOptions = {},
): Promise<DownloadExecutionResult> {
  const config = loadConfig();
  const client = new ImmigrationBoardClient(config);
  const downloader = new StayForeignersDownloader({ config });
  const monthlyArticles = await client.fetchMonthlyArticles({
    ...(options.crawlAllPages ? { allPages: true } : {}),
  });
  const scopedArticles = options.months
    ? monthlyArticles.slice(0, options.months)
    : monthlyArticles;

  const downloadTargets: Array<{
    article: (typeof scopedArticles)[number];
    attachment: Awaited<
      ReturnType<typeof client.fetchArticleAttachments>
    >["attachments"][number];
  }> = [];
  const articleLevelFailures: DownloadOutcome[] = [];

  for (const article of scopedArticles) {
    try {
      const articleAttachments = await client.fetchArticleAttachments(article);
      const matches = articleAttachments.attachments
        .filter(
          (attachment) =>
            isEntryStatisticsAttachment(attachment) ||
            isLegacySecondFileAttachment(attachment),
        )
        .map((attachment) => ({ article, attachment }));
      downloadTargets.push(...matches);
    } catch (error) {
      articleLevelFailures.push({
        articleId: article.articleId,
        articleTitle: article.title,
        attachmentId: "article-scan",
        attachmentName: "(attachment scan failed)",
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const downloadResult = await downloader.download(
    downloadTargets,
    options.dryRun ? { dryRun: true } : {},
  );

  return {
    downloaded: downloadResult.downloaded,
    skipped: downloadResult.skipped,
    failed: downloadResult.failed + articleLevelFailures.length,
    downloadedItems: downloadResult.downloadedItems,
    skippedItems: downloadResult.skippedItems,
    failedItems: [...downloadResult.failedItems, ...articleLevelFailures],
  };
}
