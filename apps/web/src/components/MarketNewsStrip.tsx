"use client";

import Link from "next/link";
import { NewsLeadItem, NewsRow, type NewsArticleCard } from "./NewsCard";

export type NewsEditionView = {
  id?: string;
  slot?: string;
  editionDate?: string;
  createdAt?: string;
  items: NewsArticleCard[];
};

export function MarketNewsStrip({
  edition,
  variant = "rail",
}: {
  edition: NewsEditionView | null;
  variant?: "rail" | "home" | "desk";
}) {
  const items = edition?.items ?? [];
  if (!items.length) return null;

  const isRich = variant === "home" || variant === "desk";
  const lead = isRich ? items[0] : null;
  const rest = isRich ? items.slice(1) : items;

  return (
    <section
      className={`market-news${variant === "home" ? " market-news-home" : ""}${
        variant === "desk" ? " market-news-desk" : ""
      }`}
    >
      <div className="section-head">
        <h2 className="section-title">Market news</h2>
        <p className="section-sub">
          {edition?.editionDate ? `${edition.editionDate} · ` : null}
          <Link href="/news" className="inline-link">
            See all
          </Link>
        </p>
      </div>
      {lead ? (
        <div className="ms-news-lead">
          <NewsLeadItem item={lead} />
        </div>
      ) : null}
      {rest.length > 0 ? (
        <div className="news-rail" role="list">
          {rest.map((item) => (
            <div key={item.id} role="listitem">
              <NewsRow item={item} />
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
