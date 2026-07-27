import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import Constants from "expo-constants";
import { Platform } from "react-native";

import {
  isAnalyticsEnvironment,
  isAnalyticsPlatform,
  isAllowedAnalyticsProperties,
  isSafeAppVersion,
  type AnalyticsEnvironment,
  type AnalyticsEvent,
  type AnalyticsEventName,
  type AnalyticsEventProperties,
  type AnalyticsEventsResponse,
  type AnalyticsPlatform,
} from "@/analytics/event-catalog";

export const ANALYTICS_ANONYMOUS_USER_ID_KEY =
  "@english-room/analytics/anonymous-user-id";
export const ANALYTICS_MAX_QUEUE_SIZE = 200;
export const ANALYTICS_MAX_BATCH_SIZE = 20;
export const ANALYTICS_FLUSH_INTERVAL_MS = 10_000;
export const ANALYTICS_MAX_RETRY_COUNT = 3;
export const ANALYTICS_RETRY_DELAYS_MS = [1_000, 5_000, 30_000] as const;

export type AnalyticsKeyValueStore = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

export type AnalyticsClock = {
  now(): Date;
};

export type AnalyticsScheduler = {
  setInterval(callback: () => void, delayMs: number): unknown;
  clearInterval(handle: unknown): void;
  setTimeout(callback: () => void, delayMs: number): unknown;
  clearTimeout(handle: unknown): void;
};

export type AnalyticsTransport =
  | ((events: readonly AnalyticsEvent[]) => Promise<AnalyticsEventsResponse>)
  | {
      sendAnalyticsEvents(
        events: readonly AnalyticsEvent[],
      ): Promise<AnalyticsEventsResponse>;
    };

export type AnalyticsClientOptions = {
  transport: AnalyticsTransport;
  keyValueStore?: AnalyticsKeyValueStore;
  clock?: AnalyticsClock;
  uuidFactory?: () => string;
  scheduler?: AnalyticsScheduler;
  retryDelaysMs?: readonly number[];
  appVersion?: string;
  platform?: AnalyticsPlatform;
  environment?: AnalyticsEnvironment;
};

const defaultClock: AnalyticsClock = {
  now: () => new Date(),
};

