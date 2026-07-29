"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { filterRange, spread, type Point } from "@/lib/mm-analytics";
import { MM_COLORS, RANGE_TABS, type ChartRange } from "@/components/mm/chartTheme";
import { MmLcChart } from "@/components/mm/MmLcChart";
import { EI_V2_CHAPTERS, type EiV2ChapterId } from "./catalog";
import { ReserveStackChart } from "@/components/ei/ReserveStackChart";
import { GdpSectorStackChart } from "@/components/ei/GdpSectorStackChart";
import {
  InflatePair,
  ReserveRings,
  Spark,
  StatLink,
  TradeTug,
  asOf,
  fmtNum,
  fmtPct,
  latest,
} from "./viz";

export type EiV2Bundle = Record<string, Point[]>;

type Props = {
  initialBundle: EiV2Bundle;
  initialRange?: ChartRange;
};

function p(bundle: EiV2Bundle, id: string, range: ChartRange): Point[] {
  return filterRange(bundle[id] ?? [], range);
}

export function EiV2Dashboard({ initialBundle, initialRange = "1Y" }: Props) {
  const [bundle] = useState(initialBundle);
  const [range, setRange] = useState<ChartRange>(initialRange);
  const [chapter, setChapter] = useState<EiV2ChapterId>("pulse");

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
  const ccpiMom = useMemo(() => p(bundle, "sl.ei.ccpi.headline_mom", range), [bundle, range]);
  const m2bYoy = useMemo(() => p(bundle, "sl.ei.m2b_yoy", range), [bundle, range]);
  const creditYoy = useMemo(() => p(bundle, "sl.ei.credit.private_yoy", range), [bundle, range]);
  const fwdShort = useMemo(() => p(bundle, "sl.ei.reserves.fwd_short", range), [bundle, range]);
  const netReserves = useMemo(
    () => p(bundle, "sl.ei.reserves.net_after_drains", range),
    [bundle, range],
  );
  const tourEarn = useMemo(() => p(bundle, "sl.ei.tourist_earnings_usd", range), [bundle, range]);
  const tradeBalYtd = useMemo(() => p(bundle, "sl.ei.trade.balance_ytd", range), [bundle, range]);
  const pmiMfg = useMemo(() => p(bundle, "sl.ei.pmi.manufacturing", range), [bundle, range]);
  const pmiSvc = useMemo(() => p(bundle, "sl.ei.pmi.services", range), [bundle, range]);
  const pmiCon = useMemo(() => p(bundle, "sl.ei.pmi.construction", range), [bundle, range]);
  const oilShare = useMemo(
    () => p(bundle, "sl.ei.electricity.thermal_oil_share", range),
    [bundle, range],
  );
  const primaryBal = useMemo(
    () => p(bundle, "sl.ei.fiscal.primary_balance", range),
    [bundle, range],
  );

  const coreGap = useMemo(() => spread(ccpiH, ccpiC), [ccpiH, ccpiC]);
  const wedge = useMemo(() => spread(ccpiH, ncpiH), [ccpiH, ncpiH]);

  const chapterMeta = EI_V2_CHAPTERS.find((c) => c.id === chapter)!;

  const reserveSlices = useMemo(() => {
    const rows = [
      { label: "FX", value: latest(oraFx) ?? 0, tone: "fx" },
      { label: "Gold", value: latest(oraGold) ?? 0, tone: "gold" },
      { label: "IMF", value: latest(oraImf) ?? 0, tone: "imf" },
      { label: "SDRs", value: latest(oraSdr) ?? 0, tone: "sdr" },
      { label: "Other", value: latest(oraOther) ?? 0, tone: "other" },
    ].filter((s) => s.value > 0);
    return rows;
  }, [oraFx, oraGold, oraImf, oraSdr, oraOther]);

  return (
    <main className="ei2">
      <header className="ei2-hero">
        <div className="ei2-hero-copy">
          <p className="ei2-eyebrow">LankaPulse</p>
          <h1 className="ei2-title">Market Pulse</h1>
          <p className="ei2-lede">
            Sri Lanka’s live macro board — prices, reserves, money, energy, trade and growth.
          </p>
        </div>
        <Link href="/series/sl.ei.ccpi.headline_yoy" className="ei2-hero-print">
          <em>Inflation now</em>
          <strong>{fmtPct(latest(ccpiH))}</strong>
          <span>
            CCPI headline
            {asOf(ccpiH) ? ` · ${asOf(ccpiH)!.slice(0, 7)}` : ""}
          </span>
          <Spark
            values={ccpiH.slice(-30).map((x) => x.value)}
            tone="accent"
            wide
          />
        </Link>
      </header>

      <nav className="ei2-chapters" aria-label="Market chapters">
        {EI_V2_CHAPTERS.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`ei2-chapter${c.id === chapter ? " is-active" : ""}`}
            onClick={() => setChapter(c.id)}
          >
            <span>{c.label}</span>
            <em>{c.tagline}</em>
          </button>
        ))}
      </nav>

      <div className="ei2-toolbar">
        <p className="ei2-chapter-tag">{chapterMeta.tagline}</p>
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
      </div>

      {chapter === "pulse" ? (
        <section className="ei2-panel">
          <div className="ei2-mosaic">
            <StatLink
              href="/series/sl.ei.ccpi.headline_yoy"
              label="CCPI"
              value={fmtPct(latest(ccpiH))}
              points={ccpiH}
              hint="Colombo"
              tone="accent"
            />
            <StatLink
              href="/series/sl.ei.ncpi.headline_yoy"
              label="NCPI"
              value={fmtPct(latest(ncpiH))}
              points={ncpiH}
              hint="National"
              tone="copper"
            />
            <StatLink
              href="/series/sl.ei.total_reserves"
              label="Reserves"
              value={fmtNum(latest(ora), 0)}
              unit="USD mn"
              points={ora}
              tone="ink"
            />
            <StatLink
              href="/series/sl.ei.liquidity_surplus"
              label="Liquidity"
              value={fmtNum(latest(liq), 0)}
              unit="Rs bn"
              points={liq}
              tone="accent"
            />
            <StatLink
              href="/series/sl.ei.energy.brent"
              label="Brent"
              value={fmtNum(latest(brent), 1)}
              unit="USD"
              points={brent}
              tone="copper"
            />
            <StatLink
              href="/series/sl.ei.trade.exports"
              label="Exports"
              value={fmtNum(latest(exports), 0)}
              unit="USD mn"
              points={exports}
              tone="accent"
            />
            <StatLink
              href="/series/sl.ei.gdp.growth"
              label="GDP"
              value={fmtPct(latest(gdp))}
              points={gdp}
              tone="ink"
            />
            <StatLink
              href="/series/sl.ei.m2"
              label="M2"
              value={fmtNum(latest(m2), 0)}
              unit="Rs bn"
              points={m2}
              tone="copper"
            />
          </div>

          <div className="ei2-split">
            <div className="ei2-block">
              <h2>Price climate</h2>
              <InflatePair ccpi={latest(ccpiH)} ncpi={latest(ncpiH)} />
            </div>
            <div className="ei2-block">
              <h2>Trade tug</h2>
              <TradeTug exports={latest(exports)} imports={latest(imports)} />
            </div>
            <div className="ei2-block ei2-block-wide">
              <h2>Reserve mix</h2>
              <ReserveRings slices={reserveSlices} />
            </div>
          </div>
        </section>
      ) : null}

      {chapter === "prices" ? (
        <section className="ei2-panel">
          <div className="ei2-mosaic ei2-mosaic-4">
            <StatLink href="/series/sl.ei.ccpi.headline_yoy" label="CCPI headline" value={fmtPct(latest(ccpiH))} points={ccpiH} />
            <StatLink href="/series/sl.ei.ccpi.core_yoy" label="CCPI core" value={fmtPct(latest(ccpiC))} points={ccpiC} />
            <StatLink href="/series/sl.ei.ncpi.headline_yoy" label="NCPI headline" value={fmtPct(latest(ncpiH))} points={ncpiH} tone="copper" />
            <StatLink href="/series/sl.ei.ncpi.core_yoy" label="NCPI core" value={fmtPct(latest(ncpiC))} points={ncpiC} tone="copper" />
            <StatLink href="/series/sl.ei.ccpi.headline_mom" label="CCPI MoM" value={fmtPct(latest(ccpiMom))} points={ccpiMom} />
            <StatLink href="/series/sl.ei.ncpi.food_yoy" label="NCPI food" value={fmtPct(latest(ncpiFood))} points={ncpiFood} tone="copper" />
            <StatLink href="/series/sl.ei.ncpi.nonfood_yoy" label="NCPI non-food" value={fmtPct(latest(ncpiNonfood))} points={ncpiNonfood} tone="copper" />
          </div>
          <div className="ei2-charts">
            <div className="ei2-chart">
              <h2>Food vs non-food</h2>
              <MmLcChart
                range={range}
                height={280}
                compact
                series={[
                  {
                    key: "food",
                    label: "NCPI food",
                    kind: "line",
                    points: ncpiFood,
                    colorVar: MM_COLORS.copper.var,
                    colorFallback: MM_COLORS.copper.fallback,
                  },
                  {
                    key: "nonfood",
                    label: "NCPI non-food",
                    kind: "line",
                    points: ncpiNonfood,
                    colorVar: MM_COLORS.sdf.var,
                    colorFallback: MM_COLORS.sdf.fallback,
                  },
                  {
                    key: "mom",
                    label: "CCPI MoM",
                    kind: "histogram",
                    points: ccpiMom,
                    colorVar: MM_COLORS.call.var,
                    colorFallback: MM_COLORS.call.fallback,
                  },
                ]}
              />
            </div>
            <div className="ei2-chart">
              <h2>Headline vs core</h2>
              <MmLcChart
                range={range}
                height={280}
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
            <div className="ei2-chart">
              <h2>Core gap (pp)</h2>
              <MmLcChart
                range={range}
                height={280}
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
            <div className="ei2-chart">
              <h2>Colombo − national wedge</h2>
              <MmLcChart
                range={range}
                height={280}
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
            <div className="ei2-chart">
              <h2>Inflation vs policy rate</h2>
              <MmLcChart
                range={range}
                height={280}
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
        </section>
      ) : null}

      {chapter === "reserves" ? (
        <section className="ei2-panel">
          <div className="ei2-split">
            <div className="ei2-block">
              <h2>Composition</h2>
              <ReserveRings slices={reserveSlices} />
            </div>
            <div className="ei2-block ei2-block-grow">
              <div className="ei2-mosaic ei2-mosaic-2">
                <StatLink
                  href="/series/sl.ei.total_reserves"
                  label="Official reserves"
                  value={fmtNum(latest(ora), 0)}
                  unit="USD mn"
                  points={ora}
                />
                <StatLink
                  href="/series/sl.ei.reserves.fx"
                  label="FX reserves"
                  value={fmtNum(latest(oraFx), 0)}
                  unit="USD mn"
                  points={oraFx}
                  tone="accent"
                />
                <StatLink
                  href="/series/sl.ei.reserves.gold"
                  label="Gold"
                  value={fmtNum(latest(oraGold), 0)}
                  unit="USD mn"
                  points={oraGold}
                  tone="copper"
                />
                <StatLink
                  href="/series/sl.ei.reserves.imf"
                  label="IMF position"
                  value={fmtNum(latest(oraImf), 0)}
                  unit="USD mn"
                  points={oraImf}
                  tone="ink"
                />
              </div>
            </div>
          </div>
          <div className="ei2-chart ei2-chart-full">
            <h2>Reserve composition</h2>
            <ReserveStackChart
              height={320}
              slices={[
                { key: "fx", label: "FX", points: oraFx, tone: "fx" },
                { key: "gold", label: "Gold", points: oraGold, tone: "gold" },
                { key: "imf", label: "IMF", points: oraImf, tone: "imf" },
                { key: "sdr", label: "SDRs", points: oraSdr, tone: "sdr" },
                { key: "other", label: "Other", points: oraOther, tone: "other" },
              ]}
            />
          </div>
          <div className="ei2-charts">
            <div className="ei2-chart">
              <h2>Net after forward drains</h2>
              <MmLcChart
                range={range}
                height={280}
                compact
                zeroLine
                series={[
                  {
                    key: "ora",
                    label: "Gross ORA",
                    kind: "line",
                    points: ora,
                    colorVar: MM_COLORS.call.var,
                    colorFallback: MM_COLORS.call.fallback,
                    priceFormat: "number",
                  },
                  {
                    key: "net",
                    label: "Net after drains",
                    kind: "line",
                    points: netReserves,
                    colorVar: MM_COLORS.sdf.var,
                    colorFallback: MM_COLORS.sdf.fallback,
                    priceFormat: "number",
                  },
                  {
                    key: "fwd",
                    label: "Forward short",
                    kind: "histogram",
                    points: fwdShort,
                    colorVar: MM_COLORS.copper.var,
                    colorFallback: MM_COLORS.copper.fallback,
                    priceFormat: "number",
                  },
                ]}
              />
            </div>
          </div>
        </section>
      ) : null}

      {chapter === "money" ? (
        <section className="ei2-panel">
          <div className="ei2-mosaic ei2-mosaic-4">
            <StatLink
              href="/series/sl.ei.reserve_money"
              label="Reserve money"
              value={fmtNum(latest(rm) != null ? latest(rm)! / 1000 : null, 0)}
              unit="Rs bn"
              points={rm}
            />
            <StatLink
              href="/series/sl.ei.currency_in_circulation"
              label="Currency in circ."
              value={fmtNum(latest(cic) != null ? latest(cic)! / 1000 : null, 0)}
              unit="Rs bn"
              points={cic}
              tone="copper"
            />
            <StatLink
              href="/series/sl.ei.m2"
              label="M2"
              value={fmtNum(latest(m2), 0)}
              unit="Rs bn"
              points={m2}
              tone="ink"
            />
            <StatLink
              href="/series/sl.ei.liquidity_surplus"
              label="Liquidity surplus"
              value={fmtNum(latest(liq), 0)}
              unit="Rs bn"
              points={liq}
            />
            <StatLink
              href="/series/sl.ei.m2b_yoy"
              label="M2b YoY"
              value={fmtPct(latest(m2bYoy))}
              points={m2bYoy}
              tone="accent"
            />
            <StatLink
              href="/series/sl.ei.credit.private_yoy"
              label="Private credit YoY"
              value={fmtPct(latest(creditYoy))}
              points={creditYoy}
              tone="copper"
            />
            <StatLink
              href="/series/sl.ei.fiscal.primary_balance"
              label="Primary balance"
              value={fmtNum(latest(primaryBal) != null ? latest(primaryBal)! / 1000 : null, 0)}
              unit="Rs bn"
              points={primaryBal}
              tone="ink"
            />
          </div>
          <div className="ei2-charts">
            <div className="ei2-chart">
              <h2>Monetary base</h2>
              <MmLcChart
                range={range}
                height={300}
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
            <div className="ei2-chart">
              <h2>Broad money</h2>
              <MmLcChart
                range={range}
                height={300}
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
            <div className="ei2-chart ei2-chart-full">
              <h2>Market liquidity surplus</h2>
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
        </section>
      ) : null}

      {chapter === "energy" ? (
        <section className="ei2-panel">
          <div className="ei2-mosaic ei2-mosaic-4">
            <StatLink href="/series/sl.ei.energy.brent" label="Brent" value={fmtNum(latest(brent), 1)} unit="USD/bbl" points={brent} tone="copper" />
            <StatLink href="/series/sl.ei.fuel.petrol_92" label="Petrol 92" value={fmtNum(latest(petrol), 0)} unit="LKR/L" points={petrol} />
            <StatLink href="/series/sl.ei.fuel.auto_diesel" label="Diesel" value={fmtNum(latest(diesel), 0)} unit="LKR/L" points={diesel} tone="ink" />
            <StatLink href="/series/sl.ei.electricity.generation" label="Generation" value={fmtNum(latest(power), 1)} unit="GWh" points={power} />
          </div>
          <div className="ei2-charts">
            <div className="ei2-chart">
              <h2>Crude vs pump</h2>
              <MmLcChart
                range={range}
                height={300}
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
            <div className="ei2-chart">
              <h2>Power system</h2>
              <MmLcChart
                range={range}
                height={300}
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
                  {
                    key: "oil",
                    label: "Thermal oil share",
                    kind: "line",
                    points: oilShare,
                    colorVar: MM_COLORS.awfdr.var,
                    colorFallback: MM_COLORS.awfdr.fallback,
                    priceScaleId: "left",
                    priceFormat: "number",
                  },
                ]}
              />
            </div>
          </div>
        </section>
      ) : null}

      {chapter === "trade" ? (
        <section className="ei2-panel">
          <div className="ei2-split">
            <div className="ei2-block ei2-block-grow">
              <h2>Goods trade</h2>
              <TradeTug exports={latest(exports)} imports={latest(imports)} />
            </div>
            <div className="ei2-mosaic ei2-mosaic-2">
              <StatLink href="/series/sl.ei.remittances_usd" label="Remittances" value={fmtNum(latest(rem), 0)} unit="USD mn" points={rem} />
              <StatLink href="/series/sl.ei.tourist_arrivals" label="Tourists" value={fmtNum(latest(tour), 0)} points={tour} tone="copper" />
              <StatLink href="/series/sl.ei.tourist_earnings_usd" label="Tourism $" value={fmtNum(latest(tourEarn), 0)} unit="USD mn" points={tourEarn} tone="accent" />
              <StatLink href="/series/sl.ei.trade.balance_ytd" label="Trade bal YTD" value={fmtNum(latest(tradeBalYtd), 0)} unit="USD mn" points={tradeBalYtd} tone="ink" />
              <StatLink href="/series/sl.ei.remittances_usd_ytd" label="Remittances YTD" value={fmtNum(latest(remYtd), 0)} unit="USD mn" points={remYtd} tone="ink" />
              <StatLink href="/series/sl.ei.tourist_arrivals_ytd" label="Tourists YTD" value={fmtNum(latest(tourYtd), 0)} points={tourYtd} tone="copper" />
            </div>
          </div>
          <div className="ei2-charts">
            <div className="ei2-chart">
              <h2>Exports & imports</h2>
              <MmLcChart
                range={range}
                height={300}
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
            <div className="ei2-chart">
              <h2>Trade balance</h2>
              <MmLcChart
                range={range}
                height={300}
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
            <div className="ei2-chart ei2-chart-full">
              <h2>Remittances & arrivals</h2>
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
          </div>
        </section>
      ) : null}

      {chapter === "growth" ? (
        <section className="ei2-panel">
          <div className="ei2-mosaic ei2-mosaic-4">
            <StatLink href="/series/sl.ei.gdp.growth" label="GDP growth" value={fmtPct(latest(gdp))} points={gdp} />
            <StatLink href="/series/sl.ei.gdp.agriculture_yoy" label="Agriculture" value={fmtPct(latest(gdpAgri))} points={gdpAgri} tone="accent" />
            <StatLink href="/series/sl.ei.gdp.industry_yoy" label="Industry" value={fmtPct(latest(gdpInd))} points={gdpInd} tone="copper" />
            <StatLink href="/series/sl.ei.gdp.services_yoy" label="Services" value={fmtPct(latest(gdpSvc))} points={gdpSvc} tone="ink" />
            <StatLink href="/series/sl.ei.pmi.manufacturing" label="PMI mfg" value={fmtNum(latest(pmiMfg), 1)} points={pmiMfg} />
            <StatLink href="/series/sl.ei.pmi.services" label="PMI services" value={fmtNum(latest(pmiSvc), 1)} points={pmiSvc} tone="accent" />
            <StatLink href="/series/sl.ei.pmi.construction" label="PMI construction" value={fmtNum(latest(pmiCon), 1)} points={pmiCon} tone="copper" />
          </div>
          <div className="ei2-charts">
            <div className="ei2-chart">
              <h2>PMI</h2>
              <MmLcChart
                range={range}
                height={280}
                compact
                series={[
                  {
                    key: "mfg",
                    label: "Manufacturing",
                    kind: "line",
                    points: pmiMfg,
                    colorVar: MM_COLORS.call.var,
                    colorFallback: MM_COLORS.call.fallback,
                    priceFormat: "number",
                  },
                  {
                    key: "svc",
                    label: "Services",
                    kind: "line",
                    points: pmiSvc,
                    colorVar: MM_COLORS.sdf.var,
                    colorFallback: MM_COLORS.sdf.fallback,
                    priceFormat: "number",
                  },
                  {
                    key: "con",
                    label: "Construction",
                    kind: "line",
                    points: pmiCon,
                    colorVar: MM_COLORS.copper.var,
                    colorFallback: MM_COLORS.copper.fallback,
                    priceFormat: "number",
                  },
                ]}
              />
            </div>
            <div className="ei2-chart ei2-chart-full">
              <h2>GDP by industrial origin</h2>
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
            <div className="ei2-chart">
              <h2>Industrial production</h2>
              <MmLcChart
                range={range}
                height={280}
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
        </section>
      ) : null}

      <p className="ei2-foot">
        <Link href="/markets/ei/classic">Classic EI desk</Link>
        <span aria-hidden> · </span>
        <Link href="/markets/ei">Indicators desk</Link>
        <span aria-hidden> · </span>
        Market Pulse v2
      </p>
    </main>
  );
}
