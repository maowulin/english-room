import { ApiClient } from "@/services/api-client";

describe("ApiClient", () => {
  it("returns the FastAPI health status", async () => {
    const fetcher = jest.fn<Promise<Response>, [RequestInfo | URL]>();
    fetcher.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        service: "english-room-api",
        status: "ok",
      }),
    } as Response);
    const client = new ApiClient({
      baseUrl: "http://localhost:8000/",
      fetcher,
    });

    await expect(client.getHealth()).resolves.toEqual({
      service: "english-room-api",
      status: "ok",
    });
    expect(fetcher).toHaveBeenCalledWith("http://localhost:8000/health");
  });

  it("rejects an unsuccessful health response", async () => {
    const fetcher = jest.fn<Promise<Response>, [RequestInfo | URL]>();
    fetcher.mockResolvedValue({
      ok: false,
      status: 503,
    } as Response);
    const client = new ApiClient({
      baseUrl: "http://localhost:8000",
      fetcher,
    });

    await expect(client.getHealth()).rejects.toThrow(
      "后端健康检查失败（HTTP 503）",
    );
  });

  it("rejects an invalid health payload", async () => {
    const fetcher = jest.fn<Promise<Response>, [RequestInfo | URL]>();
    fetcher.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: "unknown" }),
    } as Response);
    const client = new ApiClient({
      baseUrl: "http://localhost:8000",
      fetcher,
    });

    await expect(client.getHealth()).rejects.toThrow(
      "后端健康检查返回格式无效",
    );
  });

  it("sends analytics events and validates the safe response shape", async () => {
    const fetcher = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>();
    fetcher.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        accepted: 1,
        duplicates: 0,
        rejected: 0,
        request_id: "request-1",
      }),
    } as Response);
    const client = new ApiClient({
      baseUrl: "http://localhost:8000",
      fetcher,
    });

    const events = [
      {
        event_id: "00000000-0000-4000-8000-000000000001",
        event_name: "app_opened",
        event_version: 1,
        occurred_at: "2026-07-27T12:00:00.000Z",
        anonymous_user_id: "anon_00000000-0000-4000-8000-000000000002",
        session_id: "session_00000000-0000-4000-8000-000000000003",
        environment: "local",
        platform: "ios",
        app_version: "1.0.0",
        properties: { entry_source: "cold_start" },
      },
    ] as const;

    await expect(client.sendAnalyticsEvents(events)).resolves.toEqual({
      accepted: 1,
      duplicates: 0,
      rejected: 0,
      request_id: "request-1",
    });
    expect(fetcher).toHaveBeenCalledWith(
      "http://localhost:8000/v1/analytics/events",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ events }),
      }),
    );
  });

  it("does not expose an analytics error response body", async () => {
    const fetcher = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>();
    fetcher.mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => "secret raw response",
    } as Response);
    const client = new ApiClient({
      baseUrl: "http://localhost:8000",
      fetcher,
    });

    await expect(client.sendAnalyticsEvents([])).rejects.toMatchObject({
      message: "埋点上报失败（HTTP 503）",
      retryable: true,
    });
    await expect(client.sendAnalyticsEvents([])).rejects.not.toThrow(
      "secret raw response",
    );
  });

  it("aborts an analytics request after the configured timeout", async () => {
    const fetcher = jest.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
        });
      });
    });
    const client = new ApiClient({
      baseUrl: "http://localhost:8000",
      fetcher,
      analyticsTimeoutMs: 1,
    });

    await expect(client.sendAnalyticsEvents([])).rejects.toMatchObject({
      name: "ApiClientError",
      retryable: true,
    });
    expect(fetcher.mock.calls[0][1]?.signal?.aborted).toBe(true);
  });
});
