import type { SeriesLatest } from "@/lib/api";
import type { Point } from "@/components/mm/chartTheme";

/** CPI YoY prints — primary EI inflation desk. */
export const EI_INFLATION_IDS = [
  "sl.ei.ccpi.headline_yoy",
  "sl.ei.ccpi.core_yoy",
  "sl.ei.ncpi.headline_yoy",
  "sl.ei.ncpi.core_yoy",
  "sl.ei.ccpi.headline_mom",
  "sl.ei.ncpi.headline_mom",
  "sl.ei.ncpi.food_yoy",
  "sl.ei.ncpi.nonfood_yoy",
] as const;

/** Policy overlay for Analysis (step series). */
export const EI_CONTEXT_IDS = ["sl.mm.opr"] as const;

/** Official Reserve Assets — WEI §4.3 composition (+ MEI total). */
export const EI_ORA_IDS = [
  "sl.ei.total_reserves",
  "sl.ei.reserves.fx",
  "sl.ei.reserves.gold",
  "sl.ei.reserves.imf",
  "sl.ei.reserves.sdrs",
  "sl.ei.reserves.other",
] as const;

/** DEI daily pack. */
export const EI_DEI_IDS = [
  "sl.ei.reserve_money",
  "sl.ei.currency_in_circulation",
  "sl.ei.energy.brent",
  "sl.ei.fuel.petrol_92",
  "sl.ei.fuel.auto_diesel",
] as const;

/** WEI weekly fills used on the EI desk. */
export const EI_WEI_IDS = [
  ...EI_ORA_IDS,
  "sl.ei.liquidity_surplus",
  "sl.ei.remittances_usd",
  "sl.ei.remittances_usd_ytd",
  "sl.ei.tourist_arrivals",
  "sl.ei.tourist_arrivals_ytd",
  "sl.ei.tourist_earnings_usd",
  "sl.ei.tourist_earnings_usd_ytd",
  "sl.ei.gdp.agriculture_yoy",
  "sl.ei.gdp.industry_yoy",
  "sl.ei.gdp.services_yoy",
  "sl.ei.pmi.manufacturing",
  "sl.ei.pmi.services",
  "sl.ei.pmi.construction",
  "sl.ei.m2b",
  "sl.ei.m2b_yoy",
  "sl.ei.credit.private",
  "sl.ei.credit.private_yoy",
  "sl.ei.fiscal.primary_balance",
  "sl.ei.fiscal.overall_balance",
  "sl.ei.debt.domestic",
  "sl.ei.debt.foreign",
  "sl.ei.debt.total",
  "sl.ei.trade.exports_ytd",
  "sl.ei.trade.imports_ytd",
  "sl.ei.trade.balance_ytd",
  "sl.ei.reserves.fwd_short",
  "sl.ei.reserves.net_after_drains",
  "sl.ei.electricity.thermal_oil",
  "sl.ei.electricity.thermal_oil_share",
  "sl.ei.energy.brent_wow",
  "sl.mm.awndr",
  "sl.mm.awnlr",
] as const;

/** MEI monthly pack. */
export const EI_MEI_IDS = [
  "sl.ei.m2",
  "sl.ei.gdp.growth",
  "sl.ei.trade.exports",
  "sl.ei.trade.imports",
] as const;

/** Macro pack from Daily / Monthly / Weekly Economic Indicator PDFs. */
export const EI_MACRO_IDS = [...EI_DEI_IDS, ...EI_WEI_IDS, ...EI_MEI_IDS] as const;

export const EI_SERIES_IDS = [
  ...EI_INFLATION_IDS,
  ...EI_CONTEXT_IDS,
  ...EI_MACRO_IDS,
] as const;

export type EiSeriesId = (typeof EI_SERIES_IDS)[number];
export type EiBundle = Record<string, Point[]>;

export function historyToPoints(
  history?: { period: string; value: number }[],
): Point[] {
  return (history ?? []).map((h) => ({ period: h.period, value: h.value }));
}

export function seriesToBundle(
  details: (SeriesLatest | null)[],
  ids: readonly string[] = EI_SERIES_IDS,
): EiBundle {
  const bundle: EiBundle = {};
  ids.forEach((id, i) => {
    bundle[id] = historyToPoints(details[i]?.history);
  });
  return bundle;
}

export type EiDashboardProps = {
  initialBundle: EiBundle;
  initialRange: "1Y" | "5Y" | "MAX";
  meta: SeriesLatest[];
};
