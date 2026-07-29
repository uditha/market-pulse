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

const DESK_GUIDE: Record<
  string,
  { plain: string; start: string }
> = {
  mm: {
    plain: "Overnight rates, corridor, and liquidity",
    start: "Where the day begins",
  },
  fx: {
    plain: "Rupee vs dollar and major currencies",
    start: "Watch the rupee",
  },
  fi: {
    plain: "Treasury bill yields from primary auctions",
    start: "Bills & yields",
  },
  share: {
    plain: "ASPI and equity market pulse",
    start: "Equities desk",
  },
  ei: {
    plain: "Inflation, growth, and CBSL indicators",
    start: "Macro picture",
  },
  esp: {
    plain: "Trade, reserves, and external balances",
    start: "External sector",
  },
};

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

function verbForMove(change: number | null, unit: string): string {
  if (change == null || change === 0) return "held steady";
  if (unit === "%") return change > 0 ? "edged higher" : "eased";
  return change > 0 ? "moved higher" : "moved lower";
}

function MiniSpark({
  values,
  wide = false,
}: {
  values: number[];
  wide?: boolean;
}) {
  const pts = values.slice(wide ? -48 : -16);
  if (pts.length < 2) return null;
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = max - min || 1;
  const w = wide ? 640 : 64;
  const h = wide ? 120 : 24;
  const path = pts
    .map((v, i) => {
      const x = (i / (pts.length - 1)) * w;
      const y = h - ((v - min) / span) * (h - 3) - 1.5;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const area = `${path} L${w},${h} L0,${h} Z`;
  const rising = pts[pts.length - 1] >= pts[0];
  const stroke = rising ? "var(--up)" : "var(--down)";

  return (
    <svg
      className={wide ? "ms-feature-spark" : "ms-spark"}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio={wide ? "none" : undefined}
      aria-hidden
    >
      {wide ? (
        <path d={area} fill={rising ? "var(--chart-fill-top)" : "rgba(194,59,50,0.12)"} />
      ) : null}
      <path
        d={path}
        fill="none"
        stroke={stroke}
        strokeWidth={wide ? 2.4 : 1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function buildStoryLine(markets: MorningMarketBoard[]): string | null {
  const candidates = markets
    .map((board) => {
      const ranked = board.metrics
        .filter((m) => m.change != null && m.change !== 0)
        .sort((a, b) => relativeMoveScore(b) - relativeMoveScore(a));
      const metric = ranked[0];
      if (!metric) return null;
      return { board, metric, score: relativeMoveScore(metric) };
    })
    .filter(
      (x): x is { board: MorningMarketBoard; metric: SeriesLatest; score: number } =>
        x != null,
    )
    .sort((a, b) => b.score - a.score);

  const top = candidates[0];
  if (!top) {
    const mm = markets.find((b) => b.id === "mm")?.metrics[0];
    if (mm?.value != null) {
      return `Call weighted average sits at ${formatMetricNumber(mm.value, mm.unit)}${unitSuffix(mm.unit) ? ` ${unitSuffix(mm.unit)}` : ""} — open Money Market for the full corridor read.`;
    }
    return null;
  }

  const { board, metric } = top;
  const value = formatMetricNumber(metric.value, metric.unit);
  const unit = unitSuffix(metric.unit);
  const delta = formatMoverDelta(metric);
  return `${board.title}: ${metric.shortTitle} ${verbForMove(metric.change, metric.unit)} to ${value}${unit ? ` ${unit}` : ""} (${delta}).`;
}

function FeaturedRead({
  markets,
}: {
  markets: MorningMarketBoard[];
}) {
  const feature = useMemo(() => {
    const mm = markets.find((b) => b.id === "mm");
    const hero = mm?.metrics[0];
    if (hero?.value != null) {
      return { board: mm!, metric: hero, kicker: "Lead print · Money Market" };
    }
    for (const board of markets) {
      if (board.metrics[0]?.value != null) {
        return {
          board,
          metric: board.metrics[0],
          kicker: `Lead print · ${board.title}`,
        };
      }
    }
    return null;
  }, [markets]);

  if (!feature) return null;
  const { board, metric, kicker } = feature;
  const tone = toneClass(metric.change);

  return (
    <Link
      href={`/series/${encodeURIComponent(metric.seriesId)}`}
      className={`ms-feature tone-${tone}`}
    >
      <div className="ms-feature-bg" aria-hidden>
        <MiniSpark values={metric.sparkline} wide />
      </div>
      <div className="ms-feature-copy">
        <span className="ms-feature-kicker">{kicker}</span>
        <span className="ms-feature-name">{metric.shortTitle}</span>
        <span className="ms-feature-value">
          {formatMetricNumber(metric.value, metric.unit)}
          {metric.value != null && unitSuffix(metric.unit) ? (
            <span className="ms-metric-unit">{unitSuffix(metric.unit)}</span>
          ) : null}
        </span>
        <span className={`ms-feature-meta delta ${tone}`}>
          {formatMoverDelta(metric)}
          {metric.asOf ? <span className="ms-metric-asof"> · {metric.asOf}</span> : null}
          <span className="ms-feature-desk"> · {board.title}</span>
        </span>
      </div>
    </Link>
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
  const guide = DESK_GUIDE[board.id];

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
          {guide ? <p className="ms-board-plain">{guide.plain}</p> : null}
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
            <div className="ms-pulse-head">
              <span className="ms-pulse-market">{board.label}</span>
              <span className={`delta ${tone}`}>{formatDelta(metric.change)}</span>
            </div>
            <span className="ms-pulse-label">{metric.shortTitle}</span>
            <strong className="ms-pulse-value">
              {formatMetricNumber(metric.value, metric.unit)}
              {metric.value != null && unitSuffix(metric.unit) ? (
                <span className="ms-metric-unit">{unitSuffix(metric.unit)}</span>
              ) : null}
            </strong>
            <MiniSpark values={metric.sparkline} />
          </Link>
        );
      })}
    </section>
  );
}

function DeskPath({ markets }: { markets: MorningMarketBoard[] }) {
  const desks =
    markets.length > 0
      ? markets
      : Object.entries(DESK_GUIDE).map(([id, g]) => ({
          id,
          label: id.toUpperCase(),
          title:
            id === "mm"
              ? "Money Market"
              : id === "fx"
                ? "Forex"
                : id === "fi"
                  ? "Fixed Income"
                  : id === "share"
                    ? "Shares"
                    : id === "ei"
                      ? "Economic Indicators"
                      : "External Sector",
          path: id,
          blurb: g.plain,
          metrics: [] as SeriesLatest[],
        }));

  return (
    <section className="ms-path" aria-label="Where to start">
      <div className="section-head">
        <h2 className="section-title">Choose your desk</h2>
        <p className="section-sub">One market at a time — plain English</p>
      </div>
      <div className="ms-path-row">
        {desks.map((board, i) => {
          const guide = DESK_GUIDE[board.id];
          return (
            <Link
              key={board.id}
              href={`/markets/${board.path}`}
              className="ms-path-step"
              style={{ animationDelay: `${50 + i * 45}ms` }}
            >
              <span className="ms-path-index">{String(i + 1).padStart(2, "0")}</span>
              <span className="ms-path-title">{board.title}</span>
              <span className="ms-path-plain">
                {guide?.plain ?? board.blurb}
              </span>
              <span className="ms-path-cta">{guide?.start ?? "Open desk"} →</span>
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

  const storyLine = useMemo(() => buildStoryLine(markets), [markets]);
  const hasData = markets.some((b) => b.metrics.some((m) => m.value != null));

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
    <div className="morning-home story-home">
      <section className="ms-story-hero" aria-labelledby="ms-brand">
        <div className="ms-story-copy">
          <p className="hero-eyebrow">
            Sri Lanka · Verified CBSL · {editionDate}
          </p>
          <div className="ms-hero-title-row">
            <h1 id="ms-brand">MarketPulse</h1>
            {lastUpdated ? (
              <p className="hero-updated">
                Updated {formatUtcStamp(lastUpdated)}
              </p>
            ) : null}
          </div>
          <p className="ms-story-headline">
            The morning market brief, told in order.
          </p>
          <p className="ms-story-support">
            Rates, the rupee, bills, shares, and macro — verified prints, not
            noise. Start with Money Market, then walk the desks.
          </p>
          <div className="ms-story-ctas">
            <Link href="/markets/mm" className="btn btn-primary">
              Start with Money Market
            </Link>
            <a href="#todays-pulse" className="btn btn-ghost">
              See today&apos;s pulse
            </a>
          </div>
          {storyLine ? (
            <p className="ms-story-line" role="status">
              <span className="ms-story-line-label">Today&apos;s read</span>
              {storyLine}
            </p>
          ) : null}
        </div>
        <FeaturedRead markets={markets} />
      </section>

      <section id="todays-pulse" className="ms-act">
        <div className="section-head">
          <h2 className="section-title">Today across desks</h2>
          <p className="section-sub">One print per market — then go deeper</p>
        </div>
        {hasData ? (
          <PulseStrip markets={markets} />
        ) : (
          <div className="ms-empty">
            <p>
              Morning boards load from verified CBSL prints. When data is ready,
              you&apos;ll see the cross-market pulse here.
            </p>
            <div className="ms-story-ctas">
              <Link href="/markets/mm" className="btn btn-primary">
                Open Money Market
              </Link>
              <Link href="/news" className="btn btn-ghost">
                Read market news
              </Link>
            </div>
          </div>
        )}
      </section>

      <DeskPath markets={markets} />

      <section className="ms-act ms-search-act">
        <div className="section-head">
          <h2 className="section-title">Find a series</h2>
          <p className="section-sub">Call rate, USD, 91d, ASPI, CPI…</p>
        </div>
        <div className="search-box">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search any series…"
            aria-label="Search series"
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

      <div className="ms-desk">
        <section className="morning-markets">
          <div className="section-head">
            <h2 className="section-title">Full briefing</h2>
            <p className="section-sub">Six desks · open the day</p>
          </div>
          {hasData ? (
            <div className="ms-grid">
              {markets.map((board, i) => (
                <MarketBoard key={board.id} board={board} index={i} />
              ))}
            </div>
          ) : (
            <div className="ms-empty">
              <p>
                The full desk grid appears once today&apos;s prints are approved.
                Money Market Overview is ready anytime.
              </p>
              <Link href="/markets/mm" className="btn btn-primary">
                Go to Money Market
              </Link>
            </div>
          )}
        </section>

        <aside className="ms-news-col">
          {news && news.items?.length ? (
            <MarketNewsStrip edition={news} variant="desk" />
          ) : (
            <section className="market-news market-news-desk">
              <div className="section-head">
                <h2 className="section-title">Market news</h2>
                <p className="section-sub">
                  <Link href="/news" className="inline-link">
                    Open news desk
                  </Link>
                </p>
              </div>
              <div className="ms-empty ms-empty-tight">
                <p>Today&apos;s edition will land here after the news scrape.</p>
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
