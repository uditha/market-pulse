"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { RANGE_TABS, type ChartRange } from "./chartTheme";

export type LegendItem = {
  label: string;
  value?: string | null;
  color?: string;
  href?: string;
  swatchClass?: string;
};

export function MmPanel({
  title,
  subtitle,
  range,
  onRange,
  busy,
  error,
  legend,
  annotation,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  range?: ChartRange;
  onRange?: (r: ChartRange) => void;
  busy?: boolean;
  error?: string | null;
  legend?: LegendItem[];
  annotation?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel corridor-panel mm-panel ${className ?? ""}`}>
      <div className="corridor-head">
        <div>
          <h3 className="section-title" style={{ margin: 0, fontSize: "1.05rem" }}>
            {title}
          </h3>
          {subtitle ? (
            <p className="section-sub corridor-sub">
              {subtitle}
              {busy ? " · Loading…" : ""}
            </p>
          ) : null}
        </div>
        {onRange && range ? (
          <div className="corridor-tabs" role="tablist" aria-label={`${title} range`}>
            {RANGE_TABS.map((t) => {
              const active = t === range;
              return (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className="btn"
                  disabled={busy}
                  onClick={() => onRange(t)}
                  style={{
                    background: active ? "var(--accent)" : undefined,
                    color: active ? "#fff" : undefined,
                    borderColor: active ? "var(--accent-deep)" : undefined,
                    fontWeight: active ? 700 : undefined,
                    opacity: busy && !active ? 0.7 : 1,
                    padding: "5px 10px",
                    fontSize: "0.78rem",
                  }}
                >
                  {t}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      {legend?.length ? (
        <div className="corridor-legend" aria-label="Series legend">
          {legend.map((item) => {
            const inner = (
              <>
                <span
                  className={`corridor-swatch ${item.swatchClass ?? ""}`}
                  style={
                    item.color && !item.swatchClass
                      ? { background: item.color, boxShadow: `0 0 0 3px color-mix(in srgb, ${item.color} 22%, transparent)` }
                      : undefined
                  }
                />
                <span className="corridor-legend-label">{item.label}</span>
                {item.value != null ? (
                  <strong className="corridor-legend-value">{item.value}</strong>
                ) : null}
              </>
            );
            return item.href ? (
              <Link
                key={item.label}
                href={item.href}
                className="corridor-legend-item"
              >
                {inner}
              </Link>
            ) : (
              <span key={item.label} className="corridor-legend-item">
                {inner}
              </span>
            );
          })}
        </div>
      ) : null}

      {annotation ? <div className="mm-annotation">{annotation}</div> : null}
      {error ? (
        <p style={{ color: "var(--down)", fontSize: "0.85rem", marginBottom: 8 }}>{error}</p>
      ) : null}
      {children}
    </section>
  );
}

export function MmSection({
  id,
  eyebrow,
  title,
  blurb,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  blurb: string;
  children: ReactNode;
}) {
  return (
    <section className="mm-section" id={id}>
      <div className="mm-section-head">
        <div className="hero-eyebrow" style={{ marginBottom: 4 }}>
          {eyebrow}
        </div>
        <h2 className="section-title" style={{ marginBottom: 6 }}>
          {title}
        </h2>
        <p className="section-sub" style={{ marginBottom: 0, maxWidth: 720 }}>
          {blurb}
        </p>
      </div>
      <div className="mm-charts-grid mm-charts-grid-dense">{children}</div>
    </section>
  );
}
