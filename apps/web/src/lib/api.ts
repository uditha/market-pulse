const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type TermRepoBook = {
  asOf: string;
  outstandingRepo: number;
  outstandingReverseRepo: number;
  outstandingTotal: number;
  repoWaYield: number | null;
  reverseRepoWaYield: number | null;
  openAuctionCount: number;
  repo: {
    side: "repo" | "reverse_repo";
    outstandingAmount: number;
    waYield: number | null;
    openAuctions: number;
    auctions: TermAuction[];
  };
  reverseRepo: {
    side: "repo" | "reverse_repo";
    outstandingAmount: number;
    waYield: number | null;
    openAuctions: number;
    auctions: TermAuction[];
  };
  recentAuctions: TermAuction[];
};

export type TermAuction = {
  auctionDate: string;
  settlementDate: string | null;
  maturityDate: string | null;
  side: "repo" | "reverse_repo";
  offerRepo: number | null;
  offerReverseRepo: number | null;
  received: number | null;
  accepted: number;
  minRate: number | null;
  maxRate: number | null;
  waYield: number | null;
  tenureDays: number | null;
  outstanding: boolean;
  status: string;
};

export type SeriesLatest = {
  seriesId: string;
  title: string;
  shortTitle: string;
  unit: string;
  value: number | null;
  previousValue: number | null;
  change: number | null;
  period: string | null;
  asOf: string | null;
  lastUpdated?: string | null;
  status: string | null;
  sourceUrl: string | null;
  confidence?: number | null;
  sparkline: number[];
  description?: string;
  frequency?: string;
  market?: string;
  history?: {
    period: string;
    value: number;
    asOf?: string | null;
    status?: string;
    lastUpdated?: string | null;
    confidence?: number | null;
  }[];
};

export type ReviewItem = {
  id: string;
  seriesId: string;
  title: string;
  shortTitle: string;
  unit: string;
  period: string;
  value: number;
  previousValue: number | null;
  previousPeriod: string | null;
  delta: number | null;
  sourceUrl: string | null;
  asOf: string | null;
  confidence?: number | null;
};

export type DailyFieldStatus = {
  seriesId: string;
  shortTitle: string;
  unit: string;
  value: number | null;
  period?: string | null;
  status: "missing" | "pending" | "approved" | "other" | "blank";
  required?: boolean;
  observationId: string | null;
  confidence: number | null;
};

export type DailyReportStatus = {
  reportId: string;
  title: string;
  locked?: boolean;
  period?: string;
  latestPerSeries?: boolean;
  expectedCount: number;
  present: number;
  pending: number;
  approved: number;
  missing: number;
  complete: boolean;
  readyToPublish: boolean;
  fields: DailyFieldStatus[];
};

export type DailyCompleteness = {
  period: string | null;
  reports: DailyReportStatus[];
};

export type ReportRunResult = {
  reportId: string;
  title?: string;
  ok: boolean;
  error?: string;
  observations?: number;
  seriesIds?: string[];
};

export type ScrapeRunResult = {
  ok: boolean;
  dryRun: boolean;
  force?: boolean;
  reports: string[];
  days: number;
  startedAt: string;
  finishedAt: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  pendingAfter: number;
  summary?: {
    ok: boolean;
    totalObservations: number;
    reports: ReportRunResult[];
  } | null;
};

export type ScrapeLive = {
  message: string;
  startedAt: string;
  reports: string[];
  days: number;
  dryRun: boolean;
  force: boolean;
  log: string;
};

export type ScrapeStatus = {
  running: boolean;
  sources: { id: string; title: string; production?: boolean; locked?: boolean }[];
  pendingCount: number;
  lastRun: ScrapeRunResult | null;
  rawFiles: { name: string; bytes: number; modifiedAt: string }[];
  extractorReady: boolean;
  extractorDir: string;
  /** Present while a scrape is running (or briefly after). */
  live?: ScrapeLive | null;
};

export type NewsArticle = {
  id: string;
  sourceId: string;
  sourceName: string;
  faviconUrl: string | null;
  homepageUrl?: string | null;
  url: string;
  title: string;
  summary: string;
  imageUrl: string | null;
  publishedAt: string | null;
  rank?: number;
};

export type NewsEdition = {
  id: string;
  slot: string;
  editionDate: string;
  createdAt: string;
  status?: string;
  items: NewsArticle[];
};

export type MorningMarketBoard = {
  id: string;
  label: string;
  title: string;
  path: string;
  blurb: string;
  metrics: SeriesLatest[];
};

export type NewsEditionSummary = {
  id: string;
  slot: string;
  editionDate: string;
  createdAt: string;
  status: string;
  itemCount: number;
};

export type NewsScrapeLive = {
  message: string;
  startedAt: string;
  slot: string;
  dryRun: boolean;
  log: string;
};

