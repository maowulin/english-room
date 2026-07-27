import {
  ANALYTICS_SCHEMA_VERSION,
  type AnalyticsEventName,
  type AnalyticsRecord,
} from "@/services/analytics-client";
import {
  AnalyticsHttpError,
  sendAnalyticsEvents,
} from "@/services/analytics-http-transport";
import {
  AnalyticsBatcher,
  FLUSH_INTERVAL_MS,
  MAX_BATCH_SIZE,
  MAX_QUEUE_SIZE,
  REQUEST_TIMEOUT_MS,
  createBufferedHttpAnalyticsTransport,
  type AnalyticsDiagnosticDrop,
} from "@/services/analytics-batcher";

function sampleRecord(
  overrides: Partial<AnalyticsRecord> & { event_name?: AnalyticsEventName } = {},
): AnalyticsRecord {
  return {
    event_id: overrides.event_id ?? `evt-${Math.random().toString(36).slice(2, 10)}`,
    event_name: overrides.event_name ?? "room_joined",
    schema_version: ANALYTICS_SCHEMA_VERSION,
    user_id: "user-test",
    app_session_id: "session-test",
    occurred_at: "2026-07-27T01:30:00.000Z",
    app_version: "1.0.0-test",
    platform: "ios",
    environment: "development",
    producer: "client",
    properties: {},
    ...overrides,
  };
}

