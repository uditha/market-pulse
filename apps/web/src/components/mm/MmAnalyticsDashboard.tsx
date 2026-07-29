"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import {
  canUseFullHistory,
  canViewAnalysis,
  canViewDrivers,
  getAccessTier,
} from "@/lib/access";
import {
  alignExact,
  alignToCalendar,
  correlationMatrix,
  crossCorrelation,
  despikeIsolated,
  detectCorridorCollapse,
  eventStudy,
  filterRange,
  indexToBase,
  monthOnMonth,
  policyChangeDates,
  ratio,
  rollingBeta,
  sortPoints,
  spread,
  type Point,
} from "@/lib/mm-analytics";
import { type ChartRange } from "./chartTheme";
import {
  MM_SERIES_IDS,
  type MmDashboardProps,
  type MmBundle,
} from "./mmSeries";
import {
  DEFAULT_SHOT,
  HUNT_LEVELS,
  overnightReadout,
  readIsPro,
  readMidPeek,
  writeMidPeek,
  type HuntLevel,
  type HuntShotId,
} from "./mmHunt";
import { MmHuntShell, type HuntLockMode } from "./MmHuntShell";
import {
  buildShotCatalog,
  fmt,
  renderHuntShot,
  shotsForLevel,
  type MmDerived,
} from "./MmHuntShots";
import { MmStateBoard, type BoardSeries } from "./MmStateBoard";

function pts(bundle: MmBundle, id: string, range: ChartRange): Point[] {
  return filterRange(bundle[id] ?? [], range);
}

const RANGE_DEPTH: Record<ChartRange, number> = { "1Y": 1, "5Y": 2, MAX: 3 };

