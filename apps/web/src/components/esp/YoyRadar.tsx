"use client";

import { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import { eiEchartsBase } from "@/components/ei/echartsTheme";
import { chartThemeColors } from "@/components/mm/chartTheme";

type Spoke = { label: string; value: number | null };

type Props = {
  spokes: Spoke[];
  height?: number;
};

/** Compact YoY divergence radar for headline ESP rows. */
export function YoyRadar({ spokes, height = 300 }: Props) {
  const option = useMemo<EChartsOption>(() => {
    const c = chartThemeColors();
    const base = eiEchartsBase();
    const vals = spokes.map((s) => s.value ?? 0);
    const maxAbs = Math.max(20, ...vals.map((v) => Math.abs(v)));

    return {
      ...base,
      grid: undefined,
      legend: { show: false },
      tooltip: {
        trigger: "item",
        backgroundColor: c.markerBg,
        borderColor: c.line,
        textStyle: { color: c.ink, fontFamily: "IBM Plex Mono, monospace", fontSize: 12 },
      },
      radar: {
        indicator: spokes.map((s) => ({
          name: s.label,
          max: maxAbs,
          min: -maxAbs,
        })),
        center: ["50%", "54%"],
        radius: "62%",
        axisName: {
          color: c.text,
          fontFamily: "Sora, sans-serif",
          fontSize: 11,
          fontWeight: 600,
        },
        splitArea: {
          areaStyle: {
            color: [
              "color-mix(in srgb, var(--accent) 4%, transparent)",
              "transparent",
            ],
          },
        },
        axisLine: { lineStyle: { color: c.line } },
        splitLine: { lineStyle: { color: c.grid } },
      },
      series: [
        {
          type: "radar",
          symbol: "circle",
          symbolSize: 6,
          lineStyle: { width: 2.2, color: "#0b7a6b" },
          itemStyle: { color: "#0b7a6b" },
          areaStyle: { color: "rgba(11, 122, 107, 0.18)" },
          data: [
            {
              value: vals,
              name: "YoY %",
            },
          ],
        },
      ],
    };
  }, [spokes]);

  return (
    <ReactECharts
      option={option}
      style={{ height, width: "100%" }}
      opts={{ renderer: "svg" }}
      notMerge
    />
  );
}
