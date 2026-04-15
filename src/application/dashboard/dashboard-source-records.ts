import fs from "node:fs/promises";
import path from "node:path";

import type { DownloadRecord } from "../../domain/download";
import type { AppConfig } from "../../domain/types";
import { loadDownloadRegistry } from "../../infrastructure/registry/load-download-registry";

const REGISTRY_FILE_NAME = "download-registry.json";

function isExcelFile(filePath: string): boolean {
  const name = path.basename(filePath).toLowerCase();
  return (name.endsWith(".xls") || name.endsWith(".xlsx")) && !name.startsWith("~$");
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function collectExcelFiles(rootDir: string): Promise<string[]> {
  const collected: string[] = [];

  async function walk(currentDir: string): Promise<void> {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const nextPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(nextPath);
        continue;
      }
      if (entry.isFile() && isExcelFile(nextPath)) {
        collected.push(nextPath);
      }
    }
  }

  if (await pathExists(rootDir)) {
    await walk(rootDir);
  }

  return collected.sort((left, right) => left.localeCompare(right, "en"));
}

function createManualRecord(config: AppConfig, localPath: string): DownloadRecord {
  const relativePath = path.relative(config.rawDir, localPath);
  const normalizedId = relativePath.replace(/[\\/]/g, "-");
  const parsed = path.parse(localPath);
  return {
    sourceBoardId: config.boardId,
    sourceBoardName: config.boardName,
    articleId: `manual-${normalizedId}`,
    articleTitle: `Manual raw source: ${relativePath}`,
    publishedAt: "",
    attachmentId: `manual-${normalizedId}`,
    attachmentName: parsed.base,
    attachmentUrl: "",
    localPath,
    downloadedAt: "",
    status: "downloaded",
    checksum: null,
  };
}

export async function listDashboardSourceRecords(
  config: AppConfig,
): Promise<DownloadRecord[]> {
  const registryPath = path.join(config.metadataDir, REGISTRY_FILE_NAME);
  const registry = await loadDownloadRegistry(registryPath);
  const registryRecords = registry.records.filter(
    (record) => isExcelFile(record.localPath),
  );

  const recordByPath = new Map<string, DownloadRecord>();
  for (const record of registryRecords) {
    recordByPath.set(path.resolve(record.localPath), record);
  }

  const rawExcelFiles = await collectExcelFiles(config.rawDir);
  for (const rawFile of rawExcelFiles) {
    const resolved = path.resolve(rawFile);
    if (!recordByPath.has(resolved)) {
      recordByPath.set(resolved, createManualRecord(config, resolved));
    }
  }

  return [...recordByPath.values()].sort((left, right) =>
    left.localPath.localeCompare(right.localPath, "en"),
  );
}
