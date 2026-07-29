"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import {
  DualRatesChart,
  type ChartPoint,
  type ChartRange,
} from "@/components/DualRatesChart";

const TABS: ChartRange[] = ["1Y", "5Y", "MAX"];

export type DualRatesSeriesConfig = {
  seriesId: string;
  label: string;
  colorVar: string;
  colorFallback: string;
  swatchClass: string;
  initialPoints: ChartPoint[];
  /** Event series — fetch MAX and carry into the visible window. */
  carry?: boolean;
  /** Prefer MAX history even when range tabs change (policy step rates). */
  alwaysMax?: boolean;
  lineWidth?: 1 | 2 | 3 | 4;
  legendClassName?: string;
};

function endsKey(pts: ChartPoint[]) {
  return `${pts.length}:${pts[0]?.period ?? ""}:${pts[pts.length - 1]?.period ?? ""}:${pts[pts.length - 1]?.value ?? ""}`;
}

function historyKey(
  range: ChartRange,
  a: ChartPoint[],
  b: ChartPoint[],
  c?: ChartPoint[],
) {
  return `${range}:${endsKey(a)}:${endsKey(b)}:${c ? endsKey(c) : ""}`;
}

function latest(points: ChartPoint[]): number | null {
  if (!points.length) return null;
  return points[points.length - 1].value;
}

function LegendItem({
  config,
  value,
}: {
  config: DualRatesSeriesConfig;
  value: number | null;
}) {
  return (
    <Link
      href={`/series/${encodeURIComponent(config.seriesId)}`}
      className={`corridor-legend-item ${config.legendClassName ?? ""}`}
    >
      <span className={`corridor-swatch ${config.swatchClass}`} />
      <span className="corridor-legend-label">{config.label}</span>
      <strong className="corridor-legend-value">
        {value != null ? `${value.toFixed(2)}%` : "—"}
      </strong>
    </Link>
  );
}

export function DualRatesPanel({
  title,
  subtitle,
  initialRange = "1Y",
  seriesA,
  seriesB,
  seriesC,
  hint,
}: {
  title: string;
  subtitle: string;
  initialRange?: ChartRange;
  seriesA: DualRatesSeriesConfig;
  seriesB: DualRatesSeriesConfig;
  seriesC?: DualRatesSeriesConfig;
  hint?: string;
}) {
  const [range, setRange] = useState<ChartRange>(initialRange);
  const [aPoints, setAPoints] = useState(seriesA.initialPoints);
  const [bPoints, setBPoints] = useState(seriesB.initialPoints);
  const [cPoints, setCPoints] = useState(seriesC?.initialPoints ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);
  const syncedKey = useRef(
    historyKey(
      initialRange,
      seriesA.initialPoints,
      seriesB.initialPoints,
      seriesC?.initialPoints,
    ),
  );

  useEffect(() => {
    const nextKey = historyKey(
      initialRange,
      seriesA.initialPoints,
      seriesB.initialPoints,
      seriesC?.initialPoints,
    );
    if (nextKey === syncedKey.current) return;
    syncedKey.current = nextKey;
    setRange(initialRange);
    setAPoints(seriesA.initialPoints);
    setBPoints(seriesB.initialPoints);
    setCPoints(seriesC?.initialPoints ?? []);
  }, [
    initialRange,
    seriesA.initialPoints,
    seriesB.initialPoints,
    seriesC?.initialPoints,
  ]);

  async function select(next: ChartRange) {
    if (next === range || busy) return;
    const id = ++reqId.current;
    setBusy(true);
    setError(null);
    setRange(next);
    try {
      const fetches = [
        api.series(seriesA.seriesId, seriesA.alwaysMax ? "MAX" : next),
        api.series(seriesB.seriesId, seriesB.alwaysMax ? "MAX" : next),
      ];
      if (seriesC) {
        fetches.push(api.series(seriesC.seriesId, seriesC.alwaysMax ? "MAX" : next));
      }
      const details = await Promise.all(fetches);
      if (id !== reqId.current) return;
      const nextA = (details[0].history ?? []).map((h) => ({
        period: h.period,
        value: h.value,
      }));
      const nextB = (details[1].history ?? []).map((h) => ({
        period: h.period,
        value: h.value,
      }));
      const nextC = seriesC
        ? (details[2].history ?? []).map((h) => ({
            period: h.period,
            value: h.value,
          }))
        : [];
      syncedKey.current = historyKey(next, nextA, nextB, nextC);
      setAPoints(nextA);
      setBPoints(nextB);
      setCPoints(nextC);
    } catch (err) {
      if (id !== reqId.current) return;
      setError((err as Error).message);
    } finally {
      if (id === reqId.current) setBusy(false);
    }
  }

  const aLatest = latest(aPoints);
  const bLatest = latest(bPoints);
  const cLatest = latest(cPoints);

  return (
    <section className="panel corridor-panel">
      <div className="corridor-head">
        <div>
          <h2 className="section-title" style={{ margin: 0, fontSize: "1.15rem" }}>
            {title}
          </h2>
          <p className="section-sub corridor-sub">
            {subtitle}
            {busy ? " · Loading…" : ""}
          </p>
        </div>
        <div className="corridor-tabs" role="tablist" aria-label={`${title} range`}>
          {TABS.map((t) => {
            const active = t === range;
            return (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={active}
                className="btn"
                disabled={busy}
                onClick={() => void select(t)}
                style={{
                  background: active ? "var(--accent)" : undefined,
                  color: active ? "#fff" : undefined,
                  borderColor: active ? "var(--accent-deep)" : undefined,
                  fontWeight: active ? 700 : undefined,
                  opacity: busy && !active ? 0.7 : 1,
                  padding: "5px 10px",
                  fontSize: "0.78rem",
                }}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>

      <div className="corridor-legend" aria-label="Series legend">
        <LegendItem config={seriesA} value={aLatest} />
        {seriesC ? <LegendItem config={seriesC} value={cLatest} /> : null}
        <LegendItem config={seriesB} value={bLatest} />
      </div>

      {error ? (
        <p style={{ color: "var(--down)", fontSize: "0.85rem", marginBottom: 8 }}>{error}</p>
      ) : null}

      <DualRatesChart
        key={`${range}:${seriesC?.seriesId ?? ""}`}
        range={range}
        hint={hint ?? `${range} · pan / zoom`}
        seriesA={{
          key: seriesA.seriesId,
          label: seriesA.label,
          points: aPoints,
          colorVar: seriesA.colorVar,
          colorFallback: seriesA.colorFallback,
          carry: seriesA.carry,
          lineWidth: seriesA.lineWidth,
        }}
        seriesB={{
          key: seriesB.seriesId,
          label: seriesB.label,
          points: bPoints,
          colorVar: seriesB.colorVar,
          colorFallback: seriesB.colorFallback,
          carry: seriesB.carry,
          lineWidth: seriesB.lineWidth,
        }}
        seriesC={
          seriesC
            ? {
                key: seriesC.seriesId,
                label: seriesC.label,
                points: cPoints,
                colorVar: seriesC.colorVar,
                colorFallback: seriesC.colorFallback,
                carry: seriesC.carry,
                lineWidth: seriesC.lineWidth,
              }
            : undefined
        }
      />
    </section>
  );
}
