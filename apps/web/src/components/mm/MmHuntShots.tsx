"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { latestValue, type Point } from "@/lib/mm-analytics";
import type { SeriesLatest } from "@/lib/api";
import { MmLcChart, type LcSeriesSpec } from "./MmLcChart";
import { MmChartInfo } from "./MmChartInfo";
import {
  MmBoxPlots,
  MmGantt,
  MmHeatmap,
  MmLagBars,
  MmScatter,
  eventStudyToPoints,
} from "./MmSvgCharts";
import { MM_COLORS, type ChartRange } from "./chartTheme";
import {
  emptySeries,
  thinSeries,
  type HuntLevel,
  type HuntShotId,
  type HuntShotMeta,
} from "./mmHunt";
import { useMmStageHeight } from "./mmStage";

export function fmt(v: number | null | undefined, digits = 2, suffix = "%") {
  if (v == null || Number.isNaN(v)) return "—";
  return `${v.toFixed(digits)}${suffix}`;
}

/** Shape of derived analytics from MmAnalyticsDashboard */
export type MmDerived = {
  opr: Point[];
  oprMax: Point[];
  sdf: Point[];
  slf: Point[];
  srr: Point[];
  call: Point[];
  callVol: Point[];
  repo: Point[];
  repoVol: Point[];
  callSpread: Point[];
  callRepoSpread: Point[];
  callCandles: {
    period: string;
    open: number;
    high: number;
    low: number;
    close: number;
  }[];
  repoShare: Point[];
  totalVol: Point[];
  liq: Point[];
  liqSpreadScatter: { x: number; y: number; period: string }[];
  sdfVol: Point[];
  slfVolNeg: Point[];
  facilityNet: Point[];
  bidToOffer: Point[];
  acceptance: Point[];
  omoWa: Point[];
  holdings: Point[];
  holdingsMom: Point[];
  t91: Point[];
  t182: Point[];
  t364: Point[];
  curveSlope: Point[];
  tbillPolicy: Point[];
  awpr: Point[];
  awlr: Point[];
  awdr: Point[];
  awfdr: Point[];
  awsr: Point[];
  awlrAwdr: Point[];
  awprTbill: Point[];
  awsrAwpr: Point[];
  awfdrAwdr: Point[];
  idxOpr: Point[];
  idxCall: Point[];
  idxT364: Point[];
  idxAwpr: Point[];
  idxAwlr: Point[];
  beta: Point[];
  xcorr: { lag: number; corr: number }[];
  collapseDate: string | null;
  events: { period: string; delta: number }[];
  passThroughBase: string;
  termScatter: {
    x: number;
    y: number;
    size: number;
    period: string;
    side: "repo" | "reverse_repo";
  }[];
  ganttBars: {
    id: string;
    label: string;
    start: string;
    end: string;
    amount: number;
    side: "repo" | "reverse_repo";
  }[];
  esCall: { offset: number; mean: number; n: number }[];
  esT91: { offset: number; mean: number; n: number }[];
  esAwpr: { offset: number; mean: number; n: number }[];
  regimeValues: { corridor: number[]; single: number[] };
  corr: { keys: string[]; matrix: (number | null)[][] };
};

type ShotCtx = {
  derived: MmDerived;
  range: ChartRange;
  onRange: (r: ChartRange) => void;
  busy: boolean;
  bundle: Record<string, Point[]>;
  byId: Map<string, SeriesLatest>;
};

function Legend({
  items,
}: {
  items: { label: string; value?: string | null; color?: string; href?: string }[];
}) {
  return (
    <div className="corridor-legend mm-desk-legend" aria-label="Series legend">
      {items.map((item) => {
        const inner = (
          <>
            {item.color ? (
              <span
                className="corridor-swatch"
                style={{
                  background: item.color,
                  boxShadow: `0 0 0 3px color-mix(in srgb, ${item.color} 22%, transparent)`,
                }}
              />
            ) : null}
            <span className="corridor-legend-label">{item.label}</span>
            {item.value != null ? (
              <strong className="corridor-legend-value">{item.value}</strong>
            ) : null}
          </>
        );
        return item.href ? (
          <Link key={item.label} href={item.href} className="corridor-legend-item">
            {inner}
          </Link>
        ) : (
          <span key={item.label} className="corridor-legend-item">
            {inner}
          </span>
        );
      })}
    </div>
  );
}

function tbillAwaiting(d: MmDerived) {
  return emptySeries(d.t91) || thinSeries(d.t91) || thinSeries(d.t364);
}

