"use client";

import { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import type { Point } from "@/lib/mm-analytics";
import { eiEchartsBase } from "@/components/ei/echartsTheme";
import { chartThemeColors } from "./chartTheme";

function useColors() {
  if (typeof window === "undefined") {
    return {
      accent: "#0b7a6b",
      copper: "#b86b2a",
      sdf: "#2f6f8f",
      up: "#1a7a4c",
      down: "#b42318",
      muted: "#5b6f69",
      text: "#5b6f69",
      ink: "#0b1614",
      line: "rgba(11,22,20,0.12)",
      grid: "rgba(11,22,20,0.08)",
      panel: "#ffffff",
      markerBg: "#ffffff",
    };
  }
  return chartThemeColors();
}

function resolveSeriesColor(
  color: string | undefined,
  c: ReturnType<typeof chartThemeColors>,
): string {
  if (!color) return c.accent;
  if (color.includes("copper")) return c.copper;
  if (color.includes("accent")) return c.accent;
  if (color.includes("chart-sdf") || color.includes("--sdf")) return c.sdf;
  return color;
}

function axisNameStyle(color: string) {
  return {
    color,
    fontFamily: "Sora, sans-serif",
    fontSize: 11,
    fontWeight: 600 as const,
  };
}

export function MmScatter({
  points,
  xLabel,
  yLabel,
  height = 240,
  color,
}: {
  points: { x: number; y: number; period?: string; size?: number }[];
  xLabel: string;
  yLabel: string;
  height?: number;
  color?: string;
}) {
  const option = useMemo<EChartsOption>(() => {
    const c = chartThemeColors();
    const base = eiEchartsBase();
    const fill = resolveSeriesColor(color, c);
    const hasSize = points.some((p) => p.size != null && p.size > 0);
    const sizes = points.map((p) => p.size ?? 0);
    const minSize = hasSize ? Math.min(...sizes.filter((s) => s > 0), 1) : 1;
    const maxSize = hasSize ? Math.max(...sizes, 1) : 1;

    return {
      ...base,
      grid: { left: 56, right: 18, top: 20, bottom: 44, containLabel: false },
      legend: { show: false },
      tooltip: {
        ...base.tooltip,
        trigger: "item",
        formatter: (params: unknown) => {
          const p = params as { data?: [number, number, number, string?] };
          const d = p.data;
          if (!d) return "";
          const period = d[3] ? `${d[3]}<br/>` : "";
          return `${period}<b>${xLabel}</b> ${d[0].toFixed(2)}<br/><b>${yLabel}</b> ${d[1].toFixed(2)}`;
        },
      },
      xAxis: {
        type: "value",
        name: xLabel,
        nameLocation: "middle",
        nameGap: 28,
        nameTextStyle: axisNameStyle(c.text),
        splitLine: { lineStyle: { color: c.grid } },
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
        name: yLabel,
        nameLocation: "middle",
        nameGap: 40,
        nameTextStyle: axisNameStyle(c.text),
        splitLine: { lineStyle: { color: c.grid } },
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: c.text,
          fontFamily: "IBM Plex Mono, ui-monospace, monospace",
          fontSize: 10,
        },
      },
      series: [
        {
          type: "scatter",
          symbolSize: (val: number[]) => {
            if (!hasSize) return 9;
            const s = val[2] ?? minSize;
            const t = (s - minSize) / (maxSize - minSize || 1);
            return 7 + t * 18;
          },
          itemStyle: {
            color: fill,
            opacity: 0.62,
            borderColor: c.panel,
            borderWidth: 0.5,
          },
          emphasis: {
            itemStyle: { opacity: 1, borderWidth: 1, borderColor: c.ink },
          },
          data: points.map((p) => [p.x, p.y, p.size ?? 0, p.period ?? ""]),
          markLine:
            points.some((p) => p.y < 0) && points.some((p) => p.y > 0)
              ? {
                  silent: true,
                  symbol: "none",
                  lineStyle: { color: c.line, type: "dashed", width: 1 },
                  data: [{ yAxis: 0 }],
                  label: { show: false },
                }
              : undefined,
        },
      ],
    };
  }, [points, xLabel, yLabel, color]);

  if (!points.length) {
    return <EmptySvg height={height} label="No aligned observations" />;
  }

  return (
    <div className="mm-echart" role="img" aria-label={`${yLabel} vs ${xLabel}`}>
      <ReactECharts
        option={option}
        style={{ height, width: "100%" }}
        opts={{ renderer: "svg" }}
        notMerge
      />
    </div>
  );
}

