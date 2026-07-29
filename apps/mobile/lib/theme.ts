export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export type ThemeColors = {
  ink: string;
  inkSoft: string;
  muted: string;
  mutedSoft: string;
  paper: string;
  panel: string;
  panelRaised: string;
  line: string;
  accent: string;
  accentDeep: string;
  accentSoft: string;
  up: string;
  down: string;
  warn: string;
  chart: string;
  onAccent: string;
};

export const lightColors: ThemeColors = {
  ink: "#0B1614",
  inkSoft: "#1E2F2B",
  muted: "#5B6F69",
  mutedSoft: "#8A9D96",
  paper: "#F1F4F2",
  panel: "#FFFFFF",
  panelRaised: "#FFFFFF",
  line: "rgba(11,22,20,0.10)",
  accent: "#0B7A6B",
  accentDeep: "#055649",
  accentSoft: "rgba(11,122,107,0.12)",
  up: "#0A7A62",
  down: "#C23B32",
  warn: "#B86B2A",
  chart: "#0B7A6B",
  onAccent: "#FFFFFF",
};

export const darkColors: ThemeColors = {
  ink: "#E8EEEC",
  inkSoft: "#C5D0CC",
  muted: "#8A9B95",
  mutedSoft: "#667873",
  paper: "#0C1211",
  panel: "#151C1A",
  panelRaised: "#1C2522",
  line: "rgba(232,238,236,0.10)",
  accent: "#2BB8A0",
  accentDeep: "#1A9E88",
  accentSoft: "rgba(43,184,160,0.16)",
  up: "#3DCFB0",
  down: "#F07167",
  warn: "#E0A15A",
  chart: "#3DCFB0",
  onAccent: "#0C1211",
};

export const THEME_STORAGE_KEY = "marketpulse_theme";

export function colorsFor(resolved: ResolvedTheme): ThemeColors {
  return resolved === "dark" ? darkColors : lightColors;
}
