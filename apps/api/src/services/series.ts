import { and, asc, desc, eq, gte, inArray } from "drizzle-orm";
import {
  MORNING_BRIEF_IDS,
  MORNING_SUMMARY_BOARDS,
  PRODUCTION_SLICE_IDS,
  REPORT_DAILY_EXPECTATIONS,
  searchSeriesCatalog,
  getSeriesById,
  type SeriesDefinition,
} from "@lankapulse/shared";
import { db, schema } from "../db.js";

function addYears(isoDate: string, years: number) {
  const d = new Date(isoDate);
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d.toISOString().slice(0, 10);
}

export async function listCatalog(market?: string) {
  if (market) {
    return db.select().from(schema.series).where(eq(schema.series.market, market));
  }
  return db.select().from(schema.series);
}

export async function searchSeries(q: string) {
  const fromCatalog = searchSeriesCatalog(q, 25);
  return Promise.all(fromCatalog.map((s) => enrichLatest(s)));
}

async function approvedHistory(seriesId: string, since?: string) {
  return db
    .select()
    .from(schema.observations)
    .where(
      and(
        eq(schema.observations.seriesId, seriesId),
        eq(schema.observations.status, "approved"),
        since ? gte(schema.observations.period, since) : undefined,
      ),
    )
    .orderBy(asc(schema.observations.period));
}

