export const DEFAULT_ANALYTICS_EVENT_VERSION = 1;

export type AnalyticsEnvironment = "development" | "staging" | "production";
export type AnalyticsPlatform = "ios" | "android" | "web";

/** Shared metadata attached to every submitted analytics record. */
export interface AnalyticsContextFields {
  eventVersion: number;
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
  | { name: "ops_handoff_started"; payload?: RoomScopedPayload };

export type AnalyticsRecord = AnalyticsContextFields & {
  name: AnalyticsEventName;
  payload: Record<string, unknown>;
  occurredAt: string;
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

const SENSITIVE_FIELD_PATTERN =
  /^(email|password|usersig|accesstoken|audiobytes|audio)$/i;

const noopTransport: AnalyticsTransport = () => undefined;

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

function findSensitiveViolation(value: unknown, path = "payload"): string | null {
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
    if (SENSITIVE_FIELD_PATTERN.test(key)) {
      return `${path}.${key}`;
    }
    const violation = findSensitiveViolation(nested, `${path}.${key}`);
    if (violation) {
      return violation;
    }
  }

  return null;
}

export class AnalyticsClient {
  private readonly context: AnalyticsContextFields;
  private readonly transport: AnalyticsTransport;

  constructor({ context, transport = noopTransport }: AnalyticsClientOptions) {
    this.context = context;
    this.transport = transport;
  }

  async submit(event: AnalyticsEvent): Promise<AnalyticsSubmitResult> {
    try {
      const payload = event.payload ?? {};
      const violation = findSensitiveViolation(payload);
      if (violation) {
        return {
          accepted: false,
          reason: `敏感字段被拒绝：${violation}`,
        };
      }

      const record: AnalyticsRecord = {
        ...this.context,
        name: event.name,
        payload,
        occurredAt: new Date().toISOString(),
      };

      await Promise.resolve(this.transport(record));
      return { accepted: true };
    } catch {
      return { accepted: false };
    }
  }
}