export function MmHeatmap({
  keys,
  matrix,
  height = 280,
}: {
  keys: string[];
  matrix: (number | null)[][];
  height?: number;
}) {
  const option = useMemo<EChartsOption>(() => {
    const c = chartThemeColors();
    const base = eiEchartsBase();
    const data: [number, number, number | null][] = [];
    for (let i = 0; i < matrix.length; i++) {
      const row = matrix[i] ?? [];
      for (let j = 0; j < row.length; j++) {
        data.push([j, i, row[j] ?? null]);
      }
    }

    return {
      ...base,
      grid: {
        left: 72,
        right: 18,
        top: 48,
        bottom: 52,
        containLabel: false,
      },
      legend: { show: false },
      tooltip: {
        ...base.tooltip,
        trigger: "item",
        formatter: (params: unknown) => {
          const p = params as { data?: [number, number, number | null] };
          const d = p.data;
          if (!d) return "";
          const x = keys[d[0]] ?? "";
          const y = keys[d[1]] ?? "";
          const v = d[2];
          return `${y} × ${x}<br/><b>${v == null ? "—" : v.toFixed(3)}</b>`;
        },
      },
      xAxis: {
        type: "category",
        data: keys,
        splitArea: { show: false },
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: c.text,
          fontFamily: "IBM Plex Mono, ui-monospace, monospace",
          fontSize: 10,
          rotate: 35,
          interval: 0,
        },
      },
      yAxis: {
        type: "category",
        data: keys,
        splitArea: { show: false },
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: c.text,
          fontFamily: "IBM Plex Mono, ui-monospace, monospace",
          fontSize: 10,
          interval: 0,
        },
      },
      visualMap: {
        min: -1,
        max: 1,
        calculable: false,
        orient: "horizontal",
        left: "center",
        bottom: 4,
        text: ["+1", "−1"],
        textStyle: {
          color: c.text,
          fontFamily: "IBM Plex Mono, ui-monospace, monospace",
          fontSize: 10,
        },
        itemWidth: 140,
        itemHeight: 8,
        inRange: {
          color: ["#b42318", "rgba(255,255,255,0.92)", "#0b7a6b"],
        },
      },
      series: [
        {
          type: "heatmap",
          data: data.map(([x, y, v]) => [x, y, v == null ? "-" : v]),
          label: {
            show: true,
            formatter: (params: unknown) => {
              const p = params as { data?: [number, number, number | string] };
              const v = p.data?.[2];
              if (v == null || v === "-") return "—";
              return Number(v).toFixed(2);
            },
            color: c.ink,
            fontFamily: "IBM Plex Mono, ui-monospace, monospace",
            fontSize: 10,
            fontWeight: 600,
          },
          itemStyle: {
            borderColor: c.panel,
            borderWidth: 2,
            borderRadius: 4,
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 0,
              borderColor: c.ink,
              borderWidth: 1.5,
            },
          },
        },
      ],
    };
  }, [keys, matrix]);

  if (!keys.length) {
    return <EmptySvg height={height} label="Need more overlapping changes" />;
  }

  return (
    <div className="mm-echart" role="img" aria-label="Correlation heatmap">
      <ReactECharts
        option={option}
        style={{ height, width: "100%" }}
        opts={{ renderer: "svg" }}
        notMerge
      />
    </div>
  );
}

