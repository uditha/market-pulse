export type ChartRange = "1Y" | "5Y" | "MAX";
export type Point = { period: string; value: number };

export function cssVar(name: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export function chartThemeColors() {
  return {
    text: cssVar("--muted", "#5b6f69"),
    grid: cssVar("--chart-grid", "rgba(11,22,20,0.08)"),
    markerBg: cssVar("--panel-solid", "#ffffff"),
    crosshair: cssVar("--accent", "#0b7a6b"),
    panel: cssVar("--panel-solid", "#ffffff"),
    accent: cssVar("--accent", "#0b7a6b"),
    copper: cssVar("--copper", "#b86b2a"),
    sdf: cssVar("--chart-sdf", "#2f6f8f"),
    awfdr: cssVar("--chart-awfdr", "#7a4f9a"),
    up: cssVar("--up", "#1a7a4c"),
    down: cssVar("--down", "#b42318"),
    ink: cssVar("--ink", "#0b1614"),
    line: cssVar("--line", "rgba(11,22,20,0.12)"),
  };
}

export const MM_COLORS = {
  slf: { var: "--copper", fallback: "#b86b2a" },
  opr: { var: "--accent", fallback: "#0b7a6b" },
  sdf: { var: "--chart-sdf", fallback: "#2f6f8f" },
  call: { var: "--ink", fallback: "#0b1614" },
  repo: { var: "--copper", fallback: "#b86b2a" },
  copper: { var: "--copper", fallback: "#b86b2a" },
  awpr: { var: "--accent", fallback: "#0b7a6b" },
  awfdr: { var: "--chart-awfdr", fallback: "#7a4f9a" },
  awlr: { var: "--copper", fallback: "#b86b2a" },
  awdr: { var: "--chart-sdf", fallback: "#2f6f8f" },
  awsr: { var: "--down", fallback: "#b42318" },
  tbill91: { var: "--accent", fallback: "#0b7a6b" },
  tbill182: { var: "--chart-sdf", fallback: "#2f6f8f" },
  tbill364: { var: "--copper", fallback: "#b86b2a" },
  liquidity: { var: "--accent", fallback: "#0b7a6b" },
  spread: { var: "--copper", fallback: "#b86b2a" },
} as const;

export const RANGE_TABS: ChartRange[] = ["1Y", "5Y", "MAX"];

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addYears(iso: string, years: number): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return isoDate(d);
}

export function rangeStart(range: ChartRange, points: Point[]): string | null {
  if (!points.length) return null;
  const dataTo = points[points.length - 1].period;
  if (range === "MAX") return points[0].period;
  return range === "5Y" ? addYears(dataTo, -5) : addYears(dataTo, -1);
}
