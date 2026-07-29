import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, schema } from "../db.js";

export interface IngestObservation {
  seriesId: string;
  period: string;
  value: number;
  sourceUrl?: string;
  asOf?: string;
  confidence?: number;
}

export interface IngestDocumentMeta {
  sourceReportId: string;
  url: string;
  contentHash: string;
  fromDate?: string;
  toDate?: string;
  rawPath?: string;
  fetchedAt?: string;
  /** Bypass content-hash short-circuit (re-parse same HTML). */
  force?: boolean;
}

function now() {
  return new Date().toISOString();
}

function sourceKey(reportId: string) {
  const map: Record<string, string> = {
    "5206": "mmSummary",
    "1059": "dailyOps",
    "1062": "outright",
    "1064": "termRepo",
    "6169": "govSecurities",
    "6277": "lendingDeposit",
    lending: "lendingDeposit",
    "policy-rates": "policyRates",
    "consumer-price-inflation": "consumerPriceInflation",
    "daily-economic-indicators": "dailyEconomicIndicators",
    "weekly-economic-indicators": "weeklyEconomicIndicators",
    "monthly-economic-indicators": "monthlyEconomicIndicators",
    "external-sector-performance": "externalSectorPerformance",
  };
  return map[reportId] ?? reportId;
}

export async function ingestObservations(
  observations: IngestObservation[],
  document?: IngestDocumentMeta,
) {
  const ts = now();
  let documentId: string | undefined;
  let skippedUnknown = 0;

  if (document) {
    const existingRows = await db
      .select()
      .from(schema.documents)
      .where(eq(schema.documents.contentHash, document.contentHash))
      .limit(1);
    const existing = existingRows[0];

    if (existing && !document.force) {
      return {
        skipped: true,
        reason: "unchanged_content_hash",
        documentId: existing.id,
        inserted: 0,
        updated: 0,
        pending: 0,
        skippedUnknown: 0,
      };
    }

    if (existing && document.force) {
      documentId = existing.id;
    } else {
      const sid = sourceKey(document.sourceReportId);
      const sourceRows = await db
        .select()
        .from(schema.sources)
        .where(eq(schema.sources.id, sid))
        .limit(1);
      const source = sourceRows[0];
      if (!source) {
        throw new Error(`Unknown source for report ${document.sourceReportId} (expected ${sid})`);
      }

      documentId = randomUUID();
      await db.insert(schema.documents).values({
        id: documentId,
        sourceId: sid,
        url: document.url,
        contentHash: document.contentHash,
        fromDate: document.fromDate,
        toDate: document.toDate,
        fetchedAt: document.fetchedAt ?? ts,
        rawPath: document.rawPath,
      });
    }
  }

  let inserted = 0;
  let updated = 0;
  let pending = 0;
  let unchanged = 0;

  for (const obs of observations) {
    const seriesRows = await db
      .select()
      .from(schema.series)
      .where(eq(schema.series.id, obs.seriesId))
      .limit(1);
    if (!seriesRows[0]) {
      skippedUnknown += 1;
      continue;
    }

    const existingRows = await db
      .select()
      .from(schema.observations)
      .where(
        and(
          eq(schema.observations.seriesId, obs.seriesId),
          eq(schema.observations.period, obs.period),
        ),
      )
      .limit(1);
    const existing = existingRows[0];

    const confidence =
      obs.confidence != null && Number.isFinite(obs.confidence) ? obs.confidence : null;

    if (!existing) {
      await db.insert(schema.observations).values({
        id: randomUUID(),
        seriesId: obs.seriesId,
        period: obs.period,
        value: obs.value,
        status: "pending",
        sourceUrl: obs.sourceUrl,
        documentId,
        asOf: obs.asOf ?? obs.period,
        verifiedBy: null,
        notes: null,
        confidence,
        createdAt: ts,
        updatedAt: ts,
      });
      inserted += 1;
      pending += 1;
      continue;
    }

    if (
      existing.value === obs.value &&
      existing.status === "approved" &&
      !document?.force
    ) {
      unchanged += 1;
      continue;
    }

    if (existing.value === obs.value && existing.status === "pending" && !document?.force) {
      await db
        .update(schema.observations)
        .set({
          sourceUrl: obs.sourceUrl ?? existing.sourceUrl,
          documentId: documentId ?? existing.documentId,
          confidence: confidence ?? existing.confidence,
          updatedAt: ts,
        })
        .where(eq(schema.observations.id, existing.id));
      unchanged += 1;
      pending += 1;
      continue;
    }

    await db
      .update(schema.observations)
      .set({
        value: obs.value,
        status: "pending",
        sourceUrl: obs.sourceUrl ?? existing.sourceUrl,
        documentId: documentId ?? existing.documentId,
        asOf: obs.asOf ?? obs.period,
        verifiedBy: null,
        confidence,
        updatedAt: ts,
      })
      .where(eq(schema.observations.id, existing.id));
    updated += 1;
    pending += 1;
  }

  return {
    skipped: false,
    documentId,
    inserted,
    updated,
    pending,
    unchanged,
    skippedUnknown,
  };
}
