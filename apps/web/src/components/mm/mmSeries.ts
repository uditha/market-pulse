import type { SeriesLatest, TermRepoBook } from "@/lib/api";
import type { Point } from "@/lib/mm-analytics";

export const MM_SERIES_IDS = [
  "sl.mm.opr",
  "sl.mm.srr",
  "sl.mm.sdf.rate",
  "sl.mm.slf.rate",
  "sl.mm.sdf.volume",
  "sl.mm.slf.volume",
  "sl.mm.call.wa_yield",
  "sl.mm.call.min_rate",
  "sl.mm.call.max_rate",
  "sl.mm.call.volume",
  "sl.mm.repo.wa_yield",
  "sl.mm.repo.min_rate",
  "sl.mm.repo.max_rate",
  "sl.mm.repo.volume",
  "sl.mm.overnight_liquidity",
  "sl.mm.cbsl.gov_holdings",
  "sl.mm.omo.offer_repo",
  "sl.mm.omo.offer_reverse_repo",
  "sl.mm.omo.received",
  "sl.mm.omo.accepted",
  "sl.mm.omo.min_rate",
  "sl.mm.omo.max_rate",
  "sl.mm.omo.wa_yield",
  "sl.mm.tbill.91d",
  "sl.mm.tbill.182d",
  "sl.mm.tbill.364d",
  "sl.mm.awpr",
  "sl.mm.awlr",
  "sl.mm.awdr",
  "sl.mm.awfdr",
  "sl.mm.awsr",
] as const;

export type MmSeriesId = (typeof MM_SERIES_IDS)[number];

/**
 * Always fetch MAX history. Includes policy steps plus series needed for
 * Analysis diagnostics (regimes / β / correlations) across eras.
 */
export const MM_CARRY_IDS = new Set<string>([
  "sl.mm.opr",
  "sl.mm.srr",
  "sl.mm.sdf.rate",
  "sl.mm.slf.rate",
  "sl.mm.call.wa_yield",
  "sl.mm.awpr",
  "sl.mm.awlr",
  "sl.mm.repo.wa_yield",
  "sl.mm.overnight_liquidity",
]);

export type MmBundle = Record<string, Point[]>;

export function historyToPoints(
  history?: { period: string; value: number }[],
): Point[] {
  return (history ?? []).map((h) => ({ period: h.period, value: h.value }));
}

export function seriesToBundle(
  details: (SeriesLatest | null)[],
  ids: readonly string[] = MM_SERIES_IDS,
): MmBundle {
  const bundle: MmBundle = {};
  ids.forEach((id, i) => {
    bundle[id] = historyToPoints(details[i]?.history);
  });
  return bundle;
}

export function metaFromSearch(all: SeriesLatest[]): Map<string, SeriesLatest> {
  return new Map(all.map((s) => [s.seriesId, s]));
}

export type MmDashboardProps = {
  initialBundle: MmBundle;
  initialRange: "1Y" | "5Y" | "MAX";
  meta: SeriesLatest[];
  termBook: TermRepoBook | null;
  brief: SeriesLatest[];
};
