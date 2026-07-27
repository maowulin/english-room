import {
  ANALYTICS_EVENT_NAMES,
  type AnalyticsEventProperties,
} from "@/analytics/event-catalog";
import {
  AnalyticsClient,
  type AnalyticsClock,
  type AnalyticsKeyValueStore,
  type AnalyticsScheduler,
  type AnalyticsTransport,
} from "@/analytics/analytics-client";

const fixedDate = new Date("2026-07-27T12:00:00.000Z");

class MemoryStore implements AnalyticsKeyValueStore {
  private readonly values = new Map<string, string>();

  async getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  async setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

class ImmediateScheduler implements AnalyticsScheduler {
  setInterval = jest.fn(() => 1);
  clearInterval = jest.fn();
  setTimeout = jest.fn((callback: () => void) => {
    callback();
    return 1;
  });
  clearTimeout = jest.fn();
}

function createClock(): AnalyticsClock {
  return { now: () => fixedDate };
}

function createUuidFactory() {
  let index = 0;
  return () => `00000000-0000-4000-8000-${String(++index).padStart(12, "0")}`;
}

function createClient(
  transport: AnalyticsTransport,
  store = new MemoryStore(),
  scheduler = new ImmediateScheduler(),
) {
  return new AnalyticsClient({
    transport,
    keyValueStore: store,
    clock: createClock(),
    uuidFactory: createUuidFactory(),
    scheduler,
    retryDelaysMs: [0, 0, 0],
  });
}

describe("analytics event catalog", () => {
  it("contains exactly the twelve contract event names", () => {
    expect(ANALYTICS_EVENT_NAMES).toHaveLength(12);
    expect(ANALYTICS_EVENT_NAMES).toEqual([
      "app_opened",
      "guest_session_created",
      "room_created",
      "room_joined",
      "room_ready_changed",
      "room_started",
      "rtc_connection_changed",
      "room_ended",
      "recording_status_changed",
      "score_report_viewed",
      "score_retry_requested",
      "ops_handoff_started",
    ]);
  });

  it("does not enqueue unknown property keys at runtime", async () => {
    const transport = jest.fn().mockResolvedValue({
      accepted: 1,
      duplicates: 0,
      rejected: 0,
      request_id: "request-1",
    });
    const client = createClient(transport);

    await client.startSession();
    client.track("app_opened", {
      entry_source: "cold_start",
      unknown_key: "must be rejected",
    } as AnalyticsEventProperties["app_opened"] & {
      unknown_key: string;
    });
    await client.flush("manual");

    expect(transport).not.toHaveBeenCalled();
  });

  it("ignores an unknown event name without throwing", async () => {
    const transport = jest.fn().mockResolvedValue({
      accepted: 1,
      duplicates: 0,
      rejected: 0,
      request_id: "request-1",
    });
    const client = createClient(transport);

    await client.startSession();
    expect(() =>
      client.track("unknown_event" as never, { entry_source: "cold_start" } as never),
    ).not.toThrow();
    await client.flush("manual");

    expect(transport).not.toHaveBeenCalled();
  });
});

describe("AnalyticsClient identity and queue", () => {
  it("persists an anonymous id and creates a new session for each start", async () => {
    const store = new MemoryStore();
    const transport = jest.fn().mockResolvedValue({
      accepted: 0,
      duplicates: 0,
      rejected: 0,
      request_id: "request-1",
    });
    const first = createClient(transport, store);
    await first.startSession();
    const firstSession = first.getSessionId();
    const firstAnonymousId = first.getAnonymousUserId();

    expect(firstAnonymousId).toMatch(/^anon_/);
    expect(firstSession).toMatch(/^session_/);
    expect(await store.getItem("@english-room/analytics/anonymous-user-id")).toBe(
      firstAnonymousId,
    );

    await first.startSession();
    expect(first.getSessionId()).not.toBe(firstSession);

    const second = createClient(transport, store);
    await second.startSession();
    expect(second.getAnonymousUserId()).toBe(firstAnonymousId);
    expect(second.getSessionId()).not.toBe(firstSession);
  });

  it("keeps track non-blocking, caps the queue, and flushes batches of twenty", async () => {
    const transport = jest.fn().mockResolvedValue({
      accepted: 20,
      duplicates: 0,
      rejected: 0,
      request_id: "request-1",
    });
    const client = createClient(transport);
    await client.startSession();

    for (let index = 0; index < 205; index += 1) {
      client.track("app_opened", { entry_source: "cold_start" });
    }

    expect(client.getQueueLength()).toBe(200);
    await client.flush("manual");

    expect(transport).toHaveBeenCalledTimes(10);
    expect(transport.mock.calls.every(([events]) => events.length <= 20)).toBe(
      true,
    );
    expect(client.getQueueLength()).toBe(0);
  });

  it("removes events acknowledged as accepted or duplicates", async () => {
    const transport = jest.fn().mockResolvedValue({
      accepted: 1,
      duplicates: 1,
      rejected: 0,
      request_id: "request-1",
    });
    const client = createClient(transport);
    await client.startSession();
    client.track("app_opened", { entry_source: "cold_start" });
    client.track("app_opened", { entry_source: "warm_resume" });

    await client.flush("manual");

    expect(client.getQueueLength()).toBe(0);
  });

  it("builds a safe event envelope without copying arbitrary input", async () => {
    const transport = jest.fn().mockResolvedValue({
      accepted: 1,
      duplicates: 0,
      rejected: 0,
      request_id: "request-1",
    });
    const client = new AnalyticsClient({
      transport,
      keyValueStore: new MemoryStore(),
      clock: createClock(),
      uuidFactory: createUuidFactory(),
      scheduler: new ImmediateScheduler(),
      retryDelaysMs: [0, 0, 0],
      appVersion: "1.2.3",
      platform: "ios",
    });
    await client.startSession();
    client.track("app_opened", { entry_source: "cold_start" });
    await client.flush("manual");

    const [events] = transport.mock.calls[0] as [Array<Record<string, unknown>>];
    expect(events[0]).toMatchObject({
      event_name: "app_opened",
      event_version: 1,
      occurred_at: fixedDate.toISOString(),
      anonymous_user_id: expect.stringMatching(/^anon_/),
      session_id: expect.stringMatching(/^session_/),
      environment: "local",
      platform: "ios",
      app_version: "1.2.3",
      properties: { entry_source: "cold_start" },
    });
    expect(events[0].event_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });
});

describe("AnalyticsClient retry policy", () => {
  it.each(["network", 408, 429, 500, 503])(
    "retries transient failure %s at most three times",
    async (failure) => {
      const error =
        failure === "network"
          ? new Error("network failure")
          : { status: failure };
      const transport = jest
        .fn()
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockResolvedValue({
          accepted: 1,
          duplicates: 0,
          rejected: 0,
          request_id: "request-1",
        });
      const client = createClient(transport);
      await client.startSession();
      client.track("app_opened", { entry_source: "cold_start" });

      await client.flush("manual");

      expect(transport).toHaveBeenCalledTimes(4);
      expect(client.getQueueLength()).toBe(0);
    },
  );

  it("does not retry a non-transient four hundred error", async () => {
    const transport = jest.fn().mockRejectedValue({ status: 400 });
    const client = createClient(transport);
    await client.startSession();
    client.track("app_opened", { entry_source: "cold_start" });

    await client.flush("manual");

    expect(transport).toHaveBeenCalledTimes(1);
    expect(client.getQueueLength()).toBe(0);
  });

  it("drops an event after three transient retries", async () => {
    const transport = jest.fn().mockRejectedValue({ status: 503 });
    const client = createClient(transport);
    await client.startSession();
    client.track("app_opened", { entry_source: "cold_start" });

    await client.flush("manual");

    expect(transport).toHaveBeenCalledTimes(4);
    expect(client.getQueueLength()).toBe(0);
  });
});
