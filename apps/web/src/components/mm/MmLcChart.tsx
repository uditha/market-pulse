"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  LineSeries,
  AreaSeries,
  HistogramSeries,
  BaselineSeries,
  CandlestickSeries,
  LineType,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  type HistogramData,
  type CandlestickData,
  type WhitespaceData,
  type Time,
} from "lightweight-charts";
import {
  chartThemeColors,
  cssVar,
  rangeStart,
  RANGE_TABS,
  type ChartRange,
  type Point,
} from "./chartTheme";
import { MmChartInfo, type ChartInfoGuide } from "./MmChartInfo";

export type SeriesKind =
  | "line"
  | "step"
  | "area"
  | "histogram"
  | "baseline"
  | "candle";

export type LcSeriesSpec = {
  key: string;
  label: string;
  kind: SeriesKind;
  points?: Point[];
  /** Candlestick OHLC when kind === "candle" */
  candles?: { period: string; open: number; high: number; low: number; close: number }[];
  colorVar?: string;
  colorFallback?: string;
  lineWidth?: 1 | 2 | 3 | 4;
  /** Use left price scale (dual-axis). */
  priceScaleId?: "right" | "left";
  /** Histogram / baseline positive color */
  upColor?: string;
  downColor?: string;
  /** Area fill for corridor upper band */
  topColor?: string;
  bottomColor?: string;
  priceFormat?: "percent" | "number" | "ratio";
  lastValueVisible?: boolean;
};

function withCarryIn(points: Point[], range: ChartRange, anchor: Point[]): Point[] {
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
  points: Point[],
  anchor: Point[],
): (LineData<Time> | WhitespaceData<Time>)[] {
  if (!points.length) return [];
  const real: LineData<Time>[] = points.map((p) => ({
    time: p.period as Time,
    value: p.value,
  }));
  const start = rangeStart(range, anchor.length ? anchor : points);
  const first = points[0].period;
  if (!start || start >= first) return real;
  return [{ time: start as Time }, ...real];
}

function pickAnchor(series: LcSeriesSpec[]): Point[] {
  let best: Point[] = [];
  for (const s of series) {
    const pts = s.points ?? s.candles?.map((c) => ({ period: c.period, value: c.close })) ?? [];
    if (pts.length > best.length) best = pts;
  }
  return best;
}

function priceFormatter(fmt: LcSeriesSpec["priceFormat"]) {
  if (fmt === "ratio") return (p: number) => p.toFixed(2);
  if (fmt === "percent" || fmt == null) return (p: number) => `${p.toFixed(2)}%`;
  // "number" — scale decimals to magnitude (LKR, index, Rs.mn, …)
  return (p: number) => {
    const abs = Math.abs(p);
    if (abs >= 10_000) {
      return p.toLocaleString(undefined, { maximumFractionDigits: 0 });
    }
    if (abs >= 100) {
      return p.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      });
    }
    if (abs >= 1) return p.toFixed(2);
    return p.toFixed(4);
  };
}

function latestOf(spec: LcSeriesSpec): number | null {
  if (spec.candles?.length) {
    return spec.candles[spec.candles.length - 1]?.close ?? null;
  }
  const pts = spec.points;
  if (!pts?.length) return null;
  return pts[pts.length - 1]?.value ?? null;
}

/** Stable colors only — never read CSS vars during render (avoids SSR hydration drift). */
function seriesSwatch(spec: LcSeriesSpec): string {
  if (spec.colorFallback) return spec.colorFallback;
  if (spec.upColor) return spec.upColor;
  if (spec.kind === "histogram") return "#1a7a4c";
  return "#0b7a6b";
}

function buildLegendItems(series: LcSeriesSpec[]) {
  const seen = new Set<string>();
  const items: { key: string; label: string; color: string; value: string }[] = [];
  for (const spec of series) {
    if (spec.key.includes("-band") || spec.key.includes("-mask")) continue;
    if (spec.kind === "area" && spec.lastValueVisible === false) continue;
    if (seen.has(spec.label)) continue;
    seen.add(spec.label);
    const v = latestOf(spec);
    const fmt = priceFormatter(spec.priceFormat);
    items.push({
      key: spec.key,
      label: spec.label,
      color: seriesSwatch(spec),
      value: v == null || Number.isNaN(v) ? "—" : fmt(v),
    });
  }
  return items;
}

