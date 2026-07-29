"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  LineSeries,
  LineType,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  type WhitespaceData,
  type Time,
} from "lightweight-charts";

export type ChartRange = "1Y" | "5Y" | "MAX";
export type ChartPoint = { period: string; value: number };

export type DualSeriesSpec = {
  key: string;
  label: string;
  points: ChartPoint[];
  /** CSS variable name, e.g. "--copper" */
  colorVar: string;
  colorFallback: string;
  /** Event / step series: carry last rate into the visible window start. */
  carry?: boolean;
  lineWidth?: 1 | 2 | 3 | 4;
};

function cssVar(name: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function chartTheme(series: DualSeriesSpec[]) {
  return {
    text: cssVar("--muted", "#5b6f69"),
    grid: cssVar("--chart-grid", "rgba(11,22,20,0.08)"),
    markerBg: cssVar("--panel-solid", "#ffffff"),
    crosshair: cssVar("--accent", "#0b7a6b"),
    colors: series.map((s) => cssVar(s.colorVar, s.colorFallback)),
  };
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addYears(iso: string, years: number): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return isoDate(d);
}

function rangeStart(range: ChartRange, points: ChartPoint[]): string | null {
  if (!points.length) return null;
  const dataTo = points[points.length - 1].period;
  if (range === "MAX") return points[0].period;
  return range === "5Y" ? addYears(dataTo, -5) : addYears(dataTo, -1);
}

/** For event rates: ensure a valued point at the window start carrying the prior rate. */
function withCarryIn(
  points: ChartPoint[],
  range: ChartRange,
  anchor: ChartPoint[],
): ChartPoint[] {
  if (!points.length) return points;
  const sorted = [...points].sort((a, b) => a.period.localeCompare(b.period));
  const start = rangeStart(range, anchor.length ? anchor : sorted);
  if (!start) return sorted;

  let carry: number | null = null;
  for (const p of sorted) {
    if (p.period <= start) carry = p.value;
    else break;
  }
  const inWindow = sorted.filter((p) => p.period >= start);
  if (carry == null) return inWindow.length ? inWindow : sorted;
  if (inWindow[0]?.period === start) return inWindow;
  return [{ period: start, value: carry }, ...inWindow.filter((p) => p.period > start)];
}

function toLineData(
  range: ChartRange,
  points: ChartPoint[],
  anchor: ChartPoint[],
): (LineData<Time> | WhitespaceData<Time>)[] {
  if (!points.length) return [];

  const real: LineData<Time>[] = points.map((p) => ({
    time: p.period as Time,
    value: p.value,
  }));

  const start = rangeStart(range, anchor.length ? anchor : points);
  const first = points[0].period;
  if (!start || start >= first) return real;

  const pad: WhitespaceData<Time>[] = [{ time: start as Time }];
  if (range === "5Y") {
    for (let y = 1; y < 5; y++) {
      const tick = addYears(start, y);
      if (tick < first) pad.push({ time: tick as Time });
    }
  }
  return [...pad, ...real];
}

function applyVisibleWindow(
  chart: IChartApi,
  series: ISeriesApi<"Line">,
  range: ChartRange,
  points: ChartPoint[],
) {
  if (!points.length || !chart.panes().length) return;
  const from = rangeStart(range, points);
  const to = points[points.length - 1].period;
  if (!from) return;
  try {
    chart.timeScale().setVisibleRange({ from: from as Time, to: to as Time });
  } catch {
    chart.timeScale().fitContent();
  }
  try {
    series.priceScale().applyOptions({ autoScale: true });
  } catch {
    // Price scale unavailable after chart teardown.
  }
}

function pickAnchor(series: DualSeriesSpec[]): ChartPoint[] {
  let best: ChartPoint[] = [];
  for (const s of series) {
    if (s.points.length > best.length) best = s.points;
  }
  return best;
}

export function DualRatesChart({
  seriesA,
  seriesB,
  seriesC,
  range = "1Y",
  hint,
  height = 260,
}: {
  seriesA: DualSeriesSpec;
  seriesB: DualSeriesSpec;
  seriesC?: DualSeriesSpec;
  range?: ChartRange;
  hint?: string;
  height?: number;
}) {
  const specs = seriesC ? [seriesA, seriesB, seriesC] : [seriesA, seriesB];
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRefs = useRef<(ISeriesApi<"Line"> | null)[]>([]);
  const dataRef = useRef({ specs, range });
  dataRef.current = { specs, range };

  const hasData = specs.some((s) => s.points.length > 0);

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const t = chartTheme(specs);

    const chart: IChartApi = createChart(el, {
      height,
      width: el.clientWidth || el.parentElement?.clientWidth || 400,
      layout: {
        background: { color: "transparent" },
        textColor: t.text,
        fontFamily: "IBM Plex Mono, ui-monospace, monospace",
        fontSize: 11,
        attributionLogo: false,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: t.grid, style: 1 },
      },
      rightPriceScale: {
        borderVisible: false,
        autoScale: true,
        scaleMargins: { top: 0.14, bottom: 0.08 },
      },
      localization: {
        priceFormatter: (p: number) => `${p.toFixed(2)}%`,
      },
      timeScale: {
        borderVisible: false,
        fixLeftEdge: true,
        fixRightEdge: true,
        rightOffset: 4,
        minBarSpacing: 0.5,
        lockVisibleTimeRangeOnResize: false,
        shiftVisibleRangeOnNewBar: false,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        axisPressedMouseMove: { time: true, price: true },
        axisDoubleClickReset: { time: true, price: true },
        mouseWheel: true,
        pinch: true,
      },
      kineticScroll: { mouse: true, touch: true },
      crosshair: {
        mode: 1,
        vertLine: {
          color: t.crosshair,
          width: 1,
          style: 2,
          labelBackgroundColor: t.crosshair,
        },
        horzLine: {
          color: t.crosshair,
          labelBackgroundColor: t.crosshair,
        },
      },
    });

    const created = specs.map((spec, i) => {
      const color = t.colors[i];
      return chart.addSeries(LineSeries, {
        color,
        lineWidth: spec.lineWidth ?? (spec.carry ? 3 : 2),
        lineType: LineType.WithSteps,
        crosshairMarkerRadius: 3,
        crosshairMarkerBorderColor: color,
        crosshairMarkerBackgroundColor: t.markerBg,
        priceLineVisible: false,
        lastValueVisible: true,
        title: spec.label,
      });
    });

    chartRef.current = chart;
    seriesRefs.current = created;

    const ro = new ResizeObserver(() => {
      if (!el.clientWidth) return;
      chart.applyOptions({ width: el.clientWidth });
    });
    ro.observe(el);

    const syncTheme = () => {
      const next = chartTheme(dataRef.current.specs);
      chart.applyOptions({
        layout: { textColor: next.text },
        grid: { horzLines: { color: next.grid } },
        crosshair: {
          vertLine: { color: next.crosshair, labelBackgroundColor: next.crosshair },
          horzLine: { color: next.crosshair, labelBackgroundColor: next.crosshair },
        },
      });
      created.forEach((s, i) => {
        s.applyOptions({
          color: next.colors[i],
          crosshairMarkerBorderColor: next.colors[i],
          crosshairMarkerBackgroundColor: next.markerBg,
        });
      });
    };

    const mo = new MutationObserver(syncTheme);
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "style", "class"],
    });

    return () => {
      mo.disconnect();
      ro.disconnect();
      chartRef.current = null;
      seriesRefs.current = [];
      chart.remove();
    };
    // remount via key when series identity changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height, seriesA.key, seriesA.label, seriesB.key, seriesB.label, seriesC?.key, seriesC?.label]);

  useEffect(() => {
    const chart = chartRef.current;
    const lines = seriesRefs.current;
    const current = dataRef.current.specs;
    if (!chart || lines.length !== current.length || lines.some((l) => !l)) return;

    const anchor = pickAnchor(current);
    current.forEach((spec, i) => {
      const pts = spec.carry ? withCarryIn(spec.points, range, anchor) : spec.points;
      lines[i]!.setData(toLineData(range, pts, anchor));
    });

    let cancelled = false;
    let raf1 = 0;
    let raf2 = 0;
    const paint = () => {
      if (cancelled || chartRef.current !== chart) return;
      applyVisibleWindow(
        chart,
        lines[0]!,
        range,
        anchor.length ? anchor : current.flatMap((s) => s.points),
      );
    };
    paint();
    raf1 = requestAnimationFrame(() => {
      paint();
      raf2 = requestAnimationFrame(paint);
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [seriesA.points, seriesB.points, seriesC?.points, range]);

  function resetView() {
    const chart = chartRef.current;
    const series = seriesRefs.current[0];
    const { specs: s, range: r } = dataRef.current;
    const anchor = pickAnchor(s);
    if (!chart || !series || !anchor.length) return;
    applyVisibleWindow(chart, series, r, anchor);
  }

  return (
    <div className="chart-panel">
      <div className="chart-toolbar">
        <span className="chart-hint">
          {hasData
            ? hint ?? `${range} · Drag to pan · scroll/pinch to zoom`
            : "No history yet"}
        </span>
        <button
          type="button"
          className="btn chart-reset"
          onClick={resetView}
          disabled={!hasData}
        >
          Fit
        </button>
      </div>
      <div
        className={
          hasData
            ? "chart-wrap dual-rates-chart-wrap"
            : "chart-wrap chart-empty dual-rates-chart-wrap"
        }
        style={{ height }}
        ref={ref}
      />
    </div>
  );
}
