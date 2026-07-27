import { useEffect } from "react";
import { AppState, type AppStateStatus } from "react-native";

import type { AnalyticsEventName, AnalyticsEventProperties } from "@/analytics/event-catalog";

export type AnalyticsLifecycleClient = {
  startSession(): Promise<void>;
  track<EventName extends AnalyticsEventName>(
    eventName: EventName,
    properties: AnalyticsEventProperties[EventName],
  ): void;
  flush(reason?: "background" | "manual" | "shutdown" | "timer"): Promise<void>;
  dispose(): void;
};

export const noopAnalyticsClient: AnalyticsLifecycleClient = {
  startSession: async () => undefined,
  track: () => undefined,
  flush: async () => undefined,
  dispose: () => undefined,
};

export function useAnalyticsLifecycle(
  analyticsClient: AnalyticsLifecycleClient,
  { disposeOnUnmount = false }: { disposeOnUnmount?: boolean } = {},
): void {
  useEffect(() => {
    let isActive = true;
    let previousAppState: AppStateStatus = AppState.currentState;

    const openSession = async (
      entrySource: "cold_start" | "warm_resume",
    ): Promise<void> => {
      await analyticsClient.startSession();
      if (!isActive) {
        return;
      }
      analyticsClient.track("app_opened", { entry_source: entrySource });
      void analyticsClient.flush("manual").catch(() => undefined);
    };

    void openSession("cold_start");

    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (
        nextAppState !== previousAppState &&
        (nextAppState === "background" || nextAppState === "inactive")
      ) {
        void analyticsClient.flush("background").catch(() => undefined);
      }
      const resumedFromBackground =
        nextAppState === "active" && previousAppState !== "active";
      previousAppState = nextAppState;
      if (resumedFromBackground) {
        void openSession("warm_resume");
      }
    });

    return () => {
      isActive = false;
      void analyticsClient.flush("shutdown").catch(() => undefined);
      subscription.remove();
      if (disposeOnUnmount) {
        analyticsClient.dispose();
      }
    };
  }, [analyticsClient, disposeOnUnmount]);
}
