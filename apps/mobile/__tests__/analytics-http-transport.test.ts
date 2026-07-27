import {
  ANALYTICS_SCHEMA_VERSION,
  type AnalyticsRecord,
} from "@/services/analytics-client";
import {
  createHttpAnalyticsTransport,
  sendAnalyticsEvents,
} from "@/services/analytics-http-transport";

const sampleRecord = (): AnalyticsRecord => ({
  event_id: "11111111-1111-4111-8111-111111111111",
  event_name: "app_opened",
  schema_version: ANALYTICS_SCHEMA_VERSION,
  user_id: "user-anon-test-001",
  app_session_id: "app-session-test-001",
  occurred_at: "2026-07-27T01:30:00.000Z",
  app_version: "1.0.0-test",
  platform: "ios",
  environment: "development",
  producer: "client",
  properties: { entry_point: "cold_start" },
});

describe("HttpAnalyticsTransport", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("POSTs to /v1/analytics/events with Bearer, JSON body, and wire envelope", async () => {
    const fetcher = jest.fn().mockResolvedValue({ ok: true, status: 202 });
    const record = sampleRecord();

    await sendAnalyticsEvents(
      {
        baseUrl: "http://api.example/",
        getAccessToken: () => "secret-token",
        fetcher: fetcher as typeof fetch,
      },
      [record],
    );

    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://api.example/v1/analytics/events");
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer secret-token");
    expect(headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(String(init.body))).toEqual({ events: [record] });
    expect(String(init.body)).not.toContain("secret-token");
  });

  it("skips the network call when access token is missing", async () => {
    const fetcher = jest.fn();
    await sendAnalyticsEvents(
      {
        baseUrl: "http://api.example",
        getAccessToken: () => undefined,
        fetcher: fetcher as typeof fetch,
      },
      [sampleRecord()],
    );
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("rejects on non-OK HTTP without reading response body", async () => {
    const json = jest.fn();
    const fetcher = jest.fn().mockResolvedValue({ ok: false, status: 500, json });
    await expect(
      sendAnalyticsEvents(
        {
          baseUrl: "http://api.example",
          getAccessToken: () => "token",
          fetcher: fetcher as typeof fetch,
        },
        [sampleRecord()],
      ),
    ).rejects.toThrow(/HTTP 500/);
    expect(json).not.toHaveBeenCalled();
  });

  it("aborts the request when timeout elapses", async () => {
    const fetcher = jest.fn((_url: string, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      });
    });

    const pending = sendAnalyticsEvents(
      {
        baseUrl: "http://api.example",
        getAccessToken: () => "token",
        fetcher: fetcher as typeof fetch,
        timeoutMs: 50,
      },
      [sampleRecord()],
    );

    jest.advanceTimersByTime(60);
    await expect(pending).rejects.toThrow();
    const init = fetcher.mock.calls[0]?.[1] as RequestInit;
    expect(init.signal).toBeDefined();
  });

  it("createHttpAnalyticsTransport sends one record per invocation", async () => {
    const fetcher = jest.fn().mockResolvedValue({ ok: true, status: 202 });
    const transport = createHttpAnalyticsTransport({
      baseUrl: "http://api.example",
      getAccessToken: () => "token",
      fetcher: fetcher as typeof fetch,
    });

    await transport(sampleRecord());
    expect(fetcher).toHaveBeenCalledTimes(1);
    const body = JSON.parse(String((fetcher.mock.calls[0][1] as RequestInit).body)) as {
      events: AnalyticsRecord[];
    };
    expect(body.events).toHaveLength(1);
  });
});
