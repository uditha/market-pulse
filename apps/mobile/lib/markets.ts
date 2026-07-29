export const MARKET_TABS = [
  {
    id: "mm",
    label: "MM",
    title: "Money Market",
    blurb: "Call, repo, SDF/SLF, T-bills, and bank rates.",
    live: true,
  },
  {
    id: "fx",
    label: "FX",
    title: "Forex",
    blurb: "USD/LKR and major crosses — coming next.",
    live: false,
  },
  {
    id: "fi",
    label: "FI",
    title: "Fixed Income",
    blurb: "Bond yields and government securities curve.",
    live: false,
  },
  {
    id: "share",
    label: "Share",
    title: "Shares",
    blurb: "CSE equities and indices — coming next.",
    live: false,
  },
  {
    id: "ei",
    label: "EI",
    title: "Economic Indicators",
    blurb: "Inflation — CCPI / NCPI headline and core.",
    live: true,
  },
] as const;

export type MarketTabId = (typeof MARKET_TABS)[number]["id"];
