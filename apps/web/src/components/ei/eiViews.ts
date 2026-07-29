/**
 * EI desk IA: top axis = CBSL reports, second axis = chart packs under each report.
 */

export type EiReportId = "overview" | "cpi" | "dei" | "wei" | "mei";

export type EiViewId =
  | "headline"
  | "ccpi-core"
  | "ccpi-ncpi"
  | "core-gap"
  | "four-way"
  | "wedge"
  | "vs-policy"
  | "mom-food"
  | "money"
  | "energy"
  | "reserves"
  | "liquidity"
  | "remittances"
  | "pmi"
  | "credit"
  | "fiscal"
  | "drains"
  | "external"
  | "mei-money"
  | "gdp";

export type EiReportMeta = {
  id: EiReportId;
  label: string;
  job: string;
  blurb: string;
  cadence: string;
};

export type EiViewMeta = {
  id: EiViewId;
  report: EiReportId;
  title: string;
  context: string;
};

/** Top-level drill: CBSL report sources (not analysis depth). */
export const EI_REPORTS: EiReportMeta[] = [
  {
    id: "overview",
    label: "Overview",
    job: "All reports",
    blurb: "Pick a CBSL report, then open its charts.",
    cadence: "Cross-report",
  },
  {
    id: "cpi",
    label: "CPI",
    job: "Inflation",
    blurb: "CCPI / NCPI headline and core — the inflation pack.",
    cadence: "Monthly · consumer-price-inflation",
  },
  {
    id: "dei",
    label: "DEI",
    job: "Daily",
    blurb: "Reserve money, CIC, fuel and Brent from Daily Economic Indicators.",
    cadence: "Daily · daily-economic-indicators",
  },
  {
    id: "wei",
    label: "WEI",
    job: "Weekly",
    blurb: "Official reserves, liquidity and remittances from Weekly Economic Indicators.",
    cadence: "Weekly · weekly-economic-indicators",
  },
  {
    id: "mei",
    label: "MEI",
    job: "Monthly",
    blurb: "Trade, broad money and GDP from Monthly Economic Indicators.",
    cadence: "Monthly · monthly-economic-indicators",
  },
];

/** Chart packs nested under each report. */
export const EI_VIEWS: EiViewMeta[] = [
  // CPI
  {
    id: "headline",
    report: "cpi",
    title: "CCPI headline",
    context: "Colombo headline Y-o-Y — the print markets watch first.",
  },
  {
    id: "ccpi-core",
    report: "cpi",
    title: "CCPI vs core",
    context: "Food/energy noise vs underlying Colombo inflation.",
  },
  {
    id: "ccpi-ncpi",
    report: "cpi",
    title: "CCPI vs NCPI",
    context: "Colombo basket vs national — regional pressure gap.",
  },
  {
    id: "core-gap",
    report: "cpi",
    title: "Core gap",
    context: "Headline − core (pp). Wide gap = volatile components.",
  },
  {
    id: "four-way",
    report: "cpi",
    title: "All four prints",
    context: "CCPI / NCPI × headline / core on one stage.",
  },
  {
    id: "wedge",
    report: "cpi",
    title: "CCPI − NCPI wedge",
    context: "Colombo minus national headline (pp).",
  },
  {
    id: "vs-policy",
    report: "cpi",
    title: "Inflation vs OPR",
    context: "CCPI headline against the overnight policy rate.",
  },
  {
    id: "mom-food",
    report: "cpi",
    title: "MoM & food split",
    context: "Headline MoM plus NCPI food vs non-food YoY from WEI.",
  },
  // DEI
  {
    id: "money",
    report: "dei",
    title: "Reserve money & CIC",
    context: "Daily monetary base prints from Daily Economic Indicators.",
  },
  {
    id: "energy",
    report: "dei",
    title: "Fuel & Brent",
    context: "CPC pump prices and Brent crude from the DEI energy box.",
  },
  // WEI
  {
    id: "reserves",
    report: "wei",
    title: "Official reserves",
    context: "WEI §4.3 Official Reserve Assets — total and FX / gold / IMF / SDR mix.",
  },
  {
    id: "liquidity",
    report: "wei",
    title: "Liquidity surplus",
    context: "Outstanding market liquidity surplus from WEI highlights.",
  },
  {
    id: "remittances",
    report: "wei",
    title: "Remittances & tourism",
    context: "Workers' remittances, arrivals and tourism earnings from WEI.",
  },
  {
    id: "pmi",
    report: "wei",
    title: "PMI",
    context: "Manufacturing, services and construction PMI from WEI §1.6.",
  },
  {
    id: "credit",
    report: "wei",
    title: "Credit & M2b",
    context: "Private credit and M2b levels with YoY growth from WEI §2.2.",
  },
  {
    id: "fiscal",
    report: "wei",
    title: "Fiscal & debt",
    context: "Primary/overall balance and domestic vs foreign debt from WEI.",
  },
  {
    id: "drains",
    report: "wei",
    title: "Reserve drains",
    context: "FX forward short positions and net reserves after drains (WEI §4.4).",
  },
  // MEI
  {
    id: "external",
    report: "mei",
    title: "Trade",
    context: "Merchandise exports and imports from Monthly Economic Indicators.",
  },
  {
    id: "mei-money",
    report: "mei",
    title: "Broad money M2",
    context: "Monthly M2 stock from the MEI summary.",
  },
  {
    id: "gdp",
    report: "mei",
    title: "GDP growth",
    context: "Real GDP growth print from Monthly Economic Indicators.",
  },
];

export function viewsForReport(report: EiReportId): EiViewMeta[] {
  return EI_VIEWS.filter((v) => v.report === report);
}

export const DEFAULT_EI_VIEW: Record<Exclude<EiReportId, "overview">, EiViewId> = {
  cpi: "headline",
  dei: "money",
  wei: "reserves",
  mei: "external",
};

/** @deprecated use EI_REPORTS — kept briefly for any stray imports */
export const EI_LEVELS = EI_REPORTS;
export type EiLevel = EiReportId;
