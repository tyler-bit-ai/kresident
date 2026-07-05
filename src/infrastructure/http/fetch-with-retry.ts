import { setTimeout as delay } from "node:timers/promises";

import type { AppConfig } from "../../domain/types";
import { HttpRequestError } from "../../domain/errors";

async function fetchWithRetry(
  url: string,
  config: AppConfig,
  init: RequestInit = {},
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= config.requestRetryCount; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs);

    try {
      const response = await fetch(url, {
        ...init,
        headers: {
          ...(init.headers ?? {}),
          "user-agent": config.userAgent,
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "accept-language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
        },
        redirect: "follow",
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new HttpRequestError(
          `Request failed with status ${response.status} for ${url}`,
        );
      }

      return response;
    } catch (error) {
      lastError = error;
      if (attempt < config.requestRetryCount) {
        await delay(config.requestRetryDelayMs);
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new HttpRequestError(
    `Unable to fetch ${url} after ${config.requestRetryCount} attempts: ${describeError(
      lastError,
    )}`,
  );
}

/**
 * Node's fetch (undici) wraps low-level connection failures (ECONNREFUSED,
 * timeouts, TLS errors) in a generic "TypeError: fetch failed" whose real
 * cause is buried in `.cause`, sometimes nested more than one level deep.
 * Surface the full chain so a network-level block is distinguishable from
 * an HTTP-level rejection at a glance.
 */
function describeError(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;

  while (current) {
    if (current instanceof Error) {
      parts.push(`${current.name}: ${current.message}`);
      current = current.cause;
    } else {
      parts.push(String(current));
      break;
    }
  }

  return parts.join(" -> caused by -> ");
}

export async function fetchTextWithRetry(
  url: string,
  config: AppConfig,
  init: RequestInit = {},
): Promise<string> {
  const response = await fetchWithRetry(url, config, init);
  return await response.text();
}

export async function fetchBufferWithRetry(
  url: string,
  config: AppConfig,
): Promise<Buffer> {
  const response = await fetchWithRetry(url, config);
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
