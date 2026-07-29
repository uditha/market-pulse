"use client";

import { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import type { Point } from "@/components/mm/chartTheme";
import { toMap } from "@/lib/mm-analytics";
import { downsample, eiEchartsBase, monthLabel } from "@/components/ei/echartsTheme";

type Slice = { key: string; label: string; points: Point[]; color: string };

type Props = {
  slices: Slice[];
  height?: number;
  maxBars?: number;
};

function fmt(n: number): string {
  return n.toLocaleString("en-US", {
    maximumFractionDigits: n >= 100 ? 0 : 1,
  });
}

export function ServicesStackChart({ slices, height = 300, maxBars = 36 }: Props) {
  const option = useMemo<EChartsOption>(() => {
    const maps = slices.map((s) => ({ ...s, map: toMap(s.points) }));
    const periods = new Set<string>();
    for (const s of maps) {
      for (const p of s.points) periods.add(p.period);
    }
    const cats = downsample([...periods].sort(), maxBars);
    const base = eiEchartsBase();
    const yAxis = (base.yAxis ?? {}) as Record<string, unknown>;
    const xAxis = (base.xAxis ?? {}) as Record<string, unknown>;

    return {
      ...base,
      color: slices.map((s) => s.color),
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
      },
      series: slices.map((s, i) => ({
        name: s.label,
        type: "bar" as const,
        stack: "svc",
        barMaxWidth: 26,
        itemStyle: { color: s.color },
        emphasis: { focus: "series" as const },
        data: cats.map((period) => Math.max(0, maps[i]!.map.get(period) ?? 0)),
      })),
    };
  }, [slices, maxBars]);

  return (
    <ReactECharts
      option={option}
      style={{ height, width: "100%" }}
      opts={{ renderer: "svg" }}
      notMerge
    />
  );
}
