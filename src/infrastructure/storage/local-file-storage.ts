import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import type { AttachmentCandidate, BoardArticle } from "../../domain/article";

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_");
}

function extractPeriodFromArticle(article: BoardArticle): { year: string; month: string } {
  const titleMatch = article.title.match(/(\d{4})년\s*(\d{1,2})월/);
  if (titleMatch?.[1] && titleMatch?.[2]) {
    return {
      year: titleMatch[1],
      month: titleMatch[2].padStart(2, "0"),
    };
  }

  const publishedMatch = article.publishedAt.match(/(\d{4})\.(\d{2})\./);
  if (!publishedMatch?.[1] || !publishedMatch?.[2]) {
    throw new Error(`Unable to resolve archive period from article ${article.articleId}`);
  }

  return {
    year: publishedMatch[1],
    month: publishedMatch[2],
  };
}

export class LocalFileStorage {
  constructor(private readonly rawDir: string) {}

  resolveTargetPath(article: BoardArticle, attachment: AttachmentCandidate): string {
    const period = extractPeriodFromArticle(article);
    const safeFileName = sanitizeFileName(attachment.name);
    return path.join(this.rawDir, period.year, `${period.year}-${period.month}`, safeFileName);
  }

  async writeTempFile(targetPath: string, content: Buffer): Promise<string> {
    const directory = path.dirname(targetPath);
    await fs.mkdir(directory, { recursive: true });

    const tempPath = `${targetPath}.part`;
    await fs.writeFile(tempPath, content);
    return tempPath;
  }

  async finalizeTempFile(tempPath: string, targetPath: string): Promise<void> {
    await fs.rename(tempPath, targetPath);
  }

  async removeIfExists(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }

  async statFile(filePath: string): Promise<{ size: number }> {
    const stats = await fs.stat(filePath);
    return { size: stats.size };
  }

  createChecksum(content: Buffer): string {
    return crypto.createHash("sha256").update(content).digest("hex");
  }
}
