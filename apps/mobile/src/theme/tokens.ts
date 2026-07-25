export const colors = {
  background: "#F3F7F6",
  surface: "#FFFFFF",
  ink: "#102A2A",
  muted: "#5B7070",
  onDarkMuted: "#C8D8D5",
  border: "#D7E3E0",
  accent: "#12A182",
  accentDark: "#08745E",
  accentLight: "#8CE1CE",
  accentSoft: "#DDF5EE",
  neutralSoft: "#EAF0EF",
  warning: "#9A5A0A",
  warningSoft: "#FEF0DB",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 20,
  xl: 32,
  xxl: 48,
  page: 24,
} as const;

export const radii = {
  md: 18,
  lg: 28,
  pill: 999,
} as const;

export const typography = {
  caption: 12,
  small: 14,
  smallLineHeight: 21,
  body: 17,
  bodyLineHeight: 25,
  heading: 24,
  display: 38,
} as const;
