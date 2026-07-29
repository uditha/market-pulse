"use client";

import { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import { eiEchartsBase } from "@/components/ei/echartsTheme";
import { chartThemeColors } from "@/components/mm/chartTheme";

type Step = {
  key: string;
  label: string;
  value: number | null;
};

type Props = {
  steps: Step[];
  total: number | null;
  height?: number;
};

function fmt(n: number): string {
  return n.toLocaleString("en-US", {
    maximumFractionDigits: Math.abs(n) >= 100 ? 0 : 1,
  });
}

/** Horizontal bridge / waterfall: BoP components → current account. */
export function CaWaterfall({ steps, total, height = 280 }: Props) {
  const option = useMemo<EChartsOption>(() => {
    const c = chartThemeColors();
    const base = eiEchartsBase();
    const labels = [...steps.map((s) => s.label), "Current A/C"];
    const values = [...steps.map((s) => s.value ?? 0), total ?? 0];

    let running = 0;
    const helpers: number[] = [];
    const positives: (number | "-")[] = [];
    const negatives: (number | "-")[] = [];

    for (let i = 0; i < values.length; i++) {
      const v = values[i]!;
      const isTotal = i === values.length - 1;
      if (isTotal) {
        helpers.push(Math.min(0, v));
        if (v >= 0) {
          positives.push(v);
          negatives.push("-");
        } else {
          positives.push("-");
          negatives.push(-v);
        }
        continue;
      }
      if (v >= 0) {
        helpers.push(running);
        positives.push(v);
        negatives.push("-");
        running += v;
      } else {
        helpers.push(running + v);
        positives.push("-");
        negatives.push(-v);
        running += v;
      }
    }

    return {
      ...base,
      grid: { left: 52, right: 16, top: 28, bottom: 48, containLabel: false },
      legend: { show: false },
      tooltip: {
        ...base.tooltip,
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (params: unknown) => {
          const arr = Array.isArray(params) ? params : [];
          const idx = (arr[0] as { dataIndex?: number } | undefined)?.dataIndex ?? 0;
          const v = values[idx] ?? 0;
          const isTotal = idx === values.length - 1;
          const label = labels[idx] ?? "";
          const tone = v >= 0 ? "Surplus" : "Deficit";
          if (isTotal) {
            return `${label}<br/><b>${fmt(v)} USD mn</b><br/><span style="opacity:.7">${tone} balance</span>`;
          }
          let running = 0;
          for (let i = 0; i <= idx; i++) running += values[i] ?? 0;
          return [
            `<b>${label}</b>`,
            `${tone} contribution <b>${fmt(v)} USD mn</b>`,
            `Running A/C <b>${fmt(running)} USD mn</b>`,
          ].join("<br/>");
        },
      },
      xAxis: {
        type: "category",
        data: labels,
        axisLabel: {
          color: c.text,
          fontFamily: "IBM Plex Mono, ui-monospace, monospace",
          fontSize: 10,
          interval: 0,
          rotate: 18,
        },
        axisLine: { lineStyle: { color: c.line } },
        axisTick: { show: false },
      },
      yAxis: {
        type: "value",
        splitLine: { lineStyle: { color: c.grid } },
        axisLabel: {
          color: c.text,
          fontFamily: "IBM Plex Mono, ui-monospace, monospace",
          fontSize: 10,
        },
      },
      series: [
        {
          type: "bar",
          stack: "ca",
          silent: true,
          itemStyle: { borderColor: "transparent", color: "transparent" },
          emphasis: { itemStyle: { borderColor: "transparent", color: "transparent" } },
          data: helpers,
        },
        {
          name: "Surplus",
          type: "bar",
          stack: "ca",
          barMaxWidth: 36,
          itemStyle: { color: "#0b7a6b", borderRadius: [4, 4, 0, 0] },
          data: positives,
        },
        {
          name: "Deficit",
          type: "bar",
          stack: "ca",
          barMaxWidth: 36,
          itemStyle: { color: "#b86b2a", borderRadius: [4, 4, 0, 0] },
          data: negatives,
        },
      ],
    };
  }, [steps, total]);

  return (
    <ReactECharts
      option={option}
      style={{ height, width: "100%" }}
      opts={{ renderer: "svg" }}
      notMerge
    />
  );
}
