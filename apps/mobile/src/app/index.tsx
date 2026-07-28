import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { DemoStatusCard } from "@/components/demo-status-card";
import { RoomApp } from "@/features/session/room-app";
import { ApiClient, type HealthStatus } from "@/services/api-client";
import { colors, radii, spacing, typography } from "@/theme/tokens";

const DEFAULT_API_BASE_URL = "http://127.0.0.1:8000";

type ApiState = "checking" | "online" | "offline";
type LoadHealth = () => Promise<HealthStatus>;

type DemoScreenProps = {
  loadHealth?: LoadHealth;
};

function loadDefaultHealth(): Promise<HealthStatus> {
  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL;
  return new ApiClient({ baseUrl }).getHealth();
}

const apiStatusContent: Record<
  ApiState,
  {
    status: string;
    description: string;
    tone: "neutral" | "success" | "warning";
  }
> = {
  checking: {
    status: "Checking",
    description: "Connecting to the FastAPI health check.",
    tone: "neutral",
  },
  online: {
    status: "Service online",
    description: "FastAPI responded successfully; the room control layer is ready.",
    tone: "success",
  },
  offline: {
    status: "Service offline",
    description: "The client can still run. Start FastAPI and try again.",
    tone: "warning",
  },
};

export function DemoScreen({
  loadHealth = loadDefaultHealth,
}: DemoScreenProps) {
  const [apiState, setApiState] = useState<ApiState>("checking");

  useEffect(() => {
    let isActive = true;

    void loadHealth()
      .then(() => {
        if (isActive) {
          setApiState("online");
        }
      })
      .catch(() => {
        if (isActive) {
          setApiState("offline");
        }
      });

    return () => {
      isActive = false;
    };
  }, [loadHealth]);

  const apiContent = apiStatusContent[apiState];

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.eyebrow}>
          <View style={styles.eyebrowDot} />
          <Text style={styles.eyebrowText}>FOUNDATION READY</Text>
        </View>

        <Text style={styles.title}>English Room Foundation</Text>
        <Text style={styles.subtitle}>Multiplayer English voice rooms and post-session scoring</Text>

        <View style={styles.summary}>
          <Text style={styles.summaryLabel}>Current milestone</Text>
          <Text style={styles.summaryTitle}>Foundation and runtime</Text>
          <Text style={styles.summaryBody}>
            Validate the client, control layer, and native runtime before connecting multiplayer TRTC audio and asynchronous scoring.
          </Text>
        </View>

        <View style={styles.cards}>
          <DemoStatusCard
            title="Expo Development Build"
            status="Enabled"
            description="Ready for the custom TRTC native module."
            tone="success"
          />
          <DemoStatusCard
            title="FastAPI control layer"
            status={apiContent.status}
            description={apiContent.description}
            tone={apiContent.tone}
          />
          <DemoStatusCard
            title="TRTC voice"
            status="Next phase"
            description="Audio connects directly from the client to Tencent Cloud, without passing through the business backend."
            tone="neutral"
          />
        </View>

        <Text style={styles.footer}>FastAPI · Expo Router · TypeScript</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

export default function HomeScreen() {
  return <RoomApp />;
}

export { RoomApp };

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.page,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  eyebrow: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.accentSoft,
    borderRadius: radii.pill,
    flexDirection: "row",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  eyebrowDot: {
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    height: spacing.sm,
    width: spacing.sm,
  },
  eyebrowText: {
    color: colors.accentDark,
    fontSize: typography.caption,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  title: {
    color: colors.ink,
    fontSize: typography.display,
    fontWeight: "800",
    letterSpacing: -1,
    marginTop: spacing.lg,
  },
  subtitle: {
    color: colors.muted,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
    marginTop: spacing.sm,
  },
  summary: {
    backgroundColor: colors.ink,
    borderRadius: radii.lg,
    marginTop: spacing.xl,
    padding: spacing.lg,
  },
  summaryLabel: {
    color: colors.accentLight,
    fontSize: typography.caption,
    fontWeight: "700",
  },
  summaryTitle: {
    color: colors.surface,
    fontSize: typography.heading,
    fontWeight: "700",
    marginTop: spacing.sm,
  },
  summaryBody: {
    color: colors.onDarkMuted,
    fontSize: typography.small,
    lineHeight: typography.smallLineHeight,
    marginTop: spacing.sm,
  },
  cards: {
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  footer: {
    color: colors.muted,
    fontSize: typography.caption,
    marginTop: "auto",
    paddingTop: spacing.xl,
    textAlign: "center",
  },
});
