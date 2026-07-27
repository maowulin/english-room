import {
  createHttpAnalyticsEvents,
  defaultAnalyticsEventsFactory,
  getOrCreateAnalyticsUserId,
} from "@/services/analytics-factory";
import { HttpRoomClient } from "@/services/room-client";

describe("analytics factory user_id", () => {
  beforeEach(() => {
    jest.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo) => {
      const url = String(input);
      if (String(url).includes("/v1/analytics/events")) {
        return { ok: true, status: 202 } as Response;
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("HttpAnalyticsEvents record.user_id equals authenticated player_id", async () => {
    const playerId = "player-auth-42";
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          player_id: playerId,
          access_token: "secret-token",
          profile: { display_name: "Mint" },
        }),
      } as Response)
      .mockResolvedValue({ ok: true, status: 202 } as Response);

    const client = new HttpRoomClient({
      baseUrl: "http://api.example",
      fetcher: fetcher as typeof fetch,
    });
    await client.createGuestSession({ nickname: "Mint" });

    const analyticsUserIdBefore = getOrCreateAnalyticsUserId();
    const events = createHttpAnalyticsEvents(client, "app-session-stable-001");
    events.guestSessionCreated({
      guest_session_id: playerId,
      session_type: "guest",
      player_id: playerId,
      entry_point: "app_open",
    });
    await Promise.resolve();
    await events.flushAnalytics("manual");

    const fetchMock = globalThis.fetch as jest.Mock;
    const analyticsCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).includes("/v1/analytics/events"),
    );
    expect(analyticsCalls).toHaveLength(1);
    const init = analyticsCalls[0][1] as RequestInit;
    const body = JSON.parse(String(init.body)) as {
      events: { user_id: string; app_session_id: string; properties: { player_id?: string } }[];
    };
    const record = body.events[0];
    expect(record.user_id).toBe(playerId);
    expect(record.user_id).not.toBe(analyticsUserIdBefore);
    expect(record.properties.player_id).toBe(playerId);
    expect(record.app_session_id).toBe("app-session-stable-001");
    expect(String(init.body)).not.toMatch(/secret-token|Mint/i);
    events.destroyAnalytics();
  });

  it("defaultAnalyticsEventsFactory does not POST analytics without access token", async () => {
    const client = new HttpRoomClient({ baseUrl: "http://api.example" });
    const events = defaultAnalyticsEventsFactory(client, "app-session-1");
    events.appOpened({ entry_point: "cold_start" });
    await Promise.resolve();
    await Promise.resolve();
    const analyticsCalls = (globalThis.fetch as jest.Mock).mock.calls.filter(([url]) =>
      String(url).includes("/v1/analytics/events"),
    );
    expect(analyticsCalls).toHaveLength(0);
    if ("destroyAnalytics" in events) {
      (events as ReturnType<typeof createHttpAnalyticsEvents>).destroyAnalytics();
    }
  });

  it("defaultAnalyticsEventsFactory wires buffered HTTP transport for HttpRoomClient", async () => {
    const playerId = "player-factory-7";
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          player_id: playerId,
          access_token: "factory-token",
          profile: { display_name: "Guest" },
        }),
      } as Response)
      .mockResolvedValue({ ok: true, status: 202 } as Response);

    const client = new HttpRoomClient({
      baseUrl: "http://api.example",
      fetcher: fetcher as typeof fetch,
    });
    await client.createGuestSession({ nickname: "Guest" });

    const events = defaultAnalyticsEventsFactory(client, "app-session-2") as ReturnType<
      typeof createHttpAnalyticsEvents
    >;
    expect(events.flushAnalytics).toBeDefined();
    expect(events.destroyAnalytics).toBeDefined();

    events.guestSessionCreated({
      guest_session_id: playerId,
      session_type: "guest",
      player_id: playerId,
      entry_point: "app_open",
    });
    await Promise.resolve();
    await events.flushAnalytics("manual");

    const analyticsCalls = (globalThis.fetch as jest.Mock).mock.calls.filter(([url]) =>
      String(url).includes("/v1/analytics/events"),
    );
    expect(analyticsCalls).toHaveLength(1);
    events.destroyAnalytics();
  });
});
