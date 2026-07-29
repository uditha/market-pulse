"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  api,
  type SeriesLatest,
  type NewsEdition,
  type MorningMarketBoard,
} from "@/lib/api";
import { MarketNewsStrip } from "./MarketNewsStrip";
import { formatUtcStamp } from "@/lib/format";

function formatMetricNumber(value: number | null, unit: string): string {
  if (value == null || Number.isNaN(value)) return "—";
  const abs = Math.abs(value);
  if (unit === "%") return value.toFixed(2);
  if (abs >= 1000) {
    return value.toLocaleString("en-US", {
      maximumFractionDigits: abs >= 10000 ? 0 : 1,
    });
  }
  if (abs >= 100) return value.toFixed(1);
  return value.toFixed(2);
}

function unitSuffix(unit: string): string {
  if (!unit || unit === "index") return "";
  if (unit === "pts") return "pts";
  return unit;
}

function formatDelta(change: number | null): string {
  if (change == null) return "flat";
  const abs = Math.abs(change);
  const digits = abs >= 10 ? 1 : 2;
  return `${change > 0 ? "+" : ""}${change.toFixed(digits)}`;
}

function toneClass(change: number | null): "up" | "down" | "flat" {
  if (change == null || change === 0) return "flat";
  return change > 0 ? "up" : "down";
}

