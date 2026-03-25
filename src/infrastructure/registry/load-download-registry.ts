import fs from "node:fs/promises";

import type { DownloadRegistry } from "../../domain/download";

export async function loadDownloadRegistry(
  registryPath: string,
): Promise<DownloadRegistry> {
  const content = await fs.readFile(registryPath, "utf8");
  return JSON.parse(content) as DownloadRegistry;
}
