import { StyleSheet, Text, View } from "react-native";

import { colors, radii, spacing, typography } from "@/theme/tokens";

type CardTone = "neutral" | "success" | "warning";

type DemoStatusCardProps = {
  title: string;
  status: string;
  description: string;
  tone: CardTone;
};

const toneColors: Record<CardTone, { background: string; foreground: string }> =
  {
    neutral: {
      background: colors.neutralSoft,
      foreground: colors.muted,
    },
    success: {
      background: colors.accentSoft,
      foreground: colors.accentDark,
    },
    warning: {
      background: colors.warningSoft,
      foreground: colors.warning,
    },
  };

export function DemoStatusCard({
  title,
  status,
  description,
  tone,
}: DemoStatusCardProps) {
  const statusColors = toneColors[tone];

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <View
          style={[styles.badge, { backgroundColor: statusColors.background }]}
        >
          <Text style={[styles.badgeText, { color: statusColors.foreground }]}>
            {status}
          </Text>
        </View>
      </View>
      <Text style={styles.description}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    padding: spacing.lg,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  title: {
    color: colors.ink,
    flex: 1,
    fontSize: typography.body,
    fontWeight: "700",
  },
  badge: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  badgeText: {
    fontSize: typography.caption,
    fontWeight: "700",
  },
  description: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: typography.smallLineHeight,
    marginTop: spacing.md,
  },
});
