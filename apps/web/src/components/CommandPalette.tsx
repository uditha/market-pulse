"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api, type SeriesLatest } from "@/lib/api";

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SeriesLatest[]>([]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("marketpulse:open-search", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("marketpulse:open-search", onOpen);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      api.search(q).then(setResults).catch(() => setResults([]));
    }, 120);
    return () => clearTimeout(t);
  }, [q, open]);

  const items = useMemo(() => results.slice(0, 8), [results]);

  if (!open) return null;

  return (
    <div className="palette" onClick={() => setOpen(false)}>
      <div className="palette-panel" onClick={(e) => e.stopPropagation()}>
        <input
          autoFocus
          placeholder="Search 91d, call rate, AWPR…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, items.length - 1));
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            }
            if (e.key === "Enter" && items[active]) {
              router.push(`/series/${encodeURIComponent(items[active].seriesId)}`);
              setOpen(false);
            }
          }}
        />
        <div className="palette-results">
          {items.map((item, i) => (
            <button
              key={item.seriesId}
              data-active={i === active}
              onMouseEnter={() => setActive(i)}
              onClick={() => {
                router.push(`/series/${encodeURIComponent(item.seriesId)}`);
                setOpen(false);
              }}
            >
              <span>
                <strong>{item.shortTitle}</strong>
                <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>{item.title}</div>
              </span>
              <span style={{ fontFamily: "var(--font-mono)" }}>
                {item.value != null ? `${item.value.toFixed(2)}${item.unit}` : "—"}
              </span>
            </button>
          ))}
          {!items.length && (
            <div style={{ padding: 16, color: "var(--muted)" }}>No matches</div>
          )}
        </div>
      </div>
    </div>
  );
}
