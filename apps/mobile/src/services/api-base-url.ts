export function resolveApiBaseUrl(value = process.env.EXPO_PUBLIC_API_BASE_URL): string {
  return value?.trim().replace(/\/+$/, "") || "http://127.0.0.1:8000";
}
