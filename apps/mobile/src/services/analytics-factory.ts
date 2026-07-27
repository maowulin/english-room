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
import {
  createBufferedHttpAnalyticsTransport,
  type AnalyticsFlushReason,
} from "@/services/analytics-batcher";
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

export function createAnalyticsContext(
  appSessionId: string,
  userId?: string,
): AnalyticsContextFields {
  return {
    userId: userId ?? getOrCreateAnalyticsUserId(),
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

function resolveHttpAnalyticsUserId(
  client: HttpRoomClient,
  playerId?: string,
): () => string | undefined {
  return () => playerId?.trim() || client.getPlayerId()?.trim() || undefined;
}

export type HttpAnalyticsEvents = AnalyticsEvents & {
  flushAnalytics: (reason?: AnalyticsFlushReason) => Promise<void>;
  destroyAnalytics: () => void;
};

export function createHttpAnalyticsEvents(
  client: HttpRoomClient,
  appSessionId: string,
  playerId?: string,
): HttpAnalyticsEvents {
  const resolveUserId = resolveHttpAnalyticsUserId(client, playerId);
  const buffered = createBufferedHttpAnalyticsTransport({
    baseUrl: resolveApiBaseUrl(),
    getAccessToken: () => client.getAccessToken(),
  });
  const events = new AnalyticsEvents(
    new AnalyticsClient({
      context: createAnalyticsContext(appSessionId, playerId ?? ""),
      resolveUserId,
      transport: buffered.transport,
    }),
  ) as HttpAnalyticsEvents;
  events.flushAnalytics = (reason) => buffered.flush(reason);
  events.destroyAnalytics = () => buffered.destroy();
  return events;
}

export type AnalyticsEventsFactory = (
  client: RoomClient,
  appSessionId: string,
  playerId?: string,
) => AnalyticsEvents;

export const defaultAnalyticsEventsFactory: AnalyticsEventsFactory = (client, appSessionId, playerId) => {
  if (client instanceof HttpRoomClient) {
    return createHttpAnalyticsEvents(client, appSessionId, playerId);
  }
  return createNoopAnalyticsEvents(appSessionId);
};

export function canSendAuthenticatedAnalytics(client: RoomClient): boolean {
  return client instanceof HttpRoomClient && Boolean(client.getAccessToken?.()?.trim());
}