export type NewsScrapeLastRun = {
  ok: boolean;
  dryRun: boolean;
  slot: string;
  startedAt: string;
  finishedAt: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  summary: {
    ok?: boolean;
    totalArticles?: number;
    editionDate?: string;
    slot?: string;
    sources?: { sourceId: string; ok: boolean; count?: number; error?: string }[];
    ingest?: { itemCount?: number; editionId?: string; error?: string };
  } | null;
};

export type NewsScrapeStatus = {
  running: boolean;
  sources: { id: string; name: string; kind: string; enabled: boolean }[];
  lastRun: NewsScrapeLastRun | null;
  extractorReady: boolean;
  live: NewsScrapeLive | null;
};

async function getJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { cache: "no-store", ...init });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `API ${res.status}: ${path}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  morningBrief: () => getJson<SeriesLatest[]>("/brief/morning"),
  morningMarkets: () => getJson<MorningMarketBoard[]>("/brief/markets"),
  siblings: () => getJson<SeriesLatest[]>("/brief/siblings"),
  newsLatest: (opts?: { home?: boolean }) =>
    getJson<NewsEdition | { items: [] }>(
      opts?.home ? "/news/latest?home=1" : "/news/latest",
    ),
  newsEditions: (date?: string) =>
    getJson<NewsEditionSummary[]>(
      date ? `/news/editions?date=${encodeURIComponent(date)}` : "/news/editions",
    ),
  newsEdition: (id: string) =>
    getJson<NewsEdition>(`/news/editions/${encodeURIComponent(id)}`),
  termRepoBook: (asOf?: string) =>
    getJson<TermRepoBook>(
      asOf ? `/mm/term-repo?asOf=${encodeURIComponent(asOf)}` : "/mm/term-repo",
    ),
  search: (q: string) =>
    getJson<SeriesLatest[]>(`/series/search?q=${encodeURIComponent(q)}`),
  series: (id: string, range: "1Y" | "5Y" | "MAX" = "1Y") =>
    getJson<SeriesLatest>(`/series/${encodeURIComponent(id)}?range=${range}`),
  reviews: (secret: string, opts?: { all?: boolean }) =>
    getJson<ReviewItem[]>(opts?.all ? "/ops/reviews?all=1" : "/ops/reviews", {
      headers: { "x-admin-secret": secret },
    }),
  dailyCompleteness: (secret: string, period?: string) =>
    getJson<DailyCompleteness>(
      period ? `/ops/daily?period=${encodeURIComponent(period)}` : "/ops/daily",
      { headers: { "x-admin-secret": secret } },
    ),
  review: async (
    secret: string,
    body: {
      observationId: string;
      decision: "approve" | "reject" | "correct";
      correctedValue?: number;
      notes?: string;
    },
  ) => {
    const res = await fetch(`${API_URL}/ops/reviews`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-admin-secret": secret,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  approveAll: async (secret: string) => {
    const res = await fetch(`${API_URL}/ops/reviews/approve-all`, {
      method: "POST",
      headers: { "x-admin-secret": secret },
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<{ approved: number }>;
  },
  approvePeriod: async (
    secret: string,
    period: string | undefined,
    seriesIds?: string[],
    opts?: { anyPeriod?: boolean },
  ) => {
    const res = await fetch(`${API_URL}/ops/reviews/approve-period`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-admin-secret": secret,
      },
      body: JSON.stringify({
        period,
        seriesIds,
        anyPeriod: opts?.anyPeriod,
      }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<{ approved: number; period: string }>;
  },
  checkout: async (email?: string) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
    const res = await fetch(`${API_URL}/billing/checkout-session`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email,
        successUrl: `${origin}/pricing?success=1`,
        cancelUrl: `${origin}/pricing?cancel=1`,
      }),
    });
    return res.json() as Promise<{
      url?: string;
      mode?: string;
      demoUpgradeUrl?: string;
      message?: string;
    }>;
  },
  exportUrl: (id: string, pro = false) =>
    `${API_URL}/series/${encodeURIComponent(id)}/export.csv?pro=${pro ? "1" : "0"}`,
  adminStatus: (secret: string) =>
    getJson<ScrapeStatus>("/admin/scrape/status", {
      headers: { "x-admin-secret": secret },
    }),
  /** Starts scrape in background; response is current status (poll for live log). */
  adminScrape: (
    secret: string,
    body: {
      reports: string[];
      days: number;
      dryRun: boolean;
      force?: boolean;
      unlock?: boolean;
    },
  ) =>
    getJson<ScrapeStatus>("/admin/scrape", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-admin-secret": secret,
      },
      body: JSON.stringify(body),
    }),
  adminNewsStatus: (secret: string) =>
    getJson<NewsScrapeStatus>("/admin/scrape-news/status", {
      headers: { "x-admin-secret": secret },
    }),
  adminNewsScrape: (
    secret: string,
    body: { dryRun?: boolean; sources?: string[] },
  ) =>
    getJson<NewsScrapeStatus>("/admin/scrape-news", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-admin-secret": secret,
      },
      body: JSON.stringify(body),
    }),
};
