import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { resolveDatabaseUrl } from "./client.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
void __dirname;

const url = resolveDatabaseUrl();
const client = new pg.Client({ connectionString: url });
await client.connect();

await client.query(`
CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  report_id TEXT NOT NULL,
  url TEXT NOT NULL,
  page TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES sources(id),
  url TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  from_date TEXT,
  to_date TEXT,
  fetched_at TEXT NOT NULL,
  raw_path TEXT
);

CREATE TABLE IF NOT EXISTS series (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  short_title TEXT NOT NULL,
  market TEXT NOT NULL,
  unit TEXT NOT NULL,
  frequency TEXT NOT NULL,
  aliases_json TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source_report_id TEXT NOT NULL,
  description TEXT NOT NULL,
  morning_brief BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS series_market_idx ON series(market);

CREATE TABLE IF NOT EXISTS observations (
  id TEXT PRIMARY KEY,
  series_id TEXT NOT NULL REFERENCES series(id),
  period TEXT NOT NULL,
  value DOUBLE PRECISION NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  source_url TEXT,
  document_id TEXT REFERENCES documents(id),
  as_of TEXT,
  verified_by TEXT,
  notes TEXT,
  confidence DOUBLE PRECISION,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS obs_series_period_uidx ON observations(series_id, period);
CREATE INDEX IF NOT EXISTS obs_status_idx ON observations(status);
CREATE INDEX IF NOT EXISTS obs_series_period_idx ON observations(series_id, period);

CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  observation_id TEXT NOT NULL REFERENCES observations(id),
  decision TEXT NOT NULL,
  before_value DOUBLE PRECISION,
  after_value DOUBLE PRECISION,
  reviewer TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS "user" (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  image TEXT,
  phone TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  role TEXT DEFAULT 'user',
  stripe_customer_id TEXT,
  subscription_status TEXT DEFAULT 'free'
);

CREATE TABLE IF NOT EXISTS session (
  id TEXT PRIMARY KEY,
  expires_at TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  user_id TEXT NOT NULL REFERENCES "user"(id)
);

CREATE TABLE IF NOT EXISTS account (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES "user"(id),
  access_token TEXT,
  refresh_token TEXT,
  id_token TEXT,
  access_token_expires_at TEXT,
  refresh_token_expires_at TEXT,
  scope TEXT,
  password TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS verification (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS news_sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  homepage_url TEXT NOT NULL,
  favicon_url TEXT,
  kind TEXT NOT NULL,
  feed_url TEXT,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS news_articles (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES news_sources(id),
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  image_url TEXT,
  published_at TEXT,
  content_hash TEXT NOT NULL,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS news_articles_url_uidx ON news_articles(url);
CREATE INDEX IF NOT EXISTS news_articles_source_idx ON news_articles(source_id);
CREATE INDEX IF NOT EXISTS news_articles_published_idx ON news_articles(published_at);

CREATE TABLE IF NOT EXISTS news_editions (
  id TEXT PRIMARY KEY,
  slot TEXT NOT NULL,
  edition_date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ready'
);
CREATE UNIQUE INDEX IF NOT EXISTS news_editions_date_slot_uidx ON news_editions(edition_date, slot);
CREATE INDEX IF NOT EXISTS news_editions_date_idx ON news_editions(edition_date);

CREATE TABLE IF NOT EXISTS news_edition_items (
  id TEXT PRIMARY KEY,
  edition_id TEXT NOT NULL REFERENCES news_editions(id),
  article_id TEXT NOT NULL REFERENCES news_articles(id),
  rank DOUBLE PRECISION NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS news_edition_items_uidx ON news_edition_items(edition_id, article_id);
CREATE INDEX IF NOT EXISTS news_edition_items_edition_idx ON news_edition_items(edition_id);
`);

await client.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS phone TEXT`);

await client.end();
console.log(`Postgres migrations applied at ${url.replace(/:[^:@/]+@/, ":****@")}`);
