import { StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";

const BRAND_GREEN = "#174638";
const BRAND_LINE = "#DFF1E4";
const BRAND_WAVE = "#75C594";

type BrandMarkProps = {
  animated?: boolean;
  size?: number;
};

export function BrandMark({ animated = true, size = 92 }: BrandMarkProps) {
  const markSize = size * 0.64;
  const lineWidth = Math.max(3, size * 0.042);
  const radius = size * 0.3;

  return (
    <View
      style={[styles.container, { backgroundColor: BRAND_GREEN, borderRadius: radius, height: size, width: size }]}
    >
      <View style={[styles.halo, { borderRadius: radius * 0.8, height: size * 0.78, width: size * 0.78 }]} />
      <Svg accessibilityRole="image" aria-hidden width={markSize} height={markSize} viewBox="0 0 64 64">
        <Path
          d="M17 16h30a9 9 0 0 1 9 9v13a9 9 0 0 1-9 9H31l-9 7v-7h-5a9 9 0 0 1-9-9V25a9 9 0 0 1 9-9Z"
          fill="none"
          stroke={BRAND_LINE}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={lineWidth}
        />
      </Svg>
      <View style={[styles.wave, { transform: [{ scaleX: animated ? 1 : 0.94 }] }]}>
        <Svg accessibilityRole="image" aria-hidden width={markSize} height={markSize} viewBox="0 0 64 64">
          <Path
            d="M17 34c4.5-6 8.5-6 13 0s8.5 6 13 0 8.5-6 13 0"
            fill="none"
            stroke={BRAND_WAVE}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={lineWidth}
          />
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  halo: {
    borderColor: "rgba(223, 241, 228, 0.28)",
    borderWidth: 1,
    position: "absolute",
  },
  wave: {
    alignItems: "center",
    justifyContent: "center",
    position: "absolute",
  },
});
