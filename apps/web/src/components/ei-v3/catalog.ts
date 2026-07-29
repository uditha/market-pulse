/**
 * EI v3 — desk lanes by market meaning (not report source).
 */

export type EiV3LaneId =
  | "prices"
  | "reserves"
  | "money"
  | "energy"
  | "trade"
  | "growth";

export type EiV3Lane = {
  id: EiV3LaneId;
  label: string;
  brief: string;
};

export const EI_V3_LANES: EiV3Lane[] = [
  { id: "prices", label: "Prices", brief: "Inflation the desk trades on" },
  { id: "reserves", label: "Reserves", brief: "External buffer stock" },
  { id: "money", label: "Money", brief: "Base, broad money, liquidity" },
  { id: "energy", label: "Energy", brief: "Crude, pumps, power" },
  { id: "trade", label: "Trade", brief: "Goods, remittances, tourism" },
  { id: "growth", label: "Growth", brief: "GDP and industry" },
];

export const EI_V3_SERIES_IDS = [
  "sl.ei.ccpi.headline_yoy",
  "sl.ei.ccpi.core_yoy",
  "sl.ei.ncpi.headline_yoy",
  "sl.ei.ncpi.core_yoy",
  "sl.ei.ccpi.headline_mom",
  "sl.ei.ncpi.headline_mom",
  "sl.ei.ncpi.food_yoy",
  "sl.ei.ncpi.nonfood_yoy",
  "sl.mm.opr",
  "sl.ei.total_reserves",
  "sl.ei.reserves.fx",
  "sl.ei.reserves.gold",
  "sl.ei.reserves.imf",
  "sl.ei.reserves.sdrs",
  "sl.ei.reserves.other",
  "sl.ei.reserves.fwd_short",
  "sl.ei.reserves.net_after_drains",
  "sl.ei.reserve_money",
  "sl.ei.currency_in_circulation",
  "sl.ei.m1",
  "sl.ei.m2",
  "sl.ei.m2b_yoy",
  "sl.ei.credit.private_yoy",
  "sl.ei.liquidity_surplus",
  "sl.mm.awndr",
  "sl.mm.awnlr",
  "sl.ei.energy.brent",
  "sl.ei.energy.brent_wow",
  "sl.ei.fuel.petrol_92",
  "sl.ei.fuel.auto_diesel",
  "sl.ei.electricity.generation",
  "sl.ei.electricity.peak_demand",
  "sl.ei.electricity.thermal_oil_share",
  "sl.ei.trade.exports",
  "sl.ei.trade.imports",
  "sl.ei.trade.balance",
  "sl.ei.trade.exports_ytd",
  "sl.ei.trade.imports_ytd",
  "sl.ei.trade.balance_ytd",
  "sl.ei.bop.current_account",
  "sl.ei.services.net",
  "sl.ei.remittances_usd",
  "sl.ei.remittances_usd_ytd",
  "sl.ei.tourist_arrivals",
  "sl.ei.tourist_arrivals_ytd",
  "sl.ei.tourist_earnings_usd",
  "sl.ei.reserves.gor",
  "sl.ei.flows.cse",
  "sl.ei.flows.gov_securities",
  "sl.ei.fiscal.primary_balance",
  "sl.ei.debt.total",
  "sl.ei.gdp.growth",
  "sl.ei.gdp.agriculture_yoy",
  "sl.ei.gdp.industry_yoy",
  "sl.ei.gdp.services_yoy",
  "sl.ei.iip",
  "sl.ei.pmi.manufacturing",
  "sl.ei.pmi.services",
  "sl.ei.pmi.construction",
] as const;

export type EiV3SeriesId = (typeof EI_V3_SERIES_IDS)[number];