function MiniSpark({ values }: { values: number[] }) {
  const pts = values.slice(-16);
  if (pts.length < 2) return null;
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = max - min || 1;
  const w = 64;
  const h = 24;
  const path = pts
    .map((v, i) => {
      const x = (i / (pts.length - 1)) * w;
      const y = h - ((v - min) / span) * (h - 3) - 1.5;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const rising = pts[pts.length - 1] >= pts[0];

  return (
    <svg className="ms-spark" viewBox={`0 0 ${w} ${h}`} aria-hidden>
      <path
        d={path}
        fill="none"
        stroke={rising ? "var(--up)" : "var(--down)"}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MarketBoard({
  board,
  index,
}: {
  board: MorningMarketBoard;
  index: number;
}) {
  const [hero, ...rest] = board.metrics;
  const tone = toneClass(hero?.change ?? null);

  return (
    <article
      className={`ms-board tone-${tone}`}
      style={{ animationDelay: `${70 + index * 40}ms` }}
    >
      <header className="ms-board-head">
        <div>
          <span className="ms-board-label">{board.label}</span>
          <h3 className="ms-board-title">
            <Link href={`/markets/${board.path}`}>{board.title}</Link>
          </h3>
        </div>
        <Link href={`/markets/${board.path}`} className="ms-board-link">
          Open
        </Link>
      </header>

      {hero ? (
        <Link
          href={`/series/${encodeURIComponent(hero.seriesId)}`}
          className="ms-hero"
        >
          <div className="ms-hero-top">
            <span className="ms-metric-label">{hero.shortTitle}</span>
            <MiniSpark values={hero.sparkline} />
          </div>
          <div className="ms-hero-value">
            {formatMetricNumber(hero.value, hero.unit)}
            {hero.value != null && unitSuffix(hero.unit) ? (
              <span className="ms-metric-unit">{unitSuffix(hero.unit)}</span>
            ) : null}
          </div>
          <div className={`ms-hero-meta delta ${tone}`}>
            <span>{formatDelta(hero.change)}</span>
            {hero.asOf ? <span className="ms-metric-asof">{hero.asOf}</span> : null}
          </div>
        </Link>
      ) : null}

      {rest.length > 0 ? (
        <ul className="ms-secondaries">
          {rest.map((m) => {
            const t = toneClass(m.change);
            return (
              <li key={m.seriesId}>
                <Link
                  href={`/series/${encodeURIComponent(m.seriesId)}`}
                  className="ms-secondary"
                >
                  <span className="ms-secondary-label">{m.shortTitle}</span>
                  <strong>
                    {formatMetricNumber(m.value, m.unit)}
                    {m.value != null && unitSuffix(m.unit) ? (
                      <span className="ms-metric-unit">{unitSuffix(m.unit)}</span>
                    ) : null}
                  </strong>
                  <span className={`delta ${t}`}>{formatDelta(m.change)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </article>
  );
}

function PulseStrip({ markets }: { markets: MorningMarketBoard[] }) {
  const pulse = markets
    .map((b) => ({ board: b, metric: b.metrics[0] }))
    .filter((x): x is { board: MorningMarketBoard; metric: SeriesLatest } =>
      Boolean(x.metric),
    );

  if (!pulse.length) return null;

  return (
    <section className="ms-pulse" aria-label="Cross-market pulse">
      {pulse.map(({ board, metric }, i) => {
        const tone = toneClass(metric.change);
        return (
          <Link
            key={board.id}
            href={`/series/${encodeURIComponent(metric.seriesId)}`}
            className={`ms-pulse-cell tone-${tone}`}
            style={{ animationDelay: `${40 + i * 35}ms` }}
          >
            <span className="ms-pulse-market">{board.label}</span>
            <span className="ms-pulse-label">{metric.shortTitle}</span>
            <strong className="ms-pulse-value">
              {formatMetricNumber(metric.value, metric.unit)}
              {metric.value != null && unitSuffix(metric.unit) ? (
                <span className="ms-metric-unit">{unitSuffix(metric.unit)}</span>
              ) : null}
            </strong>
            <span className={`delta ${tone}`}>{formatDelta(metric.change)}</span>
            <MiniSpark values={metric.sparkline} />
          </Link>
        );
      })}
    </section>
  );
}

function relativeMoveScore(m: SeriesLatest): number {
  if (m.change == null) return 0;
  const prev = m.previousValue;
  if (prev != null && Math.abs(prev) > 1e-9) {
    return Math.abs(m.change / prev);
  }
  return Math.abs(m.change);
}

function formatMoverDelta(m: SeriesLatest): string {
  if (m.change == null) return "flat";
  const prev = m.previousValue;
  // Levels (counts, Rs.mn, indices) → show % so units don't dominate.
  if (
    prev != null &&
    Math.abs(prev) > 1e-9 &&
    m.unit !== "%" &&
    Math.abs(prev) >= 50
  ) {
    const pct = (m.change / prev) * 100;
    return `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`;
  }
  return formatDelta(m.change);
}

/** One standout print per desk — keeps movers aligned with markets. */
function MoversRow({ markets }: { markets: MorningMarketBoard[] }) {
  const movers = useMemo(() => {
    return markets
      .map((board) => {
        const ranked = board.metrics
          .filter((m) => m.change != null && m.change !== 0)
          .sort((a, b) => relativeMoveScore(b) - relativeMoveScore(a));
        const metric = ranked[0] ?? board.metrics[0];
        if (!metric) return null;
        return { board, metric };
      })
      .filter(
        (x): x is { board: MorningMarketBoard; metric: SeriesLatest } =>
          x != null,
      );
  }, [markets]);

  if (!movers.length) return null;

  return (
    <section className="ms-movers" aria-label="Desk movers">
      <div className="ms-movers-label">Movers</div>
      <div className="ms-movers-row">
        {movers.map(({ board, metric }, i) => {
          const tone = toneClass(metric.change);
          return (
            <Link
              key={board.id}
              href={`/series/${encodeURIComponent(metric.seriesId)}`}
              className={`ms-mover tone-${tone}`}
              style={{ animationDelay: `${30 + i * 30}ms` }}
            >
              <span className="ms-mover-desk">{board.label}</span>
              <span className="ms-mover-name">{metric.shortTitle}</span>
              <span className={`ms-mover-delta delta ${tone}`}>
                {formatMoverDelta(metric)}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export function SearchHome({
  markets = [],
  news = null,
}: {
  markets?: MorningMarketBoard[];
  news?: NewsEdition | null;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SeriesLatest[]>([]);

  const stamps = [
    ...markets.flatMap((b) => b.metrics.map((m) => m.lastUpdated)),
    news?.createdAt,
  ]
    .filter(Boolean)
    .sort() as string[];
  const lastUpdated = stamps.at(-1);

  const editionDate =
    news?.editionDate ?? new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      api.search(q).then(setResults).catch(() => setResults([]));
    }, 150);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="morning-home">
      <section className="hero-search ms-hero-block">
        <div className="hero-eyebrow">
          Sri Lanka · Morning summary · {editionDate}
        </div>
        <div className="ms-hero-title-row">
          <h1>MarketPulse</h1>
          {lastUpdated ? (
            <p className="hero-updated">
              Updated {formatUtcStamp(lastUpdated)}
            </p>
          ) : null}
        </div>
        <p>
          Desk briefing — rates, FX, bills, equities, macro and external prints
          with today&apos;s news.
        </p>
        <MoversRow markets={markets} />
        <div className="search-box">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search call rate, USD, 91d, ASPI, CPI…"
            onKeyDown={(e) => {
              if (e.key === "Enter" && results[0]) {
                router.push(
                  `/series/${encodeURIComponent(results[0].seriesId)}`,
                );
              }
            }}
          />
          <span className="kbd">⌘K</span>
        </div>
        {!!results.length && (
          <div className="panel search-results">
            {results.slice(0, 6).map((r) => (
              <button
                key={r.seriesId}
                className="search-hit"
                onClick={() =>
                  router.push(`/series/${encodeURIComponent(r.seriesId)}`)
                }
              >
                <span>
                  <strong>{r.shortTitle}</strong>
                  <div
                    style={{
                      color: "var(--muted)",
                      fontSize: "0.82rem",
                      marginTop: 2,
                    }}
                  >
                    {r.title}
                  </div>
                </span>
                <span className="hit-value">
                  {r.value != null
                    ? `${formatMetricNumber(r.value, r.unit)}${unitSuffix(r.unit)}`
                    : "—"}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      <PulseStrip markets={markets} />

      <div className="ms-desk">
        <section className="morning-markets">
          <div className="section-head">
            <h2 className="section-title">Markets</h2>
            <p className="section-sub">Six desks · open the day</p>
          </div>
          <div className="ms-grid">
            {markets.map((board, i) => (
              <MarketBoard key={board.id} board={board} index={i} />
            ))}
          </div>
        </section>

        <aside className="ms-news-col">
          <MarketNewsStrip edition={news} variant="desk" />
        </aside>
      </div>
    </div>
  );
}
