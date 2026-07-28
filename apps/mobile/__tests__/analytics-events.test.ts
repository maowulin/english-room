import {
  AnalyticsClient,
  type AnalyticsContextFields,
  type AnalyticsSubmitResult,
} from "@/services/analytics-client";
import { AnalyticsEvents } from "@/services/analytics-events";

const baseContext: AnalyticsContextFields = {
  userId: "user-anon-test-001",
  appSessionId: "app-session-test-001",
  environment: "development",
  platform: "ios",
  appVersion: "1.0.0-test",
};

describe("AnalyticsEvents", () => {
  it("appOpened submits app_opened without blocking the caller", () => {
    const submit = jest.fn<Promise<AnalyticsSubmitResult>, Parameters<AnalyticsClient["submit"]>>();
    submit.mockImplementation(() => new Promise(() => undefined));
    const events = new AnalyticsEvents({ submit } as unknown as AnalyticsClient);

    const returned = events.appOpened({ entry_point: "cold_start" });

    expect(returned).toBeUndefined();
    expect(submit).toHaveBeenCalledWith({
      name: "app_opened",
      payload: { entry_point: "cold_start" },
    });
  });

  it("guestSessionCreated submits guest_session_created", () => {
    const submit = jest.fn<Promise<AnalyticsSubmitResult>, Parameters<AnalyticsClient["submit"]>>();
    submit.mockResolvedValue({ accepted: true });
    const events = new AnalyticsEvents({ submit } as unknown as AnalyticsClient);

    events.guestSessionCreated({
      guest_session_id: "g-1",
      session_type: "guest",
      player_id: "player-1",
    });

    expect(submit).toHaveBeenCalledWith({
      name: "guest_session_created",
      payload: {
        guest_session_id: "g-1",
        session_type: "guest",
        player_id: "player-1",
      },
    });
  });

  it("roomCreated submits room_created", () => {
    const submit = jest.fn<Promise<AnalyticsSubmitResult>, Parameters<AnalyticsClient["submit"]>>();
    submit.mockResolvedValue({ accepted: true });
    const events = new AnalyticsEvents({ submit } as unknown as AnalyticsClient);

    events.roomCreated({
      room_id: "room-1",
      player_id: "player-1",
      room_version: 1,
      room_role: "host",
    });

    expect(submit).toHaveBeenCalledWith({
      name: "room_created",
      payload: {
        room_id: "room-1",
        player_id: "player-1",
        room_version: 1,
        room_role: "host",
      },
    });
  });

  it("roomJoined submits room_joined", () => {
    const submit = jest.fn<Promise<AnalyticsSubmitResult>, Parameters<AnalyticsClient["submit"]>>();
    submit.mockResolvedValue({ accepted: true });
    const events = new AnalyticsEvents({ submit } as unknown as AnalyticsClient);

    events.roomJoined({
      room_id: "room-1",
      player_id: "player-1",
      room_version: 2,
      join_method: "room_code",
      room_role: "member",
    });

    expect(submit).toHaveBeenCalledWith({
      name: "room_joined",
      payload: {
        room_id: "room-1",
        player_id: "player-1",
        room_version: 2,
        join_method: "room_code",
        room_role: "member",
      },
    });
  });

  it("roomReadyChanged submits room_ready_changed", () => {
    const submit = jest.fn<Promise<AnalyticsSubmitResult>, Parameters<AnalyticsClient["submit"]>>();
    submit.mockResolvedValue({ accepted: true });
    const events = new AnalyticsEvents({ submit } as unknown as AnalyticsClient);

    events.roomReadyChanged({
      room_id: "room-1",
      player_id: "player-1",
      ready_state: "ready",
      room_version: 3,
    });

    expect(submit).toHaveBeenCalledWith({
      name: "room_ready_changed",
      payload: {
        room_id: "room-1",
        player_id: "player-1",
        ready_state: "ready",
        room_version: 3,
      },
    });
  });

  it("roomStarted submits room_started", () => {
    const submit = jest.fn<Promise<AnalyticsSubmitResult>, Parameters<AnalyticsClient["submit"]>>();
    submit.mockResolvedValue({ accepted: true });
    const events = new AnalyticsEvents({ submit } as unknown as AnalyticsClient);

    events.roomStarted({
      room_id: "room-1",
      room_version: 4,
      member_count: 4,
      ready_member_count: 4,
      started_by_player_id: "player-host",
    });

    expect(submit).toHaveBeenCalledWith({
      name: "room_started",
      payload: {
        room_id: "room-1",
        room_version: 4,
        member_count: 4,
        ready_member_count: 4,
        started_by_player_id: "player-host",
      },
    });
  });

  it("rtcConnectionChanged submits rtc_connection_changed", () => {
    const submit = jest.fn<Promise<AnalyticsSubmitResult>, Parameters<AnalyticsClient["submit"]>>();
    submit.mockResolvedValue({ accepted: true });
    const events = new AnalyticsEvents({ submit } as unknown as AnalyticsClient);

    events.rtcConnectionChanged({
      room_id: "room-1",
      player_id: "player-1",
      connection_state: "connected",
    });

    expect(submit).toHaveBeenCalledWith({
      name: "rtc_connection_changed",
      payload: {
        room_id: "room-1",
        player_id: "player-1",
        connection_state: "connected",
      },
    });
  });

  it("roomEnded submits room_ended", () => {
    const submit = jest.fn<Promise<AnalyticsSubmitResult>, Parameters<AnalyticsClient["submit"]>>();
    submit.mockResolvedValue({ accepted: true });
    const events = new AnalyticsEvents({ submit } as unknown as AnalyticsClient);

    events.roomEnded({
      room_id: "room-1",
      room_version: 5,
      ended_by_player_id: "player-host",
      end_reason: "host_action",
    });

    expect(submit).toHaveBeenCalledWith({
      name: "room_ended",
      payload: {
        room_id: "room-1",
        room_version: 5,
        ended_by_player_id: "player-host",
        end_reason: "host_action",
      },
    });
  });

  it("recordingStatusChanged submits recording_status_changed", () => {
    const submit = jest.fn<Promise<AnalyticsSubmitResult>, Parameters<AnalyticsClient["submit"]>>();
    submit.mockResolvedValue({ accepted: true });
    const events = new AnalyticsEvents({ submit } as unknown as AnalyticsClient);

    events.recordingStatusChanged({
      room_id: "room-1",
      recording_status: "recording",
      status_sequence: 1,
    });

    expect(submit).toHaveBeenCalledWith({
      name: "recording_status_changed",
      payload: {
        room_id: "room-1",
        recording_status: "recording",
        status_sequence: 1,
      },
    });
  });

  it("scoreReportViewed submits score_report_viewed", () => {
    const submit = jest.fn<Promise<AnalyticsSubmitResult>, Parameters<AnalyticsClient["submit"]>>();
    submit.mockResolvedValue({ accepted: true });
    const events = new AnalyticsEvents({ submit } as unknown as AnalyticsClient);

    events.scoreReportViewed({
      room_id: "room-1",
      player_id: "player-1",
      report_state: "success",
    });

    expect(submit).toHaveBeenCalledWith({
      name: "score_report_viewed",
      payload: {
        room_id: "room-1",
        player_id: "player-1",
        report_state: "success",
      },
    });
  });

  it("scoreRetryRequested submits score_retry_requested", () => {
    const submit = jest.fn<Promise<AnalyticsSubmitResult>, Parameters<AnalyticsClient["submit"]>>();
    submit.mockResolvedValue({ accepted: true });
    const events = new AnalyticsEvents({ submit } as unknown as AnalyticsClient);

    events.scoreRetryRequested({
      room_id: "room-1",
      player_id: "player-1",
      score_job_id: "job-1",
      attempt_number: 2,
      retry_reason: "user_action",
    });

    expect(submit).toHaveBeenCalledWith({
      name: "score_retry_requested",
      payload: {
        room_id: "room-1",
        player_id: "player-1",
        score_job_id: "job-1",
        attempt_number: 2,
        retry_reason: "user_action",
      },
    });
  });

  it("opsHandoffStarted submits ops_handoff_started", () => {
    const submit = jest.fn<Promise<AnalyticsSubmitResult>, Parameters<AnalyticsClient["submit"]>>();
    submit.mockResolvedValue({ accepted: true });
    const events = new AnalyticsEvents({ submit } as unknown as AnalyticsClient);

    events.opsHandoffStarted({
      build_variant: "internal_ops",
      handoff_surface: "ops_webview",
      entry_point: "admin_menu",
    });

    expect(submit).toHaveBeenCalledWith({
      name: "ops_handoff_started",
      payload: {
        build_variant: "internal_ops",
        handoff_surface: "ops_webview",
        entry_point: "admin_menu",
      },
    });
  });

  it("does not throw when submit rejects", () => {
    const submit = jest.fn<Promise<AnalyticsSubmitResult>, Parameters<AnalyticsClient["submit"]>>();
    submit.mockRejectedValue(new Error("network down"));
    const events = new AnalyticsEvents({ submit } as unknown as AnalyticsClient);

    expect(() => events.appOpened({ entry_point: "warm_resume" })).not.toThrow();
  });

  it("delegates sensitive payload rejection to AnalyticsClient without throwing", async () => {
    const client = new AnalyticsClient({ context: baseContext });
    const events = new AnalyticsEvents(client);
    const submitSpy = jest.spyOn(client, "submit").mockResolvedValue({
      accepted: false,
      reason: "Sensitive field rejected",
    });

    expect(() =>
      events.roomJoined({
        room_id: "r-1",
        join_method: "room_code",
        email: "user@example.com",
      } as never),
    ).not.toThrow();
    expect(submitSpy).toHaveBeenCalledWith({
      name: "room_joined",
      payload: {
        room_id: "r-1",
        join_method: "room_code",
        email: "user@example.com",
      },
    });

    submitSpy.mockRestore();
  });
});
