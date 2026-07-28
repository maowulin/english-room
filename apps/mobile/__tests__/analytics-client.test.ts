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
      client.submit({ name: "app_opened", payload: { entry_point: "cold_start" } }),
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
        payload: {
          room_id: "room-42",
          player_id: "player-1",
          room_version: 1,
          join_method: "room_code",
          room_role: "member",
        },
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
      properties: {
        room_id: "room-42",
        player_id: "player-1",
        room_version: 1,
        join_method: "room_code",
        room_role: "member",
      },
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
      { name: "app_opened" as const, payload: { entry_point: "warm_resume" as const } },
      {
        name: "guest_session_created" as const,
        payload: { guest_session_id: "g-1", session_type: "guest" as const, player_id: "p-1" },
      },
      {
        name: "room_created" as const,
        payload: { room_id: "r-1", player_id: "p-1", room_version: 1, room_role: "host" as const },
      },
      {
        name: "room_joined" as const,
        payload: {
          room_id: "r-1",
          player_id: "p-1",
          room_version: 1,
          join_method: "room_code" as const,
        },
      },
      {
        name: "room_ready_changed" as const,
        payload: {
          room_id: "r-1",
          player_id: "p-1",
          ready_state: "ready" as const,
          room_version: 2,
        },
      },
      {
        name: "room_started" as const,
        payload: { room_id: "r-1", room_version: 3, member_count: 2, ready_member_count: 2, started_by_player_id: "p-1" },
      },
      {
        name: "rtc_connection_changed" as const,
        payload: { room_id: "r-1", player_id: "p-1", connection_state: "connected" as const },
      },
      {
        name: "room_ended" as const,
        payload: {
          room_id: "r-1",
          room_version: 4,
          ended_by_player_id: "p-1",
          end_reason: "host_action" as const,
        },
      },
      {
        name: "recording_status_changed" as const,
        payload: { room_id: "r-1", recording_status: "recording" as const, status_sequence: 1 },
      },
      {
        name: "score_report_viewed" as const,
        payload: { room_id: "r-1", player_id: "p-1", report_state: "waiting" as const },
      },
      {
        name: "score_retry_requested" as const,
        payload: {
          room_id: "r-1",
          player_id: "p-1",
          score_job_id: "job-1",
          attempt_number: 1,
          retry_reason: "user_action" as const,
        },
      },
      {
        name: "ops_handoff_started" as const,
        payload: {
          build_variant: "internal_ops" as const,
          handoff_surface: "ops_webview" as const,
          entry_point: "admin_menu" as const,
        },
      },
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
      client.submit({ name: "app_opened", payload: payload as never }),
    ).resolves.toEqual({
      accepted: false,
      reason: expect.stringMatching(/sensitive/i),
    });
    expect(transport).not.toHaveBeenCalled();
  });

  it("rejects nested sensitive fields", async () => {
    const transport = jest.fn<ReturnType<AnalyticsTransport>, Parameters<AnalyticsTransport>>();
    const client = new AnalyticsClient({ context: baseContext, transport });

    await expect(
      client.submit({
        name: "room_joined",
        payload: { room_id: "r-1", meta: { accessToken: "nested" } } as never,
      }),
    ).resolves.toMatchObject({ accepted: false });
    expect(transport).not.toHaveBeenCalled();
  });

  it("returns accepted=false when transport fails without throwing", async () => {
    const transport = jest.fn<ReturnType<AnalyticsTransport>, Parameters<AnalyticsTransport>>();
    transport.mockRejectedValue(new Error("network down"));
    const client = new AnalyticsClient({ context: baseContext, transport });

    await expect(
      client.submit({ name: "app_opened", payload: { entry_point: "cold_start" } }),
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