export function MmGantt({
  bars,
  height = 280,
}: {
  bars: {
    id: string;
    label: string;
    start: string;
    end: string;
    amount: number;
    side: "repo" | "reverse_repo";
  }[];
  height?: number;
}) {
  const c = useColors();
  if (!bars.length) return <EmptySvg height={height} label="No open term auctions" />;
  const pad = { t: 12, r: 12, b: 28, l: 88 };
  const w = 640;
  const rowH = Math.max(18, Math.min(28, (height - pad.t - pad.b) / bars.length));
  const h = pad.t + pad.b + bars.length * rowH;
  const starts = bars.map((b) => b.start);
  const ends = bars.map((b) => b.end);
  const minT = starts.reduce((a, b) => (a < b ? a : b));
  const maxT = ends.reduce((a, b) => (a > b ? a : b));
  const t0 = Date.parse(`${minT}T00:00:00Z`);
  const t1 = Date.parse(`${maxT}T00:00:00Z`);
  const span = Math.max(t1 - t0, 1);
  const maxAmt = Math.max(...bars.map((b) => b.amount), 1);
  const innerW = w - pad.l - pad.r;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mm-svg" role="img" aria-label="Term repo maturity ladder">
      {bars.map((b, i) => {
        const x1 = pad.l + ((Date.parse(`${b.start}T00:00:00Z`) - t0) / span) * innerW;
        const x2 = pad.l + ((Date.parse(`${b.end}T00:00:00Z`) - t0) / span) * innerW;
        const y = pad.t + i * rowH + 3;
        const bh = Math.max(8, (b.amount / maxAmt) * (rowH - 6));
        const fill = b.side === "repo" ? c.copper : c.accent;
        return (
          <g key={b.id}>
            <text x={pad.l - 8} y={y + bh / 2 + 4} textAnchor="end" className="mm-svg-label">
              {b.label}
            </text>
            <rect x={x1} y={y} width={Math.max(x2 - x1, 2)} height={bh} rx={3} fill={fill} opacity={0.85}>
              <title>
                {b.side} · {b.start} → {b.end} · {b.amount.toFixed(1)} bn
              </title>
            </rect>
          </g>
        );
      })}
      <text x={pad.l} y={h - 8} className="mm-svg-label">
        {minT}
      </text>
      <text x={w - pad.r} y={h - 8} textAnchor="end" className="mm-svg-label">
        {maxT}
      </text>
    </svg>
  );
}

export function MmBoxPlots({
  groups,
  height = 220,
  yLabel = "pp",
}: {
  groups: { label: string; values: number[] }[];
  height?: number;
  yLabel?: string;
}) {
  const option = useMemo<EChartsOption>(() => {
    const c = chartThemeColors();
    const base = eiEchartsBase();
    const stats = groups
      .map((g) => {
        const s = [...g.values].sort((a, b) => a - b);
        if (!s.length) return null;
        const q = (p: number) => {
          const i = (s.length - 1) * p;
          const lo = Math.floor(i);
          const hi = Math.ceil(i);
          return lo === hi ? s[lo]! : s[lo]! * (hi - i) + s[hi]! * (i - lo);
        };
        return {
          label: g.label,
          min: s[0]!,
          q1: q(0.25),
          median: q(0.5),
          q3: q(0.75),
          max: s[s.length - 1]!,
          n: s.length,
        };
      })
      .filter(Boolean) as {
      label: string;
      min: number;
      q1: number;
      median: number;
      q3: number;
      max: number;
      n: number;
    }[];

    const crossesZero =
      stats.some((s) => s.min < 0) && stats.some((s) => s.max > 0);

    return {
      ...base,
      grid: { left: 56, right: 18, top: 24, bottom: 44, containLabel: false },
      legend: { show: false },
      tooltip: {
        ...base.tooltip,
        trigger: "item",
        formatter: (params: unknown) => {
          const p = params as { dataIndex?: number };
          const s = stats[p.dataIndex ?? 0];
          if (!s) return "";
          return [
            `<b>${s.label}</b> · n=${s.n}`,
            `min ${s.min.toFixed(2)}`,
            `Q1 ${s.q1.toFixed(2)}`,
            `median ${s.median.toFixed(2)}`,
            `Q3 ${s.q3.toFixed(2)}`,
            `max ${s.max.toFixed(2)}`,
          ].join("<br/>");
        },
      },
      xAxis: {
        type: "category",
        data: stats.map((s) => `${s.label} (n=${s.n})`),
        boundaryGap: true,
        splitArea: { show: false },
        axisLine: { lineStyle: { color: c.line } },
        axisTick: { show: false },
        axisLabel: {
          color: c.text,
          fontFamily: "Sora, sans-serif",
          fontSize: 11,
          fontWeight: 600,
        },
      },
      yAxis: {
        type: "value",
        name: yLabel,
        nameLocation: "middle",
        nameGap: 40,
        nameTextStyle: axisNameStyle(c.text),
        splitLine: { lineStyle: { color: c.grid } },
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: c.text,
          fontFamily: "IBM Plex Mono, ui-monospace, monospace",
          fontSize: 10,
        },
      },
      series: [
        {
          type: "boxplot",
          boxWidth: [18, 48],
          itemStyle: {
            color: "rgba(11,122,107,0.28)",
            borderColor: c.accent,
            borderWidth: 1.5,
          },
          emphasis: {
            itemStyle: {
              borderWidth: 2,
              shadowBlur: 0,
            },
          },
          data: stats.map((s) => [s.min, s.q1, s.median, s.q3, s.max]),
          markLine: crossesZero
            ? {
                silent: true,
                symbol: "none",
                lineStyle: { color: c.line, type: "dashed", width: 1 },
                data: [{ yAxis: 0 }],
                label: { show: false },
              }
            : undefined,
        },
      ],
    };
  }, [groups, yLabel]);

  const hasData = groups.some((g) => g.values.length > 0);
  if (!hasData) {
    return <EmptySvg height={height} label="No regime observations" />;
  }

  const chartH = Math.min(Math.max(height, 240), 320);

  return (
    <div className="mm-echart" role="img" aria-label="Regime box plots">
      <ReactECharts
        option={option}
        style={{ height: chartH, width: "100%" }}
        opts={{ renderer: "svg" }}
        notMerge
      />
    </div>
  );
}

