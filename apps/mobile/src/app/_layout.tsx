import { useRootNavigationState, Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";

import { LaunchLoadingOverlay } from "@/components/launch-loading-overlay";

const MINIMUM_LAUNCH_DURATION_MS = 1_200;

void SplashScreen.preventAutoHideAsync();

export function RootLayout() {
  const rootNavigationState = useRootNavigationState();
  const [launchVisible, setLaunchVisible] = useState(false);
  const [nativeSplashHidden, setNativeSplashHidden] = useState(false);

  useEffect(() => {
    if (!rootNavigationState?.key) return;

    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    void SplashScreen.hideAsync().then(() => {
      if (!active) return;
      setNativeSplashHidden(true);
      setLaunchVisible(true);
      timer = setTimeout(() => {
        setLaunchVisible(false);
      }, MINIMUM_LAUNCH_DURATION_MS);
    });

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [rootNavigationState?.key]);

  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      <StatusBar style="dark" />
      {nativeSplashHidden ? <LaunchLoadingOverlay visible={launchVisible} /> : null}
    </>
  );
}

export default RootLayout;
