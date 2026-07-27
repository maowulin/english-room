import Constants from "expo-constants";
import { Platform } from "react-native";

import { resolveApiBaseUrl } from "@/services/api-base-url";
import {
  AnalyticsClient,
  type AnalyticsContextFields,
  type AnalyticsEnvironment,
  type AnalyticsPlatform,
} from "@/services/analytics-client";
import { AnalyticsEvents } from "@/services/analytics-events";
import { createHttpAnalyticsTransport } from "@/services/analytics-http-transport";
import { HttpRoomClient, type RoomClient } from "@/services/room-client";

let persistedUserId: string | undefined;

function createRandomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function getOrCreateAnalyticsUserId(): string {
  if (!persistedUserId) {
    persistedUserId = createRandomId();
  }
  return persistedUserId;
}

export function createAppSessionId(): string {
  return createRandomId();
}

function resolveAnalyticsEnvironment(): AnalyticsEnvironment {
  const raw = process.env.EXPO_PUBLIC_ANALYTICS_ENVIRONMENT?.trim();
  if (raw === "production" || raw === "staging" || raw === "development") {
    return raw;
  }
  return __DEV__ ? "development" : "production";
}

function resolveAnalyticsPlatform(): AnalyticsPlatform {
  return Platform.OS === "android" ? "android" : "ios";
}

export function createAnalyticsContext(appSessionId: string): AnalyticsContextFields {
  return {
    userId: getOrCreateAnalyticsUserId(),
    appSessionId,
    environment: resolveAnalyticsEnvironment(),
    platform: resolveAnalyticsPlatform(),
    appVersion:
      Constants.expoConfig?.version ??
      Constants.nativeAppVersion ??
      Constants.expoConfig?.extra?.appVersion ??
      "1.0.0",
  };
}

const noopTransport = () => undefined;

export function createNoopAnalyticsEvents(appSessionId: string): AnalyticsEvents {
  return new AnalyticsEvents(
    new AnalyticsClient({
      context: createAnalyticsContext(appSessionId),
      transport: noopTransport,
    }),
  );
}

export function createHttpAnalyticsEvents(
  client: HttpRoomClient,
  appSessionId: string,
): AnalyticsEvents {
  return new AnalyticsEvents(
    new AnalyticsClient({
      context: createAnalyticsContext(appSessionId),
      transport: createHttpAnalyticsTransport({
        baseUrl: resolveApiBaseUrl(),
        getAccessToken: () => client.getAccessToken(),
      }),
    }),
  );
}

export type AnalyticsEventsFactory = (
  client: RoomClient,
  appSessionId: string,
) => AnalyticsEvents;

export const defaultAnalyticsEventsFactory: AnalyticsEventsFactory = (client, appSessionId) => {
  if (client instanceof HttpRoomClient) {
    return createHttpAnalyticsEvents(client, appSessionId);
  }
  return createNoopAnalyticsEvents(appSessionId);
};

export function canSendAuthenticatedAnalytics(client: RoomClient): boolean {
  return client instanceof HttpRoomClient && Boolean(client.getAccessToken?.()?.trim());
}
