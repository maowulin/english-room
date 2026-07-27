import type { AnalyticsEventName, AnalyticsRecord, AnalyticsTransport } from "@/services/analytics-client";
import {
  AnalyticsHttpError,
  sendAnalyticsEvents,
  type HttpAnalyticsTransportOptions,
} from "@/services/analytics-http-transport";

export const MAX_BATCH_SIZE = 20;
export const MAX_QUEUE_SIZE = 200;
export const FLUSH_INTERVAL_MS = 10_000;
export const REQUEST_TIMEOUT_MS = 3_000;
export const MAX_RETRY_ATTEMPTS = 3;

export const DEFAULT_RETRY_BACKOFF_MS = [1_000, 5_000, 30_000] as const;

export type AnalyticsFlushReason = "background" | "manual" | "shutdown";

export type AnalyticsDropReasonCode =
  | "max_retries_exceeded"
  | "validation_failed"
  | "rate_limited"
  | "request_too_large"
  | "transport_failed"
  | "queue_overflow";

export type AnalyticsDiagnosticDrop = {
  original_event_name: AnalyticsEventName;
  drop_reason_code: AnalyticsDropReasonCode;
  sink_type: "first_party";
  attempt_count: number;
};

export type TimerScheduler = {
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (id: unknown) => void;
};

type QueuedRecord = {
  record: AnalyticsRecord;
  attemptCount: number;
};

export type AnalyticsBatcherOptions = HttpAnalyticsTransportOptions & {
  maxBatchSize?: number;
  maxQueueSize?: number;
  flushIntervalMs?: number;
  maxRetryAttempts?: number;
  retryBackoffMs?: readonly number[];
  scheduler?: TimerScheduler;
  onDiagnosticDrop?: (drop: AnalyticsDiagnosticDrop) => void;
  random?: () => number;
};

const defaultScheduler: TimerScheduler = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
};

function isP0EventName(eventName: AnalyticsEventName): boolean {
  return eventName === "app_opened";
}

function isRetryableHttpStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function dropReasonForHttpStatus(status: number): AnalyticsDropReasonCode {
  if (status === 413) {
    return "request_too_large";
  }
  if (status === 429) {
    return "rate_limited";
  }
  if (status === 400 || status === 401 || status === 403) {
    return "validation_failed";
  }
  return "transport_failed";
}

function classifySendFailure(error: unknown): {
  retryable: boolean;
  dropReason: AnalyticsDropReasonCode;
} {
  if (error instanceof AnalyticsHttpError) {
    if (error.status === undefined) {
      return { retryable: true, dropReason: "transport_failed" };
    }
    if (isRetryableHttpStatus(error.status)) {
      return {
        retryable: true,
        dropReason: error.status === 429 ? "rate_limited" : "transport_failed",
      };
    }
    return { retryable: false, dropReason: dropReasonForHttpStatus(error.status) };
  }
  return { retryable: true, dropReason: "transport_failed" };
}

function applyJitter(baseMs: number, random: () => number): number {
  const jitterFactor = 0.8 + random() * 0.4;
  return Math.round(baseMs * jitterFactor);
}

export class AnalyticsBatcher {
  private readonly options: Required<
    Pick<
      AnalyticsBatcherOptions,
      | "maxBatchSize"
      | "maxQueueSize"
      | "flushIntervalMs"
      | "maxRetryAttempts"
      | "retryBackoffMs"
      | "scheduler"
      | "random"
    >
  > &
    HttpAnalyticsTransportOptions & {
      onDiagnosticDrop?: (drop: AnalyticsDiagnosticDrop) => void;
    };

  private readonly queue: QueuedRecord[] = [];
  private flushIntervalHandle: unknown | undefined;
  private retryTimerHandle: unknown | undefined;
  private inFlight: Promise<void> | null = null;
  private retryBatch: QueuedRecord[] | null = null;
  private forceNextSend = false;

  constructor(options: AnalyticsBatcherOptions) {
    this.options = {
      ...options,
      timeoutMs: options.timeoutMs ?? REQUEST_TIMEOUT_MS,
      maxBatchSize: options.maxBatchSize ?? MAX_BATCH_SIZE,
      maxQueueSize: options.maxQueueSize ?? MAX_QUEUE_SIZE,
      flushIntervalMs: options.flushIntervalMs ?? FLUSH_INTERVAL_MS,
      maxRetryAttempts: options.maxRetryAttempts ?? MAX_RETRY_ATTEMPTS,
      retryBackoffMs: options.retryBackoffMs ?? DEFAULT_RETRY_BACKOFF_MS,
      scheduler: options.scheduler ?? defaultScheduler,
      random: options.random ?? Math.random,
      onDiagnosticDrop: options.onDiagnosticDrop,
    };
  }

  createTransport(): AnalyticsTransport {
    return (record) => {
      this.enqueue(record);
    };
  }

  enqueue(record: AnalyticsRecord): void {
    this.evictIfNeeded();
    this.queue.push({ record, attemptCount: 0 });
    this.ensureFlushInterval();
    void this.scheduleSend();
  }

  flush(_reason?: AnalyticsFlushReason): Promise<void> {
    this.clearFlushInterval();
    return this.scheduleSend(true);
  }

  destroy(): void {
    this.clearFlushInterval();
    this.clearRetryTimer();
  }

