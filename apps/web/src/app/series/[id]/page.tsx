import Link from "next/link";
import { api } from "@/lib/api";
import { SeriesHistoryPanel } from "./SeriesHistoryPanel";
import { CopyValue } from "./CopyValue";

export const dynamic = "force-dynamic";

export default async function SeriesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ range?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const range = (sp.range === "5Y" || sp.range === "MAX" ? sp.range : "1Y") as
    | "1Y"
    | "5Y"
    | "MAX";

  const series = await api.series(decodeURIComponent(id), range);
  const history = (series.history ?? []).map((h) => ({
    period: h.period,
    value: h.value,
  }));
  const change = series.change;
  const up = change != null && change > 0;
  const down = change != null && change < 0;

  return (
    <main>
      <div style={{ marginBottom: 10 }}>
        <Link href="/markets/mm" style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
          ← Money Market
        </Link>
      </div>

      <div className="series-hero">
        <section className="panel">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            <span className="badge verified">Verified</span>
            <span className="badge">As of {series.asOf ?? "—"}</span>
          </div>
          <h1 className="section-title" style={{ fontSize: "1.6rem" }}>
            {series.title}
          </h1>
          <div className="big-number">
            {series.value != null ? series.value.toFixed(2) : "—"}
            <span
              style={{
                fontSize: "1.15rem",
                color: "var(--muted)",
                WebkitTextFillColor: "var(--muted)",
                fontWeight: 500,
              }}
            >
              {" "}
              {series.unit}
            </span>
          </div>
          <p
            className={up ? "delta up" : down ? "delta down" : "delta"}
            style={{ margin: "8px 0 16px" }}
          >
            {change == null ? "No prior" : `${change > 0 ? "+" : ""}${change.toFixed(2)} vs prior`}
          </p>
          <p style={{ color: "var(--muted)", marginTop: 0 }}>{series.description}</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <CopyValue
              text={`${series.shortTitle}: ${series.value?.toFixed(2)}${series.unit} (as of ${series.asOf})`}
            />
            {series.sourceUrl &&
            /^https?:\/\//i.test(series.sourceUrl) ? (
              <a className="btn" href={series.sourceUrl} target="_blank" rel="noreferrer">
                CBSL source
              </a>
            ) : null}
          </div>
        </section>

        <SeriesHistoryPanel
          seriesId={series.seriesId}
          unit={series.unit}
          initialRange={range}
          initialHistory={history}
        />
      </div>
    </main>
  );
}
