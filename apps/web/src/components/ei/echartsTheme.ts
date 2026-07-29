"use client";

import { chartThemeColors } from "@/components/mm/chartTheme";
import type { EChartsOption } from "echarts";

export function downsample<T>(rows: T[], max: number): T[] {
  if (rows.length <= max) return rows;
  const out: T[] = [];
  const last = rows.length - 1;
  for (let i = 0; i < max; i++) {
    const idx = Math.round((i / (max - 1)) * last);
    out.push(rows[idx]!);
  }
  return out.filter((r, i, a) => i === 0 || r !== a[i - 1]);
}

export function quarterLabel(period: string): string {
  const [y, m] = period.split("-");
  if (!y || !m) return period.slice(0, 7);
  return `Q${Math.ceil(Number(m) / 3)} ${y.slice(2)}`;
}

export function monthLabel(period: string): string {
  const [y, m] = period.split("-");
  if (!y || !m) return period.slice(0, 7);
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[Number(m) - 1] ?? m} ${y.slice(2)}`;
}

/** Shared LankaPulse look for ECharts composition charts. */
export function eiEchartsBase(): EChartsOption {
  const c = chartThemeColors();
  return {
    backgroundColor: "transparent",
    animationDuration: 360,
    grid: { left: 48, right: 12, top: 36, bottom: 28, containLabel: false },
    legend: {
      top: 0,
      left: 0,
      itemWidth: 10,
      itemHeight: 10,
      itemGap: 14,
      textStyle: {
        color: c.text,
        fontFamily: "Sora, sans-serif",
        fontSize: 11,
        fontWeight: 600,
      },
    },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      backgroundColor: c.markerBg,
      borderColor: c.line,
      borderWidth: 1,
      textStyle: {
        color: c.ink,
        fontFamily: "IBM Plex Mono, ui-monospace, monospace",
        fontSize: 12,
      },
      extraCssText: "border-radius: 10px; box-shadow: none;",
    },
    xAxis: {
      type: "category",
      axisLine: { lineStyle: { color: c.line } },
      axisTick: { show: false },
      axisLabel: {
        color: c.text,
        fontFamily: "IBM Plex Mono, ui-monospace, monospace",
        fontSize: 10,
      },
    },
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { color: c.grid } },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: c.text,
        fontFamily: "IBM Plex Mono, ui-monospace, monospace",
        fontSize: 10,
      },
    },
  };
}

export const ORA_TONES: Record<string, string> = {
  fx: "#0b7a6b",
  gold: "#b86b2a",
  imf: "#2f6f8f",
  sdr: "#243e39",
  other: "#8a7a6a",
};

export const GDP_TONES: Record<string, string> = {
  agri: "#0b7a6b",
  industry: "#b86b2a",
  services: "#2f6f8f",
};
