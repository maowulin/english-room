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

type ApiClientOptions = {
  baseUrl: string;
  fetcher?: typeof fetch;
};

export class ApiClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiClientError";
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
      throw new ApiClientError(`Backend health check failed (HTTP ${response.status})`);
    }
    const payload: unknown = await response.json();
    if (!isHealthStatus(payload)) {
      throw new ApiClientError("Backend health check returned an invalid payload");
    }
    return payload;
  }
}
