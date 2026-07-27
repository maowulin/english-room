import {
  AnalyticsClient,
  DEFAULT_ANALYTICS_EVENT_VERSION,
  type AnalyticsContextFields,
  type AnalyticsRecord,
  type AnalyticsTransport,
} from "@/services/analytics-client";

const baseContext: AnalyticsContextFields = {
  eventVersion: DEFAULT_ANALYTICS_EVENT_VERSION,
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

  it("includes context metadata on records sent to transport", async () => {
    const transport = jest.fn<ReturnType<AnalyticsTransport>, Parameters<AnalyticsTransport>>();
    transport.mockResolvedValue(undefined);
    const client = new AnalyticsClient({
      context: baseContext,
      transport,
    });

    await client.submit({
      name: "room_joined",
      payload: { roomId: "room-42", role: "guest" },
    });

    expect(transport).toHaveBeenCalledTimes(1);
    const record = transport.mock.calls[0][0] as AnalyticsRecord;
    expect(record.name).toBe("room_joined");
    expect(record.eventVersion).toBe(DEFAULT_ANALYTICS_EVENT_VERSION);
    expect(record.environment).toBe("development");
    expect(record.platform).toBe("ios");
    expect(record.appVersion).toBe("1.0.0-test");
    expect(record.payload).toEqual({ roomId: "room-42", role: "guest" });
    expect(typeof record.occurredAt).toBe("string");
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
      { name: "ops_handoff_started" as const, payload: { roomId: "r-1" } },
    ];

    for (const event of events) {
      await expect(client.submit(event)).resolves.toEqual({ accepted: true });
    }
    expect(transport).toHaveBeenCalledTimes(events.length);
  });

  it.each([
    ["email", { email: "user@example.com" }],
    ["password", { password: "secret" }],
    ["userSig", { userSig: "sig-value" }],
    ["accessToken", { accessToken: "token-value" }],
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
