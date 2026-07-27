import {
  ANALYTICS_SCHEMA_VERSION,
  AnalyticsClient,
  type AnalyticsContextFields,
  type AnalyticsRecord,
  type AnalyticsTransport,
} from "@/services/analytics-client";

const baseContext: AnalyticsContextFields = {
  userId: "user-anon-test-001",
  appSessionId: "app-session-test-001",
  environment: "development",
  platform: "ios",
  appVersion: "1.0.0-test",
};

describe("AnalyticsClient", () => {
  it("uses a no-op transport by default and accepts safe events", async () => {
    const client = new AnalyticsClient({ context: baseContext });

    await expect(
      client.submit({ name: "app_opened", payload: { coldStart: true } }),
    ).resolves.toEqual({ accepted: true });
  });

  it("emits catalog wire envelope on transport (snake_case, schema 1.0)", async () => {
    const transport = jest.fn<ReturnType<AnalyticsTransport>, Parameters<AnalyticsTransport>>();
    transport.mockResolvedValue(undefined);
    const client = new AnalyticsClient({
      context: baseContext,
      transport,
    });

    await client.submit(
      {
        name: "room_joined",
        payload: { roomId: "room-42", role: "guest" },
      },
      {
        eventId: "11111111-1111-4111-8111-111111111111",
        occurredAt: "2026-07-27T01:30:00.000Z",
        correlationId: "corr-join-1",
      },
    );

    expect(transport).toHaveBeenCalledTimes(1);
    const record = transport.mock.calls[0][0] as AnalyticsRecord;
    expect(record).toEqual({
      event_id: "11111111-1111-4111-8111-111111111111",
      event_name: "room_joined",
      schema_version: ANALYTICS_SCHEMA_VERSION,
      user_id: "user-anon-test-001",
      app_session_id: "app-session-test-001",
      occurred_at: "2026-07-27T01:30:00.000Z",
      app_version: "1.0.0-test",
      platform: "ios",
      environment: "development",
      producer: "client",
      correlation_id: "corr-join-1",
      properties: { roomId: "room-42", role: "guest" },
    });
    expect(record).not.toHaveProperty("name");
    expect(record).not.toHaveProperty("payload");
    expect(record).not.toHaveProperty("occurredAt");
    expect(record).not.toHaveProperty("eventVersion");
  });

  it("generates event_id when not injected", async () => {
    const transport = jest.fn<ReturnType<AnalyticsTransport>, Parameters<AnalyticsTransport>>();
    transport.mockResolvedValue(undefined);
    const client = new AnalyticsClient({ context: baseContext, transport });

    await client.submit({ name: "app_opened", payload: {} });

    const record = transport.mock.calls[0][0] as AnalyticsRecord;
    expect(typeof record.event_id).toBe("string");
    expect(record.event_id.length).toBeGreaterThan(0);
    expect(record.schema_version).toBe("1.0");
    expect(record.producer).toBe("client");
  });

  it("accepts each supported analytics event name", async () => {
    const transport = jest.fn<ReturnType<AnalyticsTransport>, Parameters<AnalyticsTransport>>();
    transport.mockResolvedValue(undefined);
    const client = new AnalyticsClient({ context: baseContext, transport });

    const events = [
      { name: "app_opened" as const, payload: { coldStart: false } },
      { name: "guest_session_created" as const, payload: { sessionId: "g-1" } },
      { name: "room_created" as const, payload: { roomId: "r-1" } },
      { name: "room_joined" as const, payload: { roomId: "r-1" } },
      { name: "room_ready_changed" as const, payload: { roomId: "r-1", ready: true } },
      { name: "room_started" as const, payload: { roomId: "r-1" } },
      {
        name: "rtc_connection_changed" as const,
        payload: { roomId: "r-1", state: "connected" },
      },
      { name: "room_ended" as const, payload: { roomId: "r-1", reason: "completed" } },
      {
        name: "recording_status_changed" as const,
        payload: { roomId: "r-1", status: "started" },
      },
      { name: "score_report_viewed" as const, payload: { roomId: "r-1" } },
      { name: "score_retry_requested" as const, payload: { roomId: "r-1" } },
      { name: "ops_handoff_started" as const, payload: { buildVariant: "internal_ops" } },
    ];

    for (const event of events) {
      await expect(client.submit(event)).resolves.toEqual({ accepted: true });
    }
    expect(transport).toHaveBeenCalledTimes(events.length);
    for (const call of transport.mock.calls) {
      const record = call[0] as AnalyticsRecord;
      expect(record.event_name).toBeDefined();
      expect(record.schema_version).toBe("1.0");
    }
  });

  it.each([
    ["email", { email: "user@example.com" }],
    ["password", { password: "secret" }],
    ["userSig", { userSig: "sig-value" }],
    ["accessToken", { accessToken: "token-value" }],
    ["token", { token: "bearer-secret" }],
    ["room_code", { room_code: "ABCD-1234" }],
    ["roomCode", { roomCode: "ABCD-1234" }],
    ["cookie", { cookie: "session=secret" }],
    ["secret", { secret: "sdk-secret" }],
    ["audio bytes", { audioBytes: new Uint8Array([1, 2, 3]) }],
  ])("rejects sensitive payload field %s", async (_label, payload) => {
    const transport = jest.fn<ReturnType<AnalyticsTransport>, Parameters<AnalyticsTransport>>();
    const client = new AnalyticsClient({ context: baseContext, transport });

    await expect(
      client.submit({ name: "app_opened", payload }),
    ).resolves.toEqual({
      accepted: false,
      reason: expect.stringMatching(/敏感|sensitive/i),
    });
    expect(transport).not.toHaveBeenCalled();
  });

  it("rejects nested sensitive fields", async () => {
    const transport = jest.fn<ReturnType<AnalyticsTransport>, Parameters<AnalyticsTransport>>();
    const client = new AnalyticsClient({ context: baseContext, transport });

    await expect(
      client.submit({
        name: "room_joined",
        payload: { roomId: "r-1", meta: { accessToken: "nested" } },
      }),
    ).resolves.toMatchObject({ accepted: false });
    expect(transport).not.toHaveBeenCalled();
  });

  it("returns accepted=false when transport fails without throwing", async () => {
    const transport = jest.fn<ReturnType<AnalyticsTransport>, Parameters<AnalyticsTransport>>();
    transport.mockRejectedValue(new Error("network down"));
    const client = new AnalyticsClient({ context: baseContext, transport });

    await expect(
      client.submit({ name: "app_opened", payload: { coldStart: true } }),
    ).resolves.toEqual({ accepted: false });
  });

  it("never throws to callers when transport throws synchronously", async () => {
    const transport = jest.fn<ReturnType<AnalyticsTransport>, Parameters<AnalyticsTransport>>();
    transport.mockImplementation(() => {
      throw new Error("sync transport failure");
    });
    const client = new AnalyticsClient({ context: baseContext, transport });

    await expect(
      client.submit({ name: "app_opened" }),
    ).resolves.toEqual({ accepted: false });
  });
});
