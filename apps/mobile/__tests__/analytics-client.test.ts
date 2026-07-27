import {
  ANALYTICS_EVENT_NAMES,
  isAllowedAnalyticsProperties,
  type AnalyticsEventName,
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

  const backendAllowlistCases: Array<
    [AnalyticsEventName, Record<string, unknown>]
  > = [
    ...[
      "cold_start",
      "warm_resume",
      "room_create",
      "room_join",
      "warm",
      "seed_demo",
    ].map((entry_source) => ["app_opened", { entry_source }] as [AnalyticsEventName, Record<string, unknown>]),
    ...["guest", "authenticated"].map((auth_mode) => [
      "guest_session_created",
      { auth_mode, entry_source: "warm" },
    ] as [AnalyticsEventName, Record<string, unknown>]),
    ...["host", "member", "guest"].map((room_role) => [
      "room_joined",
      { room_role, member_count: 1 },
    ] as [AnalyticsEventName, Record<string, unknown>]),
    ...[
      "network_timeout",
      "network_error",
      "permission_denied",
      "provider_error",
      "unknown",
    ].map((failure_code) => [
      "rtc_connection_changed",
      { connection_state: "failed", failure_code },
    ] as [AnalyticsEventName, Record<string, unknown>]),
    ...["ready", "not_ready", "blocked", "pending"].map((ready_state) => [
      "room_ready_changed",
      { ready_state, member_count: 1 },
    ] as [AnalyticsEventName, Record<string, unknown>]),
    ...[
      "requested",
      "recording",
      "stopping",
      "ready",
      "failed",
      "expired",
      "starting",
      "paused",
      "stopped",
    ].map((recording_state) => [
      "recording_status_changed",
      { recording_state, failure_code: "unknown" },
    ] as [AnalyticsEventName, Record<string, unknown>]),
    ...[
      "waiting",
      "processing",
      "success",
      "failed",
      "pending",
      "running",
      "succeeded",
      "not_started",
    ].map((score_job_state) => [
      "score_report_viewed",
      { score_job_state, report_section: "summary" },
    ] as [AnalyticsEventName, Record<string, unknown>]),
    ...["overview", "pronunciation", "fluency", "grammar", "summary", "details"].map(
      (report_section) => [
        "score_report_viewed",
        { score_job_state: "success", report_section },
      ] as [AnalyticsEventName, Record<string, unknown>],
    ),
    ...["user_action", "user_requested", "failed", "timeout", "error"].map(
      (retry_reason) => [
        "score_retry_requested",
        { score_job_state: "not_started", retry_reason },
      ] as [AnalyticsEventName, Record<string, unknown>],
    ),
    ...["admin_menu", "deep_link", "app", "ops_button", "room", "report"].map(
      (handoff_source) => [
        "ops_handoff_started",
        { handoff_source, auth_mode: "authenticated" },
      ] as [AnalyticsEventName, Record<string, unknown>],
    ),
    ...["host_action", "timeout", "system_failure", "completed", "user_left", "error"].map(
      (end_reason) => [
        "room_ended",
        { room_role: "member", room_duration_ms: 1000, end_reason },
      ] as [AnalyticsEventName, Record<string, unknown>],
    ),
  ];

  it.each(backendAllowlistCases)("accepts backend allowlist value for %s", (eventName, properties) => {
    expect(
      isAllowedAnalyticsProperties(
        eventName as AnalyticsEventName,
        properties,
      ),
    ).toBe(true);
  });

  it.each([
    ["entry_source", { entry_source: "not_allowed" }],
    ["room_role", { room_role: "owner", member_count: 1 }],
    ["ready_state", { ready_state: "unknown", member_count: 1 }],
    ["recording_state", { recording_state: "capturing", failure_code: "unknown" }],
    ["score_job_state", { score_job_state: "done", report_section: "summary" }],
    ["report_section", { score_job_state: "success", report_section: "raw" }],
    ["end_reason", { room_role: "member", room_duration_ms: 1, end_reason: "other" }],
    ["handoff_source", { handoff_source: "unknown", auth_mode: "guest" }],
    ["retry_reason", { score_job_state: "failed", retry_reason: "raw_error" }],
    ["failure_code", { connection_state: "failed", failure_code: "RAW ERROR" }],
  ] as const)("rejects unknown value for %s", (eventName, properties) => {
    const eventNamesByProperty: Record<string, AnalyticsEventName> = {
      entry_source: "app_opened",
      room_role: "room_joined",
      ready_state: "room_ready_changed",
      recording_state: "recording_status_changed",
      score_job_state: "score_report_viewed",
      report_section: "score_report_viewed",
      end_reason: "room_ended",
      handoff_source: "ops_handoff_started",
      retry_reason: "score_retry_requested",
      failure_code: "rtc_connection_changed",
    };
    expect(
      isAllowedAnalyticsProperties(
        eventNamesByProperty[eventName],
        properties,
      ),
    ).toBe(false);
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

  it("does not silently remove a batch with incomplete response counts", async () => {
    const transport = jest.fn().mockResolvedValue({
      accepted: 1,
      duplicates: 0,
      rejected: 0,
      request_id: "request-1",
    });
    const client = createClient(transport);
    await client.startSession();
    client.track("app_opened", { entry_source: "cold_start" });
    client.track("app_opened", { entry_source: "warm_resume" });

    await client.flush("manual");

    expect(transport).toHaveBeenCalledTimes(4);
    expect(client.getQueueLength()).toBe(0);
    expect(client.getDiagnostics()).toEqual({ droppedCount: 2, rejectedCount: 0 });
  });

  it("records rejected events before removing a completely accounted batch", async () => {
    const transport = jest.fn().mockResolvedValue({
      accepted: 1,
      duplicates: 0,
      rejected: 1,
      request_id: "request-1",
    });
    const client = createClient(transport);
    await client.startSession();
    client.track("app_opened", { entry_source: "cold_start" });
    client.track("app_opened", { entry_source: "warm_resume" });

    await client.flush("manual");

    expect(transport).toHaveBeenCalledTimes(1);
    expect(client.getQueueLength()).toBe(0);
    expect(client.getDiagnostics()).toEqual({ droppedCount: 1, rejectedCount: 1 });
  });

  it("falls back from unsafe injected envelope configuration", async () => {
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
      uuidFactory: (() => "not-a-uuid") as () => string,
      scheduler: new ImmediateScheduler(),
      retryDelaysMs: [0, 0, 0],
      appVersion: "not-safe",
      platform: "desktop" as never,
      environment: "production" as never,
    });
    await client.startSession();
    client.track("app_opened", { entry_source: "cold_start" });
    await client.flush("manual");

    const [events] = transport.mock.calls[0] as [Array<Record<string, unknown>>];
    expect(events[0]).toMatchObject({
      app_version: "1.0.0",
      environment: "local",
      platform: expect.stringMatching(/^(ios|android|web)$/),
      anonymous_user_id: expect.stringMatching(/^anon_[0-9a-f-]{36}$/i),
      session_id: expect.stringMatching(/^session_[0-9a-f-]{36}$/i),
    });
    expect(events[0].event_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });
});
