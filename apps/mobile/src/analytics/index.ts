import { ApiClient } from "@/services/api-client";

import {
  AnalyticsClient,
  type AnalyticsClientOptions,
} from "@/analytics/analytics-client";

export * from "@/analytics/analytics-client";
export * from "@/analytics/event-catalog";
export * from "@/analytics/lifecycle";

const DEFAULT_API_BASE_URL = "http://127.0.0.1:8000";
let defaultAnalyticsClient: AnalyticsClient | null = null;

export function getDefaultAnalyticsClient(): AnalyticsClient {
  if (defaultAnalyticsClient === null) {
    const apiClient = new ApiClient({
      baseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL,
    });
    const options: AnalyticsClientOptions = {
      transport: apiClient,
    };
    defaultAnalyticsClient = new AnalyticsClient(options);
  }
  return defaultAnalyticsClient;
}
