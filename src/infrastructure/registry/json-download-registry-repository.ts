import fs from "node:fs/promises";
import path from "node:path";

import type {
  DownloadRecord,
  DownloadRecordKey,
  DownloadRegistry,
} from "../../domain/download";
import { ParsingError } from "../../domain/errors";
import type { AppConfig } from "../../domain/types";
import type { DownloadRegistryRepository } from "./download-registry-repository";

const REGISTRY_VERSION = 1;
const REGISTRY_FILE_NAME = "download-registry.json";

function createEmptyRegistry(): DownloadRegistry {
  return {
    version: REGISTRY_VERSION,
    records: [],
  };
}

export class JsonDownloadRegistryRepository
  implements DownloadRegistryRepository
{
  private readonly registryPath: string;

  constructor(private readonly config: AppConfig) {
    this.registryPath = path.join(this.config.metadataDir, REGISTRY_FILE_NAME);
  }

  async listRecords(): Promise<DownloadRecord[]> {
    const registry = await this.readRegistry();
    return registry.records;
  }

  async isAlreadyDownloaded(recordKey: DownloadRecordKey): Promise<boolean> {
    const records = await this.listRecords();
    return records.some(
      (record) =>
        record.articleId === recordKey.articleId &&
        record.attachmentName === recordKey.attachmentName,
    );
  }

  async saveRecord(record: DownloadRecord): Promise<void> {
    const registry = await this.readRegistry();
    const deduplicatedRecords = registry.records.filter(
      (existingRecord) =>
        !(
          existingRecord.articleId === record.articleId &&
          existingRecord.attachmentName === record.attachmentName
        ),
    );

    const nextRegistry: DownloadRegistry = {
      version: REGISTRY_VERSION,
      records: [...deduplicatedRecords, record],
    };

    await this.writeRegistry(nextRegistry);
  }

  async readRegistry(): Promise<DownloadRegistry> {
    await fs.mkdir(this.config.metadataDir, { recursive: true });

    try {
      const content = await fs.readFile(this.registryPath, "utf8");
      const parsed = JSON.parse(content) as Partial<DownloadRegistry>;

      if (
        parsed.version !== REGISTRY_VERSION ||
        !Array.isArray(parsed.records)
      ) {
        throw new ParsingError(
          `Registry file has invalid shape: ${this.registryPath}`,
        );
      }

      return {
        version: REGISTRY_VERSION,
        records: parsed.records,
      };
    } catch (error) {
      const errorCode = (error as NodeJS.ErrnoException).code;
      if (errorCode === "ENOENT") {
        const emptyRegistry = createEmptyRegistry();
        await this.writeRegistry(emptyRegistry);
        return emptyRegistry;
      }

      await this.backupCorruptedRegistry();
      const emptyRegistry = createEmptyRegistry();
      await this.writeRegistry(emptyRegistry);
      return emptyRegistry;
    }
  }

  private async writeRegistry(registry: DownloadRegistry): Promise<void> {
    await fs.mkdir(this.config.metadataDir, { recursive: true });

    const tempPath = `${this.registryPath}.tmp`;
    await fs.writeFile(tempPath, `${JSON.stringify(registry, null, 2)}\n`, "utf8");
    await fs.rename(tempPath, this.registryPath);
  }

  private async backupCorruptedRegistry(): Promise<void> {
    try {
      await fs.access(this.registryPath);
    } catch {
      return;
    }

    const backupPath = path.join(
      this.config.metadataDir,
      `download-registry.corrupt-${Date.now()}.json`,
    );

    await fs.rename(this.registryPath, backupPath);
  }
}
