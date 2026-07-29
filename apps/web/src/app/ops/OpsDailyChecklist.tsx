"use client";

import { useCallback, useEffect, useState } from "react";
import {
  api,
  type DailyCompleteness,
  type DailyReportStatus,
} from "@/lib/api";
import { formatObservationValue } from "@/lib/format";

function statusLabel(report: DailyReportStatus) {
  if (report.readyToPublish) return "Live";
  if (!report.complete) return `Missing ${report.missing}`;
  if (report.pending > 0) return "Needs review";
  return "OK";
}

function statusColor(report: DailyReportStatus) {
  if (report.readyToPublish || (report.complete && report.pending === 0))
    return "var(--up)";
  if (!report.complete) return "var(--down)";
  return "var(--copper, #c4a574)";
}

function fieldTone(status: DailyReportStatus["fields"][number]["status"]) {
  if (status === "approved") return "var(--up)";
  if (status === "pending") return "var(--copper, #c4a574)";
  if (status === "missing") return "var(--down)";
  if (status === "blank") return "var(--muted)";
  return "var(--muted)";
}

export function OpsDailyChecklist({
  secret,
  onApproved,
}: {
  secret: string;
  onApproved?: () => void;
}) {
  const [data, setData] = useState<DailyCompleteness | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!secret) {
      setData(null);
      setError(null);
      return;
    }
    try {
      const next = await api.dailyCompleteness(secret);
      setData(next);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [secret]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function approveReport(report: DailyReportStatus) {
    const period = report.period ?? data?.period;
    if (!report.latestPerSeries && !period) return;
    setBusy(report.reportId);
    try {
      const seriesIds = report.fields.map((f) => f.seriesId);
      const result = await api.approvePeriod(secret, period ?? undefined, seriesIds, {
        anyPeriod: !!report.latestPerSeries,
      });
      // Always reload — client may be stale after a prior server-side approve.
      const next = await api.dailyCompleteness(secret);
      setData(next);
      setError(null);
      onApproved?.();
      const updated = next.reports.find((r) => r.reportId === report.reportId);
      if (!result.approved && updated && updated.pending > 0) {
        throw new Error("Nothing approved — no matching pending rows for this report.");
      }
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function approveField(observationId: string, reportId: string) {
    setBusy(`${reportId}:${observationId}`);
    try {
      await api.review(secret, { observationId, decision: "approve" });
      await refresh();
      onApproved?.();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (!secret) {
    return <p style={{ color: "var(--muted)" }}>Unlock with the admin secret to load the checklist.</p>;
  }
  if (error) {
    return <p style={{ color: "var(--down)" }}>{error}</p>;
  }
  if (!data) {
    return <p style={{ color: "var(--muted)" }}>Loading daily checklist…</p>;
  }
  if (!data.period) {
    return <p style={{ color: "var(--muted)" }}>No observations yet — run a scrape first.</p>;
  }

  return (
    <div style={{ display: "grid", gap: 10, marginBottom: 22 }}>
      <div className="section-head" style={{ marginBottom: 0 }}>
        <h2 className="section-title" style={{ fontSize: "1.15rem" }}>
          Daily checklist · {data.period}
        </h2>
        <p className="section-sub">Click a report to inspect fields and approve</p>
      </div>

      <div className="panel" style={{ margin: 0, padding: 0, overflow: "hidden" }}>
        {data.reports.map((report, i) => {
          const open = openId === report.reportId;
          return (
            <div
              key={report.reportId}
              style={{
                borderTop: i === 0 ? undefined : "1px solid var(--line)",
              }}
            >
              <button
                type="button"
                onClick={() =>
                  setOpenId((prev) => (prev === report.reportId ? null : report.reportId))
                }
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "14px 16px",
                  background: "transparent",
                  border: "none",
                  color: "inherit",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <span
                    style={{
                      color: "var(--muted)",
                      fontFamily: "var(--font-mono)",
                      fontSize: "0.85rem",
                      transform: open ? "rotate(90deg)" : "none",
                      transition: "transform 0.15s ease",
                    }}
                    aria-hidden
                  >
                    ›
                  </span>
                  <span style={{ fontWeight: 700 }}>{report.title}</span>
                  <span
                    className="badge"
                    style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem" }}
                  >
                    {report.reportId}
                  </span>
                  {report.period ? (
                    <span
                      className="badge"
                      style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem" }}
                    >
                      {report.period}
                    </span>
                  ) : null}
                  {report.locked ? (
                    <span className="badge verified" style={{ fontSize: "0.75rem" }}>
                      Locked
                    </span>
                  ) : null}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontWeight: 700,
                      fontSize: "1rem",
                    }}
                  >
                    {report.present}/{report.expectedCount}
                  </span>
                  <span
                    style={{
                      fontSize: "0.8rem",
                      fontWeight: 700,
                      color: statusColor(report),
                    }}
                  >
                    {statusLabel(report)}
                  </span>
                </span>
              </button>

              {open ? (
                <div style={{ padding: "0 16px 16px", display: "grid", gap: 12 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      flexWrap: "wrap",
                      alignItems: "center",
                    }}
                  >
                    <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
                      {report.latestPerSeries
                        ? "Each field shows its latest CBSL date — updated when that cell is published"
                        : null}
                      {report.latestPerSeries ? " · " : null}
                      {report.pending} pending · {report.missing} never seen ·{" "}
                      {report.approved} approved
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={Boolean(busy) || report.pending === 0}
                      onClick={(e) => {
                        e.stopPropagation();
                        void approveReport(report);
                      }}
                    >
                      {busy === report.reportId
                        ? "Approving…"
                        : report.latestPerSeries
                          ? `Approve report (${report.pending})`
                          : `Approve day (${report.pending})`}
                    </button>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                      gap: 10,
                    }}
                  >
                    {report.fields.map((field) => (
                      <div
                        key={field.seriesId}
                        style={{
                          border: "1px solid var(--line)",
                          borderRadius: 12,
                          padding: "10px 12px",
                          display: "grid",
                          gap: 6,
                        }}
                      >
                        <div
                          style={{
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            letterSpacing: "0.04em",
                            textTransform: "uppercase",
                            color: fieldTone(field.status),
                          }}
                        >
                          {field.status === "missing"
                            ? "Missing"
                            : field.status === "blank"
                              ? "Blank"
                              : field.status === "pending"
                              ? "Pending"
                              : field.status === "approved"
                                ? "Approved"
                                : field.status}
                        </div>
                        <div style={{ fontWeight: 700 }}>{field.shortTitle}</div>
                        <div
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: "1.15rem",
                          }}
                        >
                          {field.value != null
                            ? formatObservationValue(field.value, field.unit)
                            : "—"}
                        </div>
                        {field.period ? (
                          <div
                            style={{
                              fontSize: "0.75rem",
                              fontFamily: "var(--font-mono)",
                              color: "var(--muted)",
                            }}
                          >
                            as of {field.period}
                          </div>
                        ) : null}
                        {field.status === "pending" && field.observationId ? (
                          <button
                            type="button"
                            className="btn"
                            style={{ marginTop: 2, fontSize: "0.78rem", padding: "6px 10px" }}
                            disabled={Boolean(busy)}
                            onClick={(e) => {
                              e.stopPropagation();
                              void approveField(field.observationId!, report.reportId);
                            }}
                          >
                            {busy === `${report.reportId}:${field.observationId}`
                              ? "…"
                              : "Approve"}
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