export function MmAnalyticsDashboard({
  initialBundle,
  initialRange,
  meta,
  termBook,
}: MmDashboardProps) {
  const [range, setRange] = useState<ChartRange>(initialRange);
  /** Highlight while a longer history fetch is in flight (range itself stays put). */
  const [pendingRange, setPendingRange] = useState<ChartRange | null>(null);
  const [bundle, setBundle] = useState(initialBundle);
  /** How much history the non-carry series currently hold (page SSR starts at 1Y). */
  const [loadedDepth, setLoadedDepth] = useState<ChartRange>(initialRange);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState<HuntLevel>("pulse");
  const [shotId, setShotId] = useState<HuntShotId>(DEFAULT_SHOT.pulse);
  const [demoPro, setDemoPro] = useState(false);
  const [midPeek, setMidPeek] = useState<HuntShotId | null>(null);
  const { data: session } = authClient.useSession();
  const tier = useMemo(
    () => getAccessTier(session, { demoPro }),
    [session, demoPro],
  );
  const reqId = useRef(0);
  const byId = useMemo(() => new Map(meta.map((s) => [s.seriesId, s])), [meta]);
  const uiRange = pendingRange ?? range;

  useEffect(() => {
    setDemoPro(readIsPro());
    setMidPeek(readMidPeek());
  }, []);

  const selectRange = useCallback(
    async (next: ChartRange) => {
      if (next === range || busy) return;

      // Shorter / equal window: filter client-side. No refetch, no layout jump.
      if (RANGE_DEPTH[next] <= RANGE_DEPTH[loadedDepth]) {
        setRange(next);
        return;
      }

      const id = ++reqId.current;
      setBusy(true);
      setError(null);
      setPendingRange(next);
      try {
        // Upgrade once to MAX so later 1Y/5Y/MAX toggles stay local.
        const details = await Promise.all(
          MM_SERIES_IDS.map((sid) => api.series(sid, "MAX").catch(() => null)),
        );
        if (id !== reqId.current) return;
        const nextBundle: MmBundle = {};
        MM_SERIES_IDS.forEach((sid, i) => {
          nextBundle[sid] = (details[i]?.history ?? []).map((h) => ({
            period: h.period,
            value: h.value,
          }));
        });
        // Apply bundle + range together so the board doesn't refilter mid-fetch.
        setBundle(nextBundle);
        setLoadedDepth("MAX");
        setRange(next);
      } catch (err) {
        if (id !== reqId.current) return;
        setError((err as Error).message);
      } finally {
        if (id === reqId.current) {
          setBusy(false);
          setPendingRange(null);
        }
      }
    },
    [busy, loadedDepth, range],
  );

  const derived = useMemo((): MmDerived => {
    const opr = pts(bundle, "sl.mm.opr", "MAX");
    /** Drop one-day SDF/SLF scrape blips (e.g. 2024-04-01) before spreads/corridor. */
    const sdfMax = despikeIsolated(pts(bundle, "sl.mm.sdf.rate", "MAX"));
    const slfMax = despikeIsolated(pts(bundle, "sl.mm.slf.rate", "MAX"));
    const callMaxHist = pts(bundle, "sl.mm.call.wa_yield", "MAX");
    const awprMax = pts(bundle, "sl.mm.awpr", "MAX");
    const awlrMax = pts(bundle, "sl.mm.awlr", "MAX");
    const repoMax = pts(bundle, "sl.mm.repo.wa_yield", "MAX");
    const liqMax = pts(bundle, "sl.mm.overnight_liquidity", "MAX");
    const t91Max = pts(bundle, "sl.mm.tbill.91d", "MAX");
    const t364Max = pts(bundle, "sl.mm.tbill.364d", "MAX");

    const sdf = filterRange(sdfMax, range);
    const slf = filterRange(slfMax, range);
    const srr = pts(bundle, "sl.mm.srr", "MAX");
    const call = filterRange(callMaxHist, range);
    const callMin = pts(bundle, "sl.mm.call.min_rate", range);
    const callMax = pts(bundle, "sl.mm.call.max_rate", range);
    const callVol = pts(bundle, "sl.mm.call.volume", range);
    const repo = filterRange(repoMax, range);
    const repoVol = pts(bundle, "sl.mm.repo.volume", range);
    const liq = filterRange(liqMax, range);
    const sdfVol = pts(bundle, "sl.mm.sdf.volume", range);
    const slfVol = pts(bundle, "sl.mm.slf.volume", range);
    const holdings = pts(bundle, "sl.mm.cbsl.gov_holdings", range);
    const omoRec = pts(bundle, "sl.mm.omo.received", range);
    const omoAcc = pts(bundle, "sl.mm.omo.accepted", range);
    const omoOfferRepo = pts(bundle, "sl.mm.omo.offer_repo", range);
    const omoOfferRr = pts(bundle, "sl.mm.omo.offer_reverse_repo", range);
    const omoWa = pts(bundle, "sl.mm.omo.wa_yield", range);
    const t91 = filterRange(t91Max, range);
    const t182 = pts(bundle, "sl.mm.tbill.182d", range);
    const t364 = filterRange(t364Max, range);
    const awpr = filterRange(awprMax, range);
    const awlr = filterRange(awlrMax, range);
    const awdr = pts(bundle, "sl.mm.awdr", range);
    const awfdr = pts(bundle, "sl.mm.awfdr", range);
    const awsr = pts(bundle, "sl.mm.awsr", range);

    const callSpread = spread(call, opr, { carryB: true, calendar: call });
    const callSpreadPolicy = (() => {
      const rows = alignToCalendar(call, { call, opr, sdf }, ["opr", "sdf"]);
      return rows
        .filter((r) => r.values.call != null)
        .map((r) => {
          const policy = r.values.opr ?? r.values.sdf;
          if (policy == null) return null;
          return { period: r.period, value: (r.values.call as number) - policy };
        })
        .filter(Boolean) as Point[];
    })();

    /** Full-history Call−policy for regime boxes (needs pre/post corridor eras). */
    const callSpreadMax = (() => {
      const rows = alignToCalendar(callMaxHist, { call: callMaxHist, opr, sdf: sdfMax }, [
        "opr",
        "sdf",
      ]);
      return rows
        .filter((r) => r.values.call != null)
        .map((r) => {
          const policy = r.values.opr ?? r.values.sdf;
          if (policy == null) return null;
          return { period: r.period, value: (r.values.call as number) - policy };
        })
        .filter(Boolean) as Point[];
    })();

    const callRepoSpread = spread(call, repo);
    const totalVolRows = alignExact({ call: callVol, repo: repoVol });
    const totalVol: Point[] = totalVolRows.map((r) => ({
      period: r.period,
      value: (r.values.call as number) + (r.values.repo as number),
    }));
    const repoShare: Point[] = totalVolRows
      .filter((r) => (r.values.call as number) + (r.values.repo as number) > 0)
      .map((r) => ({
        period: r.period,
        value:
          ((r.values.repo as number) /
            ((r.values.call as number) + (r.values.repo as number))) *
          100,
      }));

    const slfVolNeg = sortPoints(slfVol).map((p) => ({ period: p.period, value: -p.value }));
    const facilityNet = (() => {
      const rows = alignToCalendar(sdfVol.length ? sdfVol : slfVol, {
        sdf: sdfVol,
        slf: slfVol,
      });
      return rows
        .map((r) => {
          const a = r.values.sdf ?? 0;
          const b = r.values.slf ?? 0;
          if (r.values.sdf == null && r.values.slf == null) return null;
          return { period: r.period, value: a - b };
        })
        .filter(Boolean) as Point[];
    })();

    const omoOffer = (() => {
      const rows = alignToCalendar(omoRec.length ? omoRec : omoOfferRepo, {
        repo: omoOfferRepo,
        rr: omoOfferRr,
      });
      return rows
        .map((r) => {
          const v = (r.values.repo ?? 0) + (r.values.rr ?? 0);
          if (r.values.repo == null && r.values.rr == null) return null;
          return { period: r.period, value: v };
        })
        .filter(Boolean) as Point[];
    })();
    const bidToOffer = ratio(omoRec, omoOffer);
    const acceptance = ratio(omoAcc, omoRec);

    const holdingsMom = monthOnMonth(holdings);
    const curveSlope = spread(t364, t91);
    const tbillPolicy = spread(t91, opr, { carryB: true, calendar: t91 });

    const awlrAwdr = spread(awlr, awdr);
    const awprTbill = spread(awpr, t364);
    const awsrAwpr = spread(awsr, awpr);
    const awfdrAwdr = spread(awfdr, awdr);

    const events = policyChangeDates(opr);
    const lastCut = [...events].reverse().find((e) => e.delta < 0) ?? events[events.length - 1];
    const passThroughBase = lastCut?.period ?? "2024-11-01";
    const idxOpr = indexToBase(opr, passThroughBase);
    const idxCall = indexToBase(call, passThroughBase);
    const idxT364 = indexToBase(t364, passThroughBase);
    const idxAwpr = indexToBase(awpr, passThroughBase);
    const idxAwlr = indexToBase(awlr, passThroughBase);

    const betaFull = rollingBeta(opr, awprMax, 12);
    const beta = filterRange(betaFull, range);
    const xcorr = crossCorrelation(opr, awprMax, 12);
    const collapseDate = detectCorridorCollapse(sdfMax, slfMax, opr);

    const callCandles = (() => {
      const rows = alignExact({ min: callMin, max: callMax, wa: call });
      return rows.map((r) => {
        const lo = r.values.min as number;
        const hi = r.values.max as number;
        const wa = r.values.wa as number;
        return {
          period: r.period,
          open: wa,
          high: hi,
          low: lo,
          close: wa,
        };
      });
    })();

    const liqSpreadScatter = alignToCalendar(liq, {
      liq,
      spread: callSpreadPolicy,
    })
      .filter((r) => r.values.liq != null && r.values.spread != null)
      .map((r) => ({
        x: r.values.liq as number,
        y: r.values.spread as number,
        period: r.period,
      }));

    const termScatter =
      termBook?.recentAuctions
        .filter((a) => a.tenureDays != null && a.waYield != null && a.accepted > 0)
        .map((a) => ({
          x: a.tenureDays as number,
          y: a.waYield as number,
          size: 3 + Math.sqrt(a.accepted),
          period: a.auctionDate,
          side: a.side,
        })) ?? [];

    const ganttBars =
      termBook?.recentAuctions
        .filter((a) => a.settlementDate && a.maturityDate && a.outstanding)
        .map((a, i) => ({
          id: `${a.auctionDate}-${i}`,
          label: `${a.tenureDays ?? "?"}d`,
          start: a.settlementDate as string,
          end: a.maturityDate as string,
          amount: a.accepted,
          side: a.side,
        })) ?? [];

    const esCall = eventStudy(call, events, 60);
    const esT91 = eventStudy(t91, events, 60);
    const esAwpr = eventStudy(awpr, events, 60);

    const regimeValues = { corridor: [] as number[], single: [] as number[] };
    if (collapseDate) {
      for (const p of callSpreadMax) {
        if (p.period < collapseDate) regimeValues.corridor.push(p.value);
        else regimeValues.single.push(p.value);
      }
    } else {
      for (const p of callSpreadMax) regimeValues.corridor.push(p.value);
    }

    /** Prefer series with enough history; drop empty T-bill keys so the heatmap stays readable. */
    const corrSeries: Record<string, Point[]> = {
      Call: filterRange(callMaxHist, range === "1Y" ? "5Y" : range),
      Repo: filterRange(repoMax, range === "1Y" ? "5Y" : range),
      AWPR: filterRange(awprMax, range === "1Y" ? "5Y" : range),
      AWLR: filterRange(awlrMax, range === "1Y" ? "5Y" : range),
      Liq: filterRange(liqMax, range === "1Y" ? "5Y" : range),
    };
    if (t91Max.length >= 20) {
      corrSeries["91d"] = filterRange(t91Max, range === "1Y" ? "5Y" : range);
    }
    if (t364Max.length >= 20) {
      corrSeries["364d"] = filterRange(t364Max, range === "1Y" ? "5Y" : range);
    }
    const corr = correlationMatrix(corrSeries);

    return {
      opr: filterRange(opr, range),
      oprMax: opr,
      sdf,
      slf,
      srr: filterRange(srr, range),
      call,
      callVol,
      repo,
      repoVol,
      callSpread: callSpreadPolicy.length ? callSpreadPolicy : callSpread,
      callRepoSpread,
      callCandles,
      repoShare,
      totalVol,
      liq,
      liqSpreadScatter,
      sdfVol,
      slfVolNeg,
      facilityNet,
      bidToOffer,
      acceptance,
      omoWa,
      holdings,
      holdingsMom,
      t91,
      t182,
      t364,
      curveSlope,
      tbillPolicy,
      awpr,
      awlr,
      awdr,
      awfdr,
      awsr,
      awlrAwdr,
      awprTbill,
      awsrAwpr,
      awfdrAwdr,
      idxOpr,
      idxCall,
      idxT364,
      idxAwpr,
      idxAwlr,
      beta,
      xcorr,
      collapseDate,
      events,
      passThroughBase,
      termScatter,
      ganttBars,
      esCall,
      esT91,
      esAwpr,
      regimeValues,
      corr,
    };
  }, [bundle, range, termBook]);

  const boardSeries: BoardSeries = useMemo(
    () => ({
      call: derived.call,
      opr: derived.opr,
      oprMax: derived.oprMax,
      sdf: derived.sdf,
      slf: derived.slf,
      callSpread: derived.callSpread,
      liq: derived.liq,
      sdfVol: derived.sdfVol,
      slfVol: derived.slfVolNeg.map((p) => ({ period: p.period, value: -p.value })),
      slfVolNeg: derived.slfVolNeg,
      facilityNet: derived.facilityNet,
      awpr: derived.awpr,
      awlr: derived.awlr,
    }),
    [derived],
  );

  const catalog = useMemo(() => buildShotCatalog(derived), [derived]);
  const levelShots = useMemo(() => shotsForLevel(catalog, level), [catalog, level]);
  const activeMeta = levelShots.find((s) => s.id === shotId) ?? levelShots[0];

  const lock: HuntLockMode = useMemo(() => {
    if (activeMeta?.awaitingData) return "awaiting";
    if (level === "pulse") return "open";
    if (level === "mid" && canViewDrivers(tier)) return "open";
    if (level === "rare" && canViewAnalysis(tier)) return "open";
    if (level === "rare") return "locked";
    if (midPeek === activeMeta?.id) return "open";
    return "fog";
  }, [activeMeta?.awaitingData, activeMeta?.id, level, midPeek, tier]);

  const onLevel = useCallback(
    (next: HuntLevel) => {
      setLevel(next);
      const nextShots = shotsForLevel(catalog, next);
      const preferred = DEFAULT_SHOT[next];
      const pick = nextShots.find((s) => s.id === preferred) ?? nextShots[0];
      if (pick) setShotId(pick.id);
      if (next !== "pulse" && !canUseFullHistory(tier) && range !== "1Y") {
        void selectRange("1Y");
      }
    },
    [catalog, range, selectRange, tier],
  );

  const onShot = useCallback((id: HuntShotId) => {
    setShotId(id);
  }, []);

  const onPeek = useCallback(() => {
    if (!activeMeta) return;
    writeMidPeek(activeMeta.id);
    setMidPeek(activeMeta.id);
  }, [activeMeta]);

  const readout = useMemo(
    () =>
      overnightReadout({
        call: derived.call.at(-1)?.value ?? null,
        opr: derived.oprMax.at(-1)?.value ?? null,
        sdf: derived.sdf.at(-1)?.value ?? null,
        slf: derived.slf.at(-1)?.value ?? null,
      }),
    [derived],
  );

  const metrics = (
    <>
      <Link className="mm-metric" href="/series/sl.mm.call.wa_yield">
        <em>Call</em>
        <strong>{fmt(derived.call.at(-1)?.value)}</strong>
      </Link>
      <Link className="mm-metric" href="/series/sl.mm.opr">
        <em>OPR</em>
        <strong>{fmt(derived.oprMax.at(-1)?.value)}</strong>
      </Link>
    </>
  );

  const levelMeta = HUNT_LEVELS.find((l) => l.id === level)!;

  const stage =
    level === "pulse"
      ? null
      : renderHuntShot(activeMeta?.id ?? shotId, {
          derived,
          range,
          onRange: selectRange,
          busy,
          bundle,
          byId,
        });

  return (
    <main className="mm-page">
      <div className="hero-eyebrow">Markets</div>
      <div className="mm-page-head">
        <div>
          <h1 className="section-title">Money Market</h1>
          <p className="mm-page-sub">{levelMeta.blurb}</p>
        </div>
        <div className="mm-page-modes" role="tablist" aria-label="Workspace depth">
          {HUNT_LEVELS.map((l) => (
            <button
              key={l.id}
              type="button"
              role="tab"
              aria-selected={l.id === level}
              className={`mm-mode${l.id === level ? " is-active" : ""}`}
              onClick={() => onLevel(l.id)}
              title={l.blurb}
            >
              <span className="mm-mode-label">{l.label}</span>
              <span className="mm-mode-job">{l.job}</span>
            </button>
          ))}
        </div>
        <div className="mm-page-live">{metrics}</div>
      </div>

      {error ? <p className="mm-desk-error">{error}</p> : null}

      {level === "pulse" ? (
        <MmStateBoard
          series={boardSeries}
          busy={busy}
          range={range}
          selectedRange={uiRange}
          onRange={selectRange}
        />
      ) : (
        <MmHuntShell
          level={level}
          onLevel={onLevel}
          shots={levelShots}
          activeShotId={activeMeta?.id ?? shotId}
          onShot={onShot}
          lock={lock}
          accessTier={tier}
          range={range}
          selectedRange={uiRange}
          onRange={selectRange}
          busy={busy}
          readout={readout}
          onPeek={lock === "fog" ? onPeek : undefined}
          peekUsed={Boolean(midPeek) && midPeek !== activeMeta?.id && lock === "fog"}
        >
          {stage}
        </MmHuntShell>
      )}
    </main>
  );
}
