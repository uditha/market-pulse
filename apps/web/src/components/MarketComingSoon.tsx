import { MARKET_TABS, type MarketTabId } from "@lankapulse/shared";

export function MarketComingSoon({ tabId }: { tabId: MarketTabId }) {
  const tab = MARKET_TABS.find((t) => t.id === tabId);
  if (!tab) return null;

  return (
    <main>
      <div className="hero-eyebrow">Markets</div>
      <h1 className="section-title" style={{ fontSize: "clamp(2rem, 4vw, 2.8rem)", marginBottom: 8 }}>
        {tab.title}
      </h1>
      <p className="section-sub" style={{ marginBottom: 28, fontSize: "1rem" }}>
        {tab.blurb}
      </p>
      <section className="panel market-soon">
        <p className="market-soon-label">{tab.label}</p>
        <h2 className="section-title" style={{ marginBottom: 8 }}>
          Coming soon
        </h2>
        <p style={{ color: "var(--muted)", margin: 0, maxWidth: 420 }}>
          Money Market is live today. {tab.title} will land here with the same verified
          publish flow.
        </p>
      </section>
    </main>
  );
}
