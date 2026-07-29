import { AdminPanel } from "./AdminPanel";

export const dynamic = "force-dynamic";

export default function AdminPage() {
  return (
    <main>
      <div className="hero-eyebrow">Internal</div>
      <h1 className="section-title" style={{ fontSize: "clamp(1.8rem, 4vw, 2.6rem)" }}>
        Admin · Scrapers
      </h1>
      <p className="section-sub" style={{ marginBottom: 22, fontSize: "1rem", maxWidth: "42rem" }}>
        Run CBSL extractors and Market news editions, then verify CBSL numbers in Ops
        before they go live.
      </p>
      <AdminPanel />
    </main>
  );
}
