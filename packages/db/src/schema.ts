import {
  pgTable,
  text,
  doublePrecision,
  boolean,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const sources = pgTable("sources", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  reportId: text("report_id").notNull(),
  url: text("url").notNull(),
  page: text("page"),
  createdAt: text("created_at").notNull(),
});

export const documents = pgTable("documents", {
  id: text("id").primaryKey(),
  sourceId: text("source_id")
    .notNull()
    .references(() => sources.id),
  url: text("url").notNull(),
  contentHash: text("content_hash").notNull(),
  fromDate: text("from_date"),
  toDate: text("to_date"),
  fetchedAt: text("fetched_at").notNull(),
  rawPath: text("raw_path"),
});

export const series = pgTable(
  "series",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    shortTitle: text("short_title").notNull(),
    market: text("market").notNull(),
    unit: text("unit").notNull(),
    frequency: text("frequency").notNull(),
    aliasesJson: text("aliases_json").notNull(),
    sourceUrl: text("source_url").notNull(),
    sourceReportId: text("source_report_id").notNull(),
    description: text("description").notNull(),
    morningBrief: boolean("morning_brief").notNull().default(false),
  },
  (t) => [index("series_market_idx").on(t.market)],
);

export const observations = pgTable(
  "observations",
  {
    id: text("id").primaryKey(),
    seriesId: text("series_id")
      .notNull()
      .references(() => series.id),
    period: text("period").notNull(),
    value: doublePrecision("value").notNull(),
    status: text("status").notNull().default("pending"),
    sourceUrl: text("source_url"),
    documentId: text("document_id").references(() => documents.id),
    asOf: text("as_of"),
    verifiedBy: text("verified_by"),
    notes: text("notes"),
    /** Parser confidence 0–1; null for legacy/manual rows. */
    confidence: doublePrecision("confidence"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    uniqueIndex("obs_series_period_uidx").on(t.seriesId, t.period),
    index("obs_status_idx").on(t.status),
    index("obs_series_period_idx").on(t.seriesId, t.period),
  ],
);

export const reviews = pgTable("reviews", {
  id: text("id").primaryKey(),
  observationId: text("observation_id")
    .notNull()
    .references(() => observations.id),
  decision: text("decision").notNull(),
  beforeValue: doublePrecision("before_value"),
  afterValue: doublePrecision("after_value"),
  reviewer: text("reviewer").notNull(),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
});

export const users = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  phone: text("phone"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  role: text("role").default("user"),
  stripeCustomerId: text("stripe_customer_id"),
  subscriptionStatus: text("subscription_status").default("free"),
});

export const sessions = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: text("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
});

export const accounts = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: text("access_token_expires_at"),
  refreshTokenExpiresAt: text("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const verifications = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at"),
  updatedAt: text("updated_at"),
});

/** Sri Lanka business news outlets (RSS / HTML listing scrapers). */
export const newsSources = pgTable("news_sources", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  homepageUrl: text("homepage_url").notNull(),
  faviconUrl: text("favicon_url"),
  kind: text("kind").notNull(), // rss | html_listing
  feedUrl: text("feed_url"),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: text("created_at").notNull(),
});

export const newsArticles = pgTable(
  "news_articles",
  {
    id: text("id").primaryKey(),
    sourceId: text("source_id")
      .notNull()
      .references(() => newsSources.id),
    url: text("url").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    imageUrl: text("image_url"),
    publishedAt: text("published_at"),
    contentHash: text("content_hash").notNull(),
    firstSeenAt: text("first_seen_at").notNull(),
    lastSeenAt: text("last_seen_at").notNull(),
  },
  (t) => [
    uniqueIndex("news_articles_url_uidx").on(t.url),
    index("news_articles_source_idx").on(t.sourceId),
    index("news_articles_published_idx").on(t.publishedAt),
  ],
);

/** Morning (05:00) / evening (18:00) Colombo snapshot. */
export const newsEditions = pgTable(
  "news_editions",
  {
    id: text("id").primaryKey(),
    slot: text("slot").notNull(), // morning | evening
    editionDate: text("edition_date").notNull(), // YYYY-MM-DD Asia/Colombo
    createdAt: text("created_at").notNull(),
    status: text("status").notNull().default("ready"),
  },
  (t) => [
    uniqueIndex("news_editions_date_slot_uidx").on(t.editionDate, t.slot),
    index("news_editions_date_idx").on(t.editionDate),
  ],
);

export const newsEditionItems = pgTable(
  "news_edition_items",
  {
    id: text("id").primaryKey(),
    editionId: text("edition_id")
      .notNull()
      .references(() => newsEditions.id),
    articleId: text("article_id")
      .notNull()
      .references(() => newsArticles.id),
    rank: doublePrecision("rank").notNull(),
  },
  (t) => [
    uniqueIndex("news_edition_items_uidx").on(t.editionId, t.articleId),
    index("news_edition_items_edition_idx").on(t.editionId),
  ],
);