export function MmLagBars({
  data,
  height = 200,
}: {
  data: { lag: number; corr: number }[];
  height?: number;
}) {
  const c = useColors();
  if (!data.length) return <EmptySvg height={height} label="Insufficient overlapping changes" />;
  const pad = { t: 12, r: 12, b: 32, l: 40 };
  const w = 480;
  const h = height;
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const maxAbs = Math.max(...data.map((d) => Math.abs(d.corr)), 0.01);
  const barW = innerW / data.length;
  const zeroY = pad.t + innerH / 2;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mm-svg" role="img" aria-label="Lag correlation">
      <line x1={pad.l} y1={zeroY} x2={pad.l + innerW} y2={zeroY} stroke={c.line} />
      {data.map((d, i) => {
        const bh = (Math.abs(d.corr) / maxAbs) * (innerH / 2);
        const y = d.corr >= 0 ? zeroY - bh : zeroY;
        return (
          <g key={d.lag}>
            <rect
              x={pad.l + i * barW + 2}
              y={y}
              width={Math.max(barW - 4, 2)}
              height={bh}
              rx={2}
              fill={d.corr >= 0 ? c.accent : c.down}
              opacity={0.8}
            >
              <title>
                lag {d.lag}: {d.corr.toFixed(3)}
              </title>
            </rect>
            <text
              x={pad.l + i * barW + barW / 2}
              y={h - 10}
              textAnchor="middle"
              className="mm-svg-label"
            >
              {d.lag}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function MmSparkCard({
  title,
  value,
  unit,
  mom,
  yoy,
  spark,
  href,
}: {
  title: string;
  value: number | null;
  unit: string;
  mom: number | null;
  yoy: number | null;
  spark: number[];
  href: string;
}) {
  const c = useColors();
  const w = 120;
  const h = 36;
  const min = Math.min(...spark, 0);
  const max = Math.max(...spark, 1);
  const span = max - min || 1;
  const d = spark
    .map((v, i) => {
      const x = (i / Math.max(spark.length - 1, 1)) * w;
      const y = h - ((v - min) / span) * (h - 4) - 2;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  function delta(v: number | null) {
    if (v == null) return "—";
    const sign = v > 0 ? "+" : "";
    return `${sign}${v.toFixed(2)}`;
  }

  return (
    <a className="mm-spark-card" href={href}>
      <div className="mm-spark-top">
        <span className="mm-spark-title">{title}</span>
        <strong className="mm-spark-value">
          {value != null ? value.toFixed(2) : "—"}
          <span className="mm-spark-unit">{unit}</span>
        </strong>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="mm-spark-svg" aria-hidden>
        <path d={d} fill="none" stroke={c.accent} strokeWidth={1.6} />
      </svg>
      <div className="mm-spark-deltas">
        <span>
          MoM <em className={mom != null && mom < 0 ? "down" : mom != null && mom > 0 ? "up" : ""}>{delta(mom)}</em>
        </span>
        <span>
          YoY <em className={yoy != null && yoy < 0 ? "down" : yoy != null && yoy > 0 ? "up" : ""}>{delta(yoy)}</em>
        </span>
      </div>
    </a>
  );
}

function EmptySvg({ height, label }: { height: number; label: string }) {
  return (
    <div className="mm-svg-empty" style={{ height }}>
      {label}
    </div>
  );
}

/** Convert event-study path to chart points using synthetic dates. */
export function eventStudyToPoints(
  path: { offset: number; mean: number }[],
  anchor = "2020-01-01",
): Point[] {
  return path.map((p) => {
    const d = new Date(`${anchor}T00:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() + p.offset);
    return { period: d.toISOString().slice(0, 10), value: p.mean };
  });
}