describe("AnalyticsBatcher", () => {
  const cleanups: Array<() => void> = [];

  function trackBatcher(batcher: AnalyticsBatcher): AnalyticsBatcher {
    cleanups.push(() => batcher.destroy());
    return batcher;
  }

  afterEach(() => {
    cleanups.forEach((cleanup) => cleanup());
    cleanups.length = 0;
    jest.useRealTimers();
    jest.clearAllTimers();
  });

  it("enqueue returns immediately without awaiting network", () => {
    const fetcher = jest.fn(
      () =>
        new Promise<Response>(() => {
          /* never settles */
        }),
    );
    const batcher = trackBatcher(new AnalyticsBatcher({
      baseUrl: "http://api.example",
      getAccessToken: () => "token",
      fetcher: fetcher as typeof fetch,
    }));

    const transport = batcher.createTransport();
    const started = Date.now();
    transport(sampleRecord());
    expect(Date.now() - started).toBeLessThan(20);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("sends up to MAX_BATCH_SIZE records in one POST", async () => {
    const bodies: unknown[] = [];
    const fetcher = jest.fn().mockImplementation(async (_url, init) => {
      bodies.push(JSON.parse(String(init?.body)));
      return { ok: true, status: 202 };
    });

    const batcher = trackBatcher(new AnalyticsBatcher({
      baseUrl: "http://api.example",
      getAccessToken: () => "token",
      fetcher: fetcher as typeof fetch,
    }));
    const transport = batcher.createTransport();

    for (let index = 0; index < MAX_BATCH_SIZE; index += 1) {
      transport(sampleRecord({ event_id: `batch-${index}` }));
    }

    await batcher.flush("manual");

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(bodies[0]).toEqual({
      events: expect.arrayContaining([
        expect.objectContaining({ event_id: "batch-0" }),
        expect.objectContaining({ event_id: `batch-${MAX_BATCH_SIZE - 1}` }),
      ]),
    });
    expect((bodies[0] as { events: unknown[] }).events).toHaveLength(MAX_BATCH_SIZE);
  });

  it("flush sends a partial batch", async () => {
    const fetcher = jest.fn().mockResolvedValue({ ok: true, status: 202 });
    const batcher = trackBatcher(new AnalyticsBatcher({
      baseUrl: "http://api.example",
      getAccessToken: () => "token",
      fetcher: fetcher as typeof fetch,
    }));
    batcher.createTransport()(sampleRecord({ event_id: "solo-1" }));
    batcher.createTransport()(sampleRecord({ event_id: "solo-2" }));

    await batcher.flush("background");

    expect(fetcher).toHaveBeenCalledTimes(1);
    const body = JSON.parse(String((fetcher.mock.calls[0][1] as RequestInit).body)) as {
      events: AnalyticsRecord[];
    };
    expect(body.events.map((event) => event.event_id)).toEqual(["solo-1", "solo-2"]);
  });

  it("uses REQUEST_TIMEOUT_MS by default for HTTP sends", async () => {
    jest.useFakeTimers();
    const fetcher = jest.fn((_url: string, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      });
    });

    const batcher = trackBatcher(new AnalyticsBatcher({
      baseUrl: "http://api.example",
      getAccessToken: () => "token",
      fetcher: fetcher as typeof fetch,
      maxRetryAttempts: 0,
    }));
    batcher.createTransport()(sampleRecord());
    const pending = batcher.flush("manual");

    await jest.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS + 1);
    await pending;

    expect(fetcher).toHaveBeenCalledTimes(1);
    const init = fetcher.mock.calls[0]?.[1] as RequestInit;
    expect(init.signal).toBeDefined();
  });

  it("retries retryable HTTP failures with the same event_id and backs off", async () => {
    jest.useFakeTimers();
    const fetcher = jest
      .fn()
      .mockRejectedValueOnce(new AnalyticsHttpError("HTTP 503", 503))
      .mockRejectedValueOnce(new AnalyticsHttpError("HTTP 503", 503))
      .mockResolvedValue({ ok: true, status: 202 });

    const batcher = trackBatcher(new AnalyticsBatcher({
      baseUrl: "http://api.example",
      getAccessToken: () => "token",
      fetcher: fetcher as typeof fetch,
      retryBackoffMs: [1000, 5000, 30000],
      random: () => 0.5,
    }));

    batcher.createTransport()(sampleRecord({ event_id: "stable-id" }));
    const pending = batcher.flush("manual");
    await jest.advanceTimersByTimeAsync(60_000);
    await pending;

    expect(fetcher).toHaveBeenCalledTimes(3);
    for (const call of fetcher.mock.calls) {
      const body = JSON.parse(String((call[1] as RequestInit).body)) as {
        events: AnalyticsRecord[];
      };
      expect(body.events[0]?.event_id).toBe("stable-id");
    }
  });

  it("retries HTTP 408 and 429 before succeeding", async () => {
    jest.useFakeTimers();
    const fetcher = jest
      .fn()
      .mockRejectedValueOnce(new AnalyticsHttpError("HTTP 408", 408))
      .mockRejectedValueOnce(new AnalyticsHttpError("HTTP 429", 429))
      .mockResolvedValue({ ok: true, status: 202 });

    const batcher = trackBatcher(new AnalyticsBatcher({
      baseUrl: "http://api.example",
      getAccessToken: () => "token",
      fetcher: fetcher as typeof fetch,
      retryBackoffMs: [100, 100, 100],
      random: () => 0.5,
    }));

    batcher.createTransport()(sampleRecord({ event_id: "retry-status" }));
    const pending = batcher.flush("manual");
    await jest.advanceTimersByTimeAsync(10_000);
    await pending;

    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("does not retry HTTP 400 and records validation_failed diagnostic", async () => {
    const drops: AnalyticsDiagnosticDrop[] = [];
    const fetcher = jest.fn().mockRejectedValue(new AnalyticsHttpError("HTTP 400", 400));

    const batcher = trackBatcher(new AnalyticsBatcher({
      baseUrl: "http://api.example",
      getAccessToken: () => "token",
      fetcher: fetcher as typeof fetch,
      onDiagnosticDrop: (drop) => drops.push(drop),
    }));

    batcher.createTransport()(sampleRecord({ event_name: "room_created" }));
    await batcher.flush("manual");

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(drops).toEqual([
      expect.objectContaining({
        original_event_name: "room_created",
        drop_reason_code: "validation_failed",
        sink_type: "first_party",
        attempt_count: 1,
      }),
    ]);
  });

  it.each([
    [401, "validation_failed"],
    [403, "validation_failed"],
    [413, "request_too_large"],
    [422, "transport_failed"],
  ] as const)("does not retry HTTP %i", async (status, dropReason) => {
    const drops: AnalyticsDiagnosticDrop[] = [];
    const fetcher = jest.fn().mockRejectedValue(new AnalyticsHttpError(`HTTP ${status}`, status));

    const batcher = trackBatcher(new AnalyticsBatcher({
      baseUrl: "http://api.example",
      getAccessToken: () => "token",
      fetcher: fetcher as typeof fetch,
      onDiagnosticDrop: (drop) => drops.push(drop),
    }));

    batcher.createTransport()(sampleRecord({ event_name: "room_joined" }));
    await batcher.flush("manual");

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(drops[0]?.drop_reason_code).toBe(dropReason);
  });

  it("drops P0 events first when queue exceeds MAX_QUEUE_SIZE", async () => {
    const drops: AnalyticsDiagnosticDrop[] = [];
    const fetcher = jest.fn().mockResolvedValue({ ok: true, status: 202 });

    const batcher = trackBatcher(new AnalyticsBatcher({
      baseUrl: "http://api.example",
      getAccessToken: () => "token",
      fetcher: fetcher as typeof fetch,
      onDiagnosticDrop: (drop) => drops.push(drop),
    }));
    const transport = batcher.createTransport();

    transport(sampleRecord({ event_name: "app_opened", event_id: "p0-old" }));
    for (let index = 0; index < MAX_QUEUE_SIZE; index += 1) {
      transport(sampleRecord({ event_id: `p1-${index}` }));
    }
    transport(sampleRecord({ event_name: "room_ended", event_id: "p1-new" }));

    await batcher.flush("manual");

    const ids = fetcher.mock.calls.flatMap((call) => {
      const body = JSON.parse(String((call[1] as RequestInit).body)) as { events: AnalyticsRecord[] };
      return body.events.map((event) => event.event_id);
    });
    expect(ids).not.toContain("p0-old");
    expect(ids).toContain("p1-new");
    expect(drops.some((drop) => drop.drop_reason_code === "queue_overflow")).toBe(true);
  });

  it("schedules periodic flush on FLUSH_INTERVAL_MS", async () => {
    jest.useFakeTimers();
    const fetcher = jest.fn().mockResolvedValue({ ok: true, status: 202 });
    const batcher = trackBatcher(new AnalyticsBatcher({
      baseUrl: "http://api.example",
      getAccessToken: () => "token",
      fetcher: fetcher as typeof fetch,
      flushIntervalMs: FLUSH_INTERVAL_MS,
    }));

    batcher.createTransport()(sampleRecord());
    expect(fetcher).not.toHaveBeenCalled();

    jest.advanceTimersByTime(FLUSH_INTERVAL_MS);
    await batcher.flush("manual");

    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("createBufferedHttpAnalyticsTransport exposes flush", async () => {
    const fetcher = jest.fn().mockResolvedValue({ ok: true, status: 202 });
    const buffered = createBufferedHttpAnalyticsTransport({
      baseUrl: "http://api.example",
      getAccessToken: () => "token",
      fetcher: fetcher as typeof fetch,
    });
    cleanups.push(() => buffered.destroy());

    await Promise.resolve(buffered.transport(sampleRecord()));
    await buffered.flush("shutdown");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe("sendAnalyticsEvents retry classification", () => {
  it("throws AnalyticsHttpError with status for non-OK responses", async () => {
    const fetcher = jest.fn().mockResolvedValue({ ok: false, status: 429 });
    await expect(
      sendAnalyticsEvents(
        {
          baseUrl: "http://api.example",
          getAccessToken: () => "token",
          fetcher: fetcher as typeof fetch,
        },
        [sampleRecord()],
      ),
    ).rejects.toMatchObject({ status: 429 });
  });
});
