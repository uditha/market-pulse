"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { filterRange, spread, type Point } from "@/lib/mm-analytics";
import { MM_COLORS, RANGE_TABS, type ChartRange } from "@/components/mm/chartTheme";
import { MmLcChart } from "@/components/mm/MmLcChart";
import {
  DEFAULT_EI_VIEW,
  EI_REPORTS,
  viewsForReport,
  type EiReportId,
  type EiViewId,
} from "./eiViews";
import type { EiBundle, EiDashboardProps } from "./eiSeries";
import { OraVault } from "./OraVault";
import { ReserveStackChart } from "./ReserveStackChart";

function latest(points: Point[]): number | null {
  if (!points.length) return null;
  return points[points.length - 1]?.value ?? null;
}

function fmt(n: number | null, digits = 1, suffix = "%") {
  if (n == null || Number.isNaN(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(digits)}${suffix}`;
}

function fmtUsdMn(n: number | null) {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString("en-US", {
    maximumFractionDigits: n >= 100 ? 0 : 1,
  });
}

function pts(bundle: EiBundle, id: string, range: ChartRange): Point[] {
  return filterRange(bundle[id] ?? [], range);
}

function reportSnapshot(
  bundle: EiBundle,
  report: Exclude<EiReportId, "overview">,
): { label: string; value: string } {
  if (report === "cpi") {
    const v = latest(bundle["sl.ei.ccpi.headline_yoy"] ?? []);
    return { label: "CCPI", value: fmt(v) };
  }
  if (report === "dei") {
    const v = latest(bundle["sl.ei.reserve_money"] ?? []);
    return {
      label: "Reserve money",
      value: v == null ? "—" : `${(v / 1_000).toFixed(0)} Rs bn`,
    };
  }
  if (report === "wei") {
    const v = latest(bundle["sl.ei.total_reserves"] ?? []);
    return { label: "ORA", value: v == null ? "—" : `${fmtUsdMn(v)} USD mn` };
  }
  const v = latest(bundle["sl.ei.trade.exports"] ?? []);
  return { label: "Exports", value: v == null ? "—" : `${fmtUsdMn(v)} USD mn` };
}

export function EiAnalyticsDashboard({
  initialBundle,
  initialRange,
}: EiDashboardProps) {
  const [bundle] = useState(initialBundle);
  const [range, setRange] = useState<ChartRange>(initialRange);
  const [report, setReport] = useState<EiReportId>("overview");
  const [viewId, setViewId] = useState<EiViewId>(DEFAULT_EI_VIEW.cpi);

  const selectRange = useCallback((next: ChartRange) => {
    setRange(next);
  }, []);

  const openReport = useCallback((next: Exclude<EiReportId, "overview">) => {
    setReport(next);
    setViewId(DEFAULT_EI_VIEW[next]);
  }, []);

  const onReportTab = useCallback((next: EiReportId) => {
    setReport(next);
    if (next !== "overview") setViewId(DEFAULT_EI_VIEW[next]);
  }, []);

  const ccpiH = useMemo(() => pts(bundle, "sl.ei.ccpi.headline_yoy", range), [bundle, range]);
  const ccpiC = useMemo(() => pts(bundle, "sl.ei.ccpi.core_yoy", range), [bundle, range]);
  const ncpiH = useMemo(() => pts(bundle, "sl.ei.ncpi.headline_yoy", range), [bundle, range]);
  const ncpiC = useMemo(() => pts(bundle, "sl.ei.ncpi.core_yoy", range), [bundle, range]);
  const opr = useMemo(() => pts(bundle, "sl.mm.opr", range), [bundle, range]);
  const cic = useMemo(() => pts(bundle, "sl.ei.currency_in_circulation", range), [bundle, range]);
  const reserveMoney = useMemo(() => pts(bundle, "sl.ei.reserve_money", range), [bundle, range]);
  const brent = useMemo(() => pts(bundle, "sl.ei.energy.brent", range), [bundle, range]);
  const petrol = useMemo(() => pts(bundle, "sl.ei.fuel.petrol_92", range), [bundle, range]);
  const diesel = useMemo(() => pts(bundle, "sl.ei.fuel.auto_diesel", range), [bundle, range]);
  const exports = useMemo(() => pts(bundle, "sl.ei.trade.exports", range), [bundle, range]);
  const imports = useMemo(() => pts(bundle, "sl.ei.trade.imports", range), [bundle, range]);
  const reserves = useMemo(() => pts(bundle, "sl.ei.total_reserves", range), [bundle, range]);
  const reservesFx = useMemo(() => pts(bundle, "sl.ei.reserves.fx", range), [bundle, range]);
  const reservesGold = useMemo(() => pts(bundle, "sl.ei.reserves.gold", range), [bundle, range]);
  const reservesImf = useMemo(() => pts(bundle, "sl.ei.reserves.imf", range), [bundle, range]);
  const reservesSdrs = useMemo(() => pts(bundle, "sl.ei.reserves.sdrs", range), [bundle, range]);
  const reservesOther = useMemo(() => pts(bundle, "sl.ei.reserves.other", range), [bundle, range]);
  const m2 = useMemo(() => pts(bundle, "sl.ei.m2", range), [bundle, range]);
  const gdp = useMemo(() => pts(bundle, "sl.ei.gdp.growth", range), [bundle, range]);
  const liquidity = useMemo(() => pts(bundle, "sl.ei.liquidity_surplus", range), [bundle, range]);
  const remittances = useMemo(() => pts(bundle, "sl.ei.remittances_usd", range), [bundle, range]);
  const remittancesYtd = useMemo(
    () => pts(bundle, "sl.ei.remittances_usd_ytd", range),
    [bundle, range],
  );
  const tourists = useMemo(() => pts(bundle, "sl.ei.tourist_arrivals", range), [bundle, range]);
  const touristsYtd = useMemo(
    () => pts(bundle, "sl.ei.tourist_arrivals_ytd", range),
    [bundle, range],
  );
  const touristEarn = useMemo(
    () => pts(bundle, "sl.ei.tourist_earnings_usd", range),
    [bundle, range],
  );
  const ccpiMom = useMemo(() => pts(bundle, "sl.ei.ccpi.headline_mom", range), [bundle, range]);
  const ncpiMom = useMemo(() => pts(bundle, "sl.ei.ncpi.headline_mom", range), [bundle, range]);
  const ncpiFood = useMemo(() => pts(bundle, "sl.ei.ncpi.food_yoy", range), [bundle, range]);
  const ncpiNonfood = useMemo(() => pts(bundle, "sl.ei.ncpi.nonfood_yoy", range), [bundle, range]);
  const pmiMfg = useMemo(() => pts(bundle, "sl.ei.pmi.manufacturing", range), [bundle, range]);
  const pmiSvc = useMemo(() => pts(bundle, "sl.ei.pmi.services", range), [bundle, range]);
  const pmiCon = useMemo(() => pts(bundle, "sl.ei.pmi.construction", range), [bundle, range]);
  const m2b = useMemo(() => pts(bundle, "sl.ei.m2b", range), [bundle, range]);
  const m2bYoy = useMemo(() => pts(bundle, "sl.ei.m2b_yoy", range), [bundle, range]);
  const credit = useMemo(() => pts(bundle, "sl.ei.credit.private", range), [bundle, range]);
  const creditYoy = useMemo(() => pts(bundle, "sl.ei.credit.private_yoy", range), [bundle, range]);
  const primaryBal = useMemo(
    () => pts(bundle, "sl.ei.fiscal.primary_balance", range),
    [bundle, range],
  );
  const overallBal = useMemo(
    () => pts(bundle, "sl.ei.fiscal.overall_balance", range),
    [bundle, range],
  );
  const debtDom = useMemo(() => pts(bundle, "sl.ei.debt.domestic", range), [bundle, range]);
  const debtFrn = useMemo(() => pts(bundle, "sl.ei.debt.foreign", range), [bundle, range]);
  const fwdShort = useMemo(() => pts(bundle, "sl.ei.reserves.fwd_short", range), [bundle, range]);
  const netReserves = useMemo(
    () => pts(bundle, "sl.ei.reserves.net_after_drains", range),
    [bundle, range],
  );
  const oilShare = useMemo(
    () => pts(bundle, "sl.ei.electricity.thermal_oil_share", range),
    [bundle, range],
  );
  const exportsYtd = useMemo(() => pts(bundle, "sl.ei.trade.exports_ytd", range), [bundle, range]);
  const importsYtd = useMemo(() => pts(bundle, "sl.ei.trade.imports_ytd", range), [bundle, range]);
  const awndr = useMemo(() => pts(bundle, "sl.mm.awndr", range), [bundle, range]);
  const awnlr = useMemo(() => pts(bundle, "sl.mm.awnlr", range), [bundle, range]);

  const oraSlices = useMemo(
    () => [
      {
        id: "sl.ei.reserves.fx",
        label: "Foreign currency",
        short: "FX",
        points: reservesFx,
        tone: "fx" as const,
      },
      {
        id: "sl.ei.reserves.gold",
        label: "Gold",
        short: "Gold",
        points: reservesGold,
        tone: "gold" as const,
      },
      {
        id: "sl.ei.reserves.imf",
        label: "IMF position",
        short: "IMF",
        points: reservesImf,
        tone: "imf" as const,
      },
      {
        id: "sl.ei.reserves.sdrs",
        label: "SDRs",
        short: "SDR",
        points: reservesSdrs,
        tone: "sdr" as const,
      },
      {
        id: "sl.ei.reserves.other",
        label: "Other",
        short: "Other",
        points: reservesOther,
        tone: "other" as const,
      },
    ],
    [reservesFx, reservesGold, reservesImf, reservesSdrs, reservesOther],
  );

  const coreGap = useMemo(() => spread(ccpiH, ccpiC), [ccpiH, ccpiC]);
  const wedge = useMemo(() => spread(ccpiH, ncpiH), [ccpiH, ncpiH]);

  const prints = {
    ccpiH: latest(ccpiH),
    ccpiC: latest(ccpiC),
    ncpiH: latest(ncpiH),
    ncpiC: latest(ncpiC),
    asOf: ccpiH.at(-1)?.period ?? ncpiH.at(-1)?.period ?? null,
  };

  const reportMeta = EI_REPORTS.find((r) => r.id === report)!;
  const reportViews = report === "overview" ? [] : viewsForReport(report);
  const activeView =
    reportViews.find((v) => v.id === viewId) ?? reportViews[0] ?? null;

  const chart = useMemo(() => {
    const id = activeView?.id ?? "headline";
    const base = { carryKeys: undefined as string[] | undefined };
    if (id === "ccpi-core") {
      return {
        ...base,
        zeroLine: false,
        series: [
          {
            key: "ccpiH",
            label: "CCPI Headline",
            kind: "line" as const,
            points: ccpiH,
            colorVar: MM_COLORS.call.var,
            colorFallback: MM_COLORS.call.fallback,
          },
          {
            key: "ccpiC",
            label: "CCPI Core",
            kind: "line" as const,
            points: ccpiC,
            colorVar: MM_COLORS.sdf.var,
            colorFallback: MM_COLORS.sdf.fallback,
          },
        ],
        info: {
          why: "Core strips food and energy noise — the gap shows how much of the print is volatile.",
          what: "Two Colombo Y-o-Y series: headline and core.",
          how: "Headline above core = food/energy pulling up; the reverse is disinflation in volatiles.",
        },
      };
    }
    if (id === "ccpi-ncpi") {
      return {
        ...base,
        zeroLine: false,
        series: [
          {
            key: "ccpiH",
            label: "CCPI Headline",
            kind: "line" as const,
            points: ccpiH,
            colorVar: MM_COLORS.call.var,
            colorFallback: MM_COLORS.call.fallback,
          },
          {
            key: "ncpiH",
            label: "NCPI Headline",
            kind: "line" as const,
            points: ncpiH,
            colorVar: MM_COLORS.copper.var,
            colorFallback: MM_COLORS.copper.fallback,
          },
        ],
        info: {
          why: "CCPI is Colombo urban; NCPI is national — wedge signals regional pressure.",
          what: "Headline Y-o-Y for both indices.",
          how: "Persistent CCPI > NCPI often means urban/food price stress in Colombo.",
        },
      };
    }
    if (id === "core-gap") {
      return {
        ...base,
        zeroLine: true,
        series: [
          {
            key: "gap",
            label: "Headline − core",
            kind: "baseline" as const,
            points: coreGap,
            colorVar: MM_COLORS.spread.var,
            colorFallback: MM_COLORS.spread.fallback,
          },
        ],
        info: {
          why: "The gap isolates how much headline is driven by non-core items.",
          what: "CCPI headline minus CCPI core, in percentage points.",
          how: "Positive = headline hotter than core; watch for mean-reversion after spikes.",
        },
      };
    }
    if (id === "four-way") {
      return {
        ...base,
        zeroLine: false,
        series: [
          {
            key: "ccpiH",
            label: "CCPI Headline",
            kind: "line" as const,
            points: ccpiH,
            colorVar: MM_COLORS.call.var,
            colorFallback: MM_COLORS.call.fallback,
            lineWidth: 3 as const,
          },
          {
            key: "ccpiC",
            label: "CCPI Core",
            kind: "line" as const,
            points: ccpiC,
            colorVar: MM_COLORS.sdf.var,
            colorFallback: MM_COLORS.sdf.fallback,
          },
          {
            key: "ncpiH",
            label: "NCPI Headline",
            kind: "line" as const,
            points: ncpiH,
            colorVar: MM_COLORS.copper.var,
            colorFallback: MM_COLORS.copper.fallback,
          },
          {
            key: "ncpiC",
            label: "NCPI Core",
            kind: "line" as const,
            points: ncpiC,
            colorVar: MM_COLORS.awfdr.var,
            colorFallback: MM_COLORS.awfdr.fallback,
          },
        ],
        info: {
          why: "One stage for the full CBSL consumer-price panel.",
          what: "Four monthly Y-o-Y series.",
          how: "Read clustering vs divergence — national vs Colombo, headline vs core.",
        },
      };
    }
    if (id === "wedge") {
      return {
        ...base,
        zeroLine: true,
        series: [
          {
            key: "wedge",
            label: "CCPI − NCPI",
            kind: "baseline" as const,
            points: wedge,
            colorVar: MM_COLORS.spread.var,
            colorFallback: MM_COLORS.spread.fallback,
          },
        ],
        info: {
          why: "The Colombo–national wedge is a quick stress check on urban prices.",
          what: "CCPI headline minus NCPI headline (pp).",
          how: "Above zero = Colombo running hotter than the nation.",
        },
      };
    }
    if (id === "vs-policy") {
      return {
        zeroLine: false,
        series: [
          {
            key: "ccpiH",
            label: "CCPI Headline",
            kind: "line" as const,
            points: ccpiH,
            colorVar: MM_COLORS.call.var,
            colorFallback: MM_COLORS.call.fallback,
            lineWidth: 3 as const,
          },
          {
            key: "opr",
            label: "OPR",
            kind: "step" as const,
            points: opr,
            colorVar: MM_COLORS.opr.var,
            colorFallback: MM_COLORS.opr.fallback,
          },
        ],
        carryKeys: ["opr"] as string[],
        info: {
          why: "Policy rate vs inflation — are real rates positive and is the stance consistent?",
          what: "CCPI headline Y-o-Y and Overnight Policy Rate (step).",
          how: "OPR above inflation ≈ positive real policy; watch lags after rate moves.",
        },
      };
    }
    if (id === "money") {
      return {
        ...base,
        zeroLine: false,
        series: [
          {
            key: "rm",
            label: "Reserve Money",
            kind: "line" as const,
            points: reserveMoney,
            colorVar: MM_COLORS.call.var,
            colorFallback: MM_COLORS.call.fallback,
            lineWidth: 3 as const,
            priceFormat: "number" as const,
          },
          {
            key: "cic",
            label: "CIC",
            kind: "line" as const,
            points: cic,
            colorVar: MM_COLORS.sdf.var,
            colorFallback: MM_COLORS.sdf.fallback,
            priceScaleId: "left" as const,
            priceFormat: "number" as const,
          },
        ],
        info: {
          why: "Daily monetary base from DEI.",
          what: "Reserve money and currency in circulation (Rs. mn).",
          how: "M2 lives under MEI — open the MEI report for broad money.",
        },
      };
    }
    if (id === "energy") {
      return {
        ...base,
        zeroLine: false,
        series: [
          {
            key: "brent",
            label: "Brent",
            kind: "line" as const,
            points: brent,
            colorVar: MM_COLORS.call.var,
            colorFallback: MM_COLORS.call.fallback,
            priceFormat: "number" as const,
          },
          {
            key: "petrol",
            label: "Petrol 92",
            kind: "line" as const,
            points: petrol,
            colorVar: MM_COLORS.copper.var,
            colorFallback: MM_COLORS.copper.fallback,
            priceScaleId: "left" as const,
            priceFormat: "number" as const,
          },
          {
            key: "diesel",
            label: "Auto Diesel",
            kind: "line" as const,
            points: diesel,
            colorVar: MM_COLORS.sdf.var,
            colorFallback: MM_COLORS.sdf.fallback,
            priceScaleId: "left" as const,
            priceFormat: "number" as const,
          },
        ],
        info: {
          why: "Global crude vs local CPC pump prices from DEI.",
          what: "Brent (USD/bbl) and CPC petrol / diesel (LKR/L).",
          how: "Pump prices step with CPC; Brent is the global driver.",
        },
      };
    }
    if (id === "reserves") {
      return {
        ...base,
        zeroLine: false,
        series: [
          {
            key: "ora",
            label: "Official reserves",
            kind: "line" as const,
            points: reserves,
            colorVar: MM_COLORS.call.var,
            colorFallback: MM_COLORS.call.fallback,
            lineWidth: 3 as const,
            priceFormat: "number" as const,
          },
          {
            key: "fx",
            label: "FX reserves",
            kind: "line" as const,
            points: reservesFx,
            colorVar: MM_COLORS.sdf.var,
            colorFallback: MM_COLORS.sdf.fallback,
            priceFormat: "number" as const,
          },
          {
            key: "gold",
            label: "Gold",
            kind: "line" as const,
            points: reservesGold,
            colorVar: MM_COLORS.copper.var,
            colorFallback: MM_COLORS.copper.fallback,
            priceFormat: "number" as const,
          },
        ],
        info: {
          why: "Official Reserve Assets from WEI §4.3 only.",
          what: "Total ORA, FX reserves, and gold (USD mn).",
          how: "Composition strip shows the mix; chart tracks the stock.",
        },
      };
    }
    if (id === "liquidity") {
      return {
        ...base,
        zeroLine: false,
        series: [
          {
            key: "liq",
            label: "Liquidity surplus",
            kind: "line" as const,
            points: liquidity,
            colorVar: MM_COLORS.sdf.var,
            colorFallback: MM_COLORS.sdf.fallback,
            priceFormat: "number" as const,
          },
        ],
        info: {
          why: "Week-ending market liquidity surplus from WEI highlights.",
          what: "Outstanding surplus (Rs. bn).",
          how: "Positive = surplus liquidity in the system.",
        },
      };
    }
    if (id === "remittances") {
      return {
        ...base,
        zeroLine: false,
        series: [
          {
            key: "rem",
            label: "Remittances",
            kind: "line" as const,
            points: remittances,
            colorVar: MM_COLORS.sdf.var,
            colorFallback: MM_COLORS.sdf.fallback,
            priceFormat: "number" as const,
          },
          {
            key: "remYtd",
            label: "Remittances YTD",
            kind: "line" as const,
            points: remittancesYtd,
            colorVar: MM_COLORS.call.var,
            colorFallback: MM_COLORS.call.fallback,
            priceFormat: "number" as const,
          },
          {
            key: "tour",
            label: "Tourist arrivals",
            kind: "line" as const,
            points: tourists,
            colorVar: MM_COLORS.copper.var,
            colorFallback: MM_COLORS.copper.fallback,
            priceScaleId: "left" as const,
            priceFormat: "number" as const,
          },
          {
            key: "tourYtd",
            label: "Tourists YTD",
            kind: "line" as const,
            points: touristsYtd,
            colorVar: MM_COLORS.awfdr.var,
            colorFallback: MM_COLORS.awfdr.fallback,
            priceScaleId: "left" as const,
            priceFormat: "number" as const,
          },
          {
            key: "earn",
            label: "Tourism earnings",
            kind: "line" as const,
            points: touristEarn,
            colorVar: MM_COLORS.slf.var,
            colorFallback: MM_COLORS.slf.fallback,
            priceFormat: "number" as const,
          },
        ],
        info: {
          why: "External inflows printed in WEI §4.2.",
          what: "Remittances, arrivals, and tourism earnings (USD mn).",
          how: "Month-stamped fills — not week-ending.",
        },
      };
    }
    if (id === "mom-food") {
      return {
        ...base,
        zeroLine: true,
        series: [
          {
            key: "ccpiMom",
            label: "CCPI MoM",
            kind: "line" as const,
            points: ccpiMom,
            colorVar: MM_COLORS.call.var,
            colorFallback: MM_COLORS.call.fallback,
          },
          {
            key: "ncpiMom",
            label: "NCPI MoM",
            kind: "line" as const,
            points: ncpiMom,
            colorVar: MM_COLORS.sdf.var,
            colorFallback: MM_COLORS.sdf.fallback,
          },
          {
            key: "food",
            label: "NCPI food YoY",
            kind: "line" as const,
            points: ncpiFood,
            colorVar: MM_COLORS.copper.var,
            colorFallback: MM_COLORS.copper.fallback,
          },
          {
            key: "nonfood",
            label: "NCPI non-food YoY",
            kind: "line" as const,
            points: ncpiNonfood,
            colorVar: MM_COLORS.awfdr.var,
            colorFallback: MM_COLORS.awfdr.fallback,
          },
        ],
        info: {
          why: "MoM momentum and food/non-food split from WEI.",
          what: "CCPI/NCPI MoM % and NCPI food vs non-food YoY.",
          how: "Food spikes often lead headline; MoM shows near-term heat.",
        },
      };
    }
    if (id === "pmi") {
      return {
        ...base,
        zeroLine: false,
        series: [
          {
            key: "mfg",
            label: "Manufacturing",
            kind: "line" as const,
            points: pmiMfg,
            colorVar: MM_COLORS.call.var,
            colorFallback: MM_COLORS.call.fallback,
            priceFormat: "number" as const,
          },
          {
            key: "svc",
            label: "Services",
            kind: "line" as const,
            points: pmiSvc,
            colorVar: MM_COLORS.sdf.var,
            colorFallback: MM_COLORS.sdf.fallback,
            priceFormat: "number" as const,
          },
          {
            key: "con",
            label: "Construction",
            kind: "line" as const,
            points: pmiCon,
            colorVar: MM_COLORS.copper.var,
            colorFallback: MM_COLORS.copper.fallback,
            priceFormat: "number" as const,
          },
        ],
        info: {
          why: "Soft activity gauges from WEI §1.6.",
          what: "PMI manufacturing / services / construction (50 = neutral).",
          how: "Above 50 = expansion; construction is the most volatile.",
        },
      };
    }
    if (id === "credit") {
      return {
        ...base,
        zeroLine: false,
        series: [
          {
            key: "creditYoy",
            label: "Private credit YoY",
            kind: "line" as const,
            points: creditYoy,
            colorVar: MM_COLORS.call.var,
            colorFallback: MM_COLORS.call.fallback,
          },
          {
            key: "m2bYoy",
            label: "M2b YoY",
            kind: "line" as const,
            points: m2bYoy,
            colorVar: MM_COLORS.sdf.var,
            colorFallback: MM_COLORS.sdf.fallback,
          },
          {
            key: "awndr",
            label: "AWNDR",
            kind: "line" as const,
            points: awndr,
            colorVar: MM_COLORS.copper.var,
            colorFallback: MM_COLORS.copper.fallback,
            priceScaleId: "left" as const,
          },
          {
            key: "awnlr",
            label: "AWNLR",
            kind: "line" as const,
            points: awnlr,
            colorVar: MM_COLORS.awfdr.var,
            colorFallback: MM_COLORS.awfdr.fallback,
            priceScaleId: "left" as const,
          },
        ],
        info: {
          why: "Credit impulse and new bank rates from WEI.",
          what: "Private credit / M2b YoY with AWNDR / AWNLR.",
          how: "Credit YoY leading M2b is the expansion story; new rates lead outstanding.",
        },
      };
    }
    if (id === "fiscal") {
      return {
        ...base,
        zeroLine: true,
        series: [
          {
            key: "primary",
            label: "Primary balance",
            kind: "line" as const,
            points: primaryBal,
            colorVar: MM_COLORS.sdf.var,
            colorFallback: MM_COLORS.sdf.fallback,
            priceFormat: "number" as const,
          },
          {
            key: "overall",
            label: "Overall balance",
            kind: "line" as const,
            points: overallBal,
            colorVar: MM_COLORS.call.var,
            colorFallback: MM_COLORS.call.fallback,
            priceFormat: "number" as const,
          },
          {
            key: "dom",
            label: "Domestic debt",
            kind: "line" as const,
            points: debtDom,
            colorVar: MM_COLORS.copper.var,
            colorFallback: MM_COLORS.copper.fallback,
            priceScaleId: "left" as const,
            priceFormat: "number" as const,
          },
          {
            key: "frn",
            label: "Foreign debt",
            kind: "line" as const,
            points: debtFrn,
            colorVar: MM_COLORS.awfdr.var,
            colorFallback: MM_COLORS.awfdr.fallback,
            priceScaleId: "left" as const,
            priceFormat: "number" as const,
          },
        ],
        info: {
          why: "Fiscal flow and debt stock from WEI §3.1–3.2.",
          what: "Primary/overall balance (Rs. mn) and debt (Rs. bn).",
          how: "Primary surplus funds debt service; watch foreign share.",
        },
      };
    }
    if (id === "drains") {
      return {
        ...base,
        zeroLine: true,
        series: [
          {
            key: "fwd",
            label: "FX forward short",
            kind: "line" as const,
            points: fwdShort,
            colorVar: MM_COLORS.copper.var,
            colorFallback: MM_COLORS.copper.fallback,
            priceFormat: "number" as const,
          },
          {
            key: "net",
            label: "Net after drains",
            kind: "line" as const,
            points: netReserves,
            colorVar: MM_COLORS.sdf.var,
            colorFallback: MM_COLORS.sdf.fallback,
            priceFormat: "number" as const,
          },
          {
            key: "ora",
            label: "Gross ORA",
            kind: "line" as const,
            points: reserves,
            colorVar: MM_COLORS.call.var,
            colorFallback: MM_COLORS.call.fallback,
            priceFormat: "number" as const,
          },
          {
            key: "oil",
            label: "Thermal oil share",
            kind: "line" as const,
            points: oilShare,
            colorVar: MM_COLORS.awfdr.var,
            colorFallback: MM_COLORS.awfdr.fallback,
            priceScaleId: "left" as const,
            priceFormat: "number" as const,
          },
        ],
        info: {
          why: "Reserve quality after FX drains (WEI §4.4) plus power mix.",
          what: "Forward shorts, net reserves, gross ORA; oil share on left.",
          how: "Net = ORA + forward short (shorts are negative).",
        },
      };
    }
    if (id === "external") {
      return {
        ...base,
        zeroLine: false,
        series: [
          {
            key: "exports",
            label: "Exports",
            kind: "line" as const,
            points: exports,
            colorVar: MM_COLORS.sdf.var,
            colorFallback: MM_COLORS.sdf.fallback,
            priceFormat: "number" as const,
          },
          {
            key: "imports",
            label: "Imports",
            kind: "line" as const,
            points: imports,
            colorVar: MM_COLORS.copper.var,
            colorFallback: MM_COLORS.copper.fallback,
            priceFormat: "number" as const,
          },
          {
            key: "expYtd",
            label: "Exports YTD",
            kind: "line" as const,
            points: exportsYtd,
            colorVar: MM_COLORS.call.var,
            colorFallback: MM_COLORS.call.fallback,
            priceFormat: "number" as const,
          },
          {
            key: "impYtd",
            label: "Imports YTD",
            kind: "line" as const,
            points: importsYtd,
            colorVar: MM_COLORS.awfdr.var,
            colorFallback: MM_COLORS.awfdr.fallback,
            priceFormat: "number" as const,
          },
        ],
        info: {
          why: "Merchandise trade from MEI with WEI YTD fills.",
          what: "Monthly exports/imports and YTD totals (USD mn).",
          how: "YTD deficit is the external pressure line.",
        },
      };
    }
    if (id === "mei-money") {
      return {
        ...base,
        zeroLine: false,
        series: [
          {
            key: "m2",
            label: "M2",
            kind: "line" as const,
            points: m2,
            colorVar: MM_COLORS.copper.var,
            colorFallback: MM_COLORS.copper.fallback,
            priceFormat: "number" as const,
          },
        ],
        info: {
          why: "Broad money stock from MEI.",
          what: "M2 (Rs. bn).",
          how: "Daily RM/CIC are under DEI.",
        },
      };
    }
    if (id === "gdp") {
      return {
        ...base,
        zeroLine: true,
        series: [
          {
            key: "gdp",
            label: "GDP growth",
            kind: "baseline" as const,
            points: gdp,
            colorVar: MM_COLORS.awfdr.var,
            colorFallback: MM_COLORS.awfdr.fallback,
          },
        ],
        info: {
          why: "Real GDP growth from MEI.",
          what: "Growth rate %.",
          how: "Quarterly print stamped on the MEI summary.",
        },
      };
    }
    return {
      ...base,
      zeroLine: false,
      series: [
        {
          key: "ccpiH",
          label: "CCPI Headline",
          kind: "baseline" as const,
          points: ccpiH,
          colorVar: MM_COLORS.call.var,
          colorFallback: MM_COLORS.call.fallback,
        },
      ],
      info: {
        why: "CCPI headline is the standard Colombo inflation print.",
        what: "Monthly year-on-year % change.",
        how: "Above 0 = prices up vs a year ago.",
      },
    };
  }, [
    activeView?.id,
    awndr,
    awnlr,
    brent,
    ccpiC,
    ccpiH,
    ccpiMom,
    cic,
    coreGap,
    creditYoy,
    debtDom,
    debtFrn,
    diesel,
    exports,
    exportsYtd,
    fwdShort,
    gdp,
    imports,
    importsYtd,
    liquidity,
    m2,
    m2bYoy,
    ncpiC,
    ncpiFood,
    ncpiH,
    ncpiMom,
    ncpiNonfood,
    netReserves,
    oilShare,
    opr,
    overallBal,
    petrol,
    pmiCon,
    pmiMfg,
    pmiSvc,
    primaryBal,
    remittances,
    remittancesYtd,
    reserveMoney,
    reserves,
    reservesFx,
    reservesGold,
    touristEarn,
    tourists,
    touristsYtd,
    wedge,
  ]);

  const directory = EI_REPORTS.filter((r) => r.id !== "overview") as Array<
    (typeof EI_REPORTS)[number] & { id: Exclude<EiReportId, "overview"> }
  >;

  return (
    <main className="mm-page ei-page">
      <div className="hero-eyebrow">Markets</div>
      <div className="mm-page-head ei-page-head">
        <div>
          <h1 className="section-title">Economic Indicators</h1>
          <p className="mm-page-sub">
            {reportMeta.blurb}{" "}
            <Link href="/markets/ei/v2" className="ei-v2-link">
              Pulse v2 →
            </Link>{" "}
            <Link href="/markets/ei" className="ei-v2-link">
              Indicators desk →
            </Link>
          </p>
        </div>
        <div className="mm-page-modes" role="tablist" aria-label="CBSL reports">
          {EI_REPORTS.map((r) => (
            <button
              key={r.id}
              type="button"
              role="tab"
              aria-selected={r.id === report}
              className={`mm-mode${r.id === report ? " is-active" : ""}`}
              onClick={() => onReportTab(r.id)}
              title={r.blurb}
            >
              <span className="mm-mode-label">{r.label}</span>
              <span className="mm-mode-job">{r.job}</span>
            </button>
          ))}
        </div>
      </div>

      {report === "overview" ? (
        <div className="mm-board is-pulse ei-board">
          <section className="ei-stage" aria-label="Inflation pulse">
            <div className="ei-stage-main">
              <p className="ei-stage-kicker">Latest inflation · open CPI for charts</p>
              <div className="ei-stage-print">
                <Link href="/series/sl.ei.ccpi.headline_yoy" className="ei-stage-hero">
                  <em>CCPI</em>
                  <strong>{fmt(prints.ccpiH)}</strong>
                </Link>
                <Link href="/series/sl.ei.ncpi.headline_yoy" className="ei-stage-companion">
                  <em>NCPI</em>
                  <strong>{fmt(prints.ncpiH)}</strong>
                </Link>
              </div>
              <p className="ei-stage-asof">
                {prints.asOf ? `As of ${prints.asOf.slice(0, 7)}` : "As of —"}
                <span> · Drill into a report below</span>
              </p>
            </div>
            <aside className="mm-take ei-stage-take">
              <p className="mm-take-kicker">How to read this desk</p>
              <ol className="mm-take-list">
                <li>
                  <span>1 · Report</span>
                  <p>CPI, DEI, WEI or MEI — each CBSL PDF pack.</p>
                </li>
                <li>
                  <span>2 · Chart</span>
                  <p>Pick a chart pack under that report.</p>
                </li>
                <li>
                  <span>3 · Series</span>
                  <p>Click any print to open the full series page.</p>
                </li>
              </ol>
            </aside>
          </section>

          <section className="ei-directory" aria-label="CBSL reports">
            <div className="ei-watch-head">
              <p className="ei-watch-kicker">Reports</p>
              <p className="ei-watch-hint">
                {directory.length} source packs · each opens its chart list
              </p>
            </div>
            <ul className="ei-directory-grid">
              {directory.map((r) => {
                const snap = reportSnapshot(bundle, r.id);
                const charts = viewsForReport(r.id);
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      className="ei-directory-card"
                      onClick={() => openReport(r.id)}
                    >
                      <span className="ei-directory-top">
                        <span className="ei-directory-id">{r.label}</span>
                        <span className="ei-directory-job">{r.job}</span>
                      </span>
                      <strong className="ei-directory-title">{r.blurb}</strong>
                      <span className="ei-directory-snap">
                        <em>{snap.label}</em>
                        <b>{snap.value}</b>
                      </span>
                      <span className="ei-directory-charts">
                        {charts.map((c) => c.title).join(" · ")}
                      </span>
                      <span className="ei-directory-cadence">{r.cadence}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      ) : (
        <div className="mm-desk ei-desk">
          <div className="mm-focus panel">
            <div className="mm-focus-head">
              <div className="mm-focus-copy">
                <p className="mm-focus-kicker">
                  <button
                    type="button"
                    className="ei-crumb"
                    onClick={() => onReportTab("overview")}
                  >
                    All reports
                  </button>
                  <span aria-hidden> / </span>
                  {reportMeta.label}
                </p>
                <h2 className="mm-focus-title">{activeView?.title ?? reportMeta.label}</h2>
                <p className="mm-focus-readout">
                  {activeView?.context ?? reportMeta.blurb}
                </p>
                <p className="ei-report-cadence">{reportMeta.cadence}</p>
              </div>
              <div className="mm-cmd-right">
                <div className="mm-cmd-range" role="tablist" aria-label="Chart range">
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
            </div>

            <nav className="mm-views" aria-label={`Charts in ${reportMeta.label}`}>
              {reportViews.map((v) => {
                const selected = v.id === activeView?.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    className={`mm-view${selected ? " is-active" : ""}`}
                    onClick={() => setViewId(v.id)}
                  >
                    {v.title}
                  </button>
                );
              })}
            </nav>

            {activeView?.id === "reserves" ? (
              <>
                <OraVault total={reserves} slices={oraSlices} />
                <div className="mm-shot-body ei-shot-body">
                  <ReserveStackChart
                    height={320}
                    slices={oraSlices.map((s) => ({
                      key: s.id,
                      label: s.short,
                      points: s.points,
                      tone: s.tone,
                    }))}
                  />
                </div>
              </>
            ) : (
              <div className="mm-shot-body ei-shot-body">
                <MmLcChart
                  range={range}
                  height={360}
                  compact
                  zeroLine={chart.zeroLine}
                  carryKeys={chart.carryKeys}
                  series={chart.series}
                  info={chart.info}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
