export const ANALYTICS_SCHEMA_VERSION = "1.0" as const;

export type AnalyticsEnvironment = "development" | "staging" | "production";
export type AnalyticsPlatform = "ios" | "android";

/** Shared metadata attached to every submitted analytics record. */
export interface AnalyticsContextFields {
  userId: string;
  appSessionId: string;
  environment: AnalyticsEnvironment;
  platform: AnalyticsPlatform;
  appVersion: string;
}

export type AnalyticsEventName =
  | "app_opened"
  | "guest_session_created"
  | "room_created"
  | "room_joined"
  | "room_ready_changed"
  | "room_started"
  | "rtc_connection_changed"
  | "room_ended"
  | "recording_status_changed"
  | "score_report_viewed"
  | "score_retry_requested"
  | "ops_handoff_started";

export type AppOpenedPayload = {
  entry_point?: "cold_start" | "warm_resume" | "push" | "deep_link";
  previous_app_session_gap_ms?: number;
};

export type GuestSessionCreatedPayload = {
  guest_session_id?: string;
  session_type?: "guest";
  player_id?: string;
  entry_point?: "app_open" | "room_create" | "room_join";
  correlation_id?: string;
  latency_ms?: number;
};

export type RoomCreatedPayload = {
  room_id?: string;
  player_id?: string;
  room_version?: number;
  room_role?: "host";
  story_id?: string;
  creation_mode?: "quick_create" | "story_select";
  correlation_id?: string;
  latency_ms?: number;
};

export type RoomJoinedPayload = {
  room_id?: string;
  player_id?: string;
  room_version?: number;
  join_method?: "room_code" | "recent_room" | "deep_link" | "invite";
  seat_index?: number;
  room_role?: "host" | "member";
  correlation_id?: string;
  latency_ms?: number;
};

export type RoomReadyChangedPayload = {
  room_id?: string;
  player_id?: string;
  ready_state?: "ready" | "not_ready" | "blocked";
  room_version?: number;
  change_source?: "user" | "system";
  mic_check_state?: "not_checked" | "passed" | "failed";
  correlation_id?: string;
};

export type RoomStartedPayload = {
  room_id?: string;
  room_version?: number;
  member_count?: number;
  ready_member_count?: number;
  started_by_player_id?: string;
  start_mode?: "host_action" | "system_resume";
  correlation_id?: string;
  latency_ms?: number;
};

export type RtcConnectionChangedPayload = {
  room_id?: string;
  player_id?: string;
  connection_state?: "connecting" | "connected" | "reconnecting" | "disconnected" | "failed";
  previous_state?: string;
  reason_code?: "network_lost" | "network_recovered" | "permission_denied" | "provider_error";
  duration_ms?: number;
  attempt_number?: number;
};

export type RoomEndedPayload = {
  room_id?: string;
  room_version?: number;
  ended_by_player_id?: string;
  end_reason?: "host_action" | "timeout" | "system_failure";
  live_duration_ms?: number;
  member_count?: number;
  correlation_id?: string;
  latency_ms?: number;
};

export type RecordingStatusChangedPayload = {
  room_id?: string;
  recording_status?:
    | "requested"
    | "recording"
    | "stopping"
    | "ready"
    | "failed"
    | "expired";
  status_sequence?: number;
  failure_reason_code?: string;
  participant_count?: number;
  latency_ms?: number;
  correlation_id?: string;
};

export type ScoreReportViewedPayload = {
  room_id?: string;
  player_id?: string;
  report_state?: "waiting" | "processing" | "success" | "failed";
  entry_point?: "room_end" | "history" | "notification";
  latency_ms?: number;
  report_version?: number;
};

export type ScoreRetryRequestedPayload = {
  room_id?: string;
  player_id?: string;
  score_job_id?: string;
  attempt_number?: number;
  retry_reason?: "user_action";
  failure_reason_code?: string;
  correlation_id?: string;
  latency_ms?: number;
};

export type OpsHandoffStartedPayload = {
  build_variant?: "internal_ops";
  handoff_surface?: "ops_webview";
  entry_point?: "admin_menu" | "deep_link";
  destination_host?: string;
  webview_version?: string;
  correlation_id?: string;
  latency_ms?: number;
};

export type AnalyticsEvent =
  | { name: "app_opened"; payload?: AppOpenedPayload }
  | { name: "guest_session_created"; payload?: GuestSessionCreatedPayload }
  | { name: "room_created"; payload?: RoomCreatedPayload }
  | { name: "room_joined"; payload?: RoomJoinedPayload }
  | { name: "room_ready_changed"; payload?: RoomReadyChangedPayload }
  | { name: "room_started"; payload?: RoomStartedPayload }
  | { name: "rtc_connection_changed"; payload?: RtcConnectionChangedPayload }
  | { name: "room_ended"; payload?: RoomEndedPayload }
  | { name: "recording_status_changed"; payload?: RecordingStatusChangedPayload }
  | { name: "score_report_viewed"; payload?: ScoreReportViewedPayload }
  | { name: "score_retry_requested"; payload?: ScoreRetryRequestedPayload }
  | { name: "ops_handoff_started"; payload?: OpsHandoffStartedPayload };

