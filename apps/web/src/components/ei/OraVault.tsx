"use client";

import Link from "next/link";
import type { Point } from "@/components/mm/chartTheme";

export type OraSlice = {
  id: string;
  label: string;
  short: string;
  points: Point[];
  tone: "fx" | "gold" | "imf" | "sdr" | "other";
};

function latest(points: Point[]): { value: number; period: string } | null {
  if (!points.length) return null;
  const last = points[points.length - 1]!;
  return { value: last.value, period: last.period };
}

function fmtUsd(n: number | null): string {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString("en-US", {
    maximumFractionDigits: n >= 100 ? 0 : 1,
  });
}

function monthLabel(period: string | null): string {
  if (!period) return "—";
  const [y, m] = period.split("-");
  if (!y || !m) return period.slice(0, 7);
  const names = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${names[Number(m) - 1] ?? m} ${y}`;
}

type Props = {
  total: Point[];
  slices: OraSlice[];
};

/** Composition “vault” for Official Reserve Assets — strata of the stock. */
export function OraVault({ total, slices }: Props) {
  const tot = latest(total);
  const asOf = tot?.period ?? slices.map((s) => latest(s.points)?.period).find(Boolean) ?? null;

  const parts = slices
    .map((s) => {
      const print = latest(s.points);
      return {
        ...s,
        value: print?.value ?? 0,
        has: print != null,
      };
    })
    .filter((p) => p.has && p.value >= 0);

  const sumParts = parts.reduce((a, p) => a + p.value, 0);
  const denom = tot?.value && tot.value > 0 ? tot.value : sumParts;

  return (
    <section className="ei-ora" aria-label="Official Reserve Assets composition">
      <div className="ei-ora-hero">
        <p className="ei-ora-kicker">Official Reserve Assets</p>
        <div className="ei-ora-total">
          <Link href="/series/sl.ei.total_reserves" className="ei-ora-total-link">
            <strong>{fmtUsd(tot?.value ?? null)}</strong>
            <span>USD mn</span>
          </Link>
          <em>As at end {monthLabel(asOf)}</em>
        </div>
        <p className="ei-ora-blurb">
          How the stock is built — foreign currency, gold, IMF, SDRs, and other.
        </p>
      </div>

      <div
        className="ei-ora-strata"
        role="img"
        aria-label={
          denom > 0
            ? parts
                .map((p) => `${p.label} ${((p.value / denom) * 100).toFixed(0)}%`)
                .join(", ")
            : "No composition data yet"
        }
      >
        {denom > 0 ? (
          parts.map((p) => {
            const pct = (p.value / denom) * 100;
            if (pct < 0.15) return null;
            return (
              <Link
                key={p.id}
                href={`/series/${p.id}`}
                className={`ei-ora-band tone-${p.tone}`}
                style={{ flexGrow: Math.max(pct, 1.2), flexBasis: 0 }}
                title={`${p.label}: ${fmtUsd(p.value)} USD mn (${pct.toFixed(1)}%)`}
              >
                {pct >= 8 ? <span>{p.short}</span> : null}
              </Link>
            );
          })
        ) : (
          <div className="ei-ora-empty">Awaiting WEI §4.3 backfill…</div>
        )}
      </div>

      <ul className="ei-ora-legend">
        {slices.map((s) => {
          const print = latest(s.points);
          const pct =
            print && denom > 0 ? ((print.value / denom) * 100).toFixed(1) : null;
          return (
            <li key={s.id}>
              <Link href={`/series/${s.id}`} className={`ei-ora-chip tone-${s.tone}`}>
                <i aria-hidden />
                <span>
                  <em>{s.label}</em>
                  <strong>
                    {fmtUsd(print?.value ?? null)}
                    {pct != null ? <small>{pct}%</small> : null}
                  </strong>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