/** Public CBSL link only — never expose local archive `file://` paths. */
function publicSourceUrl(
  observed: string | null | undefined,
  catalog: string,
): string {
  if (observed && /^https?:\/\//i.test(observed)) return observed;
  return catalog;
}

export async function enrichLatest(def: SeriesDefinition) {
  const rows = (await approvedHistory(def.id)).sort((a, b) =>
    b.period.localeCompare(a.period),
  );
  const latest = rows[0] ?? null;
  const prev = rows[1] ?? null;
  const sparkline = rows
    .slice(0, 30)
    .reverse()
    .map((r) => r.value);

  return {
    seriesId: def.id,
    title: def.title,
    shortTitle: def.shortTitle,
    unit: def.unit,
    frequency: def.frequency,
    market: def.market,
    description: def.description,
    aliases: def.aliases,
    value: latest?.value ?? null,
    previousValue: prev?.value ?? null,
    change:
      latest && prev ? Number((latest.value - prev.value).toFixed(4)) : null,
    period: latest?.period ?? null,
    asOf: latest?.asOf ?? latest?.period ?? null,
    lastUpdated: latest?.updatedAt ?? null,
    status: latest?.status ?? null,
    sourceUrl: publicSourceUrl(latest?.sourceUrl, def.sourceUrl),
    confidence: latest?.confidence ?? null,
    sparkline,
  };
}

export async function getMorningBrief() {
  return Promise.all(
    MORNING_BRIEF_IDS.map(async (id) => {
      const def = getSeriesById(id)!;
      return enrichLatest(def);
    }),
  );
}

/** All-desk morning summary for the home page. */
export async function getMorningMarkets() {
  return Promise.all(
    MORNING_SUMMARY_BOARDS.map(async (board) => {
      const metrics = (
        await Promise.all(
          board.seriesIds.map(async (id) => {
            const def = getSeriesById(id);
            if (!def) return null;
            return enrichLatest(def);
          }),
        )
      ).filter((m): m is NonNullable<typeof m> => m != null);

      return {
        id: board.id,
        label: board.label,
        title: board.title,
        path: board.path,
        blurb: board.blurb,
        metrics,
      };
    }),
  );
}

/** Same-scrape siblings for the production slice (excludes brief primaries). */
export async function getProductionSiblings() {
  const brief = new Set(MORNING_BRIEF_IDS);
  const defs = PRODUCTION_SLICE_IDS.filter((id) => !brief.has(id)).map(
    (id) => getSeriesById(id)!,
  );
  return Promise.all(defs.map((def) => enrichLatest(def)));
}

export async function getSeriesDetail(
  seriesId: string,
  range: "1Y" | "5Y" | "MAX" = "1Y",
) {
  const def = getSeriesById(seriesId);
  if (!def) return null;

  const today = new Date().toISOString().slice(0, 10);
  const since =
    range === "MAX" ? undefined : range === "5Y" ? addYears(today, -5) : addYears(today, -1);

  const history = await approvedHistory(seriesId, since);
  const latest = await enrichLatest(def);

  return {
    ...latest,
    description: def.description,
    history: history.map((h) => ({
      period: h.period,
      value: h.value,
      asOf: h.asOf,
      status: h.status,
      lastUpdated: h.updatedAt,
      confidence: h.confidence,
    })),
  };
}

export async function exportCsv(seriesId: string, isPro: boolean) {
  const detail = await getSeriesDetail(seriesId, isPro ? "MAX" : "1Y");
  if (!detail) return null;
  const limited = isPro ? detail.history : detail.history.slice(-60);
  const lines = [
    "period,value,as_of",
    ...limited.map((h) => `${h.period},${h.value},${h.asOf ?? ""}`),
  ];
  return lines.join("\n");
}

export async function getPendingReviews(opts?: { productionSliceOnly?: boolean }) {
  const sliceOnly = opts?.productionSliceOnly !== false;

  const rows = await db
    .select({
      id: schema.observations.id,
      seriesId: schema.observations.seriesId,
      period: schema.observations.period,
      value: schema.observations.value,
      status: schema.observations.status,
      sourceUrl: schema.observations.sourceUrl,
      asOf: schema.observations.asOf,
      confidence: schema.observations.confidence,
      createdAt: schema.observations.createdAt,
      updatedAt: schema.observations.updatedAt,
      title: schema.series.title,
      shortTitle: schema.series.shortTitle,
      unit: schema.series.unit,
    })
    .from(schema.observations)
    .innerJoin(schema.series, eq(schema.observations.seriesId, schema.series.id))
    .where(
      and(
        eq(schema.observations.status, "pending"),
        sliceOnly
          ? inArray(schema.observations.seriesId, [...PRODUCTION_SLICE_IDS])
          : undefined,
      ),
    )
    .orderBy(desc(schema.observations.period));

  return Promise.all(
    rows.map(async (row) => {
      const approved = await db
        .select()
        .from(schema.observations)
        .where(
          and(
            eq(schema.observations.seriesId, row.seriesId),
            eq(schema.observations.status, "approved"),
          ),
        )
        .orderBy(desc(schema.observations.period));
      const previous = approved.find((o) => o.period < row.period);

      return {
        ...row,
        previousValue: previous?.value ?? null,
        previousPeriod: previous?.period ?? null,
        delta:
          previous != null ? Number((row.value - previous.value).toFixed(4)) : null,
      };
    }),
  );
}

export async function getDailyCompleteness(period?: string) {
  let target = period;
  if (!target) {
    const latest = await db
      .select({ period: schema.observations.period })
      .from(schema.observations)
      .where(inArray(schema.observations.seriesId, [...PRODUCTION_SLICE_IDS]))
      .orderBy(desc(schema.observations.period))
      .limit(1);
    target = latest[0]?.period;
  }

  if (!target) {
    return { period: null, reports: [] as Awaited<ReturnType<typeof buildReportStatus>>[] };
  }

  return {
    period: target,
    reports: await Promise.all(
      REPORT_DAILY_EXPECTATIONS.map(async (exp) => {
        const reportPeriod = period
          ? period
          : ((await latestPeriodForSeries([...exp.seriesIds])) ?? target!);
        return buildReportStatus(exp, reportPeriod);
      }),
    ),
  };
}

async function latestPeriodForSeries(seriesIds: string[]): Promise<string | undefined> {
  if (!seriesIds.length) return undefined;
  const row = await db
    .select({ period: schema.observations.period })
    .from(schema.observations)
    .where(inArray(schema.observations.seriesId, seriesIds))
    .orderBy(desc(schema.observations.period))
    .limit(1);
  return row[0]?.period;
}

async function buildReportStatus(
  exp: (typeof REPORT_DAILY_EXPECTATIONS)[number],
  period: string,
) {
  const required = new Set(
    "requiredSeriesIds" in exp && exp.requiredSeriesIds
      ? [...exp.requiredSeriesIds]
      : [...exp.seriesIds],
  );
  const latestPerSeries = Boolean(
    "latestPerSeries" in exp && exp.latestPerSeries,
  );

  const fields = await Promise.all(
    exp.seriesIds.map(async (seriesId) => {
      const def = getSeriesById(seriesId)!;
      const rows = latestPerSeries
        ? await db
            .select()
            .from(schema.observations)
            .where(eq(schema.observations.seriesId, seriesId))
            .orderBy(desc(schema.observations.period))
            .limit(1)
        : await db
            .select()
            .from(schema.observations)
            .where(
              and(
                eq(schema.observations.seriesId, seriesId),
                eq(schema.observations.period, period),
              ),
            )
            .limit(1);
      const row = rows[0];

      const requiredField = required.has(seriesId);
      const status = !row
        ? requiredField
          ? ("missing" as const)
          : ("blank" as const)
        : row.status === "approved"
          ? ("approved" as const)
          : row.status === "pending"
            ? ("pending" as const)
            : ("other" as const);

      return {
        seriesId,
        shortTitle: def.shortTitle,
        unit: def.unit,
        value: row?.value ?? null,
        period: row?.period ?? null,
        status,
        required: requiredField,
        observationId: row?.id ?? null,
        confidence: row?.confidence ?? null,
      };
    }),
  );

  const requiredFields = fields.filter((f) => f.required);
  const present = requiredFields.filter((f) => f.status !== "missing" && f.status !== "blank").length;
  const pending = fields.filter((f) => f.status === "pending").length;
  const approved = fields.filter((f) => f.status === "approved").length;
  const missing = requiredFields.filter((f) => f.status === "missing").length;
  const complete = missing === 0;
  const expectedCount =
    "requiredSeriesIds" in exp && exp.requiredSeriesIds
      ? exp.requiredSeriesIds.length
      : exp.expectedCount;

  const fieldPeriods = fields
    .map((f) => f.period)
    .filter((p): p is string => !!p)
    .sort()
    .reverse();
  const reportPeriod = latestPerSeries ? (fieldPeriods[0] ?? period) : period;

  return {
    reportId: exp.reportId,
    title: exp.title,
    locked: exp.locked,
    period: reportPeriod,
    latestPerSeries,
    expectedCount,
    present,
    pending,
    approved,
    missing,
    complete,
    readyToPublish: complete && pending === 0,
    fields,
  };
}