type AnySeries =
  | ISeriesApi<"Line">
  | ISeriesApi<"Area">
  | ISeriesApi<"Histogram">
  | ISeriesApi<"Baseline">
  | ISeriesApi<"Candlestick">;

export function MmLcChart({
  series,
  range = "1Y",
  hint,
  height = 260,
  fill = false,
  compact = false,
  carryKeys = [],
  zeroLine,
  legend = true,
  info,
  onRange,
  busy,
  selectedRange,
}: {
  series: LcSeriesSpec[];
  range?: ChartRange;
  /** Tab highlight; defaults to `range` (use while a fetch is pending). */
  selectedRange?: ChartRange;
  hint?: string;
  height?: number;
  /** Fill parent height (desk / stage layout). */
  fill?: boolean;
  /** Hide the hint/fit toolbar to maximize chart. */
  compact?: boolean;
  /** Keys whose points should be step-carried into the window. */
  carryKeys?: string[];
  zeroLine?: boolean;
  /** Show color + latest-value legend above the plot. */
  legend?: boolean;
  /** Why / how-to-read popover (info icon, top-right). */
  info?: ChartInfoGuide;
  /** When set, show 1Y / 5Y / MAX inside the chart chrome. */
  onRange?: (r: ChartRange) => void;
  busy?: boolean;
}) {
  const tabRange = selectedRange ?? range;
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRefs = useRef<AnySeries[]>([]);
  const dataRef = useRef({ series, range, carryKeys });
  dataRef.current = { series, range, carryKeys };

  const hasData = series.some(
    (s) => (s.points?.length ?? 0) > 0 || (s.candles?.length ?? 0) > 0,
  );
  const hasLeft = series.some((s) => s.priceScaleId === "left");
  const seriesKey = series.map((s) => `${s.key}:${s.kind}`).join("|");

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const t = chartThemeColors();

    const startH = fill
      ? Math.max(el.clientHeight || height, 160)
      : height;

    const chart = createChart(el, {
      height: startH,
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
        scaleMargins: { top: 0.12, bottom: 0.08 },
      },
      leftPriceScale: {
        visible: hasLeft,
        borderVisible: false,
        autoScale: true,
        scaleMargins: { top: 0.12, bottom: 0.08 },
      },
      localization: {
        priceFormatter: priceFormatter(series[0]?.priceFormat ?? "percent"),
      },
      timeScale: {
        borderVisible: false,
        fixLeftEdge: true,
        fixRightEdge: true,
        rightOffset: 4,
        minBarSpacing: 0.4,
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

    const created: AnySeries[] = series.map((spec) => {
      const color = cssVar(spec.colorVar ?? "--accent", spec.colorFallback ?? "#0b7a6b");
      const scaleId = spec.priceScaleId ?? "right";
      const lastValueVisible = spec.lastValueVisible ?? true;
      const title = spec.label;
      const fmt = priceFormatter(spec.priceFormat);
      const priceFormat = {
        type: "custom" as const,
        minMove: 0.0001,
        formatter: (price: number) => fmt(price),
      };

      if (spec.kind === "area") {
        const resolve = (raw: string | undefined, fallback: string) => {
          if (!raw) return fallback;
          if (raw.startsWith("var(")) {
            const name = raw.slice(4, raw.indexOf(")")).trim();
            return cssVar(name, fallback);
          }
          return raw;
        };
        return chart.addSeries(AreaSeries, {
          lineColor: color,
          topColor: resolve(spec.topColor, "rgba(47,111,143,0.22)"),
          bottomColor: resolve(spec.bottomColor, "rgba(47,111,143,0.02)"),
          lineWidth: spec.lineWidth ?? 1,
          lineType: LineType.WithSteps,
          priceScaleId: scaleId,
          priceFormat,
          priceLineVisible: false,
          lastValueVisible,
          title,
        });
      }
      if (spec.kind === "histogram") {
        return chart.addSeries(HistogramSeries, {
          color,
          priceScaleId: scaleId,
          priceFormat,
          priceLineVisible: false,
          lastValueVisible,
          title,
        });
      }
      if (spec.kind === "baseline") {
        return chart.addSeries(BaselineSeries, {
          baseValue: { type: "price", price: 0 },
          topLineColor: spec.upColor ?? t.up,
          topFillColor1: "rgba(26,122,76,0.28)",
          topFillColor2: "rgba(26,122,76,0.02)",
          bottomLineColor: spec.downColor ?? t.down,
          bottomFillColor1: "rgba(180,35,24,0.28)",
          bottomFillColor2: "rgba(180,35,24,0.02)",
          lineWidth: spec.lineWidth ?? 2,
          priceScaleId: scaleId,
          priceFormat,
          priceLineVisible: zeroLine ?? true,
          lastValueVisible,
          title,
        });
      }
      if (spec.kind === "candle") {
        return chart.addSeries(CandlestickSeries, {
          upColor: color,
          downColor: color,
          borderUpColor: color,
          borderDownColor: color,
          wickUpColor: color,
          wickDownColor: color,
          priceScaleId: scaleId,
          priceFormat,
          priceLineVisible: false,
          lastValueVisible,
          title,
        });
      }
      return chart.addSeries(LineSeries, {
        color,
        lineWidth: spec.lineWidth ?? (spec.kind === "step" ? 3 : 2),
        lineType: spec.kind === "step" ? LineType.WithSteps : LineType.Simple,
        crosshairMarkerRadius: 3,
        crosshairMarkerBorderColor: color,
        crosshairMarkerBackgroundColor: t.markerBg,
        priceScaleId: scaleId,
        priceFormat,
        priceLineVisible: false,
        lastValueVisible,
        title,
      });
    });

    chartRef.current = chart;
    seriesRefs.current = created;

    const ro = new ResizeObserver(() => {
      if (!el.clientWidth) return;
      const next: { width: number; height?: number } = { width: el.clientWidth };
      if (fill && el.clientHeight > 0) next.height = el.clientHeight;
      chart.applyOptions(next);
    });
    ro.observe(el);

    const syncTheme = () => {
      const next = chartThemeColors();
      chart.applyOptions({
        layout: { textColor: next.text },
        grid: { horzLines: { color: next.grid } },
        crosshair: {
          vertLine: { color: next.crosshair, labelBackgroundColor: next.crosshair },
          horzLine: { color: next.crosshair, labelBackgroundColor: next.crosshair },
        },
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height, fill, seriesKey, hasLeft, zeroLine]);

  useEffect(() => {
    const chart = chartRef.current;
    const apis = seriesRefs.current;
    const { series: specs, range: r, carryKeys: carry } = dataRef.current;
    if (!chart || apis.length !== specs.length) return;

    const carrySet = new Set(carry);
    const anchor = pickAnchor(specs);

    specs.forEach((spec, i) => {
      const api = apis[i];
      if (!api) return;

      if (spec.kind === "candle" && spec.candles?.length) {
        const data: CandlestickData<Time>[] = [...spec.candles]
          .sort((a, b) => a.period.localeCompare(b.period))
          .map((c) => ({
            time: c.period as Time,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
          }));
        (api as ISeriesApi<"Candlestick">).setData(data);
        return;
      }

      let pts = spec.points ?? [];
      if (carrySet.has(spec.key) || spec.kind === "step" || spec.kind === "area") {
        pts = withCarryIn(pts, r, anchor);
      }
      const sorted = [...pts].sort((a, b) => a.period.localeCompare(b.period));

      if (spec.kind === "histogram") {
        const up = spec.upColor ?? chartThemeColors().up;
        const down = spec.downColor ?? chartThemeColors().down;
        const data: HistogramData<Time>[] = sorted.map((p) => ({
          time: p.period as Time,
          value: p.value,
          color: p.value >= 0 ? up : down,
        }));
        (api as ISeriesApi<"Histogram">).setData(data);
      } else if (spec.kind === "baseline") {
        (api as ISeriesApi<"Baseline">).setData(
          sorted.map((p) => ({ time: p.period as Time, value: p.value })),
        );
      } else {
        (api as ISeriesApi<"Line">).setData(toLineData(r, sorted, anchor));
      }
    });

    const from = rangeStart(r, anchor);
    const to = anchor[anchor.length - 1]?.period;
    if (from && to) {
      try {
        chart.timeScale().setVisibleRange({ from: from as Time, to: to as Time });
      } catch {
        chart.timeScale().fitContent();
      }
    } else {
      chart.timeScale().fitContent();
    }
    // Re-fit price axis to the visible window after data / range / view switches.
    // Without this, a prior manual zoom or a wider series can leave a stale scale
    // (e.g. CPI stuck at −20%…100% after the 2022 spike).
    chart.priceScale("right").setAutoScale(true);
    if (hasLeft) chart.priceScale("left").setAutoScale(true);
  }, [series, range, hasLeft]);

  function resetView() {
    const chart = chartRef.current;
    const { series: specs, range: r } = dataRef.current;
    const anchor = pickAnchor(specs);
    if (!chart || !anchor.length) return;
    const from = rangeStart(r, anchor);
    const to = anchor[anchor.length - 1]?.period;
    if (!from || !to) return;
    try {
      chart.timeScale().setVisibleRange({ from: from as Time, to: to as Time });
    } catch {
      chart.timeScale().fitContent();
    }
    chart.priceScale("right").setAutoScale(true);
    if (specs.some((s) => s.priceScaleId === "left")) {
      chart.priceScale("left").setAutoScale(true);
    }
  }

  const legendItems = legend ? buildLegendItems(series) : [];
  const showChrome = Boolean(legendItems.length || onRange || info);

  return (
    <div
      className={`chart-panel${fill ? " mm-chart-fill" : ""}${busy ? " is-busy" : ""}`}
      aria-busy={busy || undefined}
    >
      {showChrome ? (
        <div className="mm-chart-chrome">
          <div className="mm-chart-chrome-left">
            {legendItems.length ? (
              <div className="corridor-legend mm-chart-legend" aria-label="Series legend">
                {legendItems.map((item) => (
                  <span key={item.key} className="corridor-legend-item">
                    <span
                      className="corridor-swatch"
                      style={{
                        background: item.color,
                        boxShadow: `0 0 0 3px color-mix(in srgb, ${item.color} 22%, transparent)`,
                      }}
                    />
                    <span className="corridor-legend-label">{item.label}</span>
                    <strong className="corridor-legend-value">{item.value}</strong>
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          <div className="mm-chart-chrome-right">
            {onRange ? (
              <div className="mm-cmd-range mm-chart-range" role="tablist" aria-label="Chart range">
                {RANGE_TABS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    role="tab"
                    aria-selected={t === tabRange}
                    className={`mm-range-btn${t === tabRange ? " is-active" : ""}`}
                    disabled={busy}
                    onClick={() => onRange(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            ) : null}
            {info ? <MmChartInfo guide={info} /> : null}
          </div>
        </div>
      ) : null}
      {!compact ? (
        <div className="chart-toolbar">
          <span className="chart-hint">
            {hasData ? hint ?? `${range} · pan / zoom` : "No history yet"}
          </span>
          <button type="button" className="btn chart-reset" onClick={resetView} disabled={!hasData}>
            Fit
          </button>
        </div>
      ) : null}
      <div
        className={hasData ? "chart-wrap mm-lc-wrap" : "chart-wrap chart-empty mm-lc-wrap"}
        style={fill ? undefined : { height }}
        ref={ref}
      />
    </div>
  );
}
