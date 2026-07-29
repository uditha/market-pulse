/** Stable timestamp for SSR + client (avoids toLocaleString hydration mismatch). */
export function formatUtcStamp(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}

/** Format observation values for display (dates as ISO, side as label). */
export function formatObservationValue(
  value: number | null | undefined,
  unit: string,
): string {
  if (value == null || Number.isNaN(value)) return "—";
  if (unit === "date") {
    const s = String(Math.round(value));
    if (s.length === 8) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
    return s;
  }
  if (unit === "side") {
    if (value === 1) return "Repo";
    if (value === 2) return "Rev repo";
    return String(value);
  }
  if (unit === "days") return `${Math.round(value)}d`;
  const digits = Math.abs(value) >= 100 ? 2 : 2;
  return `${value.toFixed(digits)}${unit === "%" || unit === "Rs.bn" ? unit : unit ? ` ${unit}` : ""}`;
}
