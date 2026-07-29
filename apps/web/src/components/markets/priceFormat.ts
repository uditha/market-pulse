import type { LcSeriesSpec } from "@/components/mm/MmLcChart";

/** Map series unit → chart axis / legend format. */
export function priceFormatForUnit(unit?: string | null): LcSeriesSpec["priceFormat"] {
  const u = (unit ?? "").trim().toLowerCase();
  if (!u) return "number";
  if (u === "%" || u.includes("percent") || u === "pp") return "percent";
  if (u === "x" || u === "ratio") return "ratio";
  return "number";
}
