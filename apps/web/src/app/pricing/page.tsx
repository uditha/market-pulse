"use client";

import { useState } from "react";
import { api } from "@/lib/api";

export default function PricingPage() {
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function upgrade() {
    setLoading(true);
    setMsg(null);
    try {
      const res = await api.checkout();
      if (res.url) {
        window.location.href = res.url;
        return;
      }
      setMsg(res.message ?? "Demo mode — configure Stripe keys to enable checkout.");
      if (res.demoUpgradeUrl) {
        window.localStorage.setItem("marketpulse_plan", "pro_demo");
      }
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <h1 className="section-title" style={{ fontSize: "2rem" }}>
        Pro — $2.99–4.99 / month
      </h1>
      <p style={{ color: "var(--muted)", maxWidth: 520 }}>
        Drivers and Analysis are free with an account for now. Pro will keep the deepest
        diagnostics and MAX history when paid locks go live.
      </p>
      <div className="panel" style={{ maxWidth: 420 }}>
        <ul style={{ lineHeight: 1.7, paddingLeft: 18 }}>
          <li>Priority when Analysis moves behind subscription</li>
          <li>MAX history depth</li>
          <li>Watchlist + update alerts when CBSL prints</li>
        </ul>
        <button className="btn btn-primary" disabled={loading} onClick={upgrade}>
          {loading ? "…" : "Upgrade to Pro"}
        </button>
        {msg && <p style={{ color: "var(--muted)" }}>{msg}</p>}
      </div>
    </main>
  );
}
