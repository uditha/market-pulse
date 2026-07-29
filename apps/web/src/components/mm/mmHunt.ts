export type HuntLevel = "pulse" | "mid" | "rare";

export type HuntShotId =
  | "corridor"
  | "call-spread"
  | "srr"
  | "call-range"
  | "call-repo"
  | "volumes"
  | "overnight-liq"
  | "floor-scatter"
  | "standing-facilities"
  | "omo"
  | "term-gantt"
  | "term-scatter"
  | "holdings"
  | "transmission-chain"
  | "banking-spreads"
  | "rate-ladder"
  | "tbill-curve"
  | "tbill-slope"
  | "tbill-policy"
  | "event-study"
  | "corr-heatmap"
  | "regime-boxes"
  | "rolling-beta"
  | "lag-response"
  | "pass-through";

export type HuntGuide = {
  why: string;
  what: string;
  how: string;
};

export type HuntShotMeta = {
  id: HuntShotId;
  level: HuntLevel;
  rail: string;
  title: string;
  context: string;
  /** How to read this chart */
  guide?: HuntGuide;
  awaitingData?: boolean;
  inStrip?: boolean;
};

/** Plain-language modes — what the screen is for */
export const HUNT_LEVELS: {
  id: HuntLevel;
  label: string;
  job: string;
  blurb: string;
}[] = [
  {
    id: "pulse",
    label: "Overview",
    job: "Today’s overnight rates",
    blurb: "Check Call, the policy corridor, and morning levels.",
  },
  {
    id: "mid",
    label: "Drivers",
    job: "Why rates moved",
    blurb: "Liquidity, OMO, and how policy reaches bank rates.",
  },
  {
    id: "rare",
    label: "Analysis",
    job: "Events & regimes",
    blurb: "Event studies, regimes, and transmission diagnostics.",
  },
];

export const DEFAULT_SHOT: Record<HuntLevel, HuntShotId> = {
  pulse: "corridor",
  mid: "overnight-liq",
  rare: "event-study",
};

export const PLAN_STORAGE_KEY = "marketpulse_plan";

/** Demo checkout flag — temporary until Stripe webhook sets subscriptionStatus. */
export function readIsPro(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const plan = window.localStorage.getItem(PLAN_STORAGE_KEY);
    return plan === "pro" || plan === "pro_demo";
  } catch {
    return false;
  }
}

export const MID_PEEK_KEY = "marketpulse_mm_mid_peek";

export function readMidPeek(): HuntShotId | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.sessionStorage.getItem(MID_PEEK_KEY);
    return (v as HuntShotId) || null;
  } catch {
    return null;
  }
}

export function writeMidPeek(id: HuntShotId) {
  try {
    window.sessionStorage.setItem(MID_PEEK_KEY, id);
  } catch {
    /* ignore */
  }
}

export function thinSeries(points: { period: string; value: number }[], min = 10) {
  return points.length > 0 && points.length < min;
}

export function emptySeries(points: { period: string; value: number }[]) {
  return points.length === 0;
}

/** One-line “so what” for the corridor / overnight pulse */
export function overnightReadout(input: {
  call: number | null;
  opr: number | null;
  sdf: number | null;
  slf: number | null;
}): string {
  const { call, opr, sdf, slf } = input;
  if (call == null) return "Waiting on today’s Call print.";
  const policy = opr ?? sdf;
  if (policy == null) return `Call WA ${call.toFixed(2)}%.`;
  const spread = call - policy;
  const sign = spread >= 0 ? "+" : "−";
  const abs = Math.abs(spread).toFixed(2);
  const vs = opr != null ? "OPR" : "SDF";

  if (sdf != null && slf != null && slf > sdf) {
    const pos = (call - sdf) / (slf - sdf);
    if (pos >= 0.8) {
      return `Call is ${sign}${abs} pp vs ${vs} · near the SLF ceiling.`;
    }
    if (pos <= 0.2) {
      return `Call is ${sign}${abs} pp vs ${vs} · hugging the SDF floor.`;
    }
  }
  return `Call is ${sign}${abs} pp vs ${vs} · mid-corridor.`;
}
