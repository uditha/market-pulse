"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  api,
  type ScrapeStatus,
  type ScrapeRunResult,
  type NewsScrapeStatus,
} from "@/lib/api";
import { formatUtcStamp } from "@/lib/format";
import { authClient } from "@/lib/auth-client";
import { canAccessOps, getStaffRole } from "@/lib/roles";
import { StaffSecretField, useStaffSecret } from "@/components/StaffSecretField";

export function AdminPanel() {
  const { secret, setSecret, ready } = useStaffSecret();
  const { data: session } = authClient.useSession();
  const showOpsLink = canAccessOps(getStaffRole(session));
  const [status, setStatus] = useState<ScrapeStatus | null>(null);
  const [selected, setSelected] = useState<string[]>([
    "5206",
    "1059",
    "1064",
    "6277",
    "daily-economic-indicators",
    "weekly-economic-indicators",
    "monthly-economic-indicators",
    "external-sector-performance",
  ]);
  const [days, setDays] = useState(14);
  const [unlockLocked, setUnlockLocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<ScrapeRunResult | null>(null);
  const liveLogRef = useRef<HTMLPreElement | null>(null);

  const [newsStatus, setNewsStatus] = useState<NewsScrapeStatus | null>(null);
  const [newsSelected, setNewsSelected] = useState<string[]>([]);
  const [newsBusy, setNewsBusy] = useState(false);
  const [newsError, setNewsError] = useState<string | null>(null);
  const newsLogRef = useRef<HTMLPreElement | null>(null);

  const refresh = useCallback(async () => {
    try {
      const s = await api.adminStatus(secret);
      setStatus(s);
      setError(null);
      if (s.lastRun) setLastResult(s.lastRun);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [secret]);

  const refreshNews = useCallback(async () => {
    try {
      const s = await api.adminNewsStatus(secret);
      setNewsStatus(s);
      setNewsError(null);
      setNewsSelected((prev) => {
        if (prev.length) return prev;
        return s.sources.filter((x) => x.enabled).map((x) => x.id);
      });
    } catch (err) {
      setNewsError((err as Error).message);
    }
  }, [secret]);

  const active = busy || !!status?.running;
  const newsActive = newsBusy || !!newsStatus?.running;

  useEffect(() => {
    if (!ready || !secret) return;
    void refresh();
    void refreshNews();
    const t = setInterval(() => {
      void refresh();
      void refreshNews();
    }, active || newsActive ? 1500 : 8000);
    return () => clearInterval(t);
  }, [ready, secret, refresh, refreshNews, active, newsActive]);

  useEffect(() => {
    const el = liveLogRef.current;
    if (el && active) el.scrollTop = el.scrollHeight;
  }, [status?.live?.log, active]);

  useEffect(() => {
    const el = newsLogRef.current;
    if (el && newsActive) el.scrollTop = el.scrollHeight;
  }, [newsStatus?.live?.log, newsActive]);

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function toggleNews(id: string) {
    setNewsSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function run(dryRun: boolean, force = false) {
    if (!selected.length) {
      setError("Select at least one source");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const started = await api.adminScrape(secret, {
        reports: selected,
        days,
        dryRun,
        force,
        unlock: force ? unlockLocked : false,
      });
      setStatus(started);
      for (let i = 0; i < 3600; i++) {
        await new Promise((r) => setTimeout(r, 1500));
        const s = await api.adminStatus(secret);
        setStatus(s);
        if (s.lastRun) setLastResult(s.lastRun);
        if (!s.running) break;
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
      await refresh();
    }
  }

  async function runNews(dryRun: boolean) {
    if (!newsSelected.length) {
      setNewsError("Select at least one news source");
      return;
    }
    setNewsBusy(true);
    setNewsError(null);
    try {
      const started = await api.adminNewsScrape(secret, {
        dryRun,
        sources: newsSelected,
      });
      setNewsStatus(started);
      for (let i = 0; i < 600; i++) {
        await new Promise((r) => setTimeout(r, 1500));
        const s = await api.adminNewsStatus(secret);
        setNewsStatus(s);
        if (!s.running) break;
      }
    } catch (err) {
      setNewsError((err as Error).message);
    } finally {
      setNewsBusy(false);
      await refreshNews();
    }
  }

  const newsSummary = newsStatus?.lastRun?.summary;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <section className="panel">
        <div className="section-head">
          <h2 className="section-title">Connection</h2>
          <p className="section-sub">
            {status?.extractorReady ? "Extractor ready" : "Python venv missing — run setup"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
          <StaffSecretField secret={secret} onChange={setSecret} />
          <button
            className="btn"
            onClick={() => {
              void refresh();
              void refreshNews();
            }}
            disabled={busy || newsBusy}
          >
            Refresh status
          </button>
          {showOpsLink ? (
            <Link className="btn btn-primary" href="/ops">
              Open Ops queue ({status?.pendingCount ?? "—"})
            </Link>
          ) : null}
          <Link className="btn" href="/news">
            Open Market news
          </Link>
        </div>
        {active ? (
          <div
            style={{
              marginTop: 14,
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid var(--line)",
              background: "var(--accent-soft)",
            }}
          >
            <p style={{ color: "var(--copper)", fontWeight: 600, margin: "0 0 6px" }}>
              CBSL scrape in progress…
            </p>
            <p style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: "0.85rem" }}>
              {status?.live?.message ?? "Starting extractor…"}
            </p>
            {status?.live ? (
              <p className="section-sub" style={{ margin: "8px 0 0" }}>
                {status.live.reports.join(", ")} · {status.live.days}d
                {status.live.dryRun ? " · dry-run" : " · live"}
                {status.live.force ? " · force" : ""} · started{" "}
                {formatUtcStamp(status.live.startedAt)}
              </p>
            ) : null}
          </div>
        ) : null}
        {error ? (
          <p style={{ color: "var(--down)", marginBottom: 0 }}>{error}</p>
        ) : null}
      </section>

      <section className="panel">
        <div className="section-head">
          <h2 className="section-title">Market news</h2>
          <p className="section-sub">
            One desk snapshot — fire anytime (cron 05:00 / 18:00 Colombo optional)
          </p>
        </div>

        <div style={{ display: "grid", gap: 8, margin: "14px 0 18px" }}>
          {(newsStatus?.sources ?? []).map((src) => (
            <label
              key={src.id}
              style={{
                display: "flex",
                gap: 10,
                alignItems: "center",
                padding: "10px 12px",
                border: "1px solid var(--line)",
                borderRadius: 12,
                background: newsSelected.includes(src.id)
                  ? "var(--accent-soft)"
                  : "transparent",
                cursor: "pointer",
                opacity: src.enabled ? 1 : 0.55,
              }}
            >
              <input
                type="checkbox"
                checked={newsSelected.includes(src.id)}
                onChange={() => toggleNews(src.id)}
                disabled={!src.enabled || newsActive}
              />
              <span>
                <strong>{src.name}</strong>
                <span style={{ color: "var(--muted)", marginLeft: 8 }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem" }}>
                    {src.id}
                  </span>
                  {" · "}
                  {src.kind}
                </span>
              </span>
            </label>
          ))}
        </div>

        {newsActive ? (
          <div
            style={{
              marginBottom: 14,
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid var(--line)",
              background: "var(--accent-soft)",
            }}
          >
            <p style={{ color: "var(--copper)", fontWeight: 600, margin: "0 0 6px" }}>
              News scrape in progress…
            </p>
            <p style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: "0.85rem" }}>
              {newsStatus?.live?.message ?? "Starting news extractor…"}
            </p>
          </div>
        ) : null}

        {newsError ? (
          <p style={{ color: "var(--down)", marginBottom: 12 }}>{newsError}</p>
        ) : null}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            className="btn"
            disabled={newsActive || active}
            onClick={() => void runNews(true)}
          >
            {newsBusy ? "Running…" : "Dry-run news"}
          </button>
          <button
            className="btn btn-primary"
            disabled={newsActive || active}
            onClick={() => void runNews(false)}
          >
            {newsBusy ? "Running…" : "Fire news scrape"}
          </button>
          <Link className="btn" href="/news">
            View snapshot
          </Link>
        </div>

        {newsActive || newsStatus?.live?.log ? (
          <pre
            ref={newsLogRef}
            style={{
              marginTop: 14,
              marginBottom: 0,
              padding: 14,
              borderRadius: 12,
              background: "#0a1614",
              color: "#d7e6e1",
              fontFamily: "var(--font-mono)",
              fontSize: "0.78rem",
              overflow: "auto",
              maxHeight: 280,
              lineHeight: 1.45,
              whiteSpace: "pre-wrap",
            }}
          >
            {newsStatus?.live?.log?.trim() ||
              (newsActive ? "Waiting for news extractor…" : "(no log)")}
          </pre>
        ) : null}

        {newsStatus?.lastRun ? (
          <div style={{ marginTop: 14 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              <span className={`badge ${newsStatus.lastRun.ok ? "verified" : ""}`}>
                {newsStatus.lastRun.ok ? "OK" : "Failed"}
              </span>
              <span className="badge">{newsStatus.lastRun.dryRun ? "Dry-run" : "Live"}</span>
              {newsSummary?.editionDate ? (
                <span className="badge">{newsSummary.editionDate}</span>
              ) : null}
              {newsSummary?.totalArticles != null ? (
                <span className="badge">{newsSummary.totalArticles} stories</span>
              ) : null}
              <span className="badge">
                {formatUtcStamp(newsStatus.lastRun.finishedAt)}
              </span>
            </div>
            {newsSummary?.sources?.length ? (
              <table className="table">
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>Status</th>
                    <th>Items</th>
                    <th>Error</th>
                  </tr>
                </thead>
                <tbody>
                  {newsSummary.sources.map((r) => (
                    <tr key={r.sourceId}>
                      <td style={{ fontFamily: "var(--font-mono)" }}>{r.sourceId}</td>
                      <td>{r.ok ? "OK" : "FAIL"}</td>
                      <td>{r.count ?? "—"}</td>
                      <td style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
                        {r.error ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </div>
        ) : (
          <p className="section-sub" style={{ marginTop: 14, marginBottom: 0 }}>
            No news runs yet in this API process.
          </p>
        )}
      </section>

      {active || status?.live?.log ? (
        <section className="panel">
          <div className="section-head">
            <h2 className="section-title">CBSL live log</h2>
            <p className="section-sub">
              {active ? "Updating every ~1.5s while the scrape runs" : "Last scrape output"}
            </p>
          </div>
          <pre
            ref={liveLogRef}
            style={{
              margin: 0,
              padding: 14,
              borderRadius: 12,
              background: "#0a1614",
              color: "#d7e6e1",
              fontFamily: "var(--font-mono)",
              fontSize: "0.78rem",
              overflow: "auto",
              maxHeight: 360,
              lineHeight: 1.45,
              whiteSpace: "pre-wrap",
            }}
          >
            {status?.live?.log?.trim() ||
              (active ? "Waiting for extractor output…" : "(no log)")}
          </pre>
        </section>
      ) : null}

      <section className="panel">
        <h2 className="section-title">CBSL sources</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "8px 0 0" }}>
          <button
            className="btn"
            type="button"
            disabled={active}
            onClick={() =>
              setSelected((status?.sources ?? []).map((s) => s.id))
            }
          >
            Select all
          </button>
          <button
            className="btn"
            type="button"
            disabled={active}
            onClick={() =>
              setSelected(
                (status?.sources ?? [])
                  .filter((s) => /pdf|economic-indicators|external-sector|policy-rates|inflation/i.test(s.id + s.title))
                  .map((s) => s.id),
              )
            }
          >
            PDF / web sources
          </button>
          <button
            className="btn"
            type="button"
            disabled={active}
            onClick={() => setSelected(["5206", "1059", "1064", "6277"])}
          >
            Money market only
          </button>
        </div>
        <div style={{ display: "grid", gap: 8, margin: "14px 0 18px" }}>
          {(status?.sources ?? []).map((src) => (
            <label
              key={src.id}
              style={{
                display: "flex",
                gap: 10,
                alignItems: "center",
                padding: "10px 12px",
                border: "1px solid var(--line)",
                borderRadius: 12,
                background: selected.includes(src.id)
                  ? "var(--accent-soft)"
                  : "transparent",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={selected.includes(src.id)}
                onChange={() => toggle(src.id)}
              />
              <span>
                <strong style={{ fontFamily: "var(--font-mono)" }}>{src.id}</strong>
                <span style={{ color: "var(--muted)", marginLeft: 8 }}>{src.title}</span>
                {src.locked ? (
                  <span className="badge verified" style={{ marginLeft: 8 }}>
                    Locked
                  </span>
                ) : null}
                {src.production && !src.locked ? (
                  <span className="badge verified" style={{ marginLeft: 8 }}>
                    Prod slice
                  </span>
                ) : null}
                {/pdf/i.test(src.title) ||
                src.id.includes("economic-indicators") ||
                src.id === "external-sector-performance" ? (
                  <span className="badge" style={{ marginLeft: 8 }}>
                    PDF
                  </span>
                ) : null}
              </span>
            </label>
          ))}
        </div>

        <label style={{ display: "grid", gap: 6, fontSize: "0.85rem", color: "var(--muted)", maxWidth: 200 }}>
          Lookback (business days)
          <input
            type="number"
            min={1}
            max={800}
            value={days}
            onChange={(e) => setDays(Number(e.target.value) || 14)}
            style={{
              border: "1px solid var(--line)",
              borderRadius: 10,
              padding: "10px 12px",
            }}
          />
        </label>

        <label
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            marginTop: 12,
            fontSize: "0.85rem",
            color: "var(--muted)",
          }}
        >
          <input
            type="checkbox"
            checked={unlockLocked}
            onChange={(e) => setUnlockLocked(e.target.checked)}
          />
          Unlock locked reports for force re-ingest (5206, 1059, 1064)
        </label>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
          <button className="btn" disabled={busy || !!status?.running || newsActive} onClick={() => void run(true)}>
            {busy ? "Running…" : "Dry-run (no write)"}
          </button>
          <button
            className="btn btn-primary"
            disabled={busy || !!status?.running || newsActive}
            onClick={() => void run(false)}
          >
            {busy ? "Running…" : "Run live ingest → Ops"}
          </button>
          <button
            className="btn"
            disabled={busy || !!status?.running || newsActive}
            onClick={() => void run(false, true)}
            title="Re-parse even if content hash unchanged; locked reports need Unlock checked"
          >
            Force re-ingest
          </button>
        </div>
      </section>

      <section className="panel">
        <h2 className="section-title">Last CBSL run</h2>
        {!lastResult ? (
          <p className="section-sub">No runs yet in this API process.</p>
        ) : (
          <>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "10px 0 14px" }}>
              <span className={`badge ${lastResult.ok ? "verified" : ""}`}>
                {lastResult.ok ? "OK" : "Failed"}
              </span>
              <span className="badge">{lastResult.dryRun ? "Dry-run" : "Live"}</span>
              {lastResult.force ? <span className="badge">Force</span> : null}
              <span className="badge">{lastResult.reports.join(", ")}</span>
              <span className="badge">{lastResult.days}d</span>
              <span className="badge">Pending {lastResult.pendingAfter}</span>
              {lastResult.summary ? (
                <span className="badge">
                  {lastResult.summary.totalObservations} obs
                </span>
              ) : null}
            </div>
            {lastResult.summary?.reports?.length ? (
              <table className="table" style={{ marginBottom: 14 }}>
                <thead>
                  <tr>
                    <th>Report</th>
                    <th>Status</th>
                    <th>Obs</th>
                    <th>Series / error</th>
                  </tr>
                </thead>
                <tbody>
                  {lastResult.summary.reports.map((r) => (
                    <tr key={r.reportId}>
                      <td style={{ fontFamily: "var(--font-mono)" }}>{r.reportId}</td>
                      <td>
                        {r.ok
                          ? (r as { warning?: string }).warning
                            ? "OK*"
                            : "OK"
                          : "FAIL"}
                      </td>
                      <td>{r.observations ?? "—"}</td>
                      <td style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
                        {r.ok
                          ? [
                              (r.seriesIds ?? []).join(", "),
                              (r as { warning?: string }).warning,
                            ]
                              .filter(Boolean)
                              .join(" · ")
                          : r.error ?? "unknown error"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
            <pre
              style={{
                margin: 0,
                padding: 14,
                borderRadius: 12,
                background: "#0a1614",
                color: "#d7e6e1",
                fontFamily: "var(--font-mono)",
                fontSize: "0.78rem",
                overflow: "auto",
                maxHeight: 320,
                lineHeight: 1.45,
              }}
            >
              {lastResult.stdout || "(no stdout)"}
              {lastResult.stderr ? `\n\n--- stderr ---\n${lastResult.stderr}` : ""}
            </pre>
          </>
        )}
      </section>

      <section className="panel">
        <h2 className="section-title">Recent raw files</h2>
        {!status?.rawFiles?.length ? (
          <p className="section-sub">No cached files yet.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>File</th>
                <th>Size</th>
                <th>Modified</th>
              </tr>
            </thead>
            <tbody>
              {status.rawFiles.map((f) => (
                <tr key={f.name}>
                  <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.82rem" }}>
                    {f.name}
                  </td>
                  <td>{(f.bytes / 1024).toFixed(1)} KB</td>
                  <td>{formatUtcStamp(f.modifiedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
