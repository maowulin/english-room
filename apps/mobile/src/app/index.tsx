import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { DemoStatusCard } from "@/components/demo-status-card";
import {
  getDefaultAnalyticsClient,
  noopAnalyticsClient,
  useAnalyticsLifecycle,
  type AnalyticsLifecycleClient,
} from "@/analytics";
import { ApiClient, type HealthStatus } from "@/services/api-client";
import { colors, radii, spacing, typography } from "@/theme/tokens";

const DEFAULT_API_BASE_URL = "http://127.0.0.1:8000";

type ApiState = "checking" | "online" | "offline";
type LoadHealth = () => Promise<HealthStatus>;

type DemoScreenProps = {
  loadHealth?: LoadHealth;
  analyticsClient?: AnalyticsLifecycleClient;
  disposeAnalyticsOnUnmount?: boolean;
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
    status: "检查中",
    description: "正在连接 FastAPI 健康检查。",
    tone: "neutral",
  },
  online: {
    status: "服务在线",
    description: "FastAPI 已响应，可以继续构建房间控制面。",
    tone: "success",
  },
  offline: {
    status: "服务离线",
    description: "客户端仍可运行，请启动 FastAPI 后重试。",
    tone: "warning",
  },
};

export function DemoScreen({
  loadHealth = loadDefaultHealth,
  analyticsClient = noopAnalyticsClient,
  disposeAnalyticsOnUnmount = false,
}: DemoScreenProps) {
  const [apiState, setApiState] = useState<ApiState>("checking");

  useAnalyticsLifecycle(analyticsClient, {
    disposeOnUnmount: disposeAnalyticsOnUnmount,
  });

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

        <Text style={styles.title}>English Room Demo</Text>
        <Text style={styles.subtitle}>多人英语实时语音房间与局后评分</Text>

        <View style={styles.summary}>
          <Text style={styles.summaryLabel}>当前里程碑</Text>
          <Text style={styles.summaryTitle}>基础框架与运行环境</Text>
          <Text style={styles.summaryBody}>
            先验证客户端、控制面和原生运行链路，再接入多人 TRTC 音频与异步评分。
          </Text>
        </View>

        <View style={styles.cards}>
          <DemoStatusCard
            title="Expo Development Build"
            status="已启用"
            description="支持后续接入 TRTC 自定义原生模块。"
            tone="success"
          />
          <DemoStatusCard
            title="FastAPI 控制面"
            status={apiContent.status}
            description={apiContent.description}
            tone={apiContent.tone}
          />
          <DemoStatusCard
            title="TRTC 实时语音"
            status="下一阶段接入"
            description="音频由客户端直连腾讯云，不经过业务后端。"
            tone="neutral"
          />
        </View>

        <Text style={styles.footer}>FastAPI · Expo Router · TypeScript</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

export default function HomeScreen() {
  return <DemoScreen analyticsClient={getDefaultAnalyticsClient()} />;
}

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
