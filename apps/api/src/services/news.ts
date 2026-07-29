import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { NEWS_EDITION_CAP, NEWS_HOME_CAP, getNewsSource } from "@lankapulse/shared";
import { db, schema } from "../db.js";

export type NewsArticleIn = {
  sourceId: string;
  url: string;
  title: string;
  summary: string;
  imageUrl?: string | null;
  publishedAt?: string | null;
  contentHash: string;
};

export type NewsIngestBody = {
  /** Always stored as "latest" — morning/evening accepted for back-compat. */
  slot?: "latest" | "morning" | "evening";
  editionDate: string;
  articles: NewsArticleIn[];
  /** Cap items in this edition (default NEWS_EDITION_CAP). */
  cap?: number;
};

function now() {
  return new Date().toISOString();
}

const LATEST_SLOT = "latest";

function normalizeSlot(_slot?: string) {
  return LATEST_SLOT;
}

function articlePayload(row: typeof schema.newsArticles.$inferSelect) {
  const src = getNewsSource(row.sourceId);
  return {
    id: row.id,
    sourceId: row.sourceId,
    sourceName: src?.name ?? row.sourceId,
    faviconUrl: src?.faviconUrl ?? null,
    homepageUrl: src?.homepageUrl ?? null,
    url: row.url,
    title: row.title,
    summary: row.summary,
    imageUrl: row.imageUrl,
    publishedAt: row.publishedAt,
    firstSeenAt: row.firstSeenAt,
    lastSeenAt: row.lastSeenAt,
  };
}

async function loadEditionItems(editionId: string) {
  const rows = await db
    .select({
      item: schema.newsEditionItems,
      article: schema.newsArticles,
    })
    .from(schema.newsEditionItems)
    .innerJoin(
      schema.newsArticles,
      eq(schema.newsEditionItems.articleId, schema.newsArticles.id),
    )
    .where(eq(schema.newsEditionItems.editionId, editionId))
    .orderBy(asc(schema.newsEditionItems.rank));

  return rows.map((r) => ({
    rank: r.item.rank,
    ...articlePayload(r.article),
  }));
}

export async function ingestNews(body: NewsIngestBody) {
  const ts = now();
  const cap = Math.max(1, Math.min(body.cap ?? NEWS_EDITION_CAP, 200));

  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.editionDate)) {
    throw new Error("editionDate must be YYYY-MM-DD");
  }
  const slot = normalizeSlot(body.slot);

  let inserted = 0;
  let updated = 0;
  const articleIds: string[] = [];

  for (const a of body.articles) {
    const sourceRows = await db
      .select()
      .from(schema.newsSources)
      .where(eq(schema.newsSources.id, a.sourceId))
      .limit(1);
    if (!sourceRows[0]) {
      continue;
    }

    const existing = await db
      .select()
      .from(schema.newsArticles)
      .where(eq(schema.newsArticles.url, a.url))
      .limit(1);

    if (existing[0]) {
      await db
        .update(schema.newsArticles)
        .set({
          title: a.title,
          summary: a.summary,
          imageUrl: a.imageUrl ?? existing[0].imageUrl,
          publishedAt: a.publishedAt ?? existing[0].publishedAt,
          contentHash: a.contentHash,
          lastSeenAt: ts,
        })
        .where(eq(schema.newsArticles.id, existing[0].id));
      articleIds.push(existing[0].id);
      updated += 1;
    } else {
      const id = randomUUID();
      await db.insert(schema.newsArticles).values({
        id,
        sourceId: a.sourceId,
        url: a.url,
        title: a.title,
        summary: a.summary,
        imageUrl: a.imageUrl ?? null,
        publishedAt: a.publishedAt ?? null,
        contentHash: a.contentHash,
        firstSeenAt: ts,
        lastSeenAt: ts,
      });
      articleIds.push(id);
      inserted += 1;
    }
  }

  // Deduplicate ids while preserving scraper order (newest-first).
  const seen = new Set<string>();
  const rankedIds = articleIds.filter((id) => {
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  }).slice(0, cap);

  const existingEdition = await db
    .select()
    .from(schema.newsEditions)
    .where(
      and(
        eq(schema.newsEditions.editionDate, body.editionDate),
        eq(schema.newsEditions.slot, slot),
      ),
    )
    .limit(1);

  let editionId: string;
  if (existingEdition[0]) {
    editionId = existingEdition[0].id;
    await db
      .delete(schema.newsEditionItems)
      .where(eq(schema.newsEditionItems.editionId, editionId));
    await db
      .update(schema.newsEditions)
      .set({ createdAt: ts, status: "ready" })
      .where(eq(schema.newsEditions.id, editionId));
  } else {
    editionId = randomUUID();
    await db.insert(schema.newsEditions).values({
      id: editionId,
      slot,
      editionDate: body.editionDate,
      createdAt: ts,
      status: "ready",
    });
  }

  for (let i = 0; i < rankedIds.length; i++) {
    await db.insert(schema.newsEditionItems).values({
      id: randomUUID(),
      editionId,
      articleId: rankedIds[i]!,
      rank: i + 1,
    });
  }

  return {
    editionId,
    editionDate: body.editionDate,
    slot,
    inserted,
    updated,
    itemCount: rankedIds.length,
  };
}

