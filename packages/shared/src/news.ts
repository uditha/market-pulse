/** Sri Lanka business news outlets for the Market news snapshot. */

export type NewsSourceKind = "rss" | "html_listing" | "next_data";

export type NewsSourceDef = {
  id: string;
  name: string;
  homepageUrl: string;
  faviconUrl: string;
  kind: NewsSourceKind;
  /** RSS/Atom URL or HTML listing URL. */
  feedUrl: string;
  enabled: boolean;
};

export const NEWS_EDITION_CAP = 100;
export const NEWS_HOME_CAP = 6;

/** Single rolling snapshot per Colombo day (no morning/evening split). */
export const NEWS_SLOT = "latest" as const;
export type NewsSlot = typeof NEWS_SLOT;

export const NEWS_SOURCES: NewsSourceDef[] = [
  {
    id: "economynext",
    name: "EconomyNext",
    homepageUrl: "https://economynext.com/",
    faviconUrl: "https://www.google.com/s2/favicons?domain=economynext.com&sz=128",
    kind: "rss",
    feedUrl: "https://economynext.com/feed/",
    enabled: true,
  },
  {
    id: "lbo",
    name: "Lanka Business Online",
    homepageUrl: "https://www.lankabusinessonline.com/",
    faviconUrl: "https://www.google.com/s2/favicons?domain=lankabusinessonline.com&sz=128",
    kind: "rss",
    feedUrl: "https://www.lankabusinessonline.com/feed/",
    enabled: true,
  },
  {
    id: "adaderana-biz",
    name: "Ada Derana Biz",
    homepageUrl: "https://bizenglish.adaderana.lk/",
    faviconUrl: "https://www.google.com/s2/favicons?domain=adaderana.lk&sz=128",
    kind: "rss",
    feedUrl: "https://bizenglish.adaderana.lk/feed/",
    enabled: true,
  },
  {
    id: "lmd",
    name: "LMD",
    homepageUrl: "https://lmd.lk/",
    faviconUrl: "https://www.google.com/s2/favicons?domain=lmd.lk&sz=128",
    kind: "rss",
    feedUrl: "https://lmd.lk/feed/",
    enabled: true,
  },
  {
    id: "business-today",
    name: "Business Today",
    homepageUrl: "https://businesstoday.lk/",
    faviconUrl: "https://www.google.com/s2/favicons?domain=businesstoday.lk&sz=128",
    kind: "rss",
    feedUrl: "https://businesstoday.lk/feed/",
    enabled: true,
  },
  {
    id: "newswire",
    name: "NewsWire",
    homepageUrl: "https://www.newswire.lk/",
    faviconUrl: "https://www.google.com/s2/favicons?domain=newswire.lk&sz=128",
    kind: "rss",
    feedUrl: "https://www.newswire.lk/feed/",
    enabled: true,
  },
  {
    id: "ft",
    name: "Daily FT",
    homepageUrl: "https://www.ft.lk/",
    faviconUrl: "https://www.google.com/s2/favicons?domain=ft.lk&sz=128",
    kind: "html_listing",
    feedUrl: "https://www.ft.lk/",
    enabled: true,
  },
  {
    id: "echelon",
    name: "Echelon",
    homepageUrl: "https://www.echelon.lk/",
    faviconUrl: "https://www.google.com/s2/favicons?domain=echelon.lk&sz=128",
    kind: "next_data",
    feedUrl: "https://echelon.lk/category/features/",
    enabled: true,
  },
  {
    id: "daily-mirror-biz",
    name: "Daily Mirror Business",
    homepageUrl: "https://www.dailymirror.lk/business",
    faviconUrl: "https://www.google.com/s2/favicons?domain=dailymirror.lk&sz=128",
    kind: "html_listing",
    feedUrl: "https://www.dailymirror.lk/business",
    enabled: true,
  },
  {
    id: "sunday-times",
    name: "Sunday Times Business",
    homepageUrl: "https://www.sundaytimes.lk/",
    faviconUrl: "https://www.google.com/s2/favicons?domain=sundaytimes.lk&sz=128",
    kind: "html_listing",
    feedUrl: "https://www.sundaytimes.lk/",
    enabled: true,
  },
  {
    id: "the-morning",
    name: "The Morning",
    homepageUrl: "https://www.themorning.lk/",
    faviconUrl: "https://www.google.com/s2/favicons?domain=themorning.lk&sz=128",
    kind: "next_data",
    feedUrl: "https://www.themorning.lk/",
    enabled: true,
  },
];

export function getNewsSource(id: string): NewsSourceDef | undefined {
  return NEWS_SOURCES.find((s) => s.id === id);
}
