"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { filterRange, type Point } from "@/lib/mm-analytics";
import { MM_COLORS, RANGE_TABS, type ChartRange } from "@/components/mm/chartTheme";
import { MmLcChart } from "@/components/mm/MmLcChart";
import {
  Spark,
  StatLink,
  TradeTug,
  asOf,
  fmtNum,
  latest,
} from "@/components/ei-v2/viz";
import { CaWaterfall } from "./CaWaterfall";
import { FxSankey } from "./FxSankey";
import { ServicesStackChart } from "./ServicesStackChart";
import { DualAxisBarChart } from "./DualAxisBarChart";
import { FlowsBarChart } from "./FlowsBarChart";
import { YoyRadar } from "./YoyRadar";

export type EspBundle = Record<string, Point[]>;

type Props = {
  initialBundle: EspBundle;
  initialRange?: ChartRange;
};

function p(bundle: EspBundle, id: string, range: ChartRange): Point[] {
  return filterRange(bundle[id] ?? [], range);
}

function atPeriod(points: Point[], period: string | null): number | null {
  if (!period || !points.length) return null;
  for (let i = points.length - 1; i >= 0; i--) {
    if (points[i]!.period === period) return points[i]!.value;
  }
  return null;
}

export function EspDashboard({ initialBundle, initialRange = "1Y" }: Props) {
  const [bundle] = useState(initialBundle);
  const [range, setRange] = useState<ChartRange>(initialRange);
  const selectRange = useCallback((next: ChartRange) => setRange(next), []);

  const ca = useMemo(() => p(bundle, "sl.ei.bop.current_account", range), [bundle, range]);
  const caYtd = useMemo(() => p(bundle, "sl.ei.bop.current_account_ytd", range), [bundle, range]);
  const exports = useMemo(() => p(bundle, "sl.ei.trade.exports", range), [bundle, range]);
  const imports = useMemo(() => p(bundle, "sl.ei.trade.imports", range), [bundle, range]);
  const balance = useMemo(() => p(bundle, "sl.ei.trade.balance", range), [bundle, range]);
  const balYtd = useMemo(() => p(bundle, "sl.ei.trade.balance_ytd", range), [bundle, range]);
  const svcNet = useMemo(() => p(bundle, "sl.ei.services.net", range), [bundle, range]);
  const svcIn = useMemo(() => p(bundle, "sl.ei.services.inflows", range), [bundle, range]);
  const svcOut = useMemo(() => p(bundle, "sl.ei.services.outflows", range), [bundle, range]);
  const primary = useMemo(() => p(bundle, "sl.ei.income.primary_net", range), [bundle, range]);
  const primaryIn = useMemo(
    () => p(bundle, "sl.ei.income.primary_inflows", range),
    [bundle, range],
  );
  const primaryOut = useMemo(
    () => p(bundle, "sl.ei.income.primary_outflows", range),
    [bundle, range],
  );
  const secondary = useMemo(() => p(bundle, "sl.ei.income.secondary_net", range), [bundle, range]);
  const personalOut = useMemo(
    () => p(bundle, "sl.ei.income.personal_outflows", range),
    [bundle, range],
  );
  const rem = useMemo(() => p(bundle, "sl.ei.remittances_usd", range), [bundle, range]);
  const remYtd = useMemo(() => p(bundle, "sl.ei.remittances_usd_ytd", range), [bundle, range]);
  const tourEarn = useMemo(() => p(bundle, "sl.ei.tourist_earnings_usd", range), [bundle, range]);
  const tourEarnYtd = useMemo(
    () => p(bundle, "sl.ei.tourist_earnings_usd_ytd", range),
    [bundle, range],
  );
  const tour = useMemo(() => p(bundle, "sl.ei.tourist_arrivals", range), [bundle, range]);
  const tourYtd = useMemo(() => p(bundle, "sl.ei.tourist_arrivals_ytd", range), [bundle, range]);
  const transport = useMemo(
    () => p(bundle, "sl.ei.services.transport_inflows", range),
    [bundle, range],
  );
  const transportOut = useMemo(
    () => p(bundle, "sl.ei.services.transport_outflows", range),
    [bundle, range],
  );
  const itBpo = useMemo(() => p(bundle, "sl.ei.services.it_bpo", range), [bundle, range]);
  const travelAbroad = useMemo(
    () => p(bundle, "sl.ei.services.travel_abroad", range),
    [bundle, range],
  );
  const cse = useMemo(() => p(bundle, "sl.ei.flows.cse", range), [bundle, range]);
  const gsec = useMemo(() => p(bundle, "sl.ei.flows.gov_securities", range), [bundle, range]);
  const gor = useMemo(() => p(bundle, "sl.ei.reserves.gor", range), [bundle, range]);
  const ora = useMemo(() => p(bundle, "sl.ei.total_reserves", range), [bundle, range]);
  const changeRes = useMemo(() => p(bundle, "sl.ei.reserves.change", range), [bundle, range]);

  const expYoy = useMemo(() => p(bundle, "sl.ei.trade.exports_yoy", range), [bundle, range]);
  const impYoy = useMemo(() => p(bundle, "sl.ei.trade.imports_yoy", range), [bundle, range]);
  const svcYoy = useMemo(() => p(bundle, "sl.ei.services.net_yoy", range), [bundle, range]);
  const remYoy = useMemo(() => p(bundle, "sl.ei.remittances_usd_yoy", range), [bundle, range]);
  const tourYoy = useMemo(
    () => p(bundle, "sl.ei.tourist_earnings_usd_yoy", range),
    [bundle, range],
  );

  const asOfDate = asOf(ca) ?? asOf(exports) ?? asOf(gor);
  const fxPeriod = asOf(ca) ?? asOf(svcIn) ?? asOf(exports);

  const fxInflows = useMemo(() => {
    const tourV = atPeriod(tourEarn, fxPeriod) ?? 0;
    const trV = atPeriod(transport, fxPeriod) ?? 0;
    const itV = atPeriod(itBpo, fxPeriod) ?? 0;
    const svcInV = atPeriod(svcIn, fxPeriod);
    const otherSvc =
      svcInV != null ? Math.max(0, svcInV - tourV - trV - itV) : null;
    const cseV = atPeriod(cse, fxPeriod);
    const gsecV = atPeriod(gsec, fxPeriod);
    return [
      { key: "x", label: "Exports", value: atPeriod(exports, fxPeriod) },
      { key: "tour", label: "Tourism", value: atPeriod(tourEarn, fxPeriod) },
      { key: "tr", label: "Transport in", value: atPeriod(transport, fxPeriod) },
      { key: "it", label: "IT/BPO", value: atPeriod(itBpo, fxPeriod) },
      { key: "svcOther", label: "Other services in", value: otherSvc },
      { key: "rem", label: "Remittances", value: atPeriod(rem, fxPeriod) },
      { key: "prim", label: "Primary income in", value: atPeriod(primaryIn, fxPeriod) },
      {
        key: "cse",
        label: "CSE (net in)",
        value: cseV != null && cseV > 0 ? cseV : null,
      },
      {
        key: "gsec",
        label: "G-Sec (net in)",
        value: gsecV != null && gsecV > 0 ? gsecV : null,
      },
    ];
  }, [fxPeriod, exports, tourEarn, transport, itBpo, svcIn, rem, primaryIn, cse, gsec]);

  const fxOutflows = useMemo(() => {
    const travelV = atPeriod(travelAbroad, fxPeriod) ?? 0;
    const trV = atPeriod(transportOut, fxPeriod) ?? 0;
    const svcOutV = atPeriod(svcOut, fxPeriod);
    const otherSvc =
      svcOutV != null ? Math.max(0, svcOutV - travelV - trV) : null;
    const cseV = atPeriod(cse, fxPeriod);
    const gsecV = atPeriod(gsec, fxPeriod);
    return [
      { key: "m", label: "Imports", value: atPeriod(imports, fxPeriod) },
      { key: "travel", label: "Travel abroad", value: atPeriod(travelAbroad, fxPeriod) },
      { key: "tr", label: "Transport out", value: atPeriod(transportOut, fxPeriod) },
      { key: "svcOther", label: "Other services out", value: otherSvc },
      { key: "prim", label: "Primary income out", value: atPeriod(primaryOut, fxPeriod) },
      { key: "pers", label: "Personal transfers out", value: atPeriod(personalOut, fxPeriod) },
      {
        key: "cse",
        label: "CSE (net out)",
        value: cseV != null && cseV < 0 ? -cseV : null,
      },
      {
        key: "gsec",
        label: "G-Sec (net out)",
        value: gsecV != null && gsecV < 0 ? -gsecV : null,
      },
    ];
  }, [
    fxPeriod,
    imports,
    travelAbroad,
    transportOut,
    svcOut,
    primaryOut,
    personalOut,
    cse,
    gsec,
  ]);

  return (
    <div className="esp">
      <header className="esp-hero">
        <div>
          <p className="esp-eyebrow">CBSL · External Sector Performance</p>
          <h1 className="esp-title">External Sector</h1>
          <p className="esp-lede">
            Monthly current account, merchandise trade, services, remittances, and gross official
            reserves — from the Central Bank press pack.
          </p>
        </div>
        <Link href="/series/sl.ei.bop.current_account" className="esp-hero-print">
          <em>Latest print</em>
          <strong>{fmtNum(latest(ca), 0)}</strong>
          <span>USD mn current account{asOfDate ? ` · ${asOfDate.slice(0, 7)}` : ""}</span>
        </Link>
      </header>

      <div className="esp-toolbar">
        <p className="esp-chapter-tag">Pulse through YoY — one composition per section</p>
        <div className="mm-range-tabs" role="tablist" aria-label="History range">
          {RANGE_TABS.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              className={`mm-range-tab${range === t ? " is-active" : ""}`}
              aria-selected={range === t}
              onClick={() => selectRange(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <section className="esp-panel esp-enter">
        <div className="esp-mosaic">
          <StatLink
            href="/series/sl.ei.bop.current_account"
            label="Current account"
            value={fmtNum(latest(ca), 0)}
            unit="USD mn"
            points={ca}
            tone={latest(ca) != null && (latest(ca) as number) >= 0 ? "accent" : "copper"}
          />
          <StatLink
            href="/series/sl.ei.trade.balance"
            label="Trade balance"
            value={fmtNum(latest(balance), 0)}
            unit="USD mn"
            points={balance}
            tone="copper"
          />
          <StatLink
            href="/series/sl.ei.remittances_usd"
            label="Remittances"
            value={fmtNum(latest(rem), 0)}
            unit="USD mn"
            points={rem}
          />
          <StatLink
            href="/series/sl.ei.reserves.gor"
            label="GOR"
            value={fmtNum(latest(gor), 0)}
            unit="USD mn"
            hint="incl. PBOC swap"
            points={gor}
            tone="ink"
          />
        </div>
      </section>

      <section className="esp-panel esp-enter" style={{ animationDelay: "60ms" }}>
        <div className="esp-section-head">
          <h2>Current account bridge</h2>
          <p>Trade + services + primary + secondary income → current account</p>
        </div>
        <CaWaterfall
          steps={[
            { key: "trade", label: "Trade", value: latest(balance) },
            { key: "svc", label: "Services", value: latest(svcNet) },
            { key: "prim", label: "Primary", value: latest(primary) },
            { key: "sec", label: "Secondary", value: latest(secondary) },
          ]}
          total={latest(ca)}
        />
      </section>

      <section className="esp-panel esp-enter" style={{ animationDelay: "90ms" }}>
        <div className="esp-section-head">
          <h2>FX in &amp; out</h2>
          <p>
            Gross external inflows versus outflows for the latest month
            {asOfDate ? ` · ${asOfDate.slice(0, 7)}` : ""}
          </p>
        </div>
        <FxSankey inflows={fxInflows} outflows={fxOutflows} />
      </section>

      <section className="esp-panel esp-enter" style={{ animationDelay: "120ms" }}>
        <div className="esp-split">
          <div className="esp-block">
            <div className="esp-section-head">
              <h2>Goods trade</h2>
              <p>Exports versus imports for the latest month</p>
            </div>
            <TradeTug exports={latest(exports)} imports={latest(imports)} />
          </div>
          <div className="esp-mosaic esp-mosaic-2">
            <StatLink
              href="/series/sl.ei.trade.exports"
              label="Exports"
              value={fmtNum(latest(exports), 0)}
              unit="USD mn"
              points={exports}
            />
            <StatLink
              href="/series/sl.ei.trade.imports"
              label="Imports"
              value={fmtNum(latest(imports), 0)}
              unit="USD mn"
              points={imports}
              tone="copper"
            />
            <StatLink
              href="/series/sl.ei.trade.balance_ytd"
              label="Trade bal YTD"
              value={fmtNum(latest(balYtd), 0)}
              unit="USD mn"
              points={balYtd}
              tone="ink"
            />
            <StatLink
              href="/series/sl.ei.bop.current_account_ytd"
              label="CA YTD"
              value={fmtNum(latest(caYtd), 0)}
              unit="USD mn"
              points={caYtd}
              tone="ink"
            />
          </div>
        </div>
        <div className="esp-chart">
          <h3>Exports & imports</h3>
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
      </section>

      <section className="esp-panel esp-enter" style={{ animationDelay: "180ms" }}>
        <div className="esp-section-head">
          <h2>Services stack</h2>
          <p>Tourism, transport, and IT/BPO inflows — plus travel-abroad outflows</p>
        </div>
        <div className="esp-split">
          <div className="esp-block esp-block-grow">
            <ServicesStackChart
              slices={[
                {
                  key: "tour",
                  label: "Tourism",
                  points: tourEarn,
                  color: "#0b7a6b",
                },
                {
                  key: "tr",
                  label: "Transport",
                  points: transport,
                  color: "#2f6f8f",
                },
                {
                  key: "it",
                  label: "IT/BPO",
                  points: itBpo,
                  color: "#b86b2a",
                },
              ]}
            />
          </div>
          <div className="esp-mosaic esp-mosaic-1">
            <StatLink
              href="/series/sl.ei.services.net"
              label="Services net"
              value={fmtNum(latest(svcNet), 0)}
              unit="USD mn"
              points={svcNet}
            />
            <StatLink
              href="/series/sl.ei.services.travel_abroad"
              label="Travel abroad"
              value={fmtNum(latest(travelAbroad), 0)}
              unit="USD mn"
              points={travelAbroad}
              tone="copper"
            />
          </div>
        </div>
      </section>

      <section className="esp-panel esp-enter" style={{ animationDelay: "240ms" }}>
        <div className="esp-section-head">
          <h2>Remittances & tourism</h2>
          <p>Workers’ remittances versus tourism earnings and arrivals</p>
        </div>
        <div className="esp-charts">
          <div className="esp-chart">
            <h3>Remittances</h3>
            <DualAxisBarChart
              height={280}
              leftName="Monthly"
              rightName="YTD"
              left={{
                key: "rem",
                label: "Monthly",
                points: rem,
                color: MM_COLORS.call.fallback,
                yAxisIndex: 0,
                unit: "USD mn",
              }}
              right={{
                key: "remYtd",
                label: "YTD",
                points: remYtd,
                color: "#7eb8ad",
                yAxisIndex: 1,
                unit: "USD mn",
              }}
            />
          </div>
          <div className="esp-chart">
            <h3>Tourism earnings vs arrivals</h3>
            <DualAxisBarChart
              height={280}
              leftName="Arrivals"
              rightName="Earnings"
              left={{
                key: "arr",
                label: "Arrivals",
                points: tour,
                color: MM_COLORS.opr.fallback,
                yAxisIndex: 0,
              }}
              right={{
                key: "earn",
                label: "Earnings",
                points: tourEarn,
                color: MM_COLORS.copper.fallback,
                yAxisIndex: 1,
                unit: "USD mn",
              }}
            />
            <div className="esp-inline-stats">
              <span>
                Arrivals YTD <strong>{fmtNum(latest(tourYtd), 0)}</strong>
              </span>
              <span>
                Earnings YTD <strong>{fmtNum(latest(tourEarnYtd), 0)}</strong> USD mn
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="esp-panel esp-enter" style={{ animationDelay: "300ms" }}>
        <div className="esp-section-head">
          <h2>Financial flows</h2>
          <p>Net foreign investment in the CSE and government securities</p>
        </div>
        <FlowsBarChart
          series={[
            {
              key: "cse",
              label: "CSE",
              points: cse,
              color: "#0b7a6b",
            },
            {
              key: "gsec",
              label: "G-Sec",
              points: gsec,
              color: "#b86b2a",
            },
          ]}
        />
      </section>

      <section className="esp-panel esp-enter" style={{ animationDelay: "360ms" }}>
        <div className="esp-section-head">
          <h2>Reserves</h2>
          <p>
            Gross official reserves (incl. PBOC swap) — not the same stock as WEI Official Reserve
            Assets
          </p>
        </div>
        <div className="esp-charts">
          <div className="esp-chart">
            <h3>GOR level</h3>
            <MmLcChart
              range={range}
              height={280}
              compact
              series={[
                {
                  key: "gor",
                  label: "GOR",
                  kind: "area",
                  points: gor,
                  colorVar: MM_COLORS.opr.var,
                  colorFallback: MM_COLORS.opr.fallback,
                  priceFormat: "number",
                },
                {
                  key: "ora",
                  label: "ORA (WEI)",
                  kind: "line",
                  points: ora,
                  colorVar: MM_COLORS.call.var,
                  colorFallback: MM_COLORS.call.fallback,
                  priceFormat: "number",
                },
              ]}
            />
          </div>
          <div className="esp-chart">
            <h3>Change in reserves</h3>
            <MmLcChart
              range={range}
              height={280}
              compact
              series={[
                {
                  key: "chg",
                  label: "Δ Reserves",
                  kind: "histogram",
                  points: changeRes,
                  colorVar: MM_COLORS.call.var,
                  colorFallback: MM_COLORS.call.fallback,
                  priceFormat: "number",
                },
              ]}
            />
          </div>
        </div>
      </section>

      <section className="esp-panel esp-enter" style={{ animationDelay: "420ms" }}>
        <div className="esp-section-head">
          <h2>YoY divergence</h2>
          <p>Headline year-on-year % from the latest ESP summary table</p>
        </div>
        <div className="esp-split">
          <div className="esp-block esp-block-grow">
            <YoyRadar
              spokes={[
                { label: "Exports", value: latest(expYoy) },
                { label: "Imports", value: latest(impYoy) },
                { label: "Services", value: latest(svcYoy) },
                { label: "Remit", value: latest(remYoy) },
                { label: "Tourism", value: latest(tourYoy) },
              ]}
            />
          </div>
          <div className="esp-yoy-list">
            {(
              [
                ["Exports", expYoy, "accent"],
                ["Imports", impYoy, "copper"],
                ["Services", svcYoy, "ink"],
                ["Remittances", remYoy, "accent"],
                ["Tourism $", tourYoy, "copper"],
              ] as const
            ).map(([label, pts, tone]) => (
              <div key={label} className={`esp-yoy-row tone-${tone}`}>
                <span>{label}</span>
                <strong>
                  {latest(pts) == null
                    ? "—"
                    : `${(latest(pts) as number) > 0 ? "+" : ""}${(latest(pts) as number).toFixed(1)}%`}
                </strong>
                <Spark values={pts.slice(-12).map((x) => x.value)} tone={tone} />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