export async function getLatestNewsEdition(opts?: { home?: boolean }) {
  // Prefer the rolling "latest" slot so legacy morning/evening rows cannot win.
  const preferred = await db
    .select()
    .from(schema.newsEditions)
    .where(
      and(
        eq(schema.newsEditions.status, "ready"),
        eq(schema.newsEditions.slot, LATEST_SLOT),
      ),
    )
    .orderBy(desc(schema.newsEditions.editionDate), desc(schema.newsEditions.createdAt))
    .limit(1);

  const fallback = preferred[0]
    ? []
    : await db
        .select()
        .from(schema.newsEditions)
        .where(eq(schema.newsEditions.status, "ready"))
        .orderBy(desc(schema.newsEditions.editionDate), desc(schema.newsEditions.createdAt))
        .limit(1);

  const edition = preferred[0] ?? fallback[0];
  if (!edition) {
    return null;
  }

  let items = await loadEditionItems(edition.id);
  if (opts?.home) {
    items = items.slice(0, NEWS_HOME_CAP);
  }

  return {
    id: edition.id,
    slot: edition.slot,
    editionDate: edition.editionDate,
    createdAt: edition.createdAt,
    items,
  };
}

export async function listNewsEditions(opts?: { date?: string; limit?: number }) {
  const limit = Math.max(1, Math.min(opts?.limit ?? 30, 90));
  const rows = opts?.date
    ? await db
        .select()
        .from(schema.newsEditions)
        .where(eq(schema.newsEditions.editionDate, opts.date))
        .orderBy(desc(schema.newsEditions.createdAt))
    : await db
        .select()
        .from(schema.newsEditions)
        .orderBy(desc(schema.newsEditions.editionDate), desc(schema.newsEditions.createdAt))
        .limit(limit);

  const out = [];
  const seenDates = new Set<string>();
  for (const e of rows) {
    // One row per calendar day — prefer "latest", then first seen.
    if (seenDates.has(e.editionDate)) continue;
    if (e.slot !== LATEST_SLOT) {
      const hasLatest = rows.some(
        (r) => r.editionDate === e.editionDate && r.slot === LATEST_SLOT,
      );
      if (hasLatest) continue;
    }
    seenDates.add(e.editionDate);
    const countRows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.newsEditionItems)
      .where(eq(schema.newsEditionItems.editionId, e.id));
    out.push({
      id: e.id,
      slot: e.slot,
      editionDate: e.editionDate,
      createdAt: e.createdAt,
      status: e.status,
      itemCount: Number(countRows[0]?.count ?? 0),
    });
  }
  return out;
}

export async function getNewsEditionById(id: string) {
  const rows = await db
    .select()
    .from(schema.newsEditions)
    .where(eq(schema.newsEditions.id, id))
    .limit(1);
  const edition = rows[0];
  if (!edition) return null;
  const items = await loadEditionItems(edition.id);
  return {
    id: edition.id,
    slot: edition.slot,
    editionDate: edition.editionDate,
    createdAt: edition.createdAt,
    status: edition.status,
    items,
  };
}

export async function getNewsEditionByDateSlot(date: string, slot: string) {
  const rows = await db
    .select()
    .from(schema.newsEditions)
    .where(
      and(
        eq(schema.newsEditions.editionDate, date),
        eq(schema.newsEditions.slot, slot),
      ),
    )
    .limit(1);
  const edition = rows[0];
  if (!edition) return null;
  return getNewsEditionById(edition.id);
}
