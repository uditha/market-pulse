import { z } from "zod";

export const ObservationStatusSchema = z.enum([
  "pending",
  "approved",
  "rejected",
  "revised",
]);

export const ObservationSchema = z.object({
  id: z.string(),
  seriesId: z.string(),
  period: z.string(),
  value: z.number(),
  status: ObservationStatusSchema,
  sourceUrl: z.string().optional(),
  documentId: z.string().optional(),
  asOf: z.string().optional(),
  verifiedBy: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const SeriesLatestSchema = z.object({
  seriesId: z.string(),
  title: z.string(),
  shortTitle: z.string(),
  unit: z.string(),
  value: z.number().nullable(),
  previousValue: z.number().nullable(),
  change: z.number().nullable(),
  period: z.string().nullable(),
  asOf: z.string().nullable(),
  lastUpdated: z.string().nullable().optional(),
  status: ObservationStatusSchema.nullable(),
  sourceUrl: z.string().nullable(),
  confidence: z.number().nullable().optional(),
  sparkline: z.array(z.number()),
});

export const ReviewDecisionSchema = z.object({
  observationId: z.string(),
  decision: z.enum(["approve", "reject", "correct"]),
  correctedValue: z.number().optional(),
  notes: z.string().optional(),
  reviewer: z.string().default("ops"),
});

export type Observation = z.infer<typeof ObservationSchema>;
export type SeriesLatest = z.infer<typeof SeriesLatestSchema>;
export type ReviewDecision = z.infer<typeof ReviewDecisionSchema>;