export function buildShotCatalog(derived: MmDerived): HuntShotMeta[] {
  const tbillSoon = tbillAwaiting(derived);
  return [
    {
      id: "corridor",
      level: "pulse",
      rail: "Corridor",
      title: "Policy corridor",
      context: "Read Call inside the policy band.",
      guide: {
        why: "Shows whether overnight funding is easy, tight, or stressed versus CBSL’s stance.",
        what: "Shaded band = SDF floor to SLF ceiling. Steps = OPR. White line = Call WA.",
        how: "Call near SDF → surplus. Mid-band → balanced. Near SLF → scarcity or stress.",
      },
    },
    {
      id: "call-spread",
      level: "pulse",
      rail: "Call−policy",
      title: "Call spread to policy",
      context: "Positive = Call above policy. Near zero on the floor = surplus.",
      guide: {
        why: "Compresses the corridor story into one number: pressure on overnight rates.",
        what: "Call WA minus OPR (or SDF when OPR is missing on the day).",
        how: "Near 0 or negative → floor/surplus. Rising sharply → tightening or stress.",
      },
    },
    {
      id: "call-range",
      level: "pulse",
      rail: "Call range",
      title: "Call market range",
      context: "Daily min–max — stress hides in the WA line.",
      guide: {
        why: "A quiet WA can hide a wide, segmented market.",
        what: "Each bar is the day’s Call min–max; marker is the weighted average.",
        how: "Wide bars → dispersion/stress. Narrow bars → a tight, orderly overnight market.",
      },
    },
    {
      id: "volumes",
      level: "pulse",
      rail: "Volumes",
      title: "Volume composition",
      context: "Thin volumes with Call on the floor usually mean surplus.",
      guide: {
        why: "Rates without turnover can mislead — surplus often kills volumes.",
        what: "Call and repo volumes, plus repo’s share of total overnight turnover.",
        how: "Falling volumes with Call on the floor → surplus. Spiking volumes with rising Call → stress.",
      },
    },
    {
      id: "overnight-liq",
      level: "mid",
      rail: "Liquidity",
      title: "Overnight liquidity",
      context: "Surplus/deficit explains why Call hugs the floor or ceiling.",
      guide: {
        why: "Liquidity is the usual driver of Call’s place in the corridor.",
        what: "Bars = overnight surplus/deficit. Line = Call−policy spread.",
        how: "Large surplus + flat spread → floor effect. Deficit + rising spread → funding pressure.",
      },
    },
    {
      id: "omo",
      level: "mid",
      rail: "OMO",
      title: "OMO diagnostics",
      context: "How hard CBSL is sterilising or injecting cash.",
      guide: {
        why: "Open-market ops show how actively CBSL is managing the surplus/deficit.",
        what: "Bid-to-offer, acceptance ratio, and OMO WA versus OPR.",
        how: "High bid-to-offer → strong demand for the operation. OMO WA vs OPR → pricing of that liquidity.",
      },
    },
    {
      id: "standing-facilities",
      level: "mid",
      rail: "Facilities",
      title: "Standing facilities",
      context: "SDF vs SLF use — which side banks are on.",
      guide: {
        why: "Facility use reveals the side of the market banks choose when the corridor bites.",
        what: "SDF volume (deposit), SLF volume (borrow, shown negative), and net.",
        how: "Heavy SDF → parking surplus. Heavy SLF → borrowing at the ceiling.",
      },
    },
    {
      id: "transmission-chain",
      level: "mid",
      rail: "Transmission",
      title: "Transmission chain",
      context: "How far a policy move has reached Call, AWPR, and AWLR.",
      guide: {
        why: "Policy only matters if it reaches bank lending and deposit rates.",
        what: "OPR → Call → T-bills → AWPR → AWLR on one timeline.",
        how: "After a cut, watch which lines fall and which lag — that is pass-through speed.",
      },
    },
    {
      id: "banking-spreads",
      level: "mid",
      rail: "Bank spreads",
      title: "Banking spreads",
      context: "Lending–deposit gap and credit premium.",
      guide: {
        why: "Bank spreads show how policy and credit risk show up in customer rates.",
        what: "AWLR−AWDR (NIM proxy), AWPR−364d, AWSR−AWPR, deposit-speed spreads.",
        how: "Widening AWLR−AWDR → fatter bank margin. Rising AWSR−AWPR → SME penalty up.",
      },
    },
    {
      id: "tbill-curve",
      level: "mid",
      rail: "T-bills",
      title: "Treasury bill curve",
      context: "Awaiting data backfill.",
      awaitingData: tbillSoon,
      guide: {
        why: "T-bills bridge policy rates and fiscal funding costs.",
        what: "91d, 182d, and 364d auction yields.",
        how: "Steepening often flags supply pressure; a rising 91d−OPR gap is fiscal, not only monetary.",
      },
    },
    {
      id: "event-study",
      level: "rare",
      rail: "Event study",
      title: "Event study",
      context: "Average market path around OPR changes.",
      guide: {
        why: "Shows the typical market reaction path when CBSL moves OPR.",
        what: "Average Call, 91d, and AWPR around policy events (±60 observations).",
        how: "t=0 is the change day. Lines above/below zero are average moves relative to that day.",
      },
    },
    {
      id: "regime-boxes",
      level: "rare",
      rail: "Regimes",
      title: "Regime boxes",
      context: "Call−policy before vs after the single-OPR regime.",
      guide: {
        why: "The corridor collapse changed how overnight rates behave.",
        what: "Distribution of Call−policy in corridor era vs single-OPR era.",
        how: "Compare medians and whiskers — a tighter box means a more stable overnight spread.",
      },
    },
    {
      id: "rolling-beta",
      level: "rare",
      rail: "β",
      title: "Rolling β",
      context: "Share of OPR moves that reach AWPR.",
      guide: {
        why: "Measures transmission efficiency into prime lending.",
        what: "Rolling β of ΔAWPR on ΔOPR (≈12 observations).",
        how: "β near 1 → AWPR tracks OPR. Falling β → pass-through is weakening.",
      },
    },
    {
      id: "corr-heatmap",
      level: "rare",
      rail: "Corr",
      title: "Correlations",
      context: "Which rates move together day to day.",
      guide: {
        why: "Co-movement shows which markets still price as one system.",
        what: "Pairwise correlation of period-to-period changes (not levels).",
        how: "Warm cells → move together. Cool cells → decoupled — dig into those pairs.",
      },
    },
    /* Kept for render / future strip expansion */
    {
      id: "srr",
      level: "pulse",
      rail: "SRR",
      title: "SRR steps",
      context: "Reserve-ratio shocks vs liquidity.",
      inStrip: false,
    },
    {
      id: "call-repo",
      level: "pulse",
      rail: "Call−Repo",
      title: "Call vs Repo",
      context: "Unsecured − secured premium.",
      inStrip: false,
    },
    {
      id: "floor-scatter",
      level: "mid",
      rail: "Floor",
      title: "Floor scatter",
      context: "Liquidity vs spread cloud.",
      inStrip: false,
    },
    {
      id: "term-gantt",
      level: "mid",
      rail: "Term",
      title: "Term ladder",
      context: "Maturity book.",
      inStrip: false,
    },
    {
      id: "term-scatter",
      level: "mid",
      rail: "Term ¥",
      title: "Term scatter",
      context: "Tenure vs yield.",
      inStrip: false,
    },
    {
      id: "holdings",
      level: "mid",
      rail: "Holdings",
      title: "CBSL holdings",
      context: "Monetisation gauge.",
      inStrip: false,
    },
    {
      id: "rate-ladder",
      level: "mid",
      rail: "Ladder",
      title: "Rate ladder",
      context: "Latest levels.",
      inStrip: false,
    },
    {
      id: "tbill-slope",
      level: "mid",
      rail: "Slope",
      title: "Curve slope",
      context: "364−91.",
      awaitingData: tbillSoon,
      inStrip: false,
    },
    {
      id: "tbill-policy",
      level: "mid",
      rail: "91d−OPR",
      title: "T-bill vs policy",
      context: "Fiscal supply gap.",
      awaitingData: tbillSoon,
      inStrip: false,
    },
    {
      id: "lag-response",
      level: "rare",
      rail: "Lags",
      title: "Lag response",
      context: "Pass-through speed.",
      inStrip: false,
    },
    {
      id: "pass-through",
      level: "rare",
      rail: "Pass-through",
      title: "Cumulative pass-through",
      context: "Indexed from last cut.",
      inStrip: false,
    },
  ];
}

