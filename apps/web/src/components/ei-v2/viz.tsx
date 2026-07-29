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
  const a = points[points.length - 1]!.value;
  const b = points[points.length - 2]!.value;
  return a - b;
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

export function Spark({
  values,
  tone = "accent",
  wide,
}: {
  values: number[];
  tone?: "accent" | "copper" | "ink" | "up" | "down";
  wide?: boolean;
}) {
  if (values.length < 2) {
    return <div className={`ei2-spark is-empty${wide ? " is-wide" : ""}`} aria-hidden />;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const w = wide ? 220 : 72;
  const h = wide ? 56 : 28;
  const d = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / span) * (h - 4) - 2;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg className={`ei2-spark tone-${tone}${wide ? " is-wide" : ""}`} viewBox={`0 0 ${w} ${h}`} aria-hidden>
      <path d={d} fill="none" strokeWidth={wide ? 2.2 : 1.6} />
    </svg>
  );
}

export function StatLink({
  href,
  label,
  value,
  unit,
  hint,
  points,
  tone = "accent",
}: {
  href: string;
  label: string;
  value: string;
  unit?: string;
  hint?: string;
  points: Point[];
  tone?: "accent" | "copper" | "ink";
}) {
  const d = delta(points);
  return (
    <Link href={href} className={`ei2-stat tone-${tone}`}>
      <span className="ei2-stat-label">{label}</span>
      <span className="ei2-stat-row">
        <span className="ei2-stat-value">
          {value}
          {unit ? <small>{unit}</small> : null}
        </span>
        <Spark values={points.slice(-20).map((p) => p.value)} tone={tone} />
      </span>
      <span className="ei2-stat-foot">
        {d != null ? (
          <span className={d >= 0 ? "is-up" : "is-down"}>
            {d >= 0 ? "▲" : "▼"} {fmtNum(Math.abs(d), Math.abs(d) >= 10 ? 0 : 2)}
          </span>
        ) : (
          <span>—</span>
        )}
        {hint ? <em>{hint}</em> : null}
      </span>
    </Link>
  );
}

/** Opposing bars for exports vs imports. */
export function TradeTug({
  exports,
  imports,
}: {
  exports: number | null;
  imports: number | null;
}) {
  if (exports == null && imports == null) return null;
  const x = exports ?? 0;
  const m = imports ?? 0;
  const tot = Math.max(x + m, 1);
  const xPct = (x / tot) * 100;
  const mPct = (m / tot) * 100;
  const bal = x - m;
  return (
    <div className="ei2-tug" aria-label="Exports versus imports">
      <div className="ei2-tug-labels">
        <span>
          Exports <strong>{fmtNum(exports, 0)}</strong>
        </span>
        <span>
          Imports <strong>{fmtNum(imports, 0)}</strong>
        </span>
      </div>
      <div className="ei2-tug-track">
        <i className="is-export" style={{ width: `${xPct}%` }} />
        <i className="is-import" style={{ width: `${mPct}%` }} />
      </div>
      <p className="ei2-tug-bal">
        Balance{" "}
        <strong className={bal >= 0 ? "is-up" : "is-down"}>
          {fmtNum(bal, 0)} USD mn
        </strong>
      </p>
    </div>
  );
}

/** Soft composition rings for reserve mix. */
export function ReserveRings({
  slices,
}: {
  slices: { label: string; value: number; tone: string }[];
}) {
  const total = slices.reduce((a, s) => a + s.value, 0);
  if (total <= 0) return null;
  const size = 160;
  const cx = size / 2;
  const cy = size / 2;
  const r = 58;
  const stroke = 16;
  let offset = 0;
  const circ = 2 * Math.PI * r;
  return (
    <div className="ei2-rings">
      <svg viewBox={`0 0 ${size} ${size}`} className="ei2-rings-svg" aria-hidden>
        <circle cx={cx} cy={cy} r={r} className="ei2-rings-track" fill="none" strokeWidth={stroke} />
        {slices.map((s) => {
          const pct = s.value / total;
          const len = circ * pct;
          const el = (
            <circle
              key={s.label}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              strokeWidth={stroke}
              className={`ei2-rings-arc tone-${s.tone}`}
              strokeDasharray={`${len} ${circ - len}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${cx} ${cy})`}
            />
          );
          offset += len;
          return el;
        })}
        <text x={cx} y={cy - 4} textAnchor="middle" className="ei2-rings-total">
          {fmtNum(total, 0)}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" className="ei2-rings-unit">
          USD mn
        </text>
      </svg>
      <ul className="ei2-rings-legend">
        {slices.map((s) => (
          <li key={s.label}>
            <i className={`tone-${s.tone}`} />
            <span>{s.label}</span>
            <strong>{((s.value / total) * 100).toFixed(0)}%</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Pair of vertical “thermometers” for CCPI vs NCPI. */
export function InflatePair({
  ccpi,
  ncpi,
}: {
  ccpi: number | null;
  ncpi: number | null;
}) {
  const max = Math.max(Math.abs(ccpi ?? 0), Math.abs(ncpi ?? 0), 8);
  const h = (v: number | null) =>
    v == null ? 8 : Math.max(10, Math.min(100, (Math.abs(v) / max) * 100));
  return (
    <div className="ei2-thermo" aria-label="CCPI versus NCPI levels">
      {(
        [
          ["CCPI", ccpi, "accent"],
          ["NCPI", ncpi, "copper"],
        ] as const
      ).map(([label, val, tone]) => (
        <div key={label} className={`ei2-thermo-col tone-${tone}`}>
          <div className="ei2-thermo-tube">
            <i style={{ height: `${h(val)}%` }} />
          </div>
          <em>{label}</em>
          <strong>{fmtPct(val)}</strong>
        </div>
      ))}
    </div>
  );
}
