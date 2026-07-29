"use client";

import { useState } from "react";
import Link from "next/link";
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
    <main className="pricing-story">
      <p className="hero-eyebrow">MarketPulse Pro</p>
      <h1 className="pricing-story-brand">Stay ahead of every CBSL print.</h1>
      <p className="pricing-story-lead">
        Free today: open the desks, read the morning brief, and explore Drivers
        and Analysis with an account. Pro keeps the deepest tools when paid
        locks go live.
      </p>

      <div className="panel pricing-story-panel">
        <h2>Pro</h2>
        <p className="pricing-story-price">$2.99–4.99 / month</p>
        <ul>
          <li>Priority access when Analysis moves behind subscription</li>
          <li>MAX history depth for serious backreads</li>
          <li>Watchlist + alerts the moment CBSL prints</li>
        </ul>
        <div className="ms-story-ctas">
          <button className="btn btn-primary" disabled={loading} onClick={upgrade}>
            {loading ? "…" : "Upgrade to Pro"}
          </button>
          <Link href="/markets/mm" className="btn btn-ghost">
            Try Money Market first
          </Link>
        </div>
        {msg ? <p style={{ color: "var(--muted)", marginTop: 14 }}>{msg}</p> : null}
      </div>
    </main>
  );
}
