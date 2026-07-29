"use client";

import type { MmMarketState } from "./mmState";

/** Spatial corridor — where Call sits between SDF and SLF (not a time series). */
export function MmCorridorDial({ state }: { state: MmMarketState }) {
  const { call, opr, sdf, slf, bandPos, spread } = state;
  const ready = call != null && sdf != null && slf != null && slf > sdf;

  const callPct = ready && bandPos != null ? bandPos * 100 : 50;
  const oprPct =
    ready && opr != null
      ? Math.min(100, Math.max(0, ((opr - sdf!) / (slf! - sdf!)) * 100))
      : 50;

  return (
    <div className="mm-dial">
      <div className="mm-dial-head">
        <span className="mm-dial-kicker">Policy corridor</span>
        <strong className="mm-dial-regime">{state.regimeLabel}</strong>
      </div>

      {!ready ? (
        <div className="mm-dial-empty">Need SDF, SLF, and Call to place the dial.</div>
      ) : (
        <>
          <div className="mm-dial-track" role="img" aria-label="Call position in SDF–SLF corridor">
            <div className="mm-dial-band" />
            <div className="mm-dial-opr" style={{ left: `${oprPct}%` }} title={`OPR ${opr?.toFixed(2)}%`}>
              <span>OPR</span>
            </div>
            <div className="mm-dial-call" style={{ left: `${callPct}%` }} title={`Call ${call?.toFixed(2)}%`}>
              <span>Call</span>
            </div>
          </div>

          <div className="mm-dial-scale">
            <span>
              SDF
              <em>{sdf!.toFixed(2)}%</em>
            </span>
            <span className="mm-dial-mid">
              Spread
              <em>{spread != null ? `${spread >= 0 ? "+" : ""}${spread.toFixed(2)} pp` : "—"}</em>
            </span>
            <span>
              SLF
              <em>{slf!.toFixed(2)}%</em>
            </span>
          </div>

          <div className="mm-dial-levels">
            <div>
              <em>Call WA</em>
              <strong>{call!.toFixed(2)}%</strong>
            </div>
            <div>
              <em>OPR</em>
              <strong>{opr != null ? `${opr.toFixed(2)}%` : "—"}</strong>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
