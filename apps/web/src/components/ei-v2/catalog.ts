/**
 * EI v2 — market-data chapters (never report sources).
 * Organized by what the number means to a desk, not which PDF printed it.
 */

export type EiV2ChapterId =
  | "pulse"
  | "prices"
  | "reserves"
  | "money"
  | "energy"
  | "trade"
  | "growth";

export type EiV2Chapter = {
  id: EiV2ChapterId;
  label: string;
  tagline: string;
};

export const EI_V2_CHAPTERS: EiV2Chapter[] = [
  { id: "pulse", label: "Pulse", tagline: "Where the economy sits right now" },
  { id: "prices", label: "Prices", tagline: "Inflation prints markets trade on" },
  { id: "reserves", label: "Reserves", tagline: "The external buffer" },
  { id: "money", label: "Money", tagline: "Base, broad money, liquidity" },
  { id: "energy", label: "Energy", tagline: "Crude, pumps, and power" },
  { id: "trade", label: "Trade", tagline: "Goods, remittances, tourism" },
  { id: "growth", label: "Growth", tagline: "GDP and industry" },
];

/** All series fetched for v2 — market data only. */
export const EI_V2_SERIES_IDS = [
  // Prices
  "sl.ei.ccpi.headline_yoy",
  "sl.ei.ccpi.core_yoy",
  "sl.ei.ncpi.headline_yoy",
  "sl.ei.ncpi.core_yoy",
  "sl.ei.ccpi.headline_mom",
  "sl.ei.ncpi.headline_mom",
  "sl.ei.ncpi.food_yoy",
  "sl.ei.ncpi.nonfood_yoy",
  "sl.mm.opr",
  // Reserves
  "sl.ei.total_reserves",
  "sl.ei.reserves.fx",
  "sl.ei.reserves.gold",
  "sl.ei.reserves.imf",
  "sl.ei.reserves.sdrs",
  "sl.ei.reserves.other",
  "sl.ei.reserves.fwd_short",
  "sl.ei.reserves.net_after_drains",
  // Money
  "sl.ei.reserve_money",
  "sl.ei.currency_in_circulation",
  "sl.ei.m1",
  "sl.ei.m2",
  "sl.ei.m2b",
  "sl.ei.m2b_yoy",
  "sl.ei.credit.private",
  "sl.ei.credit.private_yoy",
  "sl.ei.liquidity_surplus",
  "sl.mm.awndr",
  "sl.mm.awnlr",
  // Energy
  "sl.ei.energy.brent",
  "sl.ei.energy.brent_wow",
  "sl.ei.energy.wti",
  "sl.ei.fuel.petrol_92",
  "sl.ei.fuel.auto_diesel",
  "sl.ei.fuel.kerosene",
  "sl.ei.electricity.generation",
  "sl.ei.electricity.peak_demand",
  "sl.ei.electricity.thermal_oil",
  "sl.ei.electricity.thermal_oil_share",
  // Trade / flows
  "sl.ei.trade.exports",
  "sl.ei.trade.imports",
  "sl.ei.trade.balance",
  "sl.ei.trade.exports_ytd",
  "sl.ei.trade.imports_ytd",
  "sl.ei.trade.balance_ytd",
  "sl.ei.bop.current_account",
  "sl.ei.bop.current_account_ytd",
  "sl.ei.services.net",
  "sl.ei.remittances_usd",
  "sl.ei.remittances_usd_ytd",
  "sl.ei.tourist_arrivals",
  "sl.ei.tourist_arrivals_ytd",
  "sl.ei.tourist_earnings_usd",
  "sl.ei.tourist_earnings_usd_ytd",
  "sl.ei.reserves.gor",
  "sl.ei.flows.cse",
  "sl.ei.flows.gov_securities",
  "sl.ei.fiscal.primary_balance",
  "sl.ei.fiscal.overall_balance",
  "sl.ei.debt.domestic",
  "sl.ei.debt.foreign",
  "sl.ei.debt.total",
  // Growth
  "sl.ei.gdp.growth",
  "sl.ei.gdp.agriculture_yoy",
  "sl.ei.gdp.industry_yoy",
  "sl.ei.gdp.services_yoy",
  "sl.ei.gdp.level",
  "sl.ei.iip",
  "sl.ei.pmi.manufacturing",
  "sl.ei.pmi.services",
  "sl.ei.pmi.construction",
] as const;

export type EiV2SeriesId = (typeof EI_V2_SERIES_IDS)[number];
