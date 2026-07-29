import Fastify from "fastify";
import cors from "@fastify/cors";
import { z } from "zod";
import { getSeriesById } from "@lankapulse/shared";
import {
  exportCsv,
  getDailyCompleteness,
  getMorningBrief,
  getMorningMarkets,
  getPendingReviews,
  getProductionSiblings,
  getSeriesDetail,
  listCatalog,
  searchSeries,
} from "./services/series.js";
import { ingestObservations } from "./services/ingest.js";
import { applyReview, approvePeriod } from "./services/reviews.js";
import { getScrapeStatus, startScrape, SCRAPE_SOURCES } from "./services/scrape.js";
import {
  getNewsScrapeStatus,
  startNewsScrape,
} from "./services/newsScrape.js";
import { getTermRepoBook } from "./services/termRepo.js";
import {
  getLatestNewsEdition,
  getNewsEditionByDateSlot,
  getNewsEditionById,
  ingestNews,
  listNewsEditions,
} from "./services/news.js";

const app = Fastify({ logger: true, requestTimeout: 120_000 });
await app.register(cors, { origin: true });

function assertAdmin(headers: Record<string, string | string[] | undefined>) {
  const expected = process.env.ADMIN_SECRET ?? "dev-admin";
  const raw = headers["x-admin-secret"];
  const got = Array.isArray(raw) ? raw[0] : (raw ?? "");
  if (got !== expected) {
    throw new Error("Unauthorized — set x-admin-secret header");
  }
}

app.get("/health", async () => ({ ok: true, service: "marketpulse-api" }));

app.get("/series", async (req) => {
  const q = z.object({ market: z.string().optional() }).parse(req.query);
  return listCatalog(q.market);
});

app.get("/series/search", async (req) => {
  const q = z.object({ q: z.string().default("") }).parse(req.query);
  return searchSeries(q.q);
});

app.get("/brief/morning", async () => getMorningBrief());

app.get("/brief/markets", async () => getMorningMarkets());

app.get("/brief/siblings", async () => getProductionSiblings());

app.get("/mm/term-repo", async (req) => {
  const q = z.object({ asOf: z.string().optional() }).parse(req.query);
  return getTermRepoBook(q.asOf);
});

app.get("/news/latest", async (req) => {
  const q = z.object({ home: z.enum(["0", "1"]).default("0") }).parse(req.query);
  return (await getLatestNewsEdition({ home: q.home === "1" })) ?? { items: [] };
});

app.get("/news/editions", async (req) => {
  const q = z
    .object({
      date: z.string().optional(),
      limit: z.coerce.number().int().min(1).max(90).optional(),
    })
    .parse(req.query);
  return listNewsEditions(q);
});

app.get("/news/editions/:id", async (req, reply) => {
  const params = z.object({ id: z.string() }).parse(req.params);
  // Support date lookup via id like "2026-07-28" or legacy "2026-07-28:morning"
  if (/^\d{4}-\d{2}-\d{2}/.test(params.id)) {
    const date = params.id.slice(0, 10);
    const edition =
      (await getNewsEditionByDateSlot(date, "latest")) ||
      (await getNewsEditionByDateSlot(date, "evening")) ||
      (await getNewsEditionByDateSlot(date, "morning"));
    if (!edition) return reply.code(404).send({ error: "Edition not found" });
    return edition;
  }
  const edition = await getNewsEditionById(params.id);
  if (!edition) return reply.code(404).send({ error: "Edition not found" });
  return edition;
});

app.get("/series/:id", async (req, reply) => {
  const params = z.object({ id: z.string() }).parse(req.params);
  const query = z
    .object({ range: z.enum(["1Y", "5Y", "MAX"]).default("1Y") })
    .parse(req.query);
  const detail = await getSeriesDetail(params.id, query.range);
  if (!detail) return reply.code(404).send({ error: "Series not found" });
  return detail;
});

app.get("/series/:id/export.csv", async (req, reply) => {
  const params = z.object({ id: z.string() }).parse(req.params);
  const query = z
    .object({ pro: z.enum(["0", "1"]).default("0") })
    .parse(req.query);
  if (!getSeriesById(params.id)) return reply.code(404).send({ error: "Not found" });
  const csv = await exportCsv(params.id, query.pro === "1");
  reply.header("content-type", "text/csv; charset=utf-8");
  reply.header(
    "content-disposition",
    `attachment; filename="${params.id}.csv"`,
  );
  return csv;
});

app.get("/ops/reviews", async (req, reply) => {
  try {
    assertAdmin(req.headers);
  } catch (err) {
    return reply.code(401).send({ error: (err as Error).message });
  }
  const q = z
    .object({ all: z.enum(["0", "1"]).default("0") })
    .parse(req.query);
  return getPendingReviews({ productionSliceOnly: q.all !== "1" });
});

app.get("/ops/daily", async (req, reply) => {
  try {
    assertAdmin(req.headers);
  } catch (err) {
    return reply.code(401).send({ error: (err as Error).message });
  }
  const q = z.object({ period: z.string().optional() }).parse(req.query);
  return getDailyCompleteness(q.period);
});

app.post("/ops/reviews", async (req, reply) => {
  try {
    assertAdmin(req.headers);
  } catch (err) {
    return reply.code(401).send({ error: (err as Error).message });
  }
  const body = z
    .object({
      observationId: z.string(),
      decision: z.enum(["approve", "reject", "correct"]),
      correctedValue: z.number().optional(),
      notes: z.string().optional(),
      reviewer: z.string().optional(),
    })
    .parse(req.body);

  try {
    return await applyReview(body);
  } catch (err) {
    return reply.code(400).send({ error: (err as Error).message });
  }
});

