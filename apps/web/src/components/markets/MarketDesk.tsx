"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { filterRange, type Point } from "@/lib/mm-analytics";
import type { SeriesLatest } from "@/lib/api";
import { MM_COLORS, RANGE_TABS, type ChartRange } from "@/components/mm/chartTheme";
import { MmLcChart } from "@/components/mm/MmLcChart";
import type { MarketDeskConfig } from "./marketDeskConfig";
import { priceFormatForUnit } from "./priceFormat";

const CHART_PALETTE = [
  MM_COLORS.call,
  MM_COLORS.repo,
  MM_COLORS.sdf,
  MM_COLORS.slf,
  MM_COLORS.tbill91,
  MM_COLORS.awfdr,
] as const;

function latest(points: Point[]): number | null {
  if (!points.length) return null;
  return points[points.length - 1]?.value ?? null;
}

function fmt(n: number | null, digits = 2, unit = "") {
  if (n == null || Number.isNaN(n)) return "—";
  const body = n.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return unit ? `${body} ${unit}` : body;
}

export type MarketDeskProps = {
  config: MarketDeskConfig;
  initialBundle: Record<string, Point[]>;
  meta: SeriesLatest[];
  initialRange?: ChartRange;
};

export function MarketDesk({
  config,
  initialBundle,
  meta,
  initialRange = "1Y",
}: MarketDeskProps) {
  const [bundle] = useState(initialBundle);
  const [range, setRange] = useState<ChartRange>(initialRange);
  const [viewId, setViewId] = useState(config.charts[0]?.id ?? "");

  const metaById = useMemo(() => {
    const m = new Map<string, SeriesLatest>();
    for (const row of meta) m.set(row.seriesId, row);
    return m;
  }, [meta]);

  const activeChart = config.charts.find((c) => c.id === viewId) ?? config.charts[0];

  const asOf = useMemo(() => {
    for (const h of config.hero) {
      const pts = bundle[h.seriesId];
      const p = pts?.at(-1)?.period;
      if (p) return p;
    }
    return null;
  }, [bundle, config.hero]);

  const chartSeries = useMemo(() => {
    if (!activeChart) return [];
    return activeChart.seriesIds.map((id, i) => {
      const pal = CHART_PALETTE[i % CHART_PALETTE.length]!;
      const row = metaById.get(id);
      return {
        key: id,
        label: row?.shortTitle ?? id.split(".").slice(-1)[0]!,
        kind: "line" as const,
        points: filterRange(bundle[id] ?? [], range),
        colorVar: pal.var,
        colorFallback: pal.fallback,
        priceFormat: priceFormatForUnit(row?.unit),
        priceScaleId:
          (activeChart.id === "indices" && i === 1) ||
          (activeChart.id === "wei-fx" && id === "sl.fx.usd.ytd_change_pct")
            ? ("left" as const)
            : ("right" as const),
      };
    });
  }, [activeChart, bundle, metaById, range]);

  return (
    <main className="mm-page market-desk">
      <div className="hero-eyebrow">Markets</div>
      <div className="mm-page-head">
        <div>
          <h1 className="section-title">{config.title}</h1>
          <p className="mm-page-sub">{config.blurb}</p>
        </div>
        <div className="mm-page-live">
          {config.hero.slice(0, 3).map((h) => {
            const unit = metaById.get(h.seriesId)?.unit ?? "";
            const value = latest(bundle[h.seriesId] ?? []);
            return (
              <Link key={h.seriesId} className="mm-metric" href={`/series/${h.seriesId}`}>
                <em>{h.label}</em>
                <strong>{fmt(value, h.digits ?? 2, h.showUnit === false ? "" : unit)}</strong>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="mm-board is-pulse">
        <p className="mm-board-asof">
          {asOf ? `As of ${asOf}` : "As of —"}
          <span className="ei-cadence"> · {config.cadence}</span>
        </p>

        <div className="mm-board-hero ei-hero">
          <div className="ei-prints" aria-label={`${config.title} latest prints`}>
            {config.hero.map((h) => {
              const row = metaById.get(h.seriesId);
              const value = latest(bundle[h.seriesId] ?? []);
              return (
                <Link key={h.seriesId} href={`/series/${h.seriesId}`} className="ei-print">
                  <em>{h.label}</em>
                  <strong>{fmt(value, h.digits ?? 2, row?.unit ?? "")}</strong>
                </Link>
              );
            })}
          </div>

          <aside className="mm-take">
            <p className="mm-take-kicker">Desk notes</p>
            <ol className="mm-take-list">
              <li>
                <span>Source</span>
                <p>CBSL indicator PDFs → Ops approve → live here.</p>
              </li>
              <li>
                <span>Verify</span>
                <p>
                  Daily is primary. Cross-check week-ending / month-end against WEI / MEI on the
                  same as-of date.
                </p>
              </li>
              <li>
                <span>Gaps</span>
                <p>Empty secondary T-bill cells and sparse weekly fields are normal.</p>
              </li>
            </ol>
            <p className="mm-take-hint">
              Open any print for full history ·{" "}
              <Link href="/ops" style={{ color: "inherit" }}>
                Ops checklist
              </Link>
            </p>
          </aside>
        </div>

        {activeChart ? (
          <section className="mm-board-context ei-context">
            <div className="mm-board-context-head">
              <div>
                <h2>{activeChart.title}</h2>
                <p>{activeChart.context}</p>
              </div>
              <div className="mm-range" role="tablist" aria-label="Chart range">
                {RANGE_TABS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    role="tab"
                    aria-selected={range === t}
                    className={`mm-range-btn${range === t ? " is-active" : ""}`}
                    onClick={() => setRange(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="mm-view-tabs" role="tablist" aria-label="Chart views">
              {config.charts.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="tab"
                  aria-selected={c.id === activeChart.id}
                  className={`mm-view-tab${c.id === activeChart.id ? " is-active" : ""}`}
                  onClick={() => setViewId(c.id)}
                >
                  {c.title}
                </button>
              ))}
            </div>

            <MmLcChart
              range={range}
              selectedRange={range}
              onRange={setRange}
              height={320}
              compact
              series={chartSeries}
              zeroLine={activeChart.zeroLine}
              info={{
                why: activeChart.context,
                what: "Verified CBSL observations (approved only on public charts).",
                how: "Compare levels across the selected range; open a series for full history.",
              }}
            />
          </section>
        ) : null}

        <section className="panel" style={{ marginTop: 20 }}>
          <div className="section-head">
            <h2 className="section-title" style={{ fontSize: "1.15rem" }}>
              Live series
            </h2>
            <p className="section-sub">{config.liveSeriesIds.length} series on this desk</p>
          </div>
          <div className="desk-series-grid">
            {config.liveSeriesIds.map((id) => {
              const row = metaById.get(id);
              const value = latest(bundle[id] ?? []);
              const period = bundle[id]?.at(-1)?.period;
              return (
                <Link key={id} href={`/series/${id}`} className="desk-series-card">
                  <em>{row?.shortTitle ?? id}</em>
                  <strong>{fmt(value, 2, row?.unit ?? "")}</strong>
                  <span>{period ?? "—"}</span>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="panel desk-roadmap" style={{ marginTop: 16 }}>
          <div className="section-head">
            <h2 className="section-title" style={{ fontSize: "1.05rem" }}>
              Coming next
            </h2>
            <p className="section-sub">Planned expansion — not scraped yet</p>
          </div>
          <ul className="desk-roadmap-list">
            {config.comingNext.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
