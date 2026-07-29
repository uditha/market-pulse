import { changeOver, latestValue, type Point } from "@/lib/mm-analytics";

export type MarketRegime = "surplus" | "balanced" | "tight" | "unknown";

export type BoardFocus = "stance" | "liquidity" | "facilities" | "transmission";

export type TakeBullet = {
  label: string;
  text: string;
};

export type MmMarketState = {
  asOf: string | null;
  call: number | null;
  opr: number | null;
  sdf: number | null;
  slf: number | null;
  spread: number | null;
  /** 0 = at SDF, 1 = at SLF */
  bandPos: number | null;
  liq: number | null;
  liqDelta30: number | null;
  sdfVol: number | null;
  slfVol: number | null;
  awpr: number | null;
  awlr: number | null;
  regime: MarketRegime;
  regimeLabel: string;
  take: TakeBullet[];
};

function bandPosition(call: number, sdf: number, slf: number): number | null {
  if (!(slf > sdf)) return null;
  return Math.min(1, Math.max(0, (call - sdf) / (slf - sdf)));
}

function classifyRegime(
  spread: number | null,
  bandPos: number | null,
  liq: number | null,
): MarketRegime {
  if (spread == null && bandPos == null && liq == null) return "unknown";
  if (liq != null && liq > 50 && (spread == null || spread <= 0.15)) return "surplus";
  if (bandPos != null && bandPos <= 0.25) return "surplus";
  if (bandPos != null && bandPos >= 0.75) return "tight";
  if (spread != null && spread >= 0.4) return "tight";
  if (liq != null && liq < -20) return "tight";
  return "balanced";
}

const REGIME_LABEL: Record<MarketRegime, string> = {
  surplus: "Surplus · floor",
  balanced: "Balanced",
  tight: "Tight · ceiling",
  unknown: "Insufficient data",
};

function fmtPp(v: number) {
  const sign = v >= 0 ? "+" : "−";
  return `${sign}${Math.abs(v).toFixed(2)} pp`;
}

function fmtBn(v: number) {
  const sign = v >= 0 ? "+" : "−";
  return `${sign}${Math.abs(v).toFixed(0)} bn`;
}

/** Derive a board-ready market state from series points (already ranged). */
export function buildMarketState(input: {
  call: Point[];
  opr: Point[];
  sdf: Point[];
  slf: Point[];
  callSpread: Point[];
  liq: Point[];
  sdfVol: Point[];
  slfVol: Point[];
  awpr: Point[];
  awlr: Point[];
}): MmMarketState {
  const call = latestValue(input.call);
  const opr = latestValue(input.opr);
  const sdf = latestValue(input.sdf);
  const slf = latestValue(input.slf);
  const spread = latestValue(input.callSpread);
  const liq = latestValue(input.liq);
  const sdfVol = latestValue(input.sdfVol);
  const slfVol = latestValue(input.slfVol);
  const awpr = latestValue(input.awpr);
  const awlr = latestValue(input.awlr);
  const liqDelta30 = changeOver(input.liq, 30);

  const bandPos =
    call != null && sdf != null && slf != null ? bandPosition(call, sdf, slf) : null;
  const regime = classifyRegime(spread, bandPos, liq);

  const asOf =
    input.call[input.call.length - 1]?.period ??
    input.liq[input.liq.length - 1]?.period ??
    null;

  const take: TakeBullet[] = [];

  if (call != null && (opr != null || sdf != null)) {
    const policy = opr ?? sdf!;
    const gap = call - policy;
    take.push({
      label: "Stance",
      text:
        gap <= 0.1
          ? `Call at ${call.toFixed(2)}% is hugging policy (${policy.toFixed(2)}%).`
          : `Call at ${call.toFixed(2)}% is ${fmtPp(gap)} vs policy.`,
    });
  }

  if (liq != null) {
    const d =
      liqDelta30 != null ? ` · 30d ${fmtBn(liqDelta30)}` : "";
    take.push({
      label: "Liquidity",
      text:
        liq >= 0
          ? `System surplus about Rs ${liq.toFixed(0)} bn${d}.`
          : `System deficit about Rs ${Math.abs(liq).toFixed(0)} bn${d}.`,
    });
  }

  if (awpr != null && call != null) {
    const pass = awpr - call;
    take.push({
      label: "Banks",
      text: `AWPR ${awpr.toFixed(2)}% is ${fmtPp(pass)} above Call — lending still ${
        pass > 1.5 ? "wide of overnight" : "close to overnight"
      }.`,
    });
  } else if (sdfVol != null || slfVol != null) {
    const sdfV = sdfVol ?? 0;
    const slfV = slfVol ?? 0;
    take.push({
      label: "Facilities",
      text:
        sdfV >= slfV
          ? "Banks are parking at SDF more than borrowing at SLF."
          : "Banks are leaning on SLF more than parking at SDF.",
    });
  }

  if (!take.length) {
    take.push({
      label: "Status",
      text: "Waiting on enough overnight prints to form a view.",
    });
  }

  return {
    asOf,
    call,
    opr,
    sdf,
    slf,
    spread,
    bandPos,
    liq,
    liqDelta30,
    sdfVol,
    slfVol,
    awpr,
    awlr,
    regime,
    regimeLabel: REGIME_LABEL[regime],
    take: take.slice(0, 3),
  };
}

export const BOARD_FOCUSES: {
  id: BoardFocus;
  label: string;
  blurb: string;
}[] = [
  {
    id: "stance",
    label: "Stance",
    blurb: "Call inside the policy corridor",
  },
  {
    id: "liquidity",
    label: "Liquidity",
    blurb: "Surplus or deficit driving the floor effect",
  },
  {
    id: "facilities",
    label: "Facilities",
    blurb: "SDF parking vs SLF borrowing",
  },
  {
    id: "transmission",
    label: "Transmission",
    blurb: "OPR → Call → AWPR → AWLR",
  },
];
