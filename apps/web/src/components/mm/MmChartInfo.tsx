"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { HuntGuide } from "./mmHunt";

export type ChartInfoGuide = Pick<HuntGuide, "why" | "how"> & { what?: string };

export function MmChartInfo({
  guide,
  title = "About this chart",
}: {
  guide: ChartInfoGuide;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className={`mm-chart-info${open ? " is-open" : ""}`} ref={rootRef}>
      <button
        type="button"
        className="mm-chart-info-btn"
        aria-label="How to read this chart"
        aria-expanded={open}
        aria-controls={panelId}
        title="How to read this chart"
        onClick={() => setOpen((v) => !v)}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v6" />
          <path d="M12 8h.01" strokeWidth="2.4" />
        </svg>
      </button>

      {open ? (
        <div className="mm-chart-info-pop" id={panelId} role="dialog" aria-label={title}>
          <p className="mm-chart-info-title">{title}</p>
          <div className="mm-chart-info-block">
            <h3>Why it matters</h3>
            <p>{guide.why}</p>
          </div>
          {guide.what ? (
            <div className="mm-chart-info-block">
              <h3>What you see</h3>
              <p>{guide.what}</p>
            </div>
          ) : null}
          <div className="mm-chart-info-block">
            <h3>How to read</h3>
            <p>{guide.how}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