  private evictIfNeeded(): void {
    while (this.queue.length >= this.options.maxQueueSize) {
      const p0Index = this.queue.findIndex((item) => isP0EventName(item.record.event_name));
      const removeIndex = p0Index >= 0 ? p0Index : 0;
      const [removed] = this.queue.splice(removeIndex, 1);
      if (removed) {
        this.recordDrop(removed, "queue_overflow");
      }
    }
  }

  private ensureFlushInterval(): void {
    if (this.flushIntervalHandle !== undefined) {
      return;
    }
    this.flushIntervalHandle = this.options.scheduler.setTimeout(() => {
      this.flushIntervalHandle = undefined;
      void this.scheduleSend(true);
      if (this.queue.length > 0 || this.retryBatch) {
        this.ensureFlushInterval();
      }
    }, this.options.flushIntervalMs);
  }

  private clearFlushInterval(): void {
    if (this.flushIntervalHandle !== undefined) {
      this.options.scheduler.clearTimeout(this.flushIntervalHandle);
      this.flushIntervalHandle = undefined;
    }
  }

  private clearRetryTimer(): void {
    if (this.retryTimerHandle !== undefined) {
      this.options.scheduler.clearTimeout(this.retryTimerHandle);
      this.retryTimerHandle = undefined;
    }
  }

  private recordDrop(item: QueuedRecord, dropReason: AnalyticsDropReasonCode): void {
    this.options.onDiagnosticDrop?.({
      original_event_name: item.record.event_name,
      drop_reason_code: dropReason,
      sink_type: "first_party",
      attempt_count: Math.max(1, item.attemptCount),
    });
  }

  private scheduleSend(force = false): Promise<void> {
    if (force) {
      this.forceNextSend = true;
    }
    if (this.inFlight) {
      return this.inFlight;
    }

    const runWithForce = this.forceNextSend;
    this.forceNextSend = false;

    this.inFlight = this.runSendLoop(runWithForce).finally(() => {
      this.inFlight = null;
      if (this.forceNextSend) {
        return this.scheduleSend(false);
      }
      return undefined;
    });
    return this.inFlight;
  }

  private async runSendLoop(force: boolean): Promise<void> {
    if (this.retryTimerHandle !== undefined && !force) {
      return;
    }
    this.clearRetryTimer();

    while (this.retryBatch || this.queue.length > 0) {
      const batch = await this.takeBatch(force);
      force = false;
      if (!batch || batch.length === 0) {
        if (!force && (this.queue.length > 0 || this.retryBatch)) {
          break;
        }
        return;
      }

      try {
        await sendAnalyticsEvents(
          {
            baseUrl: this.options.baseUrl,
            getAccessToken: this.options.getAccessToken,
            fetcher: this.options.fetcher,
            timeoutMs: this.options.timeoutMs,
          },
          batch.map((item) => item.record),
        );
        this.retryBatch = null;
      } catch (error) {
        const { retryable, dropReason } = classifySendFailure(error);
        if (!retryable) {
          for (const item of batch) {
            this.recordDrop(item, dropReason);
          }
          this.retryBatch = null;
          continue;
        }

        const nextAttemptBatch = batch.map((item) => ({
          ...item,
          attemptCount: item.attemptCount + 1,
        }));

        const survivors: QueuedRecord[] = [];
        for (const item of nextAttemptBatch) {
          if (item.attemptCount > this.options.maxRetryAttempts) {
            this.recordDrop(item, "max_retries_exceeded");
          } else {
            survivors.push(item);
          }
        }

        if (survivors.length === 0) {
          this.retryBatch = null;
          continue;
        }

        this.retryBatch = survivors;
        const backoffIndex = Math.min(
          survivors[0]?.attemptCount ?? 1,
          this.options.retryBackoffMs.length,
        ) - 1;
        const baseDelay =
          this.options.retryBackoffMs[Math.max(0, backoffIndex)] ??
          this.options.retryBackoffMs[this.options.retryBackoffMs.length - 1] ??
          1_000;
        const delayMs = applyJitter(baseDelay, this.options.random);

        await new Promise<void>((resolve) => {
          this.retryTimerHandle = this.options.scheduler.setTimeout(() => {
            this.retryTimerHandle = undefined;
            resolve();
          }, delayMs);
        });
      }
    }
  }

  private async takeBatch(force: boolean): Promise<QueuedRecord[] | null> {
    if (this.retryBatch) {
      const batch = this.retryBatch;
      this.retryBatch = null;
      return batch;
    }

    if (this.queue.length === 0) {
      return null;
    }

    if (!force && this.queue.length < this.options.maxBatchSize) {
      return null;
    }

    return this.queue.splice(0, this.options.maxBatchSize);
  }
}

export type BufferedHttpAnalyticsTransport = {
  transport: AnalyticsTransport;
  flush: (reason?: AnalyticsFlushReason) => Promise<void>;
  destroy: () => void;
};

export function createBufferedHttpAnalyticsTransport(
  options: AnalyticsBatcherOptions,
): BufferedHttpAnalyticsTransport {
  const batcher = new AnalyticsBatcher(options);
  return {
    transport: batcher.createTransport(),
    flush: (reason) => batcher.flush(reason),
    destroy: () => batcher.destroy(),
  };
}