/** Wire envelope for `/v1/analytics/events` and transport sinks. */
export type AnalyticsRecord = {
  event_id: string;
  event_name: AnalyticsEventName;
  schema_version: typeof ANALYTICS_SCHEMA_VERSION;
  user_id: string;
  app_session_id: string;
  occurred_at: string;
  app_version: string;
  platform: AnalyticsPlatform;
  environment: AnalyticsEnvironment;
  producer: "client";
  properties: Record<string, unknown>;
  correlation_id?: string;
};

export type AnalyticsSubmitOptions = {
  eventId?: string;
  occurredAt?: string;
  correlationId?: string;
};

export type AnalyticsSubmitResult = {
  accepted: boolean;
  reason?: string;
};

export type AnalyticsTransport = (
  record: AnalyticsRecord,
) => void | Promise<void>;

type AnalyticsClientOptions = {
  context: AnalyticsContextFields;
  transport?: AnalyticsTransport;
  resolveUserId?: () => string | undefined;
};

const SENSITIVE_FIELD_KEYS = new Set([
  "email",
  "password",
  "usersig",
  "accesstoken",
  "refreshtoken",
  "bearertoken",
  "token",
  "cookie",
  "secret",
  "secretkey",
  "sdksecretkey",
  "roomcode",
  "opshandoffcode",
  "audio",
  "audiobytes",
  "audiourl",
  "transcript",
]);

const noopTransport: AnalyticsTransport = () => undefined;

function normalizeFieldKey(key: string): string {
  return key.replace(/[_-]/g, "").toLowerCase();
}

function isSensitiveFieldKey(key: string): boolean {
  return SENSITIVE_FIELD_KEYS.has(normalizeFieldKey(key));
}

function createEventId(explicit?: string): string {
  if (explicit) {
    return explicit;
  }
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `evt-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function isBinaryPayload(value: unknown): boolean {
  if (value instanceof Uint8Array) {
    return true;
  }
  if (typeof ArrayBuffer !== "undefined" && value instanceof ArrayBuffer) {
    return true;
  }
  if (
    typeof value === "object" &&
    value !== null &&
    (value as { type?: string }).type === "Buffer" &&
    Array.isArray((value as { data?: unknown }).data)
  ) {
    return true;
  }
  return false;
}

function findSensitiveViolation(value: unknown, path = "properties"): string | null {
  if (isBinaryPayload(value)) {
    return path;
  }

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const nested = findSensitiveViolation(value[index], `${path}[${index}]`);
      if (nested) {
        return nested;
      }
    }
    return null;
  }

  if (typeof value !== "object" || value === null) {
    return null;
  }

  for (const [key, nested] of Object.entries(value)) {
    if (isSensitiveFieldKey(key)) {
      return `${path}.${key}`;
    }
    const violation = findSensitiveViolation(nested, `${path}.${key}`);
    if (violation) {
      return violation;
    }
  }

  return null;
}

function buildWireRecord(
  context: AnalyticsContextFields,
  event: AnalyticsEvent,
  properties: Record<string, unknown>,
  userId: string,
  options?: AnalyticsSubmitOptions,
): AnalyticsRecord {
  const record: AnalyticsRecord = {
    event_id: createEventId(options?.eventId),
    event_name: event.name,
    schema_version: ANALYTICS_SCHEMA_VERSION,
    user_id: userId,
    app_session_id: context.appSessionId,
    occurred_at: options?.occurredAt ?? new Date().toISOString(),
    app_version: context.appVersion,
    platform: context.platform,
    environment: context.environment,
    producer: "client",
    properties,
  };

  if (options?.correlationId) {
    record.correlation_id = options.correlationId;
  }

  return record;
}

export class AnalyticsClient {
  private readonly context: AnalyticsContextFields;
  private readonly transport: AnalyticsTransport;
  private readonly resolveUserId?: () => string | undefined;

  constructor({ context, transport = noopTransport, resolveUserId }: AnalyticsClientOptions) {
    this.context = context;
    this.transport = transport;
    this.resolveUserId = resolveUserId;
  }

  async submit(
    event: AnalyticsEvent,
    options?: AnalyticsSubmitOptions,
  ): Promise<AnalyticsSubmitResult> {
    try {
      const properties = { ...(event.payload ?? {}) };
      const violation = findSensitiveViolation(properties);
      if (violation) {
        return {
          accepted: false,
          reason: `Sensitive field rejected: ${violation}`,
        };
      }

      const userId = this.resolveUserId?.()?.trim() || this.context.userId.trim();
      if (!userId) {
        return { accepted: false, reason: "Missing user_id" };
      }

      const record = buildWireRecord(this.context, event, properties, userId, options);

      await Promise.resolve(this.transport(record));
      return { accepted: true };
    } catch {
      return { accepted: false };
    }
  }
}
