"use client";

import { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import type { Point } from "@/components/mm/chartTheme";
import { toMap } from "@/lib/mm-analytics";
import { downsample, eiEchartsBase, monthLabel } from "@/components/ei/echartsTheme";

type Series = { key: string; label: string; points: Point[]; color: string };

type Props = {
  series: Series[];
  height?: number;
  maxBars?: number;
};

function fmt(n: number): string {
  return n.toLocaleString("en-US", {
    maximumFractionDigits: Math.abs(n) >= 100 ? 0 : 1,
  });
}

export function FlowsBarChart({ series, height = 280, maxBars = 24 }: Props) {
  const option = useMemo<EChartsOption>(() => {
    const maps = series.map((s) => ({ ...s, map: toMap(s.points) }));
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
      color: series.map((s) => s.color),
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
      series: series.map((s, i) => ({
        name: s.label,
        type: "bar" as const,
        barMaxWidth: 18,
        itemStyle: {
          color: s.color,
          borderRadius: [3, 3, 0, 0],
        },
        data: cats.map((period) => maps[i]!.map.get(period) ?? null),
      })),
    };
  }, [series, maxBars]);

  return (
    <ReactECharts
      option={option}
      style={{ height, width: "100%" }}
      opts={{ renderer: "svg" }}
      notMerge
    />
  );
}
