"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import type { AccessTier } from "@/lib/access";
import { RANGE_TABS, type ChartRange } from "./chartTheme";
import {
  HUNT_LEVELS,
  type HuntLevel,
  type HuntShotId,
  type HuntShotMeta,
} from "./mmHunt";
import { MmStageHeightContext } from "./mmStage";

export type HuntLockMode = "open" | "fog" | "locked" | "awaiting";

const LOGIN_NEXT = "/login?next=/markets/mm";

export function MmHuntShell({
  level,
  onLevel,
  shots,
  activeShotId,
  onShot,
  lock,
  accessTier = "anonymous",
  range,
  selectedRange,
  onRange,
  busy,
  error,
  readout,
  metrics,
  onPeek,
  peekUsed,
  children,
}: {
  level: HuntLevel;
  onLevel: (l: HuntLevel) => void;
  shots: HuntShotMeta[];
  activeShotId: HuntShotId;
  onShot: (id: HuntShotId) => void;
  lock: HuntLockMode;
  accessTier?: AccessTier;
  range: ChartRange;
  selectedRange?: ChartRange;
  onRange: (r: ChartRange) => void;
  busy?: boolean;
  error?: string | null;
  /** Plain-language “so what” for the active view */
  readout?: string;
  metrics?: ReactNode;
  onPeek?: () => void;
  peekUsed?: boolean;
  children: ReactNode;
}) {
  const active = shots.find((s) => s.id === activeShotId) ?? shots[0];
  const tabRange = selectedRange ?? range;
  const levelMeta = HUNT_LEVELS.find((l) => l.id === level)!;
  const showRange = lock === "open" || lock === "fog";
  const canvasRef = useRef<HTMLDivElement>(null);
  const [stageH, setStageH] = useState(420);
  const needsAccount = accessTier === "anonymous";

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const measure = () => {
      const h = Math.floor(el.clientHeight);
      if (h > 0) setStageH(h);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="mm-desk">
      <div className="mm-focus panel">
        <div className="mm-focus-head">
          <div className="mm-focus-copy">
            <p className="mm-focus-kicker">{levelMeta.label}</p>
            <h2 className="mm-focus-title">{active?.title ?? "—"}</h2>
            <p className="mm-focus-readout">
              {lock === "awaiting"
                ? "This series is empty until the scraper backfill lands."
                : readout ?? active?.context}
            </p>
          </div>
          <div className="mm-cmd-right">
            {metrics ? <div className="mm-cmd-metrics">{metrics}</div> : null}
            {showRange ? (
              <div className="mm-cmd-range" role="tablist" aria-label="Range">
                {RANGE_TABS.map((t) => {
                  const restricted = level !== "pulse" && lock !== "open" && t !== "1Y";
                  const isActive = t === tabRange;
                  return (
                    <button
                      key={t}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      className={`mm-range-btn${isActive ? " is-active" : ""}`}
                      disabled={busy || restricted}
                      title={
                        restricted
                          ? needsAccount
                            ? "Create a free account for longer history"
                            : "Pro unlocks longer history"
                          : undefined
                      }
                      onClick={() => onRange(t)}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>

        <nav className="mm-views" aria-label="Charts in this workspace">
          {shots.map((s) => {
            const selected = s.id === activeShotId;
            return (
              <button
                key={s.id}
                type="button"
                className={`mm-view${selected ? " is-active" : ""}`}
                onClick={() => onShot(s.id)}
                aria-current={selected ? "true" : undefined}
              >
                {s.rail}
              </button>
            );
          })}
        </nav>
      </div>

      {error ? <p className="mm-desk-error">{error}</p> : null}

      <section className="mm-stage mm-stage-charts-only">
        <div className="mm-stage-chart">
          <div
            ref={canvasRef}
            className={`mm-hunt-canvas${
              lock === "fog" ? " is-fog" : lock === "locked" ? " is-locked" : ""
            }`}
          >
            <MmStageHeightContext.Provider value={stageH}>
              {lock === "awaiting" ? (
                <div className="mm-hunt-awaiting">
                  <strong>No data yet</strong>
                  <p>Leave this blank for now — Overview and Liquidity still work.</p>
                </div>
              ) : (
                children
              )}
            </MmStageHeightContext.Provider>

            {lock === "fog" ? (
              <div className="mm-hunt-lock mm-hunt-lock-fog">
                <div className="mm-hunt-lock-card">
                  <strong>{peekUsed ? "Preview used" : "Preview this chart"}</strong>
                  <p>
                    {peekUsed
                      ? "Create a free account to unlock every Drivers chart and longer history."
                      : "One free preview. Sign up free to unlock the full Drivers workspace."}
                  </p>
                  <div className="mm-hunt-lock-actions">
                    {onPeek && !peekUsed ? (
                      <button type="button" className="btn btn-primary" onClick={onPeek}>
                        Preview once
                      </button>
                    ) : null}
                    <Link
                      href={LOGIN_NEXT}
                      className={peekUsed ? "btn btn-primary" : "btn"}
                    >
                      Create free account
                    </Link>
                  </div>
                </div>
              </div>
            ) : null}

            {lock === "locked" ? (
              <div className="mm-hunt-lock mm-hunt-lock-hard">
                <div className="mm-hunt-lock-card">
                  {needsAccount ? (
                    <>
                      <strong>Analysis needs an account</strong>
                      <p>
                        Event studies, regimes, and rolling β — free with a quick sign-up.
                      </p>
                      <div className="mm-hunt-lock-actions">
                        <Link href={LOGIN_NEXT} className="btn btn-primary">
                          Create free account
                        </Link>
                      </div>
                    </>
                  ) : (
                    <>
                      <strong>Analysis is Pro</strong>
                      <p>
                        Event studies, regimes, and rolling β — clear charts and full history.
                      </p>
                      <div className="mm-hunt-lock-actions">
                        <Link href="/pricing" className="btn btn-primary">
                          Get Pro
                        </Link>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
