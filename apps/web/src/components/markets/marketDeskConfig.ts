/**
 * Market desk presentation config.
 * Live groups = series we scrape today. `comingNext` = planned expansion (UI only).
 */

export type DeskMetric = {
  seriesId: string;
  label: string;
  digits?: number;
  /** Append unit from series meta when true (default). */
  showUnit?: boolean;
};

export type DeskChartView = {
  id: string;
  title: string;
  context: string;
  seriesIds: string[];
  zeroLine?: boolean;
};

export type MarketDeskConfig = {
  tabId: "fx" | "fi" | "share";
  title: string;
  blurb: string;
  cadence: string;
  /** Hero strip metrics */
  hero: DeskMetric[];
  charts: DeskChartView[];
  /** Flat list of all live series for the desk grid */
  liveSeriesIds: string[];
  /** Planned series / sources — shown as expansion roadmap, not fetched yet */
  comingNext: string[];
};

export const FX_DESK: MarketDeskConfig = {
  tabId: "fx",
  title: "Forex",
  blurb: "Daily TT/spot from DEI; weekly mids, forwards and USD YTD % from WEI.",
  cadence: "Daily DEI · weekly WEI pack",
  hero: [
    { seriesId: "sl.fx.usd.spot", label: "USD Spot", digits: 2 },
    { seriesId: "sl.fx.usd.tt_buy", label: "USD TT Buy", digits: 2 },
    { seriesId: "sl.fx.usd.tt_sell", label: "USD TT Sell", digits: 2 },
    { seriesId: "sl.fx.usd.ytd_change_pct", label: "USD YTD %", digits: 1 },
    { seriesId: "sl.fx.usd.week_avg_mid", label: "Wk Mid", digits: 2 },
  ],
  charts: [
    {
      id: "usd",
      title: "USD/LKR",
      context: "Indicative spot with TT buy / sell band from the daily indicators pack.",
      seriesIds: ["sl.fx.usd.spot", "sl.fx.usd.tt_buy", "sl.fx.usd.tt_sell"],
    },
    {
      id: "wei-fx",
      title: "Weekly FX pack",
      context: "Week-average mid, USD forwards and YTD % from Weekly Economic Indicators (dual scale).",
      seriesIds: [
        "sl.fx.usd.week_avg_mid",
        "sl.fx.usd.fwd_1m",
        "sl.fx.usd.fwd_3m",
        "sl.fx.usd.ytd_change_pct",
      ],
    },
    {
      id: "majors",
      title: "GBP · EUR · JPY TT mid",
      context: "Telegraphic transfer mid = (buy + sell) / 2 when both legs exist.",
      seriesIds: ["sl.fx.gbp.tt_buy", "sl.fx.eur.tt_buy", "sl.fx.jpy.tt_buy"],
    },
  ],
  liveSeriesIds: [
    "sl.fx.usd.spot",
    "sl.fx.usd.tt_buy",
    "sl.fx.usd.tt_sell",
    "sl.fx.gbp.tt_buy",
    "sl.fx.gbp.tt_sell",
    "sl.fx.eur.tt_buy",
    "sl.fx.eur.tt_sell",
    "sl.fx.jpy.tt_buy",
    "sl.fx.jpy.tt_sell",
    "sl.fx.usd.ytd_change_pct",
    "sl.fx.usd.week_avg_mid",
    "sl.fx.gbp.week_avg_mid",
    "sl.fx.eur.week_avg_mid",
    "sl.fx.jpy.week_avg_mid",
    "sl.fx.usd.fwd_1m",
    "sl.fx.usd.fwd_3m",
  ],
  comingNext: [
    "Intraday / mid-rate crosses from bank boards",
    "NEER–REER (not in WEI PDF — needs separate CBSL table)",
  ],
};

