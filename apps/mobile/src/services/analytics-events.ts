import {
  AnalyticsClient,
  type AppOpenedPayload,
  type GuestSessionCreatedPayload,
  type RecordingStatusChangedPayload,
  type RoomEndedPayload,
  type RoomJoinedPayload,
  type RoomReadyChangedPayload,
  type RoomScopedPayload,
  type RtcConnectionChangedPayload,
  type OpsHandoffStartedPayload,
} from "@/services/analytics-client";

type AnalyticsEventsClient = Pick<AnalyticsClient, "submit">;

function fireAndForgetSubmit(
  client: AnalyticsEventsClient,
  event: Parameters<AnalyticsClient["submit"]>[0],
): void {
  void client.submit(event).catch(() => undefined);
}

export class AnalyticsEvents {
  private readonly client: AnalyticsEventsClient;

  constructor(client: AnalyticsEventsClient) {
    this.client = client;
  }

  appOpened(payload?: AppOpenedPayload): void {
    fireAndForgetSubmit(this.client, { name: "app_opened", payload });
  }

  guestSessionCreated(payload?: GuestSessionCreatedPayload): void {
    fireAndForgetSubmit(this.client, { name: "guest_session_created", payload });
  }

  roomCreated(payload?: RoomScopedPayload): void {
    fireAndForgetSubmit(this.client, { name: "room_created", payload });
  }

  roomJoined(payload?: RoomJoinedPayload): void {
    fireAndForgetSubmit(this.client, { name: "room_joined", payload });
  }

  roomReadyChanged(payload?: RoomReadyChangedPayload): void {
    fireAndForgetSubmit(this.client, { name: "room_ready_changed", payload });
  }

  roomStarted(payload?: RoomScopedPayload): void {
    fireAndForgetSubmit(this.client, { name: "room_started", payload });
  }

  rtcConnectionChanged(payload?: RtcConnectionChangedPayload): void {
    fireAndForgetSubmit(this.client, { name: "rtc_connection_changed", payload });
  }

  roomEnded(payload?: RoomEndedPayload): void {
    fireAndForgetSubmit(this.client, { name: "room_ended", payload });
  }

  recordingStatusChanged(payload?: RecordingStatusChangedPayload): void {
    fireAndForgetSubmit(this.client, {
      name: "recording_status_changed",
      payload,
    });
  }

  scoreReportViewed(payload?: RoomScopedPayload): void {
    fireAndForgetSubmit(this.client, { name: "score_report_viewed", payload });
  }

  scoreRetryRequested(payload?: RoomScopedPayload): void {
    fireAndForgetSubmit(this.client, { name: "score_retry_requested", payload });
  }

  opsHandoffStarted(payload?: OpsHandoffStartedPayload): void {
    fireAndForgetSubmit(this.client, { name: "ops_handoff_started", payload });
  }
}
