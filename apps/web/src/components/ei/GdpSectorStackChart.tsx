"use client";

import { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import type { Point } from "@/components/mm/chartTheme";
import { toMap } from "@/lib/mm-analytics";
import { chartThemeColors } from "@/components/mm/chartTheme";
import { GDP_TONES, downsample, eiEchartsBase, quarterLabel } from "./echartsTheme";

export type GdpSectorSlice = {
  key: string;
  label: string;
  points: Point[];
  tone: "agri" | "industry" | "services";
};

type Props = {
  slices: GdpSectorSlice[];
  /** Optional headline GDP — drawn as a line over the stack. */
  gdp?: Point[];
  height?: number;
  maxBars?: number;
};

function fmtPct(n: number): string {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

export function GdpSectorStackChart({
  slices,
  gdp = [],
  height = 320,
  maxBars = 40,
}: Props) {
  const option = useMemo<EChartsOption>(() => {
    const maps = slices.map((s) => ({ ...s, map: toMap(s.points) }));
    const periods = new Set<string>();
    for (const s of maps) {
      for (const p of s.points) periods.add(p.period);
    }
    const cats = downsample([...periods].sort(), maxBars);
    const gdpMap = toMap(gdp);
    const base = eiEchartsBase();
    const theme = chartThemeColors();
    const yAxis = (base.yAxis ?? {}) as Record<string, unknown>;
    const xAxis = (base.xAxis ?? {}) as Record<string, unknown>;

    const barSeries = slices.map((s) => {
      const map = maps.find((m) => m.key === s.key)!.map;
      return {
        name: s.label,
        type: "bar" as const,
        stack: "gdp",
        barMaxWidth: 28,
        emphasis: { focus: "series" as const },
        itemStyle: { color: GDP_TONES[s.tone] ?? GDP_TONES.services },
        data: cats.map((period) => map.get(period) ?? 0),
      };
    });

    const gdpLine =
      gdp.length > 0
        ? [
            {
              name: "GDP",
              type: "line" as const,
              showSymbol: cats.length <= 24,
              symbolSize: 6,
              lineStyle: { width: 2.5, color: theme.ink },
              itemStyle: { color: theme.ink },
              z: 5,
              data: cats.map((period) => gdpMap.get(period) ?? null),
            },
          ]
        : [];

    return {
      ...base,
      color: [...slices.map((s) => GDP_TONES[s.tone] ?? GDP_TONES.services), theme.ink],
      tooltip: {
        ...base.tooltip,
        valueFormatter: (v: unknown) =>
          v == null || Number.isNaN(Number(v)) ? "—" : fmtPct(Number(v)),
      },
      xAxis: {
        ...xAxis,
        data: cats.map(quarterLabel),
      },
      yAxis: {
        ...yAxis,
        name: "Y-o-Y %",
        nameTextStyle: {
          color: theme.text,
          fontFamily: "IBM Plex Mono, ui-monospace, monospace",
          fontSize: 10,
          align: "left",
        },
        nameGap: 8,
        axisLabel: {
          ...((yAxis.axisLabel as object) ?? {}),
          formatter: (v: number) => `${v}`,
        },
      },
      series: [...barSeries, ...gdpLine],
    };
  }, [slices, gdp, maxBars]);

  const hasData = slices.some((s) => s.points.length > 0);
  if (!hasData) {
    return <p className="gdp-stack-empty">No sector GDP prints in this range.</p>;
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
