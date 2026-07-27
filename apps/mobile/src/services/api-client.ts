import type {
  AnalyticsEvent,
  AnalyticsEventsResponse,
} from "@/analytics/event-catalog";

export type HealthStatus = {
  service: "english-room-api";
  status: "ok";
};

function isHealthStatus(value: unknown): value is HealthStatus {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return candidate.service === "english-room-api" && candidate.status === "ok";
}

function isAnalyticsEventsResponse(
  value: unknown,
): value is AnalyticsEventsResponse {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    Number.isInteger(candidate.accepted) &&
    typeof candidate.accepted === "number" &&
    candidate.accepted >= 0 &&
    Number.isInteger(candidate.duplicates) &&
    typeof candidate.duplicates === "number" &&
    candidate.duplicates >= 0 &&
    Number.isInteger(candidate.rejected) &&
    typeof candidate.rejected === "number" &&
    candidate.rejected >= 0 &&
    typeof candidate.request_id === "string" &&
    candidate.request_id.length > 0 &&
    candidate.request_id.length <= 128
  );
}

type ApiClientOptions = {
  baseUrl: string;
  fetcher?: typeof fetch;
};

export class ApiClientError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
  }
}

export class ApiClient {
  private readonly baseUrl: string;
  private readonly fetcher: typeof fetch;

  constructor({ baseUrl, fetcher = fetch }: ApiClientOptions) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.fetcher = fetcher;
  }

  async getHealth(): Promise<HealthStatus> {
    const response = await this.fetcher(`${this.baseUrl}/health`);
    if (!response.ok) {
      throw new ApiClientError(
        `后端健康检查失败（HTTP ${response.status}）`,
        response.status,
      );
    }
    const payload: unknown = await response.json();
    if (!isHealthStatus(payload)) {
      throw new ApiClientError("后端健康检查返回格式无效");
    }
    return payload;
  }

  async sendAnalyticsEvents(
    events: readonly AnalyticsEvent[],
  ): Promise<AnalyticsEventsResponse> {
    const response = await this.fetcher(`${this.baseUrl}/v1/analytics/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events }),
    });

    if (!response.ok) {
      throw new ApiClientError(
        `埋点上报失败（HTTP ${response.status}）`,
        response.status,
      );
    }

    const payload: unknown = await response.json();
    if (!isAnalyticsEventsResponse(payload)) {
      throw new ApiClientError("埋点上报返回格式无效");
    }
    return payload;
  }
}
