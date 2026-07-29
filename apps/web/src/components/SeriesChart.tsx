"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  AreaSeries,
  type IChartApi,
  type ISeriesApi,
  type AreaData,
  type WhitespaceData,
  type Time,
} from "lightweight-charts";

type Range = "1Y" | "5Y" | "MAX";

function cssVar(name: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function chartTheme() {
  return {
    text: cssVar("--muted", "#5b6f69"),
    grid: cssVar("--chart-grid", "rgba(11,22,20,0.08)"),
    accent: cssVar("--chart", "#0b7a6b"),
    fillTop: cssVar("--chart-fill-top", "rgba(11,122,107,0.28)"),
    fillBottom: cssVar("--chart-fill-bottom", "rgba(11,122,107,0.01)"),
    markerBg: cssVar("--panel-solid", "#ffffff"),
    crosshair: cssVar("--accent", "#0b7a6b"),
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

/** Start of the selected calendar window (MAX → first observation). */
function rangeStart(range: Range, points: { period: string; value: number }[]): string | null {
  if (!points.length) return null;
  const dataTo = points[points.length - 1].period;
  if (range === "MAX") return points[0].period;
  return range === "5Y" ? addYears(dataTo, -5) : addYears(dataTo, -1);
}

/**
 * Real points plus whitespace anchors so the time axis spans the full
 * 1Y / 5Y calendar window even when history is sparse.
 */
function toChartData(
  range: Range,
  points: { period: string; value: number }[],
): (AreaData<Time> | WhitespaceData<Time>)[] {
  if (!points.length) return [];

  const real: AreaData<Time>[] = points.map((p) => ({
    time: p.period as Time,
    value: p.value,
  }));

  const start = rangeStart(range, points);
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
  series: ISeriesApi<"Area">,
  range: Range,
  points: { period: string; value: number }[],
) {
  if (!points.length) return;
  // Chart may already be removed (e.g. Strict Mode remount / unmount while rAF is pending).
  if (!chart.panes().length) return;
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

export function SeriesChart({
  points,
  range = "1Y",
}: {
  points: { period: string; value: number }[];
  range?: Range;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);
  const pointsRef = useRef(points);
  const rangeRef = useRef(range);
  pointsRef.current = points;
  rangeRef.current = range;

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const t = chartTheme();

    const chart: IChartApi = createChart(el, {
      height: 300,
      width: el.clientWidth || el.parentElement?.clientWidth || 600,
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
        scaleMargins: { top: 0.12, bottom: 0.05 },
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
      kineticScroll: {
        mouse: true,
        touch: true,
      },
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

    const series: ISeriesApi<"Area"> = chart.addSeries(AreaSeries, {
      lineColor: t.accent,
      topColor: t.fillTop,
      bottomColor: t.fillBottom,
      lineWidth: 2,
      crosshairMarkerRadius: 4,
      crosshairMarkerBorderColor: t.accent,
      crosshairMarkerBackgroundColor: t.markerBg,
      priceLineVisible: true,
      lastValueVisible: true,
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const ro = new ResizeObserver(() => {
      if (!el.clientWidth) return;
      chart.applyOptions({ width: el.clientWidth });
    });
    ro.observe(el);

    const syncTheme = () => {
      const next = chartTheme();
      chart.applyOptions({
        layout: { textColor: next.text },
        grid: { horzLines: { color: next.grid } },
        crosshair: {
          vertLine: { color: next.crosshair, labelBackgroundColor: next.crosshair },
          horzLine: { color: next.crosshair, labelBackgroundColor: next.crosshair },
        },
      });
      series.applyOptions({
        lineColor: next.accent,
        topColor: next.fillTop,
        bottomColor: next.fillBottom,
        crosshairMarkerBorderColor: next.accent,
        crosshairMarkerBackgroundColor: next.markerBg,
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
      seriesRef.current = null;
      chart.remove();
    };
  }, []);

  useEffect(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!series || !chart) return;

    if (!points.length) {
      series.setData([]);
      return;
    }

    series.setData(toChartData(range, points));
    let cancelled = false;
    let raf1 = 0;
    let raf2 = 0;
    const paint = () => {
      if (cancelled || chartRef.current !== chart) return;
      applyVisibleWindow(chart, series, range, points);
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
  }, [points, range]);

  function resetView() {
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!chart || !series || !pointsRef.current.length) return;
    applyVisibleWindow(chart, series, rangeRef.current, pointsRef.current);
  }

  return (
    <div className="chart-panel">
      <div className="chart-toolbar">
        <span className="chart-hint">
          {points.length
            ? `${points.length} points · ${range} window · Drag to pan · scroll/pinch to zoom`
            : "No history yet"}
        </span>
        <button
          type="button"
          className="btn chart-reset"
          onClick={resetView}
          disabled={!points.length}
        >
          Fit
        </button>
      </div>
      <div
        className={points.length ? "chart-wrap" : "chart-wrap chart-empty"}
        ref={ref}
      />
    </div>
  );
}
