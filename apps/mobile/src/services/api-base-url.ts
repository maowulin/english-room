export function resolveApiBaseUrl(value = process.env.EXPO_PUBLIC_API_BASE_URL): string {
  return value?.trim().replace(/\/+$/, "") || "http://127.0.0.1:8000";
}

/** Converts the HTTP(S) API origin to a WebSocket origin for room event streams. */
export function httpApiBaseUrlToWebSocketBaseUrl(httpBaseUrl: string): string {
  const trimmed = httpBaseUrl.trim().replace(/\/+$/, "");
  if (trimmed.startsWith("https://")) return `wss://${trimmed.slice("https://".length)}`;
  if (trimmed.startsWith("http://")) return `ws://${trimmed.slice("http://".length)}`;
  throw new Error(`无法将 API Base URL 转为 WebSocket URL：${httpBaseUrl}`);
}

export function buildRoomEventsWebSocketUrl(apiBaseUrl: string, roomId: string): string {
  return `${httpApiBaseUrlToWebSocketBaseUrl(apiBaseUrl)}/v1/rooms/${encodeURIComponent(roomId)}/events`;
}
