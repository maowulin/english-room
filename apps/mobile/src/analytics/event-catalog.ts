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
    entry_source:
      | "cold_start"
      | "warm_resume"
      | "room_create"
      | "room_join"
      | "warm"
      | "seed_demo";
  };
  guest_session_created: {
    auth_mode: "guest" | "authenticated";
    entry_source:
      | "cold_start"
      | "warm_resume"
      | "room_create"
      | "room_join"
      | "warm"
      | "seed_demo";
  };
  room_created: {
    room_role: "host" | "member" | "guest";
    member_count: number;
  };
  room_joined: {
    room_role: "host" | "member" | "guest";
    member_count: number;
  };
  room_ready_changed: {
    ready_state: "ready" | "not_ready" | "blocked" | "pending";
    member_count: number;
  };
  room_started: {
    room_role: "host" | "member" | "guest";
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
    room_role: "host" | "member" | "guest";
    room_duration_ms: number;
    end_reason:
      | "host_action"
      | "timeout"
      | "system_failure"
      | "completed"
      | "user_left"
      | "error";
  };
  recording_status_changed: {
    recording_state:
      | "requested"
      | "recording"
      | "stopping"
      | "ready"
      | "failed"
      | "expired"
      | "starting"
      | "paused"
      | "stopped";
    failure_code:
      | "network_timeout"
      | "network_error"
      | "permission_denied"
      | "provider_error"
      | "unknown";
  };
  score_report_viewed: {
    score_job_state:
      | "waiting"
      | "processing"
      | "success"
      | "failed"
      | "pending"
      | "running"
      | "succeeded"
      | "not_started";
    report_section:
      | "overview"
      | "pronunciation"
      | "fluency"
      | "grammar"
      | "summary"
      | "details";
  };
  score_retry_requested: {
    score_job_state:
      | "waiting"
      | "processing"
      | "success"
      | "failed"
      | "pending"
      | "running"
      | "succeeded"
      | "not_started";
    retry_reason:
      | "user_action"
      | "user_requested"
      | "failed"
      | "timeout"
      | "error";
  };
  ops_handoff_started: {
    handoff_source:
      | "admin_menu"
      | "deep_link"
      | "app"
      | "ops_button"
      | "room"
      | "report";
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

export function isSafeAppVersion(value: unknown): value is string {
  return typeof value === "string" && /^\d+\.\d+\.\d+$/.test(value);
}

export function isAnalyticsPlatform(value: unknown): value is AnalyticsPlatform {
  return value === "ios" || value === "android" || value === "web";
}

export function isAnalyticsEnvironment(value: unknown): value is AnalyticsEnvironment {
  return value === "local";
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

const FAILURE_CODES = [
  "network_timeout",
  "network_error",
  "permission_denied",
  "provider_error",
  "unknown",
] as const;
const SAFE_CODE_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;

function isFailureCode(value: unknown): boolean {
  return (
    typeof value === "string" &&
    SAFE_CODE_PATTERN.test(value) &&
    (FAILURE_CODES as readonly string[]).includes(value)
  );
}

function isSafePropertyValue(key: string, value: unknown): boolean {
  switch (key) {
    case "app_version":
      return isSafeAppVersion(value);
    case "platform":
      return isAnalyticsPlatform(value);
    case "entry_source":
      return (
        value === "cold_start" ||
        value === "warm_resume" ||
        value === "room_create" ||
        value === "room_join" ||
        value === "warm" ||
        value === "seed_demo"
      );
    case "auth_mode":
      return value === "guest" || value === "authenticated";
    case "room_role":
      return value === "host" || value === "member" || value === "guest";
    case "member_count":
      return isMemberCount(value);
    case "ready_state":
      return (
        value === "ready" ||
        value === "not_ready" ||
        value === "blocked" ||
        value === "pending"
      );
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
        value === "system_failure" ||
        value === "completed" ||
        value === "user_left" ||
        value === "error"
      );
    case "recording_state":
      return (
        value === "requested" ||
        value === "recording" ||
        value === "stopping" ||
        value === "ready" ||
        value === "failed" ||
        value === "expired" ||
        value === "starting" ||
        value === "paused" ||
        value === "stopped"
      );
    case "score_job_state":
      return (
        value === "waiting" ||
        value === "processing" ||
        value === "success" ||
        value === "failed" ||
        value === "pending" ||
        value === "running" ||
        value === "succeeded" ||
        value === "not_started"
      );
    case "report_section":
      return (
        value === "overview" ||
        value === "pronunciation" ||
        value === "fluency" ||
        value === "grammar" ||
        value === "summary" ||
        value === "details"
      );
    case "retry_reason":
      return (
        value === "user_action" ||
        value === "user_requested" ||
        value === "failed" ||
        value === "timeout" ||
        value === "error"
      );
    case "handoff_source":
      return (
        value === "admin_menu" ||
        value === "deep_link" ||
        value === "app" ||
        value === "ops_button" ||
        value === "room" ||
        value === "report"
      );
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