export const FI_DESK: MarketDeskConfig = {
  tabId: "fi",
  title: "Fixed Income",
  blurb: "T-bill daily from DEI; bond curve, ISBs and auctions from WEI.",
  cadence: "Daily DEI · weekly WEI curve / auction",
  hero: [
    { seriesId: "sl.fi.tbill.91d.primary", label: "91d", digits: 2 },
    { seriesId: "sl.fi.tbill.182d.primary", label: "182d", digits: 2 },
    { seriesId: "sl.fi.tbill.364d.primary", label: "364d", digits: 2 },
    { seriesId: "sl.fi.tbond.10y.secondary_mid", label: "10Y", digits: 2 },
  ],
  charts: [
    {
      id: "primary",
      title: "T-bill primary curve",
      context: "91 / 182 / 364 day primary market yields from the DEI yield box.",
      seriesIds: [
        "sl.fi.tbill.91d.primary",
        "sl.fi.tbill.182d.primary",
        "sl.fi.tbill.364d.primary",
      ],
    },
    {
      id: "bond-curve",
      title: "T-bond secondary curve",
      context: "Week-ending secondary mid yields from Weekly Economic Indicators §3.3.",
      seriesIds: [
        "sl.fi.tbond.2y.secondary_mid",
        "sl.fi.tbond.5y.secondary_mid",
        "sl.fi.tbond.10y.secondary_mid",
        "sl.fi.tbond.20y.secondary_mid",
      ],
    },
    {
      id: "secondary",
      title: "T-bill secondary when printed",
      context: "DEI secondary cells are often blank; WEI week-ending fills when published.",
      seriesIds: [
        "sl.fi.tbill.91d.secondary",
        "sl.fi.tbill.182d.secondary",
        "sl.fi.tbill.364d.secondary",
      ],
    },
    {
      id: "liquidity-spreads",
      title: "Bid–ask liquidity",
      context: "3M T-bill price spread and 5Y bond yield buy−sell from WEI two-way quotes.",
      seriesIds: [
        "sl.fi.tbill.3m.bid_ask_spread",
        "sl.fi.tbond.5y.bid_ask_yield",
      ],
    },
  ],
  liveSeriesIds: [
    "sl.fi.tbill.91d.primary",
    "sl.fi.tbill.182d.primary",
    "sl.fi.tbill.364d.primary",
    "sl.fi.tbill.91d.secondary",
    "sl.fi.tbill.182d.secondary",
    "sl.fi.tbill.364d.secondary",
    "sl.fi.tbond.2y.secondary_mid",
    "sl.fi.tbond.3y.secondary_mid",
    "sl.fi.tbond.5y.secondary_mid",
    "sl.fi.tbond.10y.secondary_mid",
    "sl.fi.tbond.20y.secondary_mid",
    "sl.fi.isb.2028_04_pdi",
    "sl.fi.isb.2030_01_macro",
    "sl.fi.tbill.auction.cover",
    "sl.fi.gov.foreign_holdings",
    "sl.fi.tbill.3m.bid_ask_spread",
    "sl.fi.tbond.5y.bid_ask_yield",
  ],
  comingNext: [
    "eResearch 6169 as hardened primary for T-bills",
    "Full ISB strip on the FI desk",
  ],
};

export const SHARE_DESK: MarketDeskConfig = {
  tabId: "share",
  title: "Shares",
  blurb: "CSE ASPI, S&P SL20, turnover and foreign flows from Daily Economic Indicators.",
  cadence: "Daily DEI · week-ending close should match WEI highlights",
  hero: [
    { seriesId: "sl.eq.aspi", label: "ASPI", digits: 2 },
    { seriesId: "sl.eq.sp_sl20", label: "S&P SL20", digits: 2 },
    { seriesId: "sl.eq.turnover", label: "Turnover", digits: 1 },
    { seriesId: "sl.eq.market_cap", label: "Mkt Cap", digits: 1 },
  ],
  charts: [
    {
      id: "indices",
      title: "ASPI & S&P SL20",
      context: "Daily closes from DEI share-market box (dual scale).",
      seriesIds: ["sl.eq.aspi", "sl.eq.sp_sl20"],
    },
    {
      id: "flows",
      title: "Turnover & foreign flow",
      context: "Activity and non-resident purchases / sales (Rs. mn).",
      seriesIds: [
        "sl.eq.turnover",
        "sl.eq.foreign_purchases",
        "sl.eq.foreign_sales",
      ],
    },
  ],
  liveSeriesIds: [
    "sl.eq.aspi",
    "sl.eq.sp_sl20",
    "sl.eq.turnover",
    "sl.eq.market_cap",
    "sl.eq.pe_ratio",
    "sl.eq.foreign_purchases",
    "sl.eq.foreign_sales",
    "sl.eq.foreign_net",
    "sl.eq.aspi_wow_pct",
  ],
  comingNext: [
    "Sector indices and breadth from CSE direct feed",
    "MEI month-end share market block as confirmation prints",
    "Corporate actions / free-float adjustments",
  ],
};

export const DESK_BY_TAB = {
  fx: FX_DESK,
  fi: FI_DESK,
  share: SHARE_DESK,
} as const;

export function allLiveSeriesIds(config: MarketDeskConfig): string[] {
  const ids = new Set<string>([
    ...config.liveSeriesIds,
    ...config.hero.map((h) => h.seriesId),
    ...config.charts.flatMap((c) => c.seriesIds),
  ]);
  return [...ids];
}