export function shotsForLevel(catalog: HuntShotMeta[], level: HuntLevel) {
  return catalog.filter(
    (s) => s.level === level && s.inStrip !== false && !s.awaitingData,
  );
}

export function HuntShotView({ id, ctx }: { id: HuntShotId; ctx: ShotCtx }) {
  const stageH = useMmStageHeight();
  /** SVG charts can't flex-fill — leave a little pad for chrome */
  const chartH = Math.max(180, stageH - 8);
  const { derived: d, range, busy, bundle } = ctx;
  const meta = buildShotCatalog(d).find((s) => s.id === id);

  return (
    <div className="mm-shot-body">
      {meta?.guide ? <MmChartInfo guide={meta.guide} title={meta.title} /> : null}
      {renderShot(id, { d, range, busy, bundle, chartH })}
    </div>
  );
}

/** @deprecated use HuntShotView */
export function renderHuntShot(id: HuntShotId, ctx: ShotCtx): ReactNode {
  return <HuntShotView id={id} ctx={ctx} />;
}

function renderShot(
  id: HuntShotId,
  {
    d,
    range,
    busy,
    bundle,
    chartH,
  }: {
    d: MmDerived;
    range: ChartRange;
    busy: boolean;
    bundle: Record<string, Point[]>;
    chartH: number;
  },
): ReactNode {
  switch (id) {
    case "corridor":
      return (
        <>
          <Legend
            items={[
              { label: "SLF", value: fmt(latestValue(d.slf)), color: MM_COLORS.slf.fallback, href: "/series/sl.mm.slf.rate" },
              { label: "OPR", value: fmt(latestValue(d.opr)), color: MM_COLORS.opr.fallback, href: "/series/sl.mm.opr" },
              { label: "SDF", value: fmt(latestValue(d.sdf)), color: MM_COLORS.sdf.fallback, href: "/series/sl.mm.sdf.rate" },
              { label: "Call WA", value: fmt(latestValue(d.call)), color: MM_COLORS.call.fallback, href: "/series/sl.mm.call.wa_yield" },
            ]}
          />
          {d.collapseDate ? (
            <div className="mm-annotation" style={{ marginBottom: 10 }}>
              Corridor collapses toward a single OPR from <strong>{d.collapseDate}</strong>.
            </div>
          ) : null}
          <MmLcChart
            legend={false}
            range={range}
            fill
            compact
            carryKeys={["opr"]}
            hint={`${range} · band = SDF→SLF · pan / zoom`}
            series={[
              {
                key: "slf-band",
                label: "SLF",
                kind: "area",
                points: d.slf,
                colorVar: MM_COLORS.slf.var,
                colorFallback: MM_COLORS.slf.fallback,
                topColor: "rgba(184,107,42,0.20)",
                bottomColor: "rgba(184,107,42,0.04)",
                lineWidth: 1,
                lastValueVisible: false,
              },
              {
                key: "sdf-mask",
                label: "SDF",
                kind: "area",
                points: d.sdf,
                colorVar: MM_COLORS.sdf.var,
                colorFallback: MM_COLORS.sdf.fallback,
                topColor: "var(--panel-solid)",
                bottomColor: "var(--panel-solid)",
                lineWidth: 1,
                lastValueVisible: false,
              },
              {
                key: "opr",
                label: "OPR",
                kind: "step",
                points: d.oprMax,
                colorVar: MM_COLORS.opr.var,
                colorFallback: MM_COLORS.opr.fallback,
                lineWidth: 3,
              },
              {
                key: "sdf",
                label: "SDF",
                kind: "step",
                points: d.sdf,
                colorVar: MM_COLORS.sdf.var,
                colorFallback: MM_COLORS.sdf.fallback,
                lineWidth: 2,
              },
              {
                key: "slf",
                label: "SLF",
                kind: "step",
                points: d.slf,
                colorVar: MM_COLORS.slf.var,
                colorFallback: MM_COLORS.slf.fallback,
                lineWidth: 2,
              },
              {
                key: "call",
                label: "Call WA",
                kind: "line",
                points: d.call,
                colorVar: MM_COLORS.call.var,
                colorFallback: MM_COLORS.call.fallback,
                lineWidth: 2,
              },
            ] satisfies LcSeriesSpec[]}
          />
        </>
      );

    case "call-spread":
      return (
        <>
          <Legend items={[{ label: "Spread", value: fmt(latestValue(d.callSpread), 2, " pp") }]} />
          <MmLcChart
            legend={false}
            range={range}
            fill
            compact
            zeroLine
            series={[
              {
                key: "spread",
                label: "Call−policy",
                kind: "histogram",
                points: d.callSpread,
                priceFormat: "percent",
              },
            ]}
          />
        </>
      );

    case "srr":
      return (
        <>
          <Legend
            items={[
              { label: "SRR", value: fmt(latestValue(d.srr)), href: "/series/sl.mm.srr" },
              {
                label: "O/N Liq",
                value: fmt(latestValue(d.liq), 1, " bn"),
                href: "/series/sl.mm.overnight_liquidity",
              },
            ]}
          />
          <MmLcChart
            legend={false}
            range={range}
            fill
            compact
            carryKeys={["srr"]}
            series={[
              {
                key: "liq",
                label: "O/N Liq",
                kind: "histogram",
                points: d.liq,
                priceScaleId: "left",
                priceFormat: "number",
              },
              {
                key: "srr",
                label: "SRR",
                kind: "step",
                points: bundle["sl.mm.srr"] ?? [],
                colorVar: MM_COLORS.opr.var,
                colorFallback: MM_COLORS.opr.fallback,
                lineWidth: 3,
                priceFormat: "percent",
              },
            ]}
          />
        </>
      );

    case "call-range":
      return (
        <>
          <Legend
            items={[
              {
                label: "Call WA",
                value: fmt(latestValue(d.call)),
                href: "/series/sl.mm.call.wa_yield",
              },
            ]}
          />
          <MmLcChart
            legend={false}
            range={range}
            fill
            compact
            series={[
              {
                key: "call-range",
                label: "Call range",
                kind: "candle",
                candles: d.callCandles,
                colorVar: MM_COLORS.opr.var,
                colorFallback: MM_COLORS.opr.fallback,
              },
            ]}
          />
        </>
      );

    case "call-repo":
      return (
        <>
          <Legend
            items={[{ label: "Spread", value: fmt(latestValue(d.callRepoSpread), 2, " pp") }]}
          />
          <MmLcChart
            legend={false}
            range={range}
            fill
            compact
            zeroLine
            series={[
              {
                key: "cr",
                label: "Call−Repo",
                kind: "baseline",
                points: d.callRepoSpread,
              },
            ]}
          />
        </>
      );

    case "volumes":
      return (
        <>
          <Legend
            items={[
              {
                label: "Call Vol",
                value: fmt(latestValue(d.callVol), 1, " bn"),
                href: "/series/sl.mm.call.volume",
              },
              {
                label: "Repo Vol",
                value: fmt(latestValue(d.repoVol), 1, " bn"),
                href: "/series/sl.mm.repo.volume",
              },
              { label: "Repo share", value: fmt(latestValue(d.repoShare), 0, "%") },
            ]}
          />
          <MmLcChart
            legend={false}
            range={range}
            fill
            compact
            series={[
              {
                key: "total-vol",
                label: "Total Vol",
                kind: "histogram",
                points: d.totalVol,
                upColor: "rgba(11,122,107,0.45)",
                downColor: "rgba(11,122,107,0.45)",
                priceScaleId: "left",
                priceFormat: "number",
              },
              {
                key: "call-vol",
                label: "Call Vol",
                kind: "line",
                points: d.callVol,
                colorVar: MM_COLORS.opr.var,
                colorFallback: MM_COLORS.opr.fallback,
                priceScaleId: "left",
                priceFormat: "number",
                lineWidth: 2,
              },
              {
                key: "repo-vol",
                label: "Repo Vol",
                kind: "line",
                points: d.repoVol,
                colorVar: MM_COLORS.copper.var,
                colorFallback: MM_COLORS.copper.fallback,
                priceScaleId: "left",
                priceFormat: "number",
                lineWidth: 2,
                lastValueVisible: false,
              },
              {
                key: "share",
                label: "Repo %",
                kind: "line",
                points: d.repoShare,
                colorVar: MM_COLORS.call.var,
                colorFallback: MM_COLORS.call.fallback,
                lineWidth: 2,
                priceFormat: "percent",
              },
            ]}
          />
        </>
      );

    case "overnight-liq":
      return (
        <>
          <Legend
            items={[
              {
                label: "O/N Liq",
                value: fmt(latestValue(d.liq), 1, " bn"),
                href: "/series/sl.mm.overnight_liquidity",
              },
              { label: "Call−policy", value: fmt(latestValue(d.callSpread), 2, " pp") },
            ]}
          />
          <MmLcChart
            legend={false}
            range={range}
            fill
            compact
            series={[
              {
                key: "liq",
                label: "O/N Liq",
                kind: "histogram",
                points: d.liq,
                priceScaleId: "left",
                priceFormat: "number",
              },
              {
                key: "spr",
                label: "Call−policy",
                kind: "line",
                points: d.callSpread,
                colorVar: MM_COLORS.copper.var,
                colorFallback: MM_COLORS.copper.fallback,
                lineWidth: 2,
              },
            ]}
          />
        </>
      );

    case "floor-scatter":
      return (
        <MmScatter
          points={d.liqSpreadScatter}
          xLabel="O/N liquidity (Rs.bn)"
          yLabel="Call − policy (pp)"
          height={chartH}
        />
      );

    case "standing-facilities":
      return (
        <>
          <Legend
            items={[
              {
                label: "SDF Vol",
                value: fmt(latestValue(d.sdfVol), 1, " bn"),
                href: "/series/sl.mm.sdf.volume",
              },
              { label: "Net", value: fmt(latestValue(d.facilityNet), 1, " bn") },
            ]}
          />
          <MmLcChart
            legend={false}
            range={range}
            fill
            compact
            series={[
              {
                key: "sdfv",
                label: "SDF",
                kind: "histogram",
                points: d.sdfVol,
                upColor: "rgba(11,122,107,0.65)",
                downColor: "rgba(11,122,107,0.65)",
                priceFormat: "number",
              },
              {
                key: "slfv",
                label: "SLF",
                kind: "histogram",
                points: d.slfVolNeg,
                upColor: "rgba(180,35,24,0.65)",
                downColor: "rgba(180,35,24,0.65)",
                priceFormat: "number",
                lastValueVisible: false,
              },
              {
                key: "net",
                label: "Net",
                kind: "line",
                points: d.facilityNet,
                colorVar: MM_COLORS.call.var,
                colorFallback: MM_COLORS.call.fallback,
                lineWidth: 2,
                priceFormat: "number",
              },
            ]}
          />
        </>
      );

    case "omo":
      return (
        <>
          <Legend
            items={[
              { label: "Bid/Offer", value: fmt(latestValue(d.bidToOffer), 2, "×") },
              { label: "Accept", value: fmt(latestValue(d.acceptance), 2, "") },
              {
                label: "OMO WA",
                value: fmt(latestValue(d.omoWa)),
                href: "/series/sl.mm.omo.wa_yield",
              },
            ]}
          />
          <MmLcChart
            legend={false}
            range={range}
            fill
            compact
            carryKeys={["opr"]}
            series={[
              {
                key: "bto",
                label: "Bid/Offer",
                kind: "line",
                points: d.bidToOffer,
                colorVar: MM_COLORS.sdf.var,
                colorFallback: MM_COLORS.sdf.fallback,
                priceScaleId: "left",
                priceFormat: "ratio",
              },
              {
                key: "acc",
                label: "Accept",
                kind: "line",
                points: d.acceptance,
                colorVar: MM_COLORS.copper.var,
                colorFallback: MM_COLORS.copper.fallback,
                priceScaleId: "left",
                priceFormat: "ratio",
                lastValueVisible: false,
              },
              {
                key: "omo",
                label: "OMO WA",
                kind: "line",
                points: d.omoWa,
                colorVar: MM_COLORS.opr.var,
                colorFallback: MM_COLORS.opr.fallback,
                lineWidth: 2,
              },
              {
                key: "opr",
                label: "OPR",
                kind: "step",
                points: d.oprMax,
                colorVar: MM_COLORS.call.var,
                colorFallback: MM_COLORS.call.fallback,
                lineWidth: 2,
              },
            ]}
          />
        </>
      );

    case "term-gantt":
      return (
        <>
          <MmGantt bars={d.ganttBars} height={Math.max(160, chartH - 28)} />
          <div className="mm-mini-legend">
            <span>
              <i style={{ background: "var(--copper)" }} /> Repo (absorb)
            </span>
            <span>
              <i style={{ background: "var(--accent)" }} /> Reverse repo (inject)
            </span>
          </div>
        </>
      );

    case "term-scatter":
      return (
        <MmScatter
          points={d.termScatter.map((p) => ({
            x: p.x,
            y: p.y,
            size: p.size,
            period: p.period,
          }))}
          xLabel="Tenure (days)"
          yLabel="WA yield (%)"
          height={chartH}
          color="var(--copper)"
        />
      );

    case "holdings":
      return (
        <>
          <Legend
            items={[
              {
                label: "Holdings",
                value: fmt(latestValue(d.holdings), 0, " bn"),
                href: "/series/sl.mm.cbsl.gov_holdings",
              },
              { label: "MoM Δ", value: fmt(latestValue(d.holdingsMom), 1, " bn") },
            ]}
          />
          <MmLcChart
            legend={false}
            range={range}
            fill
            compact
            series={[
              {
                key: "mom",
                label: "MoM Δ",
                kind: "histogram",
                points: d.holdingsMom,
                priceScaleId: "left",
                priceFormat: "number",
              },
              {
                key: "hold",
                label: "Holdings",
                kind: "line",
                points: d.holdings,
                colorVar: MM_COLORS.opr.var,
                colorFallback: MM_COLORS.opr.fallback,
                lineWidth: 2,
                priceFormat: "number",
              },
              {
                key: "liq2",
                label: "O/N Liq",
                kind: "line",
                points: d.liq,
                colorVar: MM_COLORS.sdf.var,
                colorFallback: MM_COLORS.sdf.fallback,
                lineWidth: 1,
                priceScaleId: "left",
                priceFormat: "number",
                lastValueVisible: false,
              },
            ]}
          />
        </>
      );

    case "transmission-chain":
      return (
        <>
          <Legend
            items={[
              { label: "OPR", value: fmt(latestValue(d.opr)) },
              { label: "Call", value: fmt(latestValue(d.call)) },
              { label: "AWPR", value: fmt(latestValue(d.awpr)), href: "/series/sl.mm.awpr" },
              { label: "AWLR", value: fmt(latestValue(d.awlr)), href: "/series/sl.mm.awlr" },
            ]}
          />
          <MmLcChart
            legend={false}
            range={range}
            fill
            compact
            carryKeys={["opr"]}
            series={[
              {
                key: "opr",
                label: "OPR",
                kind: "step",
                points: d.oprMax,
                colorVar: MM_COLORS.opr.var,
                colorFallback: MM_COLORS.opr.fallback,
                lineWidth: 3,
              },
              {
                key: "call",
                label: "Call",
                kind: "line",
                points: d.call,
                colorVar: MM_COLORS.call.var,
                colorFallback: MM_COLORS.call.fallback,
              },
              {
                key: "t91",
                label: "91d",
                kind: "line",
                points: d.t91,
                colorVar: MM_COLORS.tbill91.var,
                colorFallback: MM_COLORS.tbill91.fallback,
              },
              {
                key: "t364",
                label: "364d",
                kind: "line",
                points: d.t364,
                colorVar: MM_COLORS.tbill364.var,
                colorFallback: MM_COLORS.tbill364.fallback,
              },
              {
                key: "awpr",
                label: "AWPR",
                kind: "line",
                points: d.awpr,
                colorVar: MM_COLORS.awpr.var,
                colorFallback: MM_COLORS.awpr.fallback,
                lineWidth: 2,
              },
              {
                key: "awlr",
                label: "AWLR",
                kind: "line",
                points: d.awlr,
                colorVar: MM_COLORS.awlr.var,
                colorFallback: MM_COLORS.awlr.fallback,
                lineWidth: 2,
              },
            ]}
          />
        </>
      );

    case "banking-spreads":
      return (
        <>
          <Legend
            items={[
              { label: "AWLR−AWDR", value: fmt(latestValue(d.awlrAwdr), 2, " pp") },
              { label: "AWPR−364d", value: fmt(latestValue(d.awprTbill), 2, " pp") },
              { label: "AWSR−AWPR", value: fmt(latestValue(d.awsrAwpr), 2, " pp") },
            ]}
          />
          <MmLcChart
            legend={false}
            range={range}
            fill
            compact
            series={[
              {
                key: "nim",
                label: "AWLR−AWDR",
                kind: "line",
                points: d.awlrAwdr,
                colorVar: MM_COLORS.opr.var,
                colorFallback: MM_COLORS.opr.fallback,
              },
              {
                key: "crp",
                label: "AWPR−364d",
                kind: "line",
                points: d.awprTbill,
                colorVar: MM_COLORS.copper.var,
                colorFallback: MM_COLORS.copper.fallback,
              },
              {
                key: "sme",
                label: "AWSR−AWPR",
                kind: "line",
                points: d.awsrAwpr,
                colorVar: MM_COLORS.awsr.var,
                colorFallback: MM_COLORS.awsr.fallback,
              },
              {
                key: "dep",
                label: "AWFDR−AWDR",
                kind: "line",
                points: d.awfdrAwdr,
                colorVar: MM_COLORS.awfdr.var,
                colorFallback: MM_COLORS.awfdr.fallback,
              },
            ]}
          />
        </>
      );

    case "rate-ladder":
      return (
        <RateLadder
          rows={[
            { label: "OPR", value: latestValue(d.opr) },
            { label: "Call WA", value: latestValue(d.call) },
            { label: "91d", value: latestValue(d.t91) },
            { label: "364d", value: latestValue(d.t364) },
            { label: "AWPR", value: latestValue(d.awpr) },
            { label: "AWLR", value: latestValue(d.awlr) },
            { label: "AWSR", value: latestValue(d.awsr) },
            { label: "AWDR", value: latestValue(d.awdr) },
            { label: "AWFDR", value: latestValue(d.awfdr) },
          ]}
        />
      );

    case "tbill-curve":
      return (
        <>
          <Legend
            items={[
              {
                label: "91d",
                value: fmt(latestValue(d.t91)),
                href: "/series/sl.mm.tbill.91d",
                color: MM_COLORS.tbill91.fallback,
              },
              {
                label: "182d",
                value: fmt(latestValue(d.t182)),
                href: "/series/sl.mm.tbill.182d",
                color: MM_COLORS.tbill182.fallback,
              },
              {
                label: "364d",
                value: fmt(latestValue(d.t364)),
                href: "/series/sl.mm.tbill.364d",
                color: MM_COLORS.tbill364.fallback,
              },
            ]}
          />
          <MmLcChart
            legend={false}
            range={range}
            fill
            compact
            series={[
              {
                key: "t91",
                label: "91d",
                kind: "line",
                points: d.t91,
                colorVar: MM_COLORS.tbill91.var,
                colorFallback: MM_COLORS.tbill91.fallback,
              },
              {
                key: "t182",
                label: "182d",
                kind: "line",
                points: d.t182,
                colorVar: MM_COLORS.tbill182.var,
                colorFallback: MM_COLORS.tbill182.fallback,
              },
              {
                key: "t364",
                label: "364d",
                kind: "line",
                points: d.t364,
                colorVar: MM_COLORS.tbill364.var,
                colorFallback: MM_COLORS.tbill364.fallback,
                lineWidth: 3,
              },
            ]}
          />
        </>
      );

    case "tbill-slope":
      return (
        <>
          <Legend items={[{ label: "Slope", value: fmt(latestValue(d.curveSlope), 2, " pp") }]} />
          <MmLcChart
            legend={false}
            range={range}
            fill
            compact
            zeroLine
            series={[
              {
                key: "slope",
                label: "364−91",
                kind: "baseline",
                points: d.curveSlope,
              },
            ]}
          />
        </>
      );

    case "tbill-policy":
      return (
        <>
          <Legend
            items={[{ label: "91d−OPR", value: fmt(latestValue(d.tbillPolicy), 2, " pp") }]}
          />
          <MmLcChart
            legend={false}
            range={range}
            fill
            compact
            zeroLine
            series={[
              {
                key: "tpol",
                label: "91d−OPR",
                kind: "histogram",
                points: d.tbillPolicy,
              },
            ]}
          />
        </>
      );

    case "event-study":
      return (
        <>
          <Legend items={[{ label: "Events", value: String(d.events.length) }]} />
          <MmLcChart
            legend={false}
            range="MAX"
            fill
            compact
            zeroLine
            hint="Synthetic time axis · offset from policy change"
            series={[
              {
                key: "es-call",
                label: "Call",
                kind: "line",
                points: eventStudyToPoints(d.esCall),
                colorVar: MM_COLORS.call.var,
                colorFallback: MM_COLORS.call.fallback,
              },
              {
                key: "es-t91",
                label: "91d",
                kind: "line",
                points: eventStudyToPoints(d.esT91),
                colorVar: MM_COLORS.tbill91.var,
                colorFallback: MM_COLORS.tbill91.fallback,
              },
              {
                key: "es-awpr",
                label: "AWPR",
                kind: "line",
                points: eventStudyToPoints(d.esAwpr),
                colorVar: MM_COLORS.awpr.var,
                colorFallback: MM_COLORS.awpr.fallback,
                lineWidth: 3,
              },
            ]}
          />
        </>
      );

    case "corr-heatmap":
      return (
        <div className="mm-svg-stage">
          <MmHeatmap keys={d.corr.keys} matrix={d.corr.matrix} height={300} />
        </div>
      );

    case "regime-boxes":
      return (
        <div className="mm-svg-stage">
          <MmBoxPlots
            groups={[
              { label: "Corridor", values: d.regimeValues.corridor },
              { label: "Single OPR", values: d.regimeValues.single },
            ].filter((g) => g.values.length > 0)}
            yLabel="Call − policy (pp)"
            height={280}
          />
        </div>
      );

    case "rolling-beta":
      return (
        <>
          <Legend
            items={[
              {
                label: "β (ΔAWPR / ΔOPR)",
                value: fmt(latestValue(d.beta), 2, ""),
                color: MM_COLORS.opr.fallback,
              },
            ]}
          />
          {d.beta.length < 2 ? (
            <div className="mm-svg-empty" style={{ flex: 1, minHeight: 240 }}>
              Need more overlapping OPR / AWPR changes to estimate β.
            </div>
          ) : (
            <MmLcChart
              legend={false}
              range={range}
              fill
              compact
              zeroLine
              hint={`${range} · rolling β · pan / zoom`}
              series={[
                {
                  key: "beta",
                  label: "β",
                  kind: "line",
                  points: d.beta,
                  colorVar: MM_COLORS.opr.var,
                  colorFallback: MM_COLORS.opr.fallback,
                  lineWidth: 2,
                  priceFormat: "ratio",
                },
              ]}
            />
          )}
        </>
      );

    case "lag-response":
      return <MmLagBars data={d.xcorr} height={chartH} />;

    case "pass-through":
      return (
        <>
          <div className="mm-annotation" style={{ marginBottom: 10 }}>
            Indexed to 100 at <strong>{d.passThroughBase}</strong>
            {busy ? " · Loading…" : ""}
          </div>
          <MmLcChart
            legend={false}
            range={range}
            fill
            compact
            hint="Index = 100 at last policy cut"
            series={[
              {
                key: "iopr",
                label: "OPR",
                kind: "step",
                points: d.idxOpr,
                colorVar: MM_COLORS.opr.var,
                colorFallback: MM_COLORS.opr.fallback,
                lineWidth: 3,
                priceFormat: "number",
              },
              {
                key: "icall",
                label: "Call",
                kind: "line",
                points: d.idxCall,
                colorVar: MM_COLORS.call.var,
                colorFallback: MM_COLORS.call.fallback,
                priceFormat: "number",
              },
              {
                key: "it364",
                label: "364d",
                kind: "line",
                points: d.idxT364,
                colorVar: MM_COLORS.tbill364.var,
                colorFallback: MM_COLORS.tbill364.fallback,
                priceFormat: "number",
              },
              {
                key: "iawpr",
                label: "AWPR",
                kind: "line",
                points: d.idxAwpr,
                colorVar: MM_COLORS.awpr.var,
                colorFallback: MM_COLORS.awpr.fallback,
                priceFormat: "number",
              },
              {
                key: "iawlr",
                label: "AWLR",
                kind: "line",
                points: d.idxAwlr,
                colorVar: MM_COLORS.awlr.var,
                colorFallback: MM_COLORS.awlr.fallback,
                priceFormat: "number",
              },
            ]}
          />
        </>
      );

    default:
      return null;
  }
}

function RateLadder({
  rows,
}: {
  rows: { label: string; value: number | null }[];
}) {
  const vals = rows.map((r) => r.value).filter((v): v is number => v != null);
  const min = Math.min(...vals, 0);
  const max = Math.max(...vals, 1);
  const span = max - min || 1;
  return (
    <div className="mm-ladder" style={{ padding: "12px 4px" }}>
      {rows.map((r) => (
        <div key={r.label} className="mm-ladder-row">
          <span className="mm-ladder-label">{r.label}</span>
          <div className="mm-ladder-track">
            {r.value != null ? (
              <span
                className="mm-ladder-mark"
                style={{ left: `${((r.value - min) / span) * 100}%` }}
              />
            ) : null}
          </div>
          <strong className="mm-ladder-value">{fmt(r.value)}</strong>
        </div>
      ))}
    </div>
  );
}
