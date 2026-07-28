import { useEffect, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { BrandMark } from "@/components/brand-mark";

const FADE_OUT_DURATION_MS = 180;
const CONTENT_DELAY_MS = 550;
const MARK_SIZE = 92;
const USE_NATIVE_DRIVER = Platform.OS !== "web";

export type LaunchLoadingOverlayProps = {
  visible: boolean;
};

export function LaunchLoadingOverlay({ visible }: LaunchLoadingOverlayProps) {
  const [mounted, setMounted] = useState(visible);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [opacity] = useState(() => new Animated.Value(visible ? 1 : 0));
  const [markScale] = useState(() => new Animated.Value(visible ? 0 : 1));
  const [contentOpacity] = useState(() => new Animated.Value(visible ? 0 : 1));
  const [contentTranslateY] = useState(() => new Animated.Value(visible ? 10 : 0));

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (visible) {
      opacity.setValue(1);
      if (reduceMotion) {
        markScale.setValue(1);
        contentOpacity.setValue(1);
        contentTranslateY.setValue(0);
        return;
      }
      markScale.setValue(0.78);
      contentOpacity.setValue(0);
      contentTranslateY.setValue(10);
      Animated.parallel([
        Animated.timing(markScale, {
          duration: 650,
          easing: Easing.out(Easing.cubic),
          toValue: 1,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.sequence([
          Animated.delay(CONTENT_DELAY_MS),
          Animated.parallel([
            Animated.timing(contentOpacity, {
              duration: 450,
              easing: Easing.out(Easing.quad),
              toValue: 1,
              useNativeDriver: USE_NATIVE_DRIVER,
            }),
            Animated.timing(contentTranslateY, {
              duration: 450,
              easing: Easing.out(Easing.quad),
              toValue: 0,
              useNativeDriver: USE_NATIVE_DRIVER,
            }),
          ]),
        ]),
      ]).start();
      return;
    }

    const fadeDuration = reduceMotion ? 0 : FADE_OUT_DURATION_MS;
    const fadeTimer = setTimeout(() => {
      setMounted(false);
    }, fadeDuration);
    Animated.timing(opacity, {
      duration: fadeDuration,
      easing: Easing.out(Easing.quad),
      toValue: 0,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
    return () => clearTimeout(fadeTimer);
  }, [contentOpacity, contentTranslateY, markScale, opacity, reduceMotion, visible]);

  if (!mounted) return null;

  return (
    <Animated.View
      accessibilityLabel="English Room"
      accessibilityRole="summary"
      accessible
      style={[styles.overlay, { opacity }]}
    >
      <Animated.View style={{ transform: [{ scale: markScale }] }}>
        <BrandMark animated={!reduceMotion} size={MARK_SIZE} />
      </Animated.View>
      <Animated.View
        style={[styles.copy, { opacity: contentOpacity, transform: [{ translateY: contentTranslateY }] }]}
      >
        <Text style={styles.eyebrow}>A room for your voice</Text>
        <Text style={styles.title}>English Room</Text>
        <Text style={styles.tagline}>Find your voice. Tell the story.</Text>
        <View accessibilityLabel="Loading progress" style={styles.progress}>
          <View style={styles.progressTrack}>
            <View style={styles.progressFill} />
          </View>
          <View style={styles.progressCopy}>
            <Text style={styles.progressLabel}>Preparing your room</Text>
            <Text style={styles.progressLabel}>Ready soon</Text>
          </View>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    alignItems: "center",
    backgroundColor: "#F8F5EE",
    bottom: 0,
    justifyContent: "center",
    left: 0,
    paddingHorizontal: 32,
    pointerEvents: "none",
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 100,
  },
  copy: {
    alignItems: "center",
    marginTop: 24,
    width: "100%",
  },
  eyebrow: {
    color: "#278D68",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 2.2,
    textAlign: "center",
    textTransform: "uppercase",
  },
  title: {
    color: "#164638",
    fontFamily: "Georgia",
    fontSize: 44,
    fontWeight: "700",
    letterSpacing: -1.8,
    lineHeight: 48,
    marginTop: 10,
    textAlign: "center",
  },
  tagline: {
    color: "#3F6658",
    fontFamily: "Georgia",
    fontSize: 17,
    marginTop: 14,
    textAlign: "center",
  },
  progress: {
    marginTop: 58,
    maxWidth: 255,
    width: "80%",
  },
  progressTrack: {
    backgroundColor: "#D8DED3",
    height: 2,
    overflow: "hidden",
    width: "100%",
  },
  progressFill: {
    backgroundColor: "#278D68",
    height: 2,
    width: "42%",
  },
  progressCopy: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  progressLabel: {
    color: "#789083",
    fontSize: 11,
    fontWeight: "700",
  },
});
