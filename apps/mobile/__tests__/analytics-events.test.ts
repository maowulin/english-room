import {
  AnalyticsClient,
  DEFAULT_ANALYTICS_EVENT_VERSION,
  type AnalyticsContextFields,
  type AnalyticsSubmitResult,
} from "@/services/analytics-client";
import { AnalyticsEvents } from "@/services/analytics-events";

const baseContext: AnalyticsContextFields = {
  eventVersion: DEFAULT_ANALYTICS_EVENT_VERSION,
  environment: "development",
  platform: "ios",
  appVersion: "1.0.0-test",
};

describe("AnalyticsEvents", () => {
  it("appOpened submits app_opened without blocking the caller", () => {
    const submit = jest.fn<Promise<AnalyticsSubmitResult>, Parameters<AnalyticsClient["submit"]>>();
    submit.mockImplementation(() => new Promise(() => undefined));
    const events = new AnalyticsEvents({ submit } as unknown as AnalyticsClient);

    const returned = events.appOpened({ coldStart: true });

    expect(returned).toBeUndefined();
    expect(submit).toHaveBeenCalledWith({
      name: "app_opened",
      payload: { coldStart: true },
    });
  });

  it("guestSessionCreated submits guest_session_created", () => {
    const submit = jest.fn<Promise<AnalyticsSubmitResult>, Parameters<AnalyticsClient["submit"]>>();
    submit.mockResolvedValue({ accepted: true });
    const events = new AnalyticsEvents({ submit } as unknown as AnalyticsClient);

    events.guestSessionCreated({ sessionId: "g-1" });

    expect(submit).toHaveBeenCalledWith({
      name: "guest_session_created",
      payload: { sessionId: "g-1" },
    });
  });

  it("roomCreated submits room_created", () => {
    const submit = jest.fn<Promise<AnalyticsSubmitResult>, Parameters<AnalyticsClient["submit"]>>();
    submit.mockResolvedValue({ accepted: true });
    const events = new AnalyticsEvents({ submit } as unknown as AnalyticsClient);

    events.roomCreated({ roomId: "room-1" });

    expect(submit).toHaveBeenCalledWith({
      name: "room_created",
      payload: { roomId: "room-1" },
    });
  });

  it("roomJoined submits room_joined", () => {
    const submit = jest.fn<Promise<AnalyticsSubmitResult>, Parameters<AnalyticsClient["submit"]>>();
    submit.mockResolvedValue({ accepted: true });
    const events = new AnalyticsEvents({ submit } as unknown as AnalyticsClient);

    events.roomJoined({ roomId: "room-1", role: "member" });

    expect(submit).toHaveBeenCalledWith({
      name: "room_joined",
      payload: { roomId: "room-1", role: "member" },
    });
  });

  it("roomReadyChanged submits room_ready_changed", () => {
    const submit = jest.fn<Promise<AnalyticsSubmitResult>, Parameters<AnalyticsClient["submit"]>>();
    submit.mockResolvedValue({ accepted: true });
    const events = new AnalyticsEvents({ submit } as unknown as AnalyticsClient);

    events.roomReadyChanged({ roomId: "room-1", ready: true });

    expect(submit).toHaveBeenCalledWith({
      name: "room_ready_changed",
      payload: { roomId: "room-1", ready: true },
    });
  });

  it("roomStarted submits room_started", () => {
    const submit = jest.fn<Promise<AnalyticsSubmitResult>, Parameters<AnalyticsClient["submit"]>>();
    submit.mockResolvedValue({ accepted: true });
    const events = new AnalyticsEvents({ submit } as unknown as AnalyticsClient);

    events.roomStarted({ roomId: "room-1" });

    expect(submit).toHaveBeenCalledWith({
      name: "room_started",
      payload: { roomId: "room-1" },
    });
  });

  it("rtcConnectionChanged submits rtc_connection_changed", () => {
    const submit = jest.fn<Promise<AnalyticsSubmitResult>, Parameters<AnalyticsClient["submit"]>>();
    submit.mockResolvedValue({ accepted: true });
    const events = new AnalyticsEvents({ submit } as unknown as AnalyticsClient);

    events.rtcConnectionChanged({ roomId: "room-1", state: "connected" });

    expect(submit).toHaveBeenCalledWith({
      name: "rtc_connection_changed",
      payload: { roomId: "room-1", state: "connected" },
    });
  });

  it("roomEnded submits room_ended", () => {
    const submit = jest.fn<Promise<AnalyticsSubmitResult>, Parameters<AnalyticsClient["submit"]>>();
    submit.mockResolvedValue({ accepted: true });
    const events = new AnalyticsEvents({ submit } as unknown as AnalyticsClient);

    events.roomEnded({ roomId: "room-1", reason: "host_action" });

    expect(submit).toHaveBeenCalledWith({
      name: "room_ended",
      payload: { roomId: "room-1", reason: "host_action" },
    });
  });

  it("recordingStatusChanged submits recording_status_changed", () => {
    const submit = jest.fn<Promise<AnalyticsSubmitResult>, Parameters<AnalyticsClient["submit"]>>();
    submit.mockResolvedValue({ accepted: true });
    const events = new AnalyticsEvents({ submit } as unknown as AnalyticsClient);

    events.recordingStatusChanged({ roomId: "room-1", status: "recording" });

    expect(submit).toHaveBeenCalledWith({
      name: "recording_status_changed",
      payload: { roomId: "room-1", status: "recording" },
    });
  });

  it("scoreReportViewed submits score_report_viewed", () => {
    const submit = jest.fn<Promise<AnalyticsSubmitResult>, Parameters<AnalyticsClient["submit"]>>();
    submit.mockResolvedValue({ accepted: true });
    const events = new AnalyticsEvents({ submit } as unknown as AnalyticsClient);

    events.scoreReportViewed({ roomId: "room-1" });

    expect(submit).toHaveBeenCalledWith({
      name: "score_report_viewed",
      payload: { roomId: "room-1" },
    });
  });

  it("scoreRetryRequested submits score_retry_requested", () => {
    const submit = jest.fn<Promise<AnalyticsSubmitResult>, Parameters<AnalyticsClient["submit"]>>();
    submit.mockResolvedValue({ accepted: true });
    const events = new AnalyticsEvents({ submit } as unknown as AnalyticsClient);

    events.scoreRetryRequested({ roomId: "room-1" });

    expect(submit).toHaveBeenCalledWith({
      name: "score_retry_requested",
      payload: { roomId: "room-1" },
    });
  });

  it("does not throw when submit rejects", () => {
    const submit = jest.fn<Promise<AnalyticsSubmitResult>, Parameters<AnalyticsClient["submit"]>>();
    submit.mockRejectedValue(new Error("network down"));
    const events = new AnalyticsEvents({ submit } as unknown as AnalyticsClient);

    expect(() => events.appOpened({ coldStart: false })).not.toThrow();
  });

  it("delegates sensitive payload rejection to AnalyticsClient without throwing", async () => {
    const client = new AnalyticsClient({ context: baseContext });
    const events = new AnalyticsEvents(client);
    const submitSpy = jest.spyOn(client, "submit").mockResolvedValue({
      accepted: false,
      reason: "敏感字段被拒绝",
    });

    expect(() =>
      events.roomJoined({ roomId: "r-1", email: "user@example.com" } as never),
    ).not.toThrow();
    expect(submitSpy).toHaveBeenCalledWith({
      name: "room_joined",
      payload: { roomId: "r-1", email: "user@example.com" },
    });

    submitSpy.mockRestore();
  });
});
