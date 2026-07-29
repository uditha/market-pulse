"use client";

import Link from "next/link";
import type { Point } from "@/components/mm/chartTheme";

export function latest(points: Point[]): number | null {
  if (!points.length) return null;
  return points[points.length - 1]?.value ?? null;
}

export function asOf(points: Point[]): string | null {
  return points.at(-1)?.period ?? null;
}

export function delta(points: Point[]): number | null {
  if (points.length < 2) return null;
  return points[points.length - 1]!.value - points[points.length - 2]!.value;
}

export function fmtNum(n: number | null, digits = 1): string {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits > 0 && Math.abs(n) < 100 ? Math.min(digits, 1) : 0,
  });
}

export function fmtPct(n: number | null, digits = 1): string {
  if (n == null || Number.isNaN(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(digits)}%`;
}

export function Spark({ values }: { values: number[] }) {
  if (values.length < 2) {
    return <span className="ei3-spark is-empty" aria-hidden />;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const w = 56;
  const h = 20;
  const d = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / span) * (h - 4) - 2;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg className="ei3-spark" viewBox={`0 0 ${w} ${h}`} aria-hidden>
      <path d={d} fill="none" strokeWidth={1.5} />
    </svg>
  );
}

export function Readout({
  href,
  label,
  value,
  unit,
  points,
}: {
  href: string;
  label: string;
  value: string;
  unit?: string;
  points: Point[];
}) {
  const d = delta(points);
  return (
    <Link href={href} className="ei3-readout">
      <span className="ei3-readout-label">{label}</span>
      <span className="ei3-readout-value">
        {value}
        {unit ? <small>{unit}</small> : null}
      </span>
      <span className="ei3-readout-meta">
        {d != null ? (
          <span className={d >= 0 ? "is-up" : "is-down"}>
            {d >= 0 ? "+" : "−"}
            {fmtNum(Math.abs(d), Math.abs(d) >= 10 ? 0 : 2)}
          </span>
        ) : (
          <span>—</span>
        )}
        <Spark values={points.slice(-16).map((p) => p.value)} />
      </span>
    </Link>
  );
}

export function TapeItem({
  href,
  label,
  value,
  unit,
  points,
}: {
  href: string;
  label: string;
  value: string;
  unit?: string;
  points: Point[];
}) {
  const d = delta(points);
  return (
    <Link href={href} className="ei3-tape-item">
      <span className="ei3-tape-label">{label}</span>
      <span className="ei3-tape-value">
        {value}
        {unit ? <small>{unit}</small> : null}
      </span>
      {d != null ? (
        <span className={`ei3-tape-delta${d >= 0 ? " is-up" : " is-down"}`}>
          {d >= 0 ? "▲" : "▼"}
          {fmtNum(Math.abs(d), Math.abs(d) >= 10 ? 0 : 2)}
        </span>
      ) : null}
    </Link>
  );
}
