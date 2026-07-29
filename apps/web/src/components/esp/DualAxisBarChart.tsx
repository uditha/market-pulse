"use client";

import { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import type { Point } from "@/components/mm/chartTheme";
import { toMap } from "@/lib/mm-analytics";
import { downsample, eiEchartsBase, monthLabel } from "@/components/ei/echartsTheme";

type AxisSeries = {
  key: string;
  label: string;
  points: Point[];
  color: string;
  /** Left (0) or right (1) value axis */
  yAxisIndex?: 0 | 1;
  unit?: string;
};

type Props = {
  left: AxisSeries;
  right: AxisSeries;
  height?: number;
  maxBars?: number;
  leftName?: string;
  rightName?: string;
};

function fmt(n: number): string {
  return n.toLocaleString("en-US", {
    maximumFractionDigits: Math.abs(n) >= 100 ? 0 : 1,
  });
}

export function DualAxisBarChart({
  left,
  right,
  height = 280,
  maxBars = 28,
  leftName,
  rightName,
}: Props) {
  const option = useMemo<EChartsOption>(() => {
    const series = [left, right];
    const maps = series.map((s) => ({ ...s, map: toMap(s.points) }));
    const periods = new Set<string>();
    for (const s of maps) {
      for (const p of s.points) periods.add(p.period);
    }
    const cats = downsample([...periods].sort(), maxBars);
    const base = eiEchartsBase();
    const xAxis = (base.xAxis ?? {}) as Record<string, unknown>;

    const option: EChartsOption = {
      ...base,
      grid: { left: 52, right: 52, top: 36, bottom: 28, containLabel: false },
      color: [left.color, right.color],
      tooltip: {
        ...base.tooltip,
        formatter: (params: unknown) => {
          const rows = Array.isArray(params) ? params : [params];
          if (!rows.length) return "";
          const axis = (rows[0] as { axisValueLabel?: string }).axisValueLabel ?? "";
          const lines = rows.map((row) => {
            const r = row as {
              marker?: string;
              seriesName?: string;
              value?: number | null;
              seriesIndex?: number;
            };
            const unit = (r.seriesIndex === 1 ? right.unit : left.unit) ?? "";
            const v = r.value == null || Number.isNaN(Number(r.value)) ? "—" : fmt(Number(r.value));
            return `${r.marker ?? ""}${r.seriesName}: <b>${v}</b>${unit ? ` ${unit}` : ""}`;
          });
          return [`<div>${axis}</div>`, ...lines].join("<br/>");
        },
      },
      xAxis: {
        ...xAxis,
        data: cats.map(monthLabel),
      },
      yAxis: [
        {
          type: "value",
          name: leftName ?? left.label,
          nameTextStyle: { fontSize: 10 },
          splitLine: { show: true },
          axisLine: { show: false },
          axisTick: { show: false },
        },
        {
          type: "value",
          name: rightName ?? right.label,
          nameTextStyle: { fontSize: 10 },
          splitLine: { show: false },
          axisLine: { show: false },
          axisTick: { show: false },
        },
      ],
      series: series.map((s, i) => ({
        name: s.label,
        type: "bar" as const,
        yAxisIndex: s.yAxisIndex ?? (i === 0 ? 0 : 1),
        barMaxWidth: 14,
        barGap: "18%",
        itemStyle: {
          color: s.color,
          borderRadius: [3, 3, 0, 0],
        },
        data: cats.map((period) => maps[i]!.map.get(period) ?? null),
      })),
    };
    return option;
  }, [left, right, maxBars, leftName, rightName]);

  return (
    <ReactECharts
      option={option}
      style={{ height, width: "100%" }}
      opts={{ renderer: "svg" }}
      notMerge
    />
  );
}
