import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { PRODUCTION_SLICE_IDS } from "@lankapulse/shared";
import { db, schema } from "../db.js";
import { getPendingReviews } from "./series.js";

export async function applyReview(input: {
  observationId: string;
  decision: "approve" | "reject" | "correct";
  correctedValue?: number;
  notes?: string;
  reviewer?: string;
}) {
  const rows = await db
    .select()
    .from(schema.observations)
    .where(eq(schema.observations.id, input.observationId))
    .limit(1);
  const obs = rows[0];

  if (!obs) {
    throw new Error("Observation not found");
  }

  const ts = new Date().toISOString();
  const reviewer = input.reviewer ?? "ops";
  let afterValue = obs.value;
  let status = obs.status;

  if (input.decision === "approve") {
    status = "approved";
  } else if (input.decision === "reject") {
    status = "rejected";
  } else if (input.decision === "correct") {
    if (input.correctedValue == null || Number.isNaN(input.correctedValue)) {
      throw new Error("correctedValue required");
    }
    afterValue = input.correctedValue;
    status = "approved";
  }

  await db
    .update(schema.observations)
    .set({
      value: afterValue,
      status,
      verifiedBy: reviewer,
      notes: input.notes,
      updatedAt: ts,
    })
    .where(eq(schema.observations.id, obs.id));

  await db.insert(schema.reviews).values({
    id: randomUUID(),
    observationId: obs.id,
    decision: input.decision,
    beforeValue: obs.value,
    afterValue,
    reviewer,
    notes: input.notes,
    createdAt: ts,
  });

  const updated = await db
    .select()
    .from(schema.observations)
    .where(eq(schema.observations.id, obs.id))
    .limit(1);
  return updated[0];
}

/** Approve pending observations for a calendar period (optionally one report's series).
 *  Pass anyPeriod=true for sparse / monthly reports where each series has its own latest date.
 *
 *  When `seriesIds` is set, do not gate on the production MM slice — otherwise EI / other
 *  catalog reports can never be approved from the ops checklist.
 */
export async function approvePeriod(input: {
  period?: string;
  seriesIds?: string[];
  anyPeriod?: boolean;
  reviewer?: string;
}) {
  const seriesIds = input.seriesIds?.length
    ? input.seriesIds
    : [...PRODUCTION_SLICE_IDS];

  if (!input.anyPeriod && !input.period) {
    return { approved: 0, period: "none" };
  }

  const conditions = [
    eq(schema.observations.status, "pending"),
    inArray(schema.observations.seriesId, seriesIds),
  ];
  if (!input.anyPeriod && input.period) {
    conditions.push(eq(schema.observations.period, input.period));
  }

  const pending = await db
    .select({ id: schema.observations.id })
    .from(schema.observations)
    .where(and(...conditions));

  let approved = 0;
  for (const item of pending) {
    await applyReview({
      observationId: item.id,
      decision: "approve",
      reviewer: input.reviewer ?? "ops-day",
    });
    approved += 1;
  }
  return { approved, period: input.period ?? "any" };
}