app.post("/ops/reviews/approve-period", async (req, reply) => {
  try {
    assertAdmin(req.headers);
  } catch (err) {
    return reply.code(401).send({ error: (err as Error).message });
  }
  const body = z
    .object({
      period: z.string().optional(),
      seriesIds: z.array(z.string()).optional(),
      anyPeriod: z.boolean().optional(),
      reviewer: z.string().optional(),
    })
    .parse(req.body);
  return approvePeriod(body);
});

app.post("/ops/reviews/approve-all", async (req, reply) => {
  try {
    assertAdmin(req.headers);
  } catch (err) {
    return reply.code(401).send({ error: (err as Error).message });
  }
  const pending = await getPendingReviews({ productionSliceOnly: false });
  let approved = 0;
  for (const item of pending) {
    await applyReview({
      observationId: item.id,
      decision: "approve",
      reviewer: "ops-bulk",
    });
    approved += 1;
  }
  return { approved };
});

app.post("/ingest/observations", async (req, reply) => {
  const body = z
    .object({
      observations: z.array(
        z.object({
          seriesId: z.string(),
          period: z.string(),
          value: z.number(),
          sourceUrl: z.string().optional(),
          asOf: z.string().optional(),
          confidence: z.number().min(0).max(1).optional(),
        }),
      ),
      document: z
        .object({
          sourceReportId: z.string(),
          url: z.string(),
          contentHash: z.string(),
          fromDate: z.string().optional(),
          toDate: z.string().optional(),
          rawPath: z.string().optional(),
          fetchedAt: z.string().optional(),
          force: z.boolean().optional(),
        })
        .optional(),
    })
    .parse(req.body);

  try {
    return await ingestObservations(body.observations, body.document);
  } catch (err) {
    return reply.code(400).send({ error: (err as Error).message });
  }
});

app.post("/ingest/news", async (req, reply) => {
  const body = z
    .object({
      slot: z.enum(["latest", "morning", "evening"]).optional(),
      editionDate: z.string(),
      cap: z.number().int().min(1).max(200).optional(),
      articles: z.array(
        z.object({
          sourceId: z.string(),
          url: z.string().url(),
          title: z.string().min(1),
          summary: z.string(),
          imageUrl: z.string().nullable().optional(),
          publishedAt: z.string().nullable().optional(),
          contentHash: z.string().min(1),
        }),
      ),
    })
    .parse(req.body);

  try {
    return await ingestNews(body);
  } catch (err) {
    return reply.code(400).send({ error: (err as Error).message });
  }
});

app.get("/admin/scrape/status", async (req, reply) => {
  try {
    assertAdmin(req.headers);
  } catch (err) {
    return reply.code(401).send({ error: (err as Error).message });
  }
  return getScrapeStatus();
});

app.post("/admin/scrape", async (req, reply) => {
  try {
    assertAdmin(req.headers);
  } catch (err) {
    return reply.code(401).send({ error: (err as Error).message });
  }

  const body = z
    .object({
      reports: z.array(z.string()).min(1).default(["5206", "1059", "1064", "6277"]),
      days: z.number().int().min(1).max(800).default(14),
      dryRun: z.boolean().default(true),
      force: z.boolean().default(false),
      unlock: z.boolean().default(false),
    })
    .parse(req.body);

  const allowed = new Set<string>(SCRAPE_SOURCES.map((s) => s.id));
  const reports = body.reports.filter((r) => allowed.has(r));
  if (!reports.length) {
    return reply.code(400).send({ error: "No valid report ids" });
  }

  try {
    return await startScrape({
      reports,
      days: body.days,
      dryRun: body.dryRun,
      force: body.force,
      unlock: body.unlock,
    });
  } catch (err) {
    return reply.code(409).send({ error: (err as Error).message });
  }
});

app.get("/admin/scrape-news/status", async (req, reply) => {
  try {
    assertAdmin(req.headers);
  } catch (err) {
    return reply.code(401).send({ error: (err as Error).message });
  }
  return getNewsScrapeStatus();
});

app.post("/admin/scrape-news", async (req, reply) => {
  try {
    assertAdmin(req.headers);
  } catch (err) {
    return reply.code(401).send({ error: (err as Error).message });
  }

  const body = z
    .object({
      dryRun: z.boolean().default(false),
      sources: z.array(z.string()).optional(),
    })
    .parse(req.body);

  try {
    return await startNewsScrape(body);
  } catch (err) {
    return reply.code(409).send({ error: (err as Error).message });
  }
});

app.post("/billing/checkout-session", async (req, reply) => {
  const body = z
    .object({
      email: z.string().email().optional(),
      successUrl: z.string().url(),
      cancelUrl: z.string().url(),
    })
    .parse(req.body);

  const key = process.env.STRIPE_SECRET_KEY;
  const price = process.env.STRIPE_PRICE_PRO;

  if (!key || !price || key.includes("replace")) {
    return reply.send({
      mode: "demo",
      message: "Stripe not configured. Set STRIPE_SECRET_KEY and STRIPE_PRICE_PRO.",
      demoUpgradeUrl: "/pricing?demo=1",
    });
  }

  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(key);
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: body.email,
    line_items: [{ price, quantity: 1 }],
    success_url: body.successUrl,
    cancel_url: body.cancelUrl,
  });

  return { url: session.url, id: session.id };
});

const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? "0.0.0.0";

try {
  await app.listen({ port, host });
  console.log(`API listening on http://${host}:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
