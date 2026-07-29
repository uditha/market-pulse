"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  NEWS_TOPICS,
  NewsLeadItem,
  NewsRow,
  filterNewsByTopic,
  type NewsArticleCard,
  type NewsTopicId,
} from "@/components/NewsCard";

export type NewsEditionDetail = {
  id: string;
  slot: string;
  editionDate: string;
  createdAt: string;
  status?: string;
  items: NewsArticleCard[];
};

export type NewsEditionListItem = {
  id: string;
  slot: string;
  editionDate: string;
  createdAt: string;
  status: string;
  itemCount: number;
};

const LEAD_COUNT = 4;

export function NewsPageClient({
  edition,
  editions,
  selectedDate,
}: {
  edition: NewsEditionDetail | null;
  editions: NewsEditionListItem[];
  selectedDate: string | null;
}) {
  const router = useRouter();
  const [topic, setTopic] = useState<NewsTopicId>("all");
  const dates = Array.from(new Set(editions.map((e) => e.editionDate)));

  const filtered = useMemo(
    () => filterNewsByTopic(edition?.items ?? [], topic),
    [edition?.items, topic],
  );
  const lead = filtered.slice(0, LEAD_COUNT);
  const rest = filtered.slice(LEAD_COUNT);

  return (
    <div className="news-page">
      <header className="news-page-head">
        <div>
          <p className="hero-eyebrow">Sri Lanka · Business press</p>
          <h1 className="news-page-title">Market news</h1>
          <p className="news-page-lead">
            Scan the desk in seconds. Open a headline for a short preview —
            full article stays on the source when you choose.
          </p>
        </div>
      </header>

      <div className="news-controls">
        <div className="news-topic-chips" role="tablist" aria-label="Topic">
          {NEWS_TOPICS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={topic === t.id}
              className={`news-topic-chip${topic === t.id ? " active" : ""}`}
              onClick={() => setTopic(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        {dates.length ? (
          <label className="news-date-pick">
            <span>History</span>
            <select
              value={selectedDate ?? dates[0]}
              onChange={(e) =>
                router.push(`/news?date=${encodeURIComponent(e.target.value)}`)
              }
            >
              {dates.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {edition && edition.items.length ? (
        filtered.length ? (
          <>
            <div className="section-head">
              <h2 className="section-title">{edition.editionDate}</h2>
              <p className="section-sub">
                {filtered.length}
                {topic !== "all" ? ` · ${topic}` : ""} · {edition.items.length}{" "}
                total
              </p>
            </div>

            <div className="news-lead-grid">
              {lead.map((item) => (
                <NewsLeadItem key={item.id} item={item} />
              ))}
            </div>

            {rest.length ? (
              <div className="news-list-block">
                <h3 className="news-list-heading">More headlines</h3>
                <div className="news-rail news-rail-full" role="list">
                  {rest.map((item) => (
                    <div key={item.id} role="listitem">
                      <NewsRow item={item} />
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <div className="panel news-empty">
            <p>No stories match this topic in today’s snapshot.</p>
            <button
              type="button"
              className="btn"
              onClick={() => setTopic("all")}
            >
              Show all
            </button>
          </div>
        )
      ) : (
        <div className="panel news-empty">
          <p>No news snapshot yet.</p>
          <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
            Fire it from Admin, or run{" "}
            <code>pnpm extract:news</code> after the API is up.
          </p>
          <Link href="/" className="inline-link">
            Back home
          </Link>
        </div>
      )}
    </div>
  );
}
