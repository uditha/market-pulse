import { and, inArray } from "drizzle-orm";
import { db, schema } from "../db.js";

const FIELD_IDS = [
  "sl.mm.term_repo.accepted",
  "sl.mm.term_repo.wa_yield",
  "sl.mm.term_repo.min_rate",
  "sl.mm.term_repo.max_rate",
  "sl.mm.term_repo.tenure",
  "sl.mm.term_repo.settlement_date",
  "sl.mm.term_repo.maturity_date",
  "sl.mm.term_repo.side",
  "sl.mm.term_repo.offer_repo",
  "sl.mm.term_repo.offer_reverse_repo",
  "sl.mm.term_repo.received",
] as const;

export type TermAuctionSide = "repo" | "reverse_repo";

export type TermAuction = {
  auctionDate: string;
  settlementDate: string | null;
  maturityDate: string | null;
  side: TermAuctionSide;
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

export type TermSideBook = {
  side: TermAuctionSide;
  outstandingAmount: number;
  waYield: number | null;
  openAuctions: number;
  auctions: TermAuction[];
};

function yyyymmddToIso(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  const s = String(Math.round(value));
  if (s.length !== 8) return null;
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

function sideFromValue(value: number | null | undefined): TermAuctionSide {
  return value === 2 ? "reverse_repo" : "repo";
}

function weightedAverage(
  items: { amount: number; rate: number | null }[],
): number | null {
  let num = 0;
  let den = 0;
  for (const item of items) {
    if (item.rate == null || item.amount <= 0) continue;
    num += item.amount * item.rate;
    den += item.amount;
  }
  return den > 0 ? Number((num / den).toFixed(4)) : null;
}

/**
 * Outstanding term book: auctions where settlement ≤ asOf < maturity
 * and accepted > 0, split by repo vs reverse-repo side.
 */
export async function getTermRepoBook(asOf?: string) {
  const asOfDate = asOf ?? new Date().toISOString().slice(0, 10);

  const rows = await db
    .select()
    .from(schema.observations)
    .where(
      and(
        inArray(schema.observations.seriesId, [...FIELD_IDS]),
        inArray(schema.observations.status, ["approved", "pending"]),
      ),
    );

  const byPeriod = new Map<string, Record<string, { value: number; status: string }>>();
  for (const row of rows) {
    const bucket = byPeriod.get(row.period) ?? {};
    const prev = bucket[row.seriesId];
    if (!prev || (prev.status !== "approved" && row.status === "approved")) {
      bucket[row.seriesId] = { value: row.value, status: row.status };
    }
    byPeriod.set(row.period, bucket);
  }

  const auctions: TermAuction[] = [];
  for (const [auctionDate, fields] of byPeriod) {
    const accepted = fields["sl.mm.term_repo.accepted"]?.value;
    if (accepted == null || accepted <= 0) continue;

    const settlementDate = yyyymmddToIso(fields["sl.mm.term_repo.settlement_date"]?.value);
    const maturityDate = yyyymmddToIso(fields["sl.mm.term_repo.maturity_date"]?.value);
    const side = sideFromValue(fields["sl.mm.term_repo.side"]?.value);
    const outstanding =
      !!settlementDate &&
      !!maturityDate &&
      settlementDate <= asOfDate &&
      asOfDate < maturityDate;

    auctions.push({
      auctionDate,
      settlementDate,
      maturityDate,
      side,
      offerRepo: fields["sl.mm.term_repo.offer_repo"]?.value ?? null,
      offerReverseRepo: fields["sl.mm.term_repo.offer_reverse_repo"]?.value ?? null,
      received: fields["sl.mm.term_repo.received"]?.value ?? null,
      accepted,
      minRate: fields["sl.mm.term_repo.min_rate"]?.value ?? null,
      maxRate: fields["sl.mm.term_repo.max_rate"]?.value ?? null,
      waYield: fields["sl.mm.term_repo.wa_yield"]?.value ?? null,
      tenureDays: fields["sl.mm.term_repo.tenure"]?.value ?? null,
      outstanding,
      status: fields["sl.mm.term_repo.accepted"]?.status ?? "pending",
    });
  }

  auctions.sort((a, b) => b.auctionDate.localeCompare(a.auctionDate));

  function bookFor(side: TermAuctionSide): TermSideBook {
    const open = auctions.filter((a) => a.side === side && a.outstanding);
    return {
      side,
      outstandingAmount: Number(
        open.reduce((sum, a) => sum + a.accepted, 0).toFixed(4),
      ),
      waYield: weightedAverage(open.map((a) => ({ amount: a.accepted, rate: a.waYield }))),
      openAuctions: open.length,
      auctions: open,
    };
  }

  const repo = bookFor("repo");
  const reverseRepo = bookFor("reverse_repo");

  return {
    asOf: asOfDate,
    outstandingRepo: repo.outstandingAmount,
    outstandingReverseRepo: reverseRepo.outstandingAmount,
    outstandingTotal: Number(
      (repo.outstandingAmount + reverseRepo.outstandingAmount).toFixed(4),
    ),
    repoWaYield: repo.waYield,
    reverseRepoWaYield: reverseRepo.waYield,
    openAuctionCount: repo.openAuctions + reverseRepo.openAuctions,
    repo,
    reverseRepo,
    recentAuctions: auctions.slice(0, 12),
  };
}
