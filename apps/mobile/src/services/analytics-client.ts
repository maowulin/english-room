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

type AnonymousPayload = Record<string, unknown>;

export type AppOpenedPayload = AnonymousPayload & {
  coldStart?: boolean;
};

export type GuestSessionCreatedPayload = AnonymousPayload & {
  sessionId?: string;
};

export type RoomScopedPayload = AnonymousPayload & {
  roomId?: string;
};

export type RoomReadyChangedPayload = RoomScopedPayload & {
  ready?: boolean;
};

export type RtcConnectionChangedPayload = RoomScopedPayload & {
  state?: string;
};

export type RoomEndedPayload = RoomScopedPayload & {
  reason?: string;
};

export type RecordingStatusChangedPayload = RoomScopedPayload & {
  status?: string;
};

export type RoomJoinedPayload = RoomScopedPayload & {
  role?: string;
};

export type OpsHandoffStartedPayload = AnonymousPayload & {
  buildVariant?: string;
  handoffSurface?: string;
  entryPoint?: string;
};

export type AnalyticsEvent =
  | { name: "app_opened"; payload?: AppOpenedPayload }
  | { name: "guest_session_created"; payload?: GuestSessionCreatedPayload }
  | { name: "room_created"; payload?: RoomScopedPayload }
  | { name: "room_joined"; payload?: RoomJoinedPayload }
  | { name: "room_ready_changed"; payload?: RoomReadyChangedPayload }
  | { name: "room_started"; payload?: RoomScopedPayload }
  | { name: "rtc_connection_changed"; payload?: RtcConnectionChangedPayload }
  | { name: "room_ended"; payload?: RoomEndedPayload }
  | { name: "recording_status_changed"; payload?: RecordingStatusChangedPayload }
  | { name: "score_report_viewed"; payload?: RoomScopedPayload }
  | { name: "score_retry_requested"; payload?: RoomScopedPayload }
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
  options?: AnalyticsSubmitOptions,
): AnalyticsRecord {
  const record: AnalyticsRecord = {
    event_id: createEventId(options?.eventId),
    event_name: event.name,
    schema_version: ANALYTICS_SCHEMA_VERSION,
    user_id: context.userId,
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

  constructor({ context, transport = noopTransport }: AnalyticsClientOptions) {
    this.context = context;
    this.transport = transport;
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
          reason: `敏感字段被拒绝：${violation}`,
        };
      }

      const record = buildWireRecord(this.context, event, properties, options);

      await Promise.resolve(this.transport(record));
      return { accepted: true };
    } catch {
      return { accepted: false };
    }
  }
}
