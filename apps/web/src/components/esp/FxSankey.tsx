"use client";

import { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import { eiEchartsBase } from "@/components/ei/echartsTheme";
import { chartThemeColors } from "@/components/mm/chartTheme";

export type FxFlowLeg = {
  key: string;
  label: string;
  value: number | null;
};

type Props = {
  inflows: FxFlowLeg[];
  outflows: FxFlowLeg[];
  height?: number;
};

const HUB = "External FX";
const SURPLUS = "Net surplus";
const DEFICIT = "Financing gap";

function fmt(n: number): string {
  return n.toLocaleString("en-US", {
    maximumFractionDigits: Math.abs(n) >= 100 ? 0 : 1,
  });
}

function positiveLegs(legs: FxFlowLeg[]): { name: string; value: number }[] {
  return legs
    .map((l) => ({ name: l.label, value: l.value ?? 0 }))
    .filter((l) => l.value > 0);
}

/** Gross FX in → external hub → FX out (ECharts sankey, nodeAlign right). */
export function FxSankey({ inflows, outflows, height = 440 }: Props) {
  const built = useMemo(() => {
    const ins = positiveLegs(inflows);
    const outs = positiveLegs(outflows);
    if (ins.length === 0 || outs.length === 0) return null;

    const totalIn = ins.reduce((s, l) => s + l.value, 0);
    const totalOut = outs.reduce((s, l) => s + l.value, 0);
    const gap = totalIn - totalOut;

    const nodes: { name: string; itemStyle?: { color: string } }[] = [];
    const links: { source: string; target: string; value: number }[] = [];
    const seen = new Set<string>();

    const addNode = (name: string, color?: string) => {
      if (seen.has(name)) return;
      seen.add(name);
      nodes.push(color ? { name, itemStyle: { color } } : { name });
    };

    addNode(HUB, "#1f4b5c");
    for (const l of ins) {
      addNode(l.name, "#0b7a6b");
      links.push({ source: l.name, target: HUB, value: l.value });
    }
    for (const l of outs) {
      addNode(l.name, "#b86b2a");
      links.push({ source: HUB, target: l.name, value: l.value });
    }

    if (gap > 0.5) {
      addNode(SURPLUS, "#2f6f8f");
      links.push({ source: HUB, target: SURPLUS, value: gap });
    } else if (gap < -0.5) {
      addNode(DEFICIT, "#8a4b2f");
      links.push({ source: DEFICIT, target: HUB, value: -gap });
    }

    return { nodes, links, totalIn, totalOut, gap };
  }, [inflows, outflows]);

  const option = useMemo<EChartsOption>(() => {
    const c = chartThemeColors();
    const base = eiEchartsBase();
    if (!built) return { ...base, series: [] };

    return {
      ...base,
      grid: undefined,
      xAxis: undefined,
      yAxis: undefined,
      legend: { show: false },
      tooltip: {
        ...base.tooltip,
        trigger: "item",
        formatter: (params: unknown) => {
          const p = params as {
            dataType?: string;
            name?: string;
            value?: number;
            data?: { source?: string; target?: string; value?: number };
          };
          const pct = (n: number, den: number) =>
            den > 0 ? ` · ${((n / den) * 100).toFixed(1)}%` : "";
          if (p.dataType === "edge" && p.data) {
            const v = p.data.value ?? 0;
            const fromIn = p.data.source !== HUB;
            const share = fromIn
              ? pct(v, built.totalIn)
              : pct(v, built.totalOut);
            return `${p.data.source} → ${p.data.target}<br/><b>${fmt(v)} USD mn</b>${share}`;
          }
          const v = Number(p.value) || 0;
          const isIn = built.nodes.some(
            (n) => n.name === p.name && n.itemStyle?.color === "#0b7a6b",
          );
          const isOut = built.nodes.some(
            (n) => n.name === p.name && n.itemStyle?.color === "#b86b2a",
          );
          const share = isIn
            ? pct(v, built.totalIn)
            : isOut
              ? pct(v, built.totalOut)
              : "";
          return `${p.name}<br/><b>${fmt(v)} USD mn</b>${share}`;
        },
      },
      series: [
        {
          type: "sankey",
          emphasis: { focus: "adjacency" },
          nodeAlign: "right",
          nodeGap: 14,
          nodeWidth: 18,
          layoutIterations: 32,
          left: 4,
          right: 140,
          top: 16,
          bottom: 16,
          data: built.nodes,
          links: built.links,
          lineStyle: {
            color: "gradient",
            curveness: 0.5,
            opacity: 0.35,
          },
          label: {
            color: c.text,
            fontFamily: "Sora, sans-serif",
            fontSize: 11,
            fontWeight: 600,
          },
          itemStyle: {
            borderWidth: 0,
          },
        },
      ],
    };
  }, [built]);

  if (!built) {
    return <p className="esp-inline-stats">Not enough gross flow legs for this month.</p>;
  }

  return (
    <div>
      <ReactECharts
        option={option}
        style={{ height, width: "100%" }}
        opts={{ renderer: "svg" }}
        notMerge
      />
      <div className="esp-inline-stats">
        <span>
          FX in <strong>{fmt(built.totalIn)}</strong> USD mn
        </span>
        <span>
          FX out <strong>{fmt(built.totalOut)}</strong> USD mn
        </span>
        <span>
          {built.gap >= 0 ? "Surplus" : "Gap"}{" "}
          <strong>{fmt(Math.abs(built.gap))}</strong> USD mn
        </span>
      </div>
    </div>
  );
}
