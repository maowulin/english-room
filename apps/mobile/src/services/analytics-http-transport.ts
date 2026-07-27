import type { AnalyticsRecord, AnalyticsTransport } from "@/services/analytics-client";

export type AnalyticsFetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export type HttpAnalyticsTransportOptions = {
  baseUrl: string;
  getAccessToken: () => string | undefined;
  fetcher?: AnalyticsFetcher;
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 15_000;
const ANALYTICS_EVENTS_PATH = "/v1/analytics/events";

function resolveFetcher(fetcher?: AnalyticsFetcher): AnalyticsFetcher {
  const runtime = fetcher ?? globalThis.fetch?.bind(globalThis);
  if (!runtime) {
    throw new Error("当前运行环境未提供 fetch，无法发送 Analytics");
  }
  return runtime;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, "");
}

/** POST one or more wire records; batch API for future multi-event sends. */
export async function sendAnalyticsEvents(
  options: HttpAnalyticsTransportOptions,
  records: AnalyticsRecord[],
): Promise<void> {
  if (records.length === 0) {
    return;
  }

  const token = options.getAccessToken()?.trim();
  if (!token) {
    return;
  }

  const fetcher = resolveFetcher(options.fetcher);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetcher(`${normalizeBaseUrl(options.baseUrl)}${ANALYTICS_EVENTS_PATH}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ events: records }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Analytics 请求失败（HTTP ${response.status}）`);
    }
  } finally {
    clearTimeout(timeoutId);
  }
}

export function createHttpAnalyticsTransport(
  options: HttpAnalyticsTransportOptions,
): AnalyticsTransport {
  return async (record) => {
    await sendAnalyticsEvents(options, [record]);
  };
}
