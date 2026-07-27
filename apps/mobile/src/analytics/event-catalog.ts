export const ANALYTICS_EVENT_NAMES = [
  "app_opened",
  "guest_session_created",
  "room_created",
  "room_joined",
  "room_ready_changed",
  "room_started",
  "rtc_connection_changed",
  "room_ended",
  "recording_status_changed",
  "score_report_viewed",
  "score_retry_requested",
  "ops_handoff_started",
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENT_NAMES)[number];

export type AnalyticsPlatform = "ios" | "android" | "web";
export type AnalyticsEnvironment = "local";

type AnalyticsEventPropertiesMap = {
  app_opened: {
    app_version?: string;
    platform?: AnalyticsPlatform;
    entry_source: "cold_start" | "warm_resume";
  };
  guest_session_created: {
    auth_mode: "guest" | "authenticated";
    entry_source: "cold_start" | "warm_resume" | "room_create" | "room_join";
  };
  room_created: {
    room_role: "host";
    member_count: number;
  };
  room_joined: {
    room_role: "host" | "member";
    member_count: number;
  };
  room_ready_changed: {
    ready_state: "ready" | "not_ready" | "blocked";
    member_count: number;
  };
  room_started: {
    room_role: "host" | "member";
    member_count: number;
  };
  rtc_connection_changed: {
    connection_state:
      | "connecting"
      | "connected"
      | "reconnecting"
      | "disconnected"
      | "failed";
    failure_code:
      | "network_timeout"
      | "network_error"
      | "permission_denied"
      | "provider_error"
      | "unknown";
  };
  room_ended: {
    room_role: "host" | "member";
    room_duration_ms: number;
    end_reason: "host_action" | "timeout" | "system_failure";
  };
  recording_status_changed: {
    recording_state:
      | "requested"
      | "recording"
      | "stopping"
      | "ready"
      | "failed"
      | "expired";
    failure_code:
      | "network_timeout"
      | "network_error"
      | "permission_denied"
      | "provider_error"
      | "unknown";
  };
  score_report_viewed: {
    score_job_state: "waiting" | "processing" | "success" | "failed";
    report_section: "overview" | "pronunciation" | "fluency" | "grammar";
  };
  score_retry_requested: {
    score_job_state: "waiting" | "processing" | "success" | "failed";
    retry_reason: "user_action";
  };
  ops_handoff_started: {
    handoff_source: "admin_menu" | "deep_link";
    auth_mode: "guest" | "authenticated";
  };
};

export type AnalyticsEventProperties = AnalyticsEventPropertiesMap;

export type AnalyticsEvent = {
  [EventName in AnalyticsEventName]: {
    event_id: string;
    event_name: EventName;
    event_version: 1;
    occurred_at: string;
    anonymous_user_id: string;
    session_id: string;
    environment: AnalyticsEnvironment;
    platform: AnalyticsPlatform;
    app_version: string;
    properties: AnalyticsEventPropertiesMap[EventName];
  };
}[AnalyticsEventName];

export type AnalyticsEventsResponse = {
  accepted: number;
  duplicates: number;
  rejected: number;
  request_id: string;
};

const PROPERTY_KEYS: Record<AnalyticsEventName, readonly string[]> = {
  app_opened: ["app_version", "platform", "entry_source"],
  guest_session_created: ["auth_mode", "entry_source"],
  room_created: ["room_role", "member_count"],
  room_joined: ["room_role", "member_count"],
  room_ready_changed: ["ready_state", "member_count"],
  room_started: ["room_role", "member_count"],
  rtc_connection_changed: ["connection_state", "failure_code"],
  room_ended: ["room_role", "room_duration_ms", "end_reason"],
  recording_status_changed: ["recording_state", "failure_code"],
  score_report_viewed: ["score_job_state", "report_section"],
  score_retry_requested: ["score_job_state", "retry_reason"],
  ops_handoff_started: ["handoff_source", "auth_mode"],
};

export function isAnalyticsEventName(value: unknown): value is AnalyticsEventName {
  return (
    typeof value === "string" &&
    (ANALYTICS_EVENT_NAMES as readonly string[]).includes(value)
  );
}

function isSafeAppVersion(value: unknown): value is string {
  return typeof value === "string" && /^\d+\.\d+\.\d+$/.test(value);
}

function isPlatform(value: unknown): value is AnalyticsPlatform {
  return value === "ios" || value === "android" || value === "web";
}

function isMemberCount(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= 100
  );
}

function isDuration(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= 86_400_000
  );
}

function isFailureCode(value: unknown): boolean {
  return (
    value === "network_timeout" ||
    value === "network_error" ||
    value === "permission_denied" ||
    value === "provider_error" ||
    value === "unknown"
  );
}

function isSafePropertyValue(key: string, value: unknown): boolean {
  switch (key) {
    case "app_version":
      return isSafeAppVersion(value);
    case "platform":
      return isPlatform(value);
    case "entry_source":
      return (
        value === "cold_start" ||
        value === "warm_resume" ||
        value === "room_create" ||
        value === "room_join"
      );
    case "auth_mode":
      return value === "guest" || value === "authenticated";
    case "room_role":
      return value === "host" || value === "member";
    case "member_count":
      return isMemberCount(value);
    case "ready_state":
      return value === "ready" || value === "not_ready" || value === "blocked";
    case "connection_state":
      return (
        value === "connecting" ||
        value === "connected" ||
        value === "reconnecting" ||
        value === "disconnected" ||
        value === "failed"
      );
    case "failure_code":
      return isFailureCode(value);
    case "room_duration_ms":
      return isDuration(value);
    case "end_reason":
      return (
        value === "host_action" ||
        value === "timeout" ||
        value === "system_failure"
      );
    case "recording_state":
      return (
        value === "requested" ||
        value === "recording" ||
        value === "stopping" ||
        value === "ready" ||
        value === "failed" ||
        value === "expired"
      );
    case "score_job_state":
      return (
        value === "waiting" ||
        value === "processing" ||
        value === "success" ||
        value === "failed"
      );
    case "report_section":
      return (
        value === "overview" ||
        value === "pronunciation" ||
        value === "fluency" ||
        value === "grammar"
      );
    case "retry_reason":
      return value === "user_action";
    case "handoff_source":
      return value === "admin_menu" || value === "deep_link";
    default:
      return false;
  }
}

export function isAllowedAnalyticsProperties(
  eventName: AnalyticsEventName,
  properties: unknown,
): properties is AnalyticsEventPropertiesMap[typeof eventName] {
  if (!isAnalyticsEventName(eventName)) {
    return false;
  }

  if (
    typeof properties !== "object" ||
    properties === null ||
    Array.isArray(properties)
  ) {
    return false;
  }

  const candidate = properties as Record<string, unknown>;
  const keys = Object.keys(candidate);
  const allowedKeys = PROPERTY_KEYS[eventName];

  if (keys.some((key) => !allowedKeys.includes(key))) {
    return false;
  }

  const requiredKeys = eventName === "app_opened" ? ["entry_source"] : allowedKeys;
  if (requiredKeys.some((key) => !(key in candidate))) {
    return false;
  }

  return keys.every((key) => isSafePropertyValue(key, candidate[key]));
}
