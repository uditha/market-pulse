"use client";

import { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import type { Point } from "@/components/mm/chartTheme";
import { toMap } from "@/lib/mm-analytics";
import { ORA_TONES, downsample, eiEchartsBase, monthLabel } from "./echartsTheme";

export type ReserveStackSlice = {
  key: string;
  label: string;
  points: Point[];
  tone: "fx" | "gold" | "imf" | "sdr" | "other";
};

type Props = {
  slices: ReserveStackSlice[];
  height?: number;
  maxBars?: number;
};

function fmt(n: number): string {
  return n.toLocaleString("en-US", {
    maximumFractionDigits: n >= 100 ? 0 : 1,
  });
}

export function ReserveStackChart({ slices, height = 320, maxBars = 48 }: Props) {
  const option = useMemo<EChartsOption>(() => {
    // Small slices first → baseline; FX last → top of stack (ECharts stacks in series order).
    const ordered = [...slices].sort(
      (a, b) => Number(a.tone === "fx") - Number(b.tone === "fx"),
    );
    const maps = ordered.map((s) => ({ ...s, map: toMap(s.points) }));
    const periods = new Set<string>();
    for (const s of maps) {
      for (const p of s.points) periods.add(p.period);
    }
    const cats = downsample([...periods].sort(), maxBars);
    const base = eiEchartsBase();
    const yAxis = (base.yAxis ?? {}) as Record<string, unknown>;
    const xAxis = (base.xAxis ?? {}) as Record<string, unknown>;

    const series = ordered.map((s, i) => {
      const map = maps[i]!.map;
      return {
        name: s.label,
        type: "bar" as const,
        stack: "ora",
        barMaxWidth: 28,
        emphasis: { focus: "series" as const },
        itemStyle: { color: ORA_TONES[s.tone] ?? ORA_TONES.other },
        data: cats.map((period) => Math.max(0, map.get(period) ?? 0)),
      };
    });

    return {
      ...base,
      color: ordered.map((s) => ORA_TONES[s.tone] ?? ORA_TONES.other),
      legend: {
        ...base.legend,
        // Keep FX first in the legend even though it stacks on top.
        data: [...ordered].sort((a, b) => Number(b.tone === "fx") - Number(a.tone === "fx")).map((s) => s.label),
      },
      tooltip: {
        ...base.tooltip,
        valueFormatter: (v: unknown) => `${fmt(Number(v))} USD mn`,
      },
      xAxis: {
        ...xAxis,
        data: cats.map(monthLabel),
      },
      yAxis: {
        ...yAxis,
        name: "USD mn",
        nameTextStyle: {
          color: "#8a9d96",
          fontFamily: "IBM Plex Mono, ui-monospace, monospace",
          fontSize: 10,
          align: "left",
        },
        nameGap: 8,
        axisLabel: {
          ...((yAxis.axisLabel as object) ?? {}),
          formatter: (v: number) =>
            v >= 1000 ? `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : String(v),
        },
      },
      series,
    };
  }, [slices, maxBars]);

  const hasData = slices.some((s) => s.points.length > 0);
  if (!hasData) {
    return <p className="ora-stack-empty">No reserve composition in this range.</p>;
  }

  return (
    <div className="ei-echart">
      <ReactECharts
        option={option}
        style={{ height, width: "100%" }}
        opts={{ renderer: "canvas" }}
        notMerge
        lazyUpdate
      />
    </div>
  );
}
