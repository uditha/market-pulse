"use client";

import { useMemo, useState } from "react";
import { type Point } from "@/lib/mm-analytics";
import { MmLcChart, type LcSeriesSpec } from "./MmLcChart";
import { MM_COLORS, type ChartRange } from "./chartTheme";
import { MmCorridorDial } from "./MmCorridorDial";
import type { ChartInfoGuide } from "./MmChartInfo";
import {
  BOARD_FOCUSES,
  buildMarketState,
  type BoardFocus,
  type MmMarketState,
} from "./mmState";

export type BoardSeries = {
  call: Point[];
  opr: Point[];
  oprMax: Point[];
  sdf: Point[];
  slf: Point[];
  callSpread: Point[];
  liq: Point[];
  sdfVol: Point[];
  slfVol: Point[];
  slfVolNeg: Point[];
  facilityNet: Point[];
  awpr: Point[];
  awlr: Point[];
};

function fmt(v: number | null | undefined, digits = 2, suffix = "%") {
  if (v == null || Number.isNaN(v)) return "—";
  return `${v.toFixed(digits)}${suffix}`;
}

function spark(points: Point[], n = 28) {
  return points.slice(-n).map((p) => p.value);
}

function MiniSpark({
  values,
  tone = "neutral",
}: {
  values: number[];
  tone?: "up" | "down" | "neutral";
}) {
  if (values.length < 2) return <div className="mm-mini-spark is-empty" />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const w = 72;
  const h = 28;
  const d = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / span) * (h - 4) - 2;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg className={`mm-mini-spark tone-${tone}`} viewBox={`0 0 ${w} ${h}`} aria-hidden>
      <path d={d} fill="none" strokeWidth="1.6" />
    </svg>
  );
}

function FocusTile({
  active,
  label,
  value,
  hint,
  sparkValues,
  tone,
  onClick,
}: {
  active: boolean;
  label: string;
  value: string;
  hint: string;
  sparkValues: number[];
  tone?: "up" | "down" | "neutral";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`mm-tile${active ? " is-active" : ""}`}
      onClick={onClick}
      aria-pressed={active}
    >
      <div className="mm-tile-top">
        <span className="mm-tile-label">{label}</span>
        <MiniSpark values={sparkValues} tone={tone} />
      </div>
      <strong className="mm-tile-value">{value}</strong>
      <span className="mm-tile-hint">{hint}</span>
    </button>
  );
}

function contextChart(focus: BoardFocus, s: BoardSeries): {
  title: string;
  note: string;
  series: LcSeriesSpec[];
  carryKeys?: string[];
  zeroLine?: boolean;
  info: ChartInfoGuide;
} {
  switch (focus) {
    case "liquidity":
      return {
        title: "Liquidity vs Call−policy",
        note: "Bars = overnight surplus/deficit. Line = Call spread to policy.",
        info: {
          why: "Liquidity is the usual driver of where Call sits in the policy corridor.",
          what: "Bars = overnight surplus/deficit. Line = Call−policy spread.",
          how: "Large surplus with a flat spread → floor effect. Deficit with a rising spread → funding pressure.",
        },
        series: [
          {
            key: "liq",
            label: "O/N Liq",
            kind: "histogram",
            points: s.liq,
            priceScaleId: "left",
            priceFormat: "number",
          },
          {
            key: "spr",
            label: "Call−policy",
            kind: "line",
            points: s.callSpread,
            colorVar: MM_COLORS.copper.var,
            colorFallback: MM_COLORS.copper.fallback,
            lineWidth: 2,
          },
        ],
      };
    case "facilities":
      return {
        title: "Standing facility usage",
        note: "SDF deposits up; SLF borrowing down; net line.",
        info: {
          why: "Facility use shows which side of the corridor banks choose when the market bites.",
          what: "SDF volume (deposit), SLF volume (borrow, shown negative), and net.",
          how: "Heavy SDF → parking surplus. Heavy SLF → borrowing at the ceiling.",
        },
        series: [
          {
            key: "sdfv",
            label: "SDF",
            kind: "histogram",
            points: s.sdfVol,
            upColor: "rgba(11,122,107,0.65)",
            downColor: "rgba(11,122,107,0.65)",
            priceFormat: "number",
          },
          {
            key: "slfv",
            label: "SLF",
            kind: "histogram",
            points: s.slfVolNeg,
            upColor: "rgba(180,35,24,0.65)",
            downColor: "rgba(180,35,24,0.65)",
            priceFormat: "number",
            lastValueVisible: false,
          },
          {
            key: "net",
            label: "Net",
            kind: "line",
            points: s.facilityNet,
            colorVar: MM_COLORS.call.var,
            colorFallback: MM_COLORS.call.fallback,
            lineWidth: 2,
            priceFormat: "number",
          },
        ],
      };
    case "transmission":
      return {
        title: "Transmission chain",
        note: "How far policy has travelled into Call, AWPR, and AWLR.",
        info: {
          why: "Policy only matters if it reaches bank lending and deposit rates.",
          what: "OPR → Call → AWPR → AWLR on one timeline.",
          how: "After a cut, watch which lines fall and which lag — that is pass-through speed.",
        },
        carryKeys: ["opr"],
        series: [
          {
            key: "opr",
            label: "OPR",
            kind: "step",
            points: s.oprMax,
            colorVar: MM_COLORS.opr.var,
            colorFallback: MM_COLORS.opr.fallback,
            lineWidth: 3,
          },
          {
            key: "call",
            label: "Call",
            kind: "line",
            points: s.call,
            colorVar: MM_COLORS.call.var,
            colorFallback: MM_COLORS.call.fallback,
          },
          {
            key: "awpr",
            label: "AWPR",
            kind: "line",
            points: s.awpr,
            colorVar: MM_COLORS.awpr.var,
            colorFallback: MM_COLORS.awpr.fallback,
            lineWidth: 2,
          },
          {
            key: "awlr",
            label: "AWLR",
            kind: "line",
            points: s.awlr,
            colorVar: MM_COLORS.awlr.var,
            colorFallback: MM_COLORS.awlr.fallback,
            lineWidth: 2,
          },
        ],
      };
    case "stance":
    default:
      return {
        title: "Call spread to policy",
        note: "Distance of Call from OPR (or SDF). Floor ≈ surplus; rising ≈ stress.",
        info: {
          why: "Compresses the corridor into one number: pressure on overnight rates versus policy.",
          what: "Call WA minus OPR (or SDF when OPR is missing on the day).",
          how: "Near 0 or negative → floor/surplus. Rising sharply → tightening or stress.",
        },
        zeroLine: true,
        series: [
          {
            key: "spread",
            label: "Call−policy",
            kind: "histogram",
            points: s.callSpread,
            priceFormat: "percent",
            colorFallback: MM_COLORS.copper.fallback,
          },
        ],
      };
  }
}

