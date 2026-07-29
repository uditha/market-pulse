"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type ReviewItem } from "@/lib/api";
import { StaffSecretField, useStaffSecret } from "@/components/StaffSecretField";
import { OpsDailyChecklist } from "./OpsDailyChecklist";

export function OpsQueue() {
  const { secret, setSecret, ready } = useStaffSecret();
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [corrections, setCorrections] = useState<Record<string, string>>({});
  const [latestOnly, setLatestOnly] = useState(true);
  const [changedOnly, setChangedOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!secret) {
      setItems([]);
      setError("Enter the admin secret to load the queue.");
      return;
    }
    try {
      const next = await api.reviews(secret, { all: true });
      setItems(next);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [secret]);

  useEffect(() => {
    if (!ready) return;
    void reload();
  }, [ready, reload]);

  const latestPeriod = items.reduce<string | null>((max, item) => {
    if (!max || item.period > max) return item.period;
    return max;
  }, null);

  const visible = items.filter((item) => {
    if (latestOnly && latestPeriod && item.period !== latestPeriod) return false;
    if (changedOnly && item.delta === 0) return false;
    return true;
  });

  async function act(
    id: string,
    decision: "approve" | "reject" | "correct",
  ) {
    setBusy(id);
    try {
      const correctedValue =
        decision === "correct" ? Number(corrections[id]) : undefined;
      await api.review(secret, {
        observationId: id,
        decision,
        correctedValue,
        notes: decision === "correct" ? "Corrected in ops UI" : undefined,
      });
      setItems((prev) => prev.filter((x) => x.id !== id));
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function approveAll() {
    setBusy("all");
    try {
      await api.approveAll(secret);
      setItems([]);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div
        className="panel"
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "end",
          marginBottom: 16,
        }}
      >
        <StaffSecretField secret={secret} onChange={setSecret} />
        <button className="btn" type="button" onClick={() => void reload()}>
          Unlock / refresh
        </button>
      </div>

      {error ? <p style={{ color: "var(--down)" }}>{error}</p> : null}

      <OpsDailyChecklist secret={secret} onApproved={() => void reload()} />

      <div className="section-head">
        <h2 className="section-title" style={{ fontSize: "1.15rem" }}>
          Pending detail
        </h2>
        <p className="section-sub">Row-level actions when you need to correct a print</p>
      </div>

      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "center",
          marginBottom: 14,
        }}
      >
        <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: "0.9rem" }}>
          <input
            type="checkbox"
            checked={latestOnly}
            onChange={(e) => setLatestOnly(e.target.checked)}
          />
          Latest day only{latestPeriod ? ` (${latestPeriod})` : ""}
        </label>
        <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: "0.9rem" }}>
          <input
            type="checkbox"
            checked={changedOnly}
            onChange={(e) => setChangedOnly(e.target.checked)}
          />
          Changed only
        </label>
        <button className="btn btn-primary" disabled={busy === "all" || !items.length} onClick={approveAll}>
          Approve all pending ({items.length})
        </button>
      </div>

      {!visible.length ? (
        <p style={{ color: "var(--muted)" }}>
          {items.length
            ? "No rows match filters — turn off “Latest day only” to see older pending."
            : "Queue clear — nothing pending."}
        </p>
      ) : (
        visible.map((item) => (
          <div className="ops-row" key={item.id}>
            <div>
              <strong>{item.shortTitle}</strong>
              <div style={{ color: "var(--muted)", fontSize: "0.88rem" }}>
                {item.title} · {item.period}
              </div>
              {item.sourceUrl && (
                <a
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: "0.82rem", color: "var(--accent-deep)" }}
                >
                  Source
                </a>
              )}
            </div>
            <div>
              <div style={{ color: "var(--muted)", fontSize: "0.78rem" }}>New</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "1.2rem" }}>
                {item.value.toFixed(2)}
                {item.unit}
              </div>
            </div>
            <div>
              <div style={{ color: "var(--muted)", fontSize: "0.78rem" }}>Prior</div>
              <div style={{ fontFamily: "var(--font-mono)" }}>
                {item.previousValue != null
                  ? `${item.previousValue.toFixed(2)}${item.unit}`
                  : "—"}
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                Δ {item.delta ?? "—"}
                {item.confidence != null
                  ? ` · conf ${(item.confidence * 100).toFixed(0)}%`
                  : ""}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <input
                placeholder="Correct…"
                value={corrections[item.id] ?? ""}
                onChange={(e) =>
                  setCorrections((c) => ({ ...c, [item.id]: e.target.value }))
                }
                style={{
                  width: 90,
                  border: "1px solid var(--line)",
                  borderRadius: 10,
                  padding: "8px 10px",
                }}
              />
              <button
                className="btn btn-primary"
                disabled={busy === item.id}
                onClick={() => act(item.id, "approve")}
              >
                Approve
              </button>
              <button
                className="btn"
                disabled={busy === item.id || !corrections[item.id]}
                onClick={() => act(item.id, "correct")}
              >
                Correct
              </button>
              <button
                className="btn btn-danger"
                disabled={busy === item.id}
                onClick={() => act(item.id, "reject")}
              >
                Reject
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
