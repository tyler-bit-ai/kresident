import type {
  DownloadRecord,
  DownloadRecordKey,
  DownloadRegistry,
} from "../../domain/download";

export interface DownloadRegistryRepository {
  listRecords(): Promise<DownloadRecord[]>;
  isAlreadyDownloaded(recordKey: DownloadRecordKey): Promise<boolean>;
  saveRecord(record: DownloadRecord): Promise<void>;
  readRegistry(): Promise<DownloadRegistry>;
}
