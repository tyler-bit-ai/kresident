import fs from "node:fs/promises";
import path from "node:path";

export class ExecutionLogger {
  private readonly logPath: string;

  constructor(private readonly logDir: string) {
    this.logPath = path.join(this.logDir, "download.log");
  }

  async info(message: string, payload?: unknown): Promise<void> {
    await this.write("INFO", message, payload);
  }

  async error(message: string, payload?: unknown): Promise<void> {
    await this.write("ERROR", message, payload);
  }

  private async write(level: "INFO" | "ERROR", message: string, payload?: unknown): Promise<void> {
    await fs.mkdir(this.logDir, { recursive: true });

    const line = JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      message,
      payload: payload ?? null,
    });

    await fs.appendFile(this.logPath, `${line}\n`, "utf8");
  }
}
