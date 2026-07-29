"use client";

import { useEffect, useRef, useState, startTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api, type SeriesLatest } from "@/lib/api";
import { SeriesChart } from "@/components/SeriesChart";

type Range = "1Y" | "5Y" | "MAX";
const TABS: Range[] = ["1Y", "5Y", "MAX"];

function historyKey(range: Range, history: { period: string; value: number }[]) {
  const first = history[0];
  const last = history[history.length - 1];
  return `${range}:${history.length}:${first?.period ?? ""}:${last?.period ?? ""}:${first?.value ?? ""}`;
}

export function SeriesHistoryPanel({
  seriesId,
  unit,
  initialRange,
  initialHistory,
}: {
  seriesId: string;
  unit: string;
  initialRange: Range;
  initialHistory: { period: string; value: number }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [range, setRange] = useState<Range>(initialRange);
  const [history, setHistory] = useState(initialHistory);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);
  const syncedKey = useRef(historyKey(initialRange, initialHistory));

  // Sync from server only when the server payload actually changes (avoid array-ref thrash)
  useEffect(() => {
    const nextKey = historyKey(initialRange, initialHistory);
    if (nextKey === syncedKey.current) return;
    syncedKey.current = nextKey;
    setRange(initialRange);
    setHistory(initialHistory);
  }, [initialRange, initialHistory]);

  async function select(next: Range) {
    if (next === range || busy) return;
    const id = ++reqId.current;
    setBusy(true);
    setError(null);
    setRange(next);
    const href = `${pathname || `/series/${encodeURIComponent(seriesId)}`}?range=${next}`;
    startTransition(() => {
      router.replace(href, { scroll: false });
    });
    try {
      const detail: SeriesLatest = await api.series(seriesId, next);
      if (id !== reqId.current) return;
      const nextHistory = (detail.history ?? []).map((h) => ({
        period: h.period,
        value: h.value,
      }));
      syncedKey.current = historyKey(next, nextHistory);
      setHistory(nextHistory);
    } catch (err) {
      if (id !== reqId.current) return;
      setError((err as Error).message);
    } finally {
      if (id === reqId.current) setBusy(false);
    }
  }

  return (
    <>
      <section className="panel">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 10,
            marginBottom: 8,
            flexWrap: "wrap",
          }}
        >
          <h2 className="section-title" style={{ margin: 0 }}>
            History
            <span
              style={{
                marginLeft: 10,
                fontSize: "0.8rem",
                fontWeight: 600,
                color: "var(--muted)",
              }}
            >
              {busy ? "Loading…" : `${history.length} points · ${range}`}
            </span>
          </h2>
          <div style={{ display: "flex", gap: 6 }} role="tablist" aria-label="History range">
            {TABS.map((t) => {
              const active = t === range;
              return (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className="btn"
                  disabled={busy}
                  onClick={() => void select(t)}
                  style={{
                    background: active ? "var(--accent)" : undefined,
                    color: active ? "#fff" : undefined,
                    borderColor: active ? "var(--accent-deep)" : undefined,
                    fontWeight: active ? 700 : undefined,
                    opacity: busy && !active ? 0.7 : 1,
                  }}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </div>
        {error ? (
          <p style={{ color: "var(--down)", fontSize: "0.85rem" }}>{error}</p>
        ) : null}
        <SeriesChart
          key={range}
          range={range}
          points={history}
        />
      </section>

      <section className="panel" style={{ marginTop: 18 }}>
        <h2 className="section-title">Table</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Period</th>
              <th>Value</th>
              <th>As of</th>
            </tr>
          </thead>
          <tbody>
            {[...history].reverse().slice(0, 40).map((row) => (
              <tr key={row.period}>
                <td>{row.period}</td>
                <td style={{ fontFamily: "var(--font-mono)" }}>
                  {row.value.toFixed(2)}
                  {unit}
                </td>
                <td>{row.period}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