const defaultScheduler: AnalyticsScheduler = {
  setInterval: (callback, delayMs) => setInterval(callback, delayMs),
  clearInterval: (handle) => clearInterval(handle as ReturnType<typeof setInterval>),
  setTimeout: (callback, delayMs) => setTimeout(callback, delayMs),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

function getDefaultPlatform(): AnalyticsPlatform {
  return Platform.OS === "ios" || Platform.OS === "android" ? Platform.OS : "web";
}

function isUuidV4(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

function createValidatedUuidFactory(factory: () => string): () => string {
  return () => {
    try {
      const candidate = factory();
      if (isUuidV4(candidate)) {
        return candidate;
      }
    } catch {
      // Fall back to Expo Crypto below without exposing the original error.
    }
    return createSafeUuidV4();
  };
}

export function createSafeUuidV4(): string {
  const candidates = [
    () => Crypto.randomUUID(),
    () => {
      const runtimeCrypto = globalThis.crypto as
        | { randomUUID?: () => string }
        | undefined;
      return runtimeCrypto?.randomUUID?.();
    },
  ];

  for (const candidateFactory of candidates) {
    try {
      const value = candidateFactory();
      if (isUuidV4(value)) {
        return value;
      }
    } catch {
      // Try the next platform-provided secure UUID source.
    }
  }

  throw new Error("安全 UUID 工厂返回了无效 UUID");
}

function isAnonymousUserId(value: string | null): value is string {
  return (
    value !== null &&
    /^anon_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

function isRetryableError(error: unknown): boolean {
  if (
    typeof error === "object" &&
    error !== null &&
    "retryable" in error &&
    typeof (error as { retryable?: unknown }).retryable === "boolean"
  ) {
    return (error as { retryable: boolean }).retryable;
  }

  const status =
    typeof error === "object" && error !== null && "status" in error
      ? (error as { status?: unknown }).status
      : undefined;

  if (typeof status !== "number") {
    return true;
  }

  return status === 408 || status === 429 || (status >= 500 && status <= 599);
}

export class AnalyticsClient {
  private readonly transport: AnalyticsTransport;
  private readonly keyValueStore: AnalyticsKeyValueStore;
  private readonly clock: AnalyticsClock;
  private readonly uuidFactory: () => string;
  private readonly scheduler: AnalyticsScheduler;
  private readonly retryDelaysMs: readonly number[];
  private readonly appVersion: string;
  private readonly platform: AnalyticsPlatform;
  private readonly environment: AnalyticsEnvironment;
  private readonly anonymousUserIdPromise: Promise<string>;
  private readonly queue: AnalyticsEvent[] = [];
  private sessionId: string | null = null;
  private intervalHandle: unknown;
  private flushPromise: Promise<void> | null = null;
  private disposed = false;
  private droppedCount = 0;
  private rejectedCount = 0;

  constructor({
    transport,
    keyValueStore = AsyncStorage,
    clock = defaultClock,
    uuidFactory = createSafeUuidV4,
    scheduler = defaultScheduler,
    retryDelaysMs = ANALYTICS_RETRY_DELAYS_MS,
    appVersion = Constants.expoConfig?.version ?? "1.0.0",
    platform = getDefaultPlatform(),
    environment = "local",
  }: AnalyticsClientOptions) {
    this.transport = transport;
    this.keyValueStore = keyValueStore;
    this.clock = clock;
    this.uuidFactory = createValidatedUuidFactory(uuidFactory);
    this.scheduler = scheduler;
    this.retryDelaysMs = retryDelaysMs;
    this.appVersion = isSafeAppVersion(appVersion) ? appVersion : "1.0.0";
    this.platform = isAnalyticsPlatform(platform) ? platform : getDefaultPlatform();
    this.environment = isAnalyticsEnvironment(environment) ? environment : "local";
    this.anonymousUserIdPromise = this.loadOrCreateAnonymousUserId();
    this.intervalHandle = this.scheduler.setInterval(() => {
      void this.flush("timer");
    }, ANALYTICS_FLUSH_INTERVAL_MS);
  }

  async startSession(): Promise<void> {
    if (this.disposed) {
      return;
    }

    await this.anonymousUserIdPromise;
    if (!this.disposed) {
      this.sessionId = `session_${this.uuidFactory()}`;
    }
  }

  track<EventName extends AnalyticsEventName>(
    eventName: EventName,
    properties: AnalyticsEventProperties[EventName],
  ): void {
    if (
      this.disposed ||
      this.sessionId === null ||
      this.currentAnonymousUserId === null ||
      !isAllowedAnalyticsProperties(eventName, properties)
    ) {
      return;
    }

    const event: AnalyticsEvent = {
      event_id: this.uuidFactory(),
      event_name: eventName,
      event_version: 1,
      occurred_at: this.clock.now().toISOString(),
      anonymous_user_id: this.currentAnonymousUserId,
      session_id: this.sessionId,
      environment: this.environment,
      platform: this.platform,
      app_version: this.appVersion,
      properties: { ...properties },
    } as AnalyticsEvent;
    this.enqueue(event);
  }

  async flush(_reason: "background" | "manual" | "shutdown" | "timer" = "manual") {
    if (this.disposed) {
      return;
    }
    if (this.flushPromise !== null) {
      return this.flushPromise;
    }

    this.flushPromise = this.flushQueue().finally(() => {
      this.flushPromise = null;
    });
    return this.flushPromise;
  }

  reset(): void {
    this.queue.splice(0, this.queue.length);
    this.sessionId = null;
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.scheduler.clearInterval(this.intervalHandle);
    this.reset();
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  getAnonymousUserId(): string | null {
    return this.currentAnonymousUserId;
  }

  getSessionId(): string | null {
    return this.sessionId;
  }

  getDiagnostics(): { droppedCount: number; rejectedCount: number } {
    return {
      droppedCount: this.droppedCount,
      rejectedCount: this.rejectedCount,
    };
  }

  private currentAnonymousUserId: string | null = null;

  private async loadOrCreateAnonymousUserId(): Promise<string> {
    let storedValue: string | null = null;
    try {
      storedValue = await this.keyValueStore.getItem(ANALYTICS_ANONYMOUS_USER_ID_KEY);
    } catch {
      storedValue = null;
    }

    if (isAnonymousUserId(storedValue)) {
      this.currentAnonymousUserId = storedValue;
      return storedValue;
    }

    const generatedValue = `anon_${this.uuidFactory()}`;
    this.currentAnonymousUserId = generatedValue;
    try {
      await this.keyValueStore.setItem(
        ANALYTICS_ANONYMOUS_USER_ID_KEY,
        generatedValue,
      );
    } catch {
      // Analytics identity is best effort and must never block the app.
    }
    return generatedValue;
  }

  private enqueue(event: AnalyticsEvent): void {
    if (this.queue.length >= ANALYTICS_MAX_QUEUE_SIZE) {
      this.queue.shift();
    }
    this.queue.push(event);
  }

  private async flushQueue(): Promise<void> {
    while (!this.disposed && this.queue.length > 0) {
      const batch = this.queue.slice(0, ANALYTICS_MAX_BATCH_SIZE);
      await this.sendWithRetry(batch);
      const batchIds = new Set(batch.map((event) => event.event_id));
      for (let index = this.queue.length - 1; index >= 0; index -= 1) {
        if (batchIds.has(this.queue[index].event_id)) {
          this.queue.splice(index, 1);
        }
      }
    }
  }

  private async sendWithRetry(batch: readonly AnalyticsEvent[]): Promise<void> {
    for (let retryCount = 0; retryCount <= ANALYTICS_MAX_RETRY_COUNT; retryCount += 1) {
      try {
        const response =
          typeof this.transport === "function"
            ? await this.transport(batch)
            : await this.transport.sendAnalyticsEvents(batch);

        if (
          !Number.isInteger(response.accepted) ||
          !Number.isInteger(response.duplicates) ||
          !Number.isInteger(response.rejected) ||
          response.accepted < 0 ||
          response.duplicates < 0 ||
          response.rejected < 0 ||
          response.accepted + response.duplicates + response.rejected !== batch.length
        ) {
          throw new Error("埋点响应计数不完整");
        }

        if (response.rejected > 0) {
          this.droppedCount += response.rejected;
          this.rejectedCount += response.rejected;
        }
        return;
      } catch (error) {
        if (retryCount >= ANALYTICS_MAX_RETRY_COUNT || !isRetryableError(error)) {
          this.droppedCount += batch.length;
          return;
        }

        const delayMs = this.retryDelaysMs[retryCount] ?? 0;
        await new Promise<void>((resolve) => {
          this.scheduler.setTimeout(resolve, delayMs);
        });
      }
    }
  }
}
