"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { filterRange, spread, type Point } from "@/lib/mm-analytics";
import { MM_COLORS, RANGE_TABS, type ChartRange } from "@/components/mm/chartTheme";
import { MmLcChart } from "@/components/mm/MmLcChart";
import { ReserveStackChart } from "@/components/ei/ReserveStackChart";
import { GdpSectorStackChart } from "@/components/ei/GdpSectorStackChart";
import { EI_V3_LANES, type EiV3LaneId } from "./catalog";
import { Readout, TapeItem, asOf, fmtNum, fmtPct, latest } from "./viz";

export type EiV3Bundle = Record<string, Point[]>;

type Props = {
  initialBundle: EiV3Bundle;
  initialRange?: ChartRange;
};

function p(bundle: EiV3Bundle, id: string, range: ChartRange): Point[] {
  return filterRange(bundle[id] ?? [], range);
}

export function EiV3Dashboard({ initialBundle, initialRange = "1Y" }: Props) {
  const [bundle] = useState(initialBundle);
  const [range, setRange] = useState<ChartRange>(initialRange);
  const [lane, setLane] = useState<EiV3LaneId>("prices");

  const selectRange = useCallback((next: ChartRange) => setRange(next), []);

  const ccpiH = useMemo(() => p(bundle, "sl.ei.ccpi.headline_yoy", range), [bundle, range]);
  const ccpiC = useMemo(() => p(bundle, "sl.ei.ccpi.core_yoy", range), [bundle, range]);
  const ncpiH = useMemo(() => p(bundle, "sl.ei.ncpi.headline_yoy", range), [bundle, range]);
  const ncpiC = useMemo(() => p(bundle, "sl.ei.ncpi.core_yoy", range), [bundle, range]);
  const opr = useMemo(() => p(bundle, "sl.mm.opr", range), [bundle, range]);
  const ora = useMemo(() => p(bundle, "sl.ei.total_reserves", range), [bundle, range]);
  const oraFx = useMemo(() => p(bundle, "sl.ei.reserves.fx", range), [bundle, range]);
  const oraGold = useMemo(() => p(bundle, "sl.ei.reserves.gold", range), [bundle, range]);
  const oraImf = useMemo(() => p(bundle, "sl.ei.reserves.imf", range), [bundle, range]);
  const oraSdr = useMemo(() => p(bundle, "sl.ei.reserves.sdrs", range), [bundle, range]);
  const oraOther = useMemo(() => p(bundle, "sl.ei.reserves.other", range), [bundle, range]);
  const rm = useMemo(() => p(bundle, "sl.ei.reserve_money", range), [bundle, range]);

  const reserveSlices = useMemo(
    () => [
      { key: "fx", label: "FX", points: oraFx, tone: "fx" as const },
      { key: "gold", label: "Gold", points: oraGold, tone: "gold" as const },
      { key: "imf", label: "IMF", points: oraImf, tone: "imf" as const },
      { key: "sdr", label: "SDRs", points: oraSdr, tone: "sdr" as const },
      { key: "other", label: "Other", points: oraOther, tone: "other" as const },
    ],
    [oraFx, oraGold, oraImf, oraSdr, oraOther],
  );
  const cic = useMemo(() => p(bundle, "sl.ei.currency_in_circulation", range), [bundle, range]);
  const m2 = useMemo(() => p(bundle, "sl.ei.m2", range), [bundle, range]);
  const m1 = useMemo(() => p(bundle, "sl.ei.m1", range), [bundle, range]);
  const liq = useMemo(() => p(bundle, "sl.ei.liquidity_surplus", range), [bundle, range]);
  const brent = useMemo(() => p(bundle, "sl.ei.energy.brent", range), [bundle, range]);
  const petrol = useMemo(() => p(bundle, "sl.ei.fuel.petrol_92", range), [bundle, range]);
  const diesel = useMemo(() => p(bundle, "sl.ei.fuel.auto_diesel", range), [bundle, range]);
  const power = useMemo(() => p(bundle, "sl.ei.electricity.generation", range), [bundle, range]);
  const peak = useMemo(() => p(bundle, "sl.ei.electricity.peak_demand", range), [bundle, range]);
  const exports = useMemo(() => p(bundle, "sl.ei.trade.exports", range), [bundle, range]);
  const imports = useMemo(() => p(bundle, "sl.ei.trade.imports", range), [bundle, range]);
  const balance = useMemo(() => p(bundle, "sl.ei.trade.balance", range), [bundle, range]);
  const rem = useMemo(() => p(bundle, "sl.ei.remittances_usd", range), [bundle, range]);
  const remYtd = useMemo(() => p(bundle, "sl.ei.remittances_usd_ytd", range), [bundle, range]);
  const tour = useMemo(() => p(bundle, "sl.ei.tourist_arrivals", range), [bundle, range]);
  const tourYtd = useMemo(() => p(bundle, "sl.ei.tourist_arrivals_ytd", range), [bundle, range]);
  const gdp = useMemo(() => p(bundle, "sl.ei.gdp.growth", range), [bundle, range]);
  const gdpAgri = useMemo(() => p(bundle, "sl.ei.gdp.agriculture_yoy", range), [bundle, range]);
  const gdpInd = useMemo(() => p(bundle, "sl.ei.gdp.industry_yoy", range), [bundle, range]);
  const gdpSvc = useMemo(() => p(bundle, "sl.ei.gdp.services_yoy", range), [bundle, range]);
  const iip = useMemo(() => p(bundle, "sl.ei.iip", range), [bundle, range]);
  const ncpiFood = useMemo(() => p(bundle, "sl.ei.ncpi.food_yoy", range), [bundle, range]);
  const ncpiNonfood = useMemo(() => p(bundle, "sl.ei.ncpi.nonfood_yoy", range), [bundle, range]);
  const m2bYoy = useMemo(() => p(bundle, "sl.ei.m2b_yoy", range), [bundle, range]);
  const creditYoy = useMemo(() => p(bundle, "sl.ei.credit.private_yoy", range), [bundle, range]);
  const fwdShort = useMemo(() => p(bundle, "sl.ei.reserves.fwd_short", range), [bundle, range]);
  const netReserves = useMemo(
    () => p(bundle, "sl.ei.reserves.net_after_drains", range),
    [bundle, range],
  );
  const tourEarn = useMemo(() => p(bundle, "sl.ei.tourist_earnings_usd", range), [bundle, range]);
  const pmiMfg = useMemo(() => p(bundle, "sl.ei.pmi.manufacturing", range), [bundle, range]);
  const pmiSvc = useMemo(() => p(bundle, "sl.ei.pmi.services", range), [bundle, range]);
  const pmiCon = useMemo(() => p(bundle, "sl.ei.pmi.construction", range), [bundle, range]);
  const oilShare = useMemo(
    () => p(bundle, "sl.ei.electricity.thermal_oil_share", range),
    [bundle, range],
  );

  const coreGap = useMemo(() => spread(ccpiH, ccpiC), [ccpiH, ccpiC]);
  const wedge = useMemo(() => spread(ccpiH, ncpiH), [ccpiH, ncpiH]);

  const laneMeta = EI_V3_LANES.find((l) => l.id === lane)!;
  const stamp =
    asOf(ccpiH) ?? asOf(ora) ?? asOf(exports) ?? asOf(gdp) ?? null;

  return (
    <main className="ei3">
      <header className="ei3-top">
        <div className="ei3-brand">
          <p className="ei3-kicker">LankaPulse</p>
          <h1 className="ei3-title">Economic Indicators</h1>
          <p className="ei3-sub">
            Sri Lanka macro desk
            {stamp ? <span> · as of {stamp.slice(0, 7)}</span> : null}
          </p>
        </div>
        <div className="mm-cmd-range" role="tablist" aria-label="Range">
          {RANGE_TABS.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={t === range}
              className={`mm-range-btn${t === range ? " is-active" : ""}`}
              onClick={() => selectRange(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </header>

      <div className="ei3-tape" aria-label="Key prints">
        <TapeItem
          href="/series/sl.ei.ccpi.headline_yoy"
          label="CCPI"
          value={fmtPct(latest(ccpiH))}
          points={ccpiH}
        />
        <TapeItem
          href="/series/sl.ei.ncpi.headline_yoy"
          label="NCPI"
          value={fmtPct(latest(ncpiH))}
          points={ncpiH}
        />
        <TapeItem
          href="/series/sl.ei.total_reserves"
          label="Reserves"
          value={fmtNum(latest(ora), 0)}
          unit="USD mn"
          points={ora}
        />
        <TapeItem
          href="/series/sl.ei.liquidity_surplus"
          label="Liquidity"
          value={fmtNum(latest(liq), 0)}
          unit="Rs bn"
          points={liq}
        />
        <TapeItem
          href="/series/sl.ei.energy.brent"
          label="Brent"
          value={fmtNum(latest(brent), 1)}
          unit="USD"
          points={brent}
        />
        <TapeItem
          href="/series/sl.ei.trade.balance"
          label="Trade bal."
          value={fmtNum(latest(balance), 0)}
          unit="USD mn"
          points={balance}
        />
        <TapeItem
          href="/series/sl.ei.gdp.growth"
          label="GDP"
          value={fmtPct(latest(gdp))}
          points={gdp}
        />
        <TapeItem
          href="/series/sl.ei.credit.private_yoy"
          label="Credit YoY"
          value={fmtPct(latest(creditYoy))}
          points={creditYoy}
        />
        <TapeItem
          href="/series/sl.ei.pmi.manufacturing"
          label="PMI mfg"
          value={fmtNum(latest(pmiMfg), 1)}
          points={pmiMfg}
        />
      </div>

      <div className="ei3-shell">
        <nav className="ei3-rail" aria-label="Indicator lanes">
          {EI_V3_LANES.map((l) => (
            <button
              key={l.id}
              type="button"
              className={`ei3-rail-btn${l.id === lane ? " is-active" : ""}`}
              onClick={() => setLane(l.id)}
            >
              <span>{l.label}</span>
              <em>{l.brief}</em>
            </button>
          ))}
        </nav>

        <section className="ei3-stage" key={lane}>
          <div className="ei3-stage-head">
            <h2>{laneMeta.label}</h2>
            <p>{laneMeta.brief}</p>
          </div>

          {lane === "prices" ? (
            <>
              <div className="ei3-readouts">
                <Readout href="/series/sl.ei.ccpi.headline_yoy" label="CCPI headline" value={fmtPct(latest(ccpiH))} points={ccpiH} />
                <Readout href="/series/sl.ei.ccpi.core_yoy" label="CCPI core" value={fmtPct(latest(ccpiC))} points={ccpiC} />
                <Readout href="/series/sl.ei.ncpi.headline_yoy" label="NCPI headline" value={fmtPct(latest(ncpiH))} points={ncpiH} />
                <Readout href="/series/sl.ei.ncpi.core_yoy" label="NCPI core" value={fmtPct(latest(ncpiC))} points={ncpiC} />
                <Readout href="/series/sl.ei.ncpi.food_yoy" label="NCPI food" value={fmtPct(latest(ncpiFood))} points={ncpiFood} />
                <Readout href="/series/sl.ei.ncpi.nonfood_yoy" label="NCPI non-food" value={fmtPct(latest(ncpiNonfood))} points={ncpiNonfood} />
              </div>
              <div className="ei3-chart-stack">
                <div className="ei3-chart ei3-chart-hero">
                  <h3>Headline vs core</h3>
                  <MmLcChart
                    range={range}
                    height={320}
                    compact
                    series={[
                      {
                        key: "h",
                        label: "CCPI headline",
                        kind: "area",
                        points: ccpiH,
                        colorVar: MM_COLORS.call.var,
                        colorFallback: MM_COLORS.call.fallback,
                      },
                      {
                        key: "c",
                        label: "CCPI core",
                        kind: "line",
                        points: ccpiC,
                        colorVar: MM_COLORS.sdf.var,
                        colorFallback: MM_COLORS.sdf.fallback,
                      },
                    ]}
                  />
                </div>
                <div className="ei3-chart-pair">
                  <div className="ei3-chart">
                    <h3>Core gap (pp)</h3>
                    <MmLcChart
                      range={range}
                      height={220}
                      compact
                      zeroLine
                      series={[
                        {
                          key: "gap",
                          label: "Headline − core",
                          kind: "histogram",
                          points: coreGap,
                          colorVar: MM_COLORS.spread.var,
                          colorFallback: MM_COLORS.spread.fallback,
                        },
                      ]}
                    />
                  </div>
                  <div className="ei3-chart">
                    <h3>vs policy rate</h3>
                    <MmLcChart
                      range={range}
                      height={220}
                      compact
                      carryKeys={["opr"]}
                      series={[
                        {
                          key: "h",
                          label: "CCPI",
                          kind: "line",
                          points: ccpiH,
                          colorVar: MM_COLORS.call.var,
                          colorFallback: MM_COLORS.call.fallback,
                          lineWidth: 3,
                        },
                        {
                          key: "opr",
                          label: "OPR",
                          kind: "step",
                          points: opr,
                          colorVar: MM_COLORS.opr.var,
                          colorFallback: MM_COLORS.opr.fallback,
                        },
                      ]}
                    />
                  </div>
                </div>
                <div className="ei3-chart">
                  <h3>Colombo − national wedge</h3>
                  <MmLcChart
                    range={range}
                    height={220}
                    compact
                    zeroLine
                    series={[
                      {
                        key: "w",
                        label: "CCPI − NCPI",
                        kind: "baseline",
                        points: wedge,
                        colorVar: MM_COLORS.copper.var,
                        colorFallback: MM_COLORS.copper.fallback,
                      },
                    ]}
                  />
                </div>
              </div>
            </>
          ) : null}

          {lane === "reserves" ? (
            <>
              <div className="ei3-readouts">
                <Readout href="/series/sl.ei.total_reserves" label="Official reserves" value={fmtNum(latest(ora), 0)} unit="USD mn" points={ora} />
                <Readout href="/series/sl.ei.reserves.fx" label="FX" value={fmtNum(latest(oraFx), 0)} unit="USD mn" points={oraFx} />
                <Readout href="/series/sl.ei.reserves.gold" label="Gold" value={fmtNum(latest(oraGold), 0)} unit="USD mn" points={oraGold} />
                <Readout href="/series/sl.ei.reserves.imf" label="IMF" value={fmtNum(latest(oraImf), 0)} unit="USD mn" points={oraImf} />
                <Readout href="/series/sl.ei.reserves.sdrs" label="SDRs" value={fmtNum(latest(oraSdr), 0)} unit="USD mn" points={oraSdr} />
                <Readout href="/series/sl.ei.reserves.net_after_drains" label="Net after drains" value={fmtNum(latest(netReserves), 0)} unit="USD mn" points={netReserves} />
                <Readout href="/series/sl.ei.reserves.fwd_short" label="Forward short" value={fmtNum(latest(fwdShort), 0)} unit="USD mn" points={fwdShort} />
              </div>
              <div className="ei3-chart-stack">
                <div className="ei3-chart ei3-chart-hero">
                  <h3>Reserve composition</h3>
                  <ReserveStackChart slices={reserveSlices} height={340} />
                </div>
              </div>
            </>
          ) : null}

          {lane === "money" ? (
            <>
              <div className="ei3-readouts">
                <Readout
                  href="/series/sl.ei.reserve_money"
                  label="Reserve money"
                  value={fmtNum(latest(rm) != null ? latest(rm)! / 1000 : null, 0)}
                  unit="Rs bn"
                  points={rm}
                />
                <Readout
                  href="/series/sl.ei.currency_in_circulation"
                  label="Currency in circ."
                  value={fmtNum(latest(cic) != null ? latest(cic)! / 1000 : null, 0)}
                  unit="Rs bn"
                  points={cic}
                />
                <Readout href="/series/sl.ei.m2" label="M2" value={fmtNum(latest(m2), 0)} unit="Rs bn" points={m2} />
                <Readout href="/series/sl.ei.liquidity_surplus" label="Liquidity surplus" value={fmtNum(latest(liq), 0)} unit="Rs bn" points={liq} />
                <Readout href="/series/sl.ei.m2b_yoy" label="M2b YoY" value={fmtPct(latest(m2bYoy))} points={m2bYoy} />
                <Readout href="/series/sl.ei.credit.private_yoy" label="Private credit YoY" value={fmtPct(latest(creditYoy))} points={creditYoy} />
              </div>
              <div className="ei3-chart-stack">
                <div className="ei3-chart-pair">
                  <div className="ei3-chart">
                    <h3>Monetary base</h3>
                    <MmLcChart
                      range={range}
                      height={260}
                      compact
                      series={[
                        {
                          key: "rm",
                          label: "Reserve money",
                          kind: "area",
                          points: rm,
                          colorVar: MM_COLORS.call.var,
                          colorFallback: MM_COLORS.call.fallback,
                          priceFormat: "number",
                        },
                        {
                          key: "cic",
                          label: "CIC",
                          kind: "line",
                          points: cic,
                          colorVar: MM_COLORS.copper.var,
                          colorFallback: MM_COLORS.copper.fallback,
                          priceFormat: "number",
                        },
                      ]}
                    />
                  </div>
                  <div className="ei3-chart">
                    <h3>Broad money</h3>
                    <MmLcChart
                      range={range}
                      height={260}
                      compact
                      series={[
                        {
                          key: "m2",
                          label: "M2",
                          kind: "area",
                          points: m2,
                          colorVar: MM_COLORS.sdf.var,
                          colorFallback: MM_COLORS.sdf.fallback,
                          priceFormat: "number",
                        },
                        {
                          key: "m1",
                          label: "M1",
                          kind: "line",
                          points: m1,
                          colorVar: MM_COLORS.awfdr.var,
                          colorFallback: MM_COLORS.awfdr.fallback,
                          priceFormat: "number",
                        },
                      ]}
                    />
                  </div>
                </div>
                <div className="ei3-chart ei3-chart-hero">
                  <h3>Market liquidity surplus</h3>
                  <MmLcChart
                    range={range}
                    height={260}
                    compact
                    zeroLine
                    series={[
                      {
                        key: "liq",
                        label: "Liquidity surplus",
                        kind: "baseline",
                        points: liq,
                        colorVar: MM_COLORS.opr.var,
                        colorFallback: MM_COLORS.opr.fallback,
                        priceFormat: "number",
                      },
                    ]}
                  />
                </div>
              </div>
            </>
          ) : null}

          {lane === "energy" ? (
            <>
              <div className="ei3-readouts">
                <Readout href="/series/sl.ei.energy.brent" label="Brent" value={fmtNum(latest(brent), 1)} unit="USD/bbl" points={brent} />
                <Readout href="/series/sl.ei.fuel.petrol_92" label="Petrol 92" value={fmtNum(latest(petrol), 0)} unit="LKR/L" points={petrol} />
                <Readout href="/series/sl.ei.fuel.auto_diesel" label="Diesel" value={fmtNum(latest(diesel), 0)} unit="LKR/L" points={diesel} />
                <Readout href="/series/sl.ei.electricity.generation" label="Generation" value={fmtNum(latest(power), 1)} unit="GWh" points={power} />
              </div>
              <div className="ei3-chart-stack">
                <div className="ei3-chart ei3-chart-hero">
                  <h3>Crude vs pump</h3>
                  <MmLcChart
                    range={range}
                    height={320}
                    compact
                    series={[
                      {
                        key: "brent",
                        label: "Brent",
                        kind: "area",
                        points: brent,
                        colorVar: MM_COLORS.call.var,
                        colorFallback: MM_COLORS.call.fallback,
                        priceFormat: "number",
                      },
                      {
                        key: "petrol",
                        label: "Petrol 92",
                        kind: "step",
                        points: petrol,
                        colorVar: MM_COLORS.copper.var,
                        colorFallback: MM_COLORS.copper.fallback,
                        priceScaleId: "left",
                        priceFormat: "number",
                      },
                      {
                        key: "diesel",
                        label: "Diesel",
                        kind: "step",
                        points: diesel,
                        colorVar: MM_COLORS.sdf.var,
                        colorFallback: MM_COLORS.sdf.fallback,
                        priceScaleId: "left",
                        priceFormat: "number",
                      },
                    ]}
                  />
                </div>
                <div className="ei3-chart">
                  <h3>Power system</h3>
                  <MmLcChart
                    range={range}
                    height={260}
                    compact
                    series={[
                      {
                        key: "gen",
                        label: "Generation",
                        kind: "histogram",
                        points: power,
                        colorVar: MM_COLORS.opr.var,
                        colorFallback: MM_COLORS.opr.fallback,
                        priceFormat: "number",
                      },
                      {
                        key: "peak",
                        label: "Peak demand",
                        kind: "line",
                        points: peak,
                        colorVar: MM_COLORS.copper.var,
                        colorFallback: MM_COLORS.copper.fallback,
                        priceScaleId: "left",
                        priceFormat: "number",
                      },
                    ]}
                  />
                </div>
              </div>
            </>
          ) : null}

          {lane === "trade" ? (
            <>
              <div className="ei3-readouts">
                <Readout href="/series/sl.ei.trade.exports" label="Exports" value={fmtNum(latest(exports), 0)} unit="USD mn" points={exports} />
                <Readout href="/series/sl.ei.trade.imports" label="Imports" value={fmtNum(latest(imports), 0)} unit="USD mn" points={imports} />
                <Readout href="/series/sl.ei.trade.balance" label="Balance" value={fmtNum(latest(balance), 0)} unit="USD mn" points={balance} />
                <Readout href="/series/sl.ei.remittances_usd" label="Remittances" value={fmtNum(latest(rem), 0)} unit="USD mn" points={rem} />
                <Readout href="/series/sl.ei.tourist_arrivals" label="Tourists" value={fmtNum(latest(tour), 0)} points={tour} />
                <Readout href="/series/sl.ei.tourist_earnings_usd" label="Tourism $" value={fmtNum(latest(tourEarn), 0)} unit="USD mn" points={tourEarn} />
              </div>
              <div className="ei3-chart-stack">
                <div className="ei3-chart-pair">
                  <div className="ei3-chart">
                    <h3>Exports & imports</h3>
                    <MmLcChart
                      range={range}
                      height={280}
                      compact
                      series={[
                        {
                          key: "x",
                          label: "Exports",
                          kind: "area",
                          points: exports,
                          colorVar: MM_COLORS.sdf.var,
                          colorFallback: MM_COLORS.sdf.fallback,
                          priceFormat: "number",
                        },
                        {
                          key: "m",
                          label: "Imports",
                          kind: "line",
                          points: imports,
                          colorVar: MM_COLORS.copper.var,
                          colorFallback: MM_COLORS.copper.fallback,
                          priceFormat: "number",
                        },
                      ]}
                    />
                  </div>
                  <div className="ei3-chart">
                    <h3>Trade balance</h3>
                    <MmLcChart
                      range={range}
                      height={280}
                      compact
                      zeroLine
                      series={[
                        {
                          key: "bal",
                          label: "Trade balance",
                          kind: "baseline",
                          points: balance,
                          colorVar: MM_COLORS.spread.var,
                          colorFallback: MM_COLORS.spread.fallback,
                          priceFormat: "number",
                        },
                      ]}
                    />
                  </div>
                </div>
                <div className="ei3-chart ei3-chart-hero">
                  <h3>Remittances & arrivals</h3>
                  <MmLcChart
                    range={range}
                    height={280}
                    compact
                    series={[
                      {
                        key: "rem",
                        label: "Remittances",
                        kind: "line",
                        points: rem,
                        colorVar: MM_COLORS.opr.var,
                        colorFallback: MM_COLORS.opr.fallback,
                        priceFormat: "number",
                      },
                      {
                        key: "tour",
                        label: "Tourist arrivals",
                        kind: "histogram",
                        points: tour,
                        colorVar: MM_COLORS.copper.var,
                        colorFallback: MM_COLORS.copper.fallback,
                        priceScaleId: "left",
                        priceFormat: "number",
                      },
                    ]}
                  />
                </div>
                <div className="ei3-ytd">
                  <span>
                    Remittances YTD <strong>{fmtNum(latest(remYtd), 0)}</strong> USD mn
                  </span>
                  <span>
                    Tourists YTD <strong>{fmtNum(latest(tourYtd), 0)}</strong>
                  </span>
                </div>
              </div>
            </>
          ) : null}

          {lane === "growth" ? (
            <>
              <div className="ei3-readouts">
                <Readout href="/series/sl.ei.gdp.growth" label="GDP growth" value={fmtPct(latest(gdp))} points={gdp} />
                <Readout href="/series/sl.ei.gdp.agriculture_yoy" label="Agriculture" value={fmtPct(latest(gdpAgri))} points={gdpAgri} />
                <Readout href="/series/sl.ei.gdp.industry_yoy" label="Industry" value={fmtPct(latest(gdpInd))} points={gdpInd} />
                <Readout href="/series/sl.ei.gdp.services_yoy" label="Services" value={fmtPct(latest(gdpSvc))} points={gdpSvc} />
                <Readout href="/series/sl.ei.iip" label="IIP" value={fmtNum(latest(iip), 1)} unit="index" points={iip} />
                <Readout href="/series/sl.ei.pmi.manufacturing" label="PMI mfg" value={fmtNum(latest(pmiMfg), 1)} points={pmiMfg} />
                <Readout href="/series/sl.ei.pmi.services" label="PMI services" value={fmtNum(latest(pmiSvc), 1)} points={pmiSvc} />
                <Readout href="/series/sl.ei.pmi.construction" label="PMI construction" value={fmtNum(latest(pmiCon), 1)} points={pmiCon} />
              </div>
              <div className="ei3-chart-stack">
                <div className="ei3-chart ei3-chart-hero">
                  <h3>GDP by industrial origin</h3>
                  <GdpSectorStackChart
                    height={320}
                    gdp={gdp}
                    slices={[
                      { key: "agri", label: "Agriculture", points: gdpAgri, tone: "agri" },
                      { key: "industry", label: "Industry", points: gdpInd, tone: "industry" },
                      { key: "services", label: "Services", points: gdpSvc, tone: "services" },
                    ]}
                  />
                </div>
                <div className="ei3-chart">
                  <h3>Industrial production</h3>
                  <MmLcChart
                    range={range}
                    height={260}
                    compact
                    series={[
                      {
                        key: "iip",
                        label: "IIP",
                        kind: "area",
                        points: iip,
                        colorVar: MM_COLORS.copper.var,
                        colorFallback: MM_COLORS.copper.fallback,
                        priceFormat: "number",
                      },
                    ]}
                  />
                </div>
              </div>
            </>
          ) : null}
        </section>
      </div>

      <p className="ei3-foot">
        <Link href="/markets/ei/classic">Classic desk</Link>
        <span aria-hidden> · </span>
        <Link href="/markets/ei/v2">Pulse v2</Link>
        <span aria-hidden> · </span>
        Indicators desk
      </p>
    </main>
  );
}