export function MmStateBoard({
  series,
  busy,
  range = "1Y",
  selectedRange,
  onRange,
}: {
  series: BoardSeries;
  busy?: boolean;
  error?: string | null;
  range?: ChartRange;
  /** Tab highlight while a longer-history fetch is pending. */
  selectedRange?: ChartRange;
  onRange?: (r: ChartRange) => void;
}) {
  const [focus, setFocus] = useState<BoardFocus>("stance");

  const state: MmMarketState = useMemo(
    () =>
      buildMarketState({
        call: series.call,
        opr: series.opr,
        sdf: series.sdf,
        slf: series.slf,
        callSpread: series.callSpread,
        liq: series.liq,
        sdfVol: series.sdfVol,
        slfVol: series.slfVol,
        awpr: series.awpr,
        awlr: series.awlr,
      }),
    [series],
  );

  const chart = contextChart(focus, series);
  const focusMeta = BOARD_FOCUSES.find((f) => f.id === focus)!;
  const liqTone: "up" | "down" | "neutral" =
    state.liq == null ? "neutral" : state.liq >= 0 ? "up" : "down";

  return (
    <div className="mm-board is-pulse">
      <p className="mm-board-asof">{state.asOf ? `As of ${state.asOf}` : "As of —"}</p>

      <div className="mm-board-hero">
        <MmCorridorDial state={state} />

        <aside className="mm-take">
          <p className="mm-take-kicker">The take</p>
          <ol className="mm-take-list">
            {state.take.map((b) => (
              <li key={b.label}>
                <span>{b.label}</span>
                <p>{b.text}</p>
              </li>
            ))}
          </ol>
          <p className="mm-take-hint">
            Tap a module on the left — the chart on the right shows its history.
          </p>
        </aside>
      </div>

      <div className="mm-board-split">
        <div className="mm-board-tiles" role="toolbar" aria-label="Market modules">
          <FocusTile
            active={focus === "stance"}
            label="Stance"
            value={fmt(state.spread, 2, " pp")}
            hint="Call − policy"
            sparkValues={spark(series.callSpread)}
            tone={state.spread != null && state.spread > 0.25 ? "down" : "neutral"}
            onClick={() => setFocus("stance")}
          />
          <FocusTile
            active={focus === "liquidity"}
            label="Liquidity"
            value={state.liq != null ? `Rs ${state.liq.toFixed(0)} bn` : "—"}
            hint={
              state.liqDelta30 != null
                ? `30d ${state.liqDelta30 >= 0 ? "+" : ""}${state.liqDelta30.toFixed(0)} bn`
                : "O/N surplus/deficit"
            }
            sparkValues={spark(series.liq)}
            tone={liqTone}
            onClick={() => setFocus("liquidity")}
          />
          <FocusTile
            active={focus === "facilities"}
            label="Facilities"
            value={
              state.sdfVol != null || state.slfVol != null
                ? `Net ${fmt(latestNet(series.facilityNet), 1, " bn")}`
                : "—"
            }
            hint="SDF vs SLF standing facilities"
            sparkValues={spark(series.facilityNet)}
            onClick={() => setFocus("facilities")}
          />
          <FocusTile
            active={focus === "transmission"}
            label="Transmission"
            value={state.awpr != null ? `AWPR ${state.awpr.toFixed(2)}%` : "—"}
            hint={state.awlr != null ? `AWLR ${state.awlr.toFixed(2)}%` : "OPR → banks"}
            sparkValues={spark(series.awpr)}
            onClick={() => setFocus("transmission")}
          />
        </div>

        <section className="mm-board-context">
          <div className="mm-board-context-head">
            <div>
              <h2>{chart.title}</h2>
              <p>
                {focusMeta.blurb}. {chart.note}
              </p>
            </div>
          </div>
          <div className="mm-board-context-chart">
            <MmLcChart
              range={range}
              selectedRange={selectedRange}
              onRange={onRange}
              busy={busy}
              fill
              compact
              zeroLine={chart.zeroLine}
              carryKeys={chart.carryKeys}
              hint={`${range} · pan / zoom`}
              series={chart.series}
              info={chart.info}
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function latestNet(points: Point[]) {
  if (!points.length) return null;
  return points[points.length - 1]?.value ?? null;
}
