import { act, cleanup, fireEvent, render } from "@testing-library/react-native";

import { RoomApp } from "@/features/session/room-app";
import { AnalyticsEvents } from "@/services/analytics-events";
import { getOrCreateAnalyticsUserId } from "@/services/analytics-factory";
import { FakeRoomClient, HttpRoomClient } from "@/services/room-client";

function createAnalyticsSpy() {
  return {
    appOpened: jest.fn(),
    guestSessionCreated: jest.fn(),
    roomCreated: jest.fn(),
    roomJoined: jest.fn(),
    roomReadyChanged: jest.fn(),
    roomStarted: jest.fn(),
    rtcConnectionChanged: jest.fn(),
    roomEnded: jest.fn(),
    recordingStatusChanged: jest.fn(),
    scoreReportViewed: jest.fn(),
    scoreRetryRequested: jest.fn(),
    opsHandoffStarted: jest.fn(),
  };
}

function wrapAnalytics(spy: ReturnType<typeof createAnalyticsSpy>): AnalyticsEvents {
  return spy as unknown as AnalyticsEvents;
}

describe("RoomApp analytics", () => {
  afterEach(cleanup);

  it("HttpRoomClient login sends guest_session_created with wire user_id matching player_id", async () => {
    const playerId = "player-room-app-99";
    const anonymousUserId = getOrCreateAnalyticsUserId();
    const previousApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
    process.env.EXPO_PUBLIC_API_BASE_URL = "http://api.example";
    try {
      const fetcher = jest.fn().mockImplementation(async (url: string) => {
        if (url.includes("/v1/guest-sessions")) {
          return {
            ok: true,
            json: async () => ({
              player_id: playerId,
              access_token: "room-app-token",
              profile: { display_name: "Mint" },
            }),
          } as Response;
        }
        if (url.includes("/v1/analytics/events")) {
          return { ok: true, status: 202 } as Response;
        }
        throw new Error(`unexpected fetch: ${url}`);
      });
      jest.spyOn(globalThis, "fetch").mockImplementation(fetcher as typeof fetch);

      const view = await render(
        <RoomApp client={new HttpRoomClient({ baseUrl: "http://api.example", fetcher: fetcher as typeof fetch })} />,
      );

      await act(async () => {
        fireEvent.press(view.getByTestId("login-button"));
      });

      await act(async () => {
        await new Promise<void>((resolve) => {
          setImmediate(resolve);
        });
      });

      const analyticsCalls = fetcher.mock.calls.filter(([url]) =>
        String(url).includes("/v1/analytics/events"),
      );
      expect(analyticsCalls.length).toBeGreaterThanOrEqual(1);
      const init = analyticsCalls[0][1] as RequestInit;
      const body = JSON.parse(String(init.body)) as {
        events: { event_name: string; user_id: string; properties: { player_id?: string } }[];
      };
      const guestEvent = body.events.find((event) => event.event_name === "guest_session_created");
      expect(guestEvent).toBeDefined();
      expect(guestEvent?.user_id).toBe(playerId);
      expect(guestEvent?.user_id).not.toBe(anonymousUserId);
      expect(guestEvent?.properties.player_id).toBe(playerId);
      expect(String(init.body)).not.toMatch(/room-app-token|Mint/i);
    } finally {
      process.env.EXPO_PUBLIC_API_BASE_URL = previousApiBaseUrl;
      jest.restoreAllMocks();
    }
  });

  it("does not call global fetch when using FakeRoomClient without HTTP transport", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockImplementation(() => {
      throw new Error("unexpected network");
    });

    const view = await render(<RoomApp client={new FakeRoomClient()} />);
    await act(async () => {
      fireEvent.press(view.getByTestId("login-button"));
    });
    await act(async () => {
      fireEvent.press(await view.findByTestId("create-room-button"));
    });

    expect(await view.findByText("等待同伴入座")).toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("emits guest_session_created after successful guest login", async () => {
    const analytics = createAnalyticsSpy();
    const view = await render(
      <RoomApp analyticsEvents={wrapAnalytics(analytics)} client={new FakeRoomClient()} />,
    );

    await act(async () => {
      fireEvent.press(view.getByTestId("login-button"));
    });

    expect(analytics.guestSessionCreated).toHaveBeenCalledTimes(1);
    const payload = analytics.guestSessionCreated.mock.calls[0][0];
    expect(payload).toMatchObject({
      session_type: "guest",
      entry_point: "app_open",
    });
    expect(payload?.guest_session_id).toEqual(payload?.player_id);
    expect(payload).not.toHaveProperty("token");
    expect(JSON.stringify(payload)).not.toMatch(/room_code|transcript|audio/i);
  });

  it("emits room_created and room_joined after create-room success", async () => {
    const analytics = createAnalyticsSpy();
    const view = await render(
      <RoomApp analyticsEvents={wrapAnalytics(analytics)} client={new FakeRoomClient()} />,
    );

    await act(async () => {
      fireEvent.press(view.getByTestId("login-button"));
    });
    await act(async () => {
      fireEvent.press(await view.findByTestId("create-room-button"));
    });
    expect(await view.findByText("等待同伴入座")).toBeTruthy();

    expect(analytics.roomCreated).toHaveBeenCalledTimes(1);
    expect(analytics.roomCreated.mock.calls[0][0]).toMatchObject({
      room_role: "host",
      creation_mode: "quick_create",
    });
    expect(analytics.roomJoined).toHaveBeenCalledTimes(1);
    expect(analytics.roomJoined.mock.calls[0][0]).toMatchObject({
      join_method: "invite",
      room_role: "host",
    });
  });

  it("emits room_ready_changed and room_started on successful lobby actions", async () => {
    const analytics = createAnalyticsSpy();
    const view = await render(
      <RoomApp analyticsEvents={wrapAnalytics(analytics)} client={new FakeRoomClient()} />,
    );

    await act(async () => {
      fireEvent.press(view.getByTestId("login-button"));
    });
    await act(async () => {
      fireEvent.press(await view.findByTestId("create-room-button"));
    });
    await act(async () => {
      fireEvent.press(view.getByTestId("ready-button"));
    });
    await act(async () => {
      fireEvent.press(view.getByTestId("start-room-button"));
    });

    expect(await view.findByText("正在练习")).toBeTruthy();
    expect(analytics.roomReadyChanged).toHaveBeenCalledWith(
      expect.objectContaining({ ready_state: "ready" }),
    );
    expect(analytics.roomStarted).toHaveBeenCalledTimes(1);
    expect(analytics.roomStarted.mock.calls[0][0]).toMatchObject({
      member_count: expect.any(Number),
      ready_member_count: expect.any(Number),
    });
  });

  it("emits room_ended and score_report_viewed after end-room success", async () => {
    const analytics = createAnalyticsSpy();
    const view = await render(
      <RoomApp analyticsEvents={wrapAnalytics(analytics)} client={new FakeRoomClient()} />,
    );

    await act(async () => {
      fireEvent.press(view.getByTestId("login-button"));
    });
    await act(async () => {
      fireEvent.press(await view.findByTestId("create-room-button"));
    });
    await act(async () => {
      fireEvent.press(view.getByTestId("ready-button"));
    });
    await act(async () => {
      fireEvent.press(view.getByTestId("start-room-button"));
    });
    await act(async () => {
      fireEvent.press(await view.findByTestId("end-room-button"));
    });

    expect(await view.findByText("本局口语报告")).toBeTruthy();
    expect(analytics.roomEnded).toHaveBeenCalledTimes(1);
    expect(analytics.scoreReportViewed).toHaveBeenCalledTimes(1);
    expect(analytics.scoreReportViewed.mock.calls[0][0]).toMatchObject({
      entry_point: "room_end",
    });
  });

  it("emits score_retry_requested only after retry API success", async () => {
    const analytics = createAnalyticsSpy();
    const view = await render(
      <RoomApp analyticsEvents={wrapAnalytics(analytics)} client={new FakeRoomClient()} />,
    );

    await act(async () => {
      fireEvent.press(view.getByTestId("login-button"));
    });
    await act(async () => {
      fireEvent.press(await view.findByTestId("create-room-button"));
    });
    await act(async () => {
      fireEvent.press(view.getByTestId("ready-button"));
    });
    await act(async () => {
      fireEvent.press(view.getByTestId("start-room-button"));
    });
    await act(async () => {
      fireEvent.press(await view.findByTestId("end-room-button"));
    });
    await act(async () => {
      fireEvent.press(await view.findByLabelText("重试评分"));
    });

    expect(analytics.scoreRetryRequested).toHaveBeenCalledTimes(1);
    expect(analytics.scoreRetryRequested.mock.calls[0][0]).toMatchObject({
      retry_reason: "user_action",
      attempt_number: 1,
    });
    expect(analytics.scoreRetryRequested.mock.calls[0][0]?.score_job_id).toMatch(/^score-room-/);
  });

  it("does not emit guest_session_created when login API fails", async () => {
    const analytics = createAnalyticsSpy();
    const client = new FakeRoomClient();
    client.createGuestSession = jest.fn().mockRejectedValue(new Error("network down"));

    const view = await render(
      <RoomApp analyticsEvents={wrapAnalytics(analytics)} client={client} />,
    );

    await act(async () => {
      fireEvent.press(view.getByTestId("login-button"));
    });

    expect(analytics.guestSessionCreated).not.toHaveBeenCalled();
  });

  it("continues the flow when analytics submit throws asynchronously", async () => {
    const analytics = createAnalyticsSpy();
    analytics.guestSessionCreated.mockImplementation(() => {
      throw new Error("analytics down");
    });

    const view = await render(
      <RoomApp analyticsEvents={wrapAnalytics(analytics)} client={new FakeRoomClient()} />,
    );

    await act(async () => {
      fireEvent.press(view.getByTestId("login-button"));
    });

    expect(await view.findByText("今晚想练哪一句？")).toBeTruthy();
  });
});
