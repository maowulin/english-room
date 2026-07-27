import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { getDefaultAnalyticsClient, useAnalyticsLifecycle } from "@/analytics";

export default function RootLayout() {
  const analyticsClient = getDefaultAnalyticsClient();
  useAnalyticsLifecycle(analyticsClient, { disposeOnUnmount: false });

  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      <StatusBar style="dark" />
    </>
  );
}
