"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

export type NewsArticleCard = {
  id: string;
  sourceId: string;
  sourceName: string;
  faviconUrl: string | null;
  url: string;
  title: string;
  summary: string;
  imageUrl: string | null;
  publishedAt: string | null;
  rank?: number;
};

export type NewsTopicId = "all" | "rates" | "fx" | "banks" | "policy";

export const NEWS_TOPICS: { id: NewsTopicId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "rates", label: "Rates" },
  { id: "fx", label: "FX" },
  { id: "banks", label: "Banks" },
  { id: "policy", label: "Policy" },
];

const TOPIC_KEYWORDS: Record<Exclude<NewsTopicId, "all">, RegExp> = {
  rates:
    /\b(yield|bond|bill|t-bill|treasury|awpr|awlr|interest|repo|sdfr|slfr|coupon|gilt|debt auction)\b/i,
  fx: /\b(rupee|dollar|forex|fx|usd|lkr|exchange rate|currency|remittance)\b/i,
  banks:
    /\b(bank|loan|deposit|npl|credit|lending|cse|equity|share|stock|ipo|plc)\b/i,
  policy:
    /\b(cbs?l|central bank|monetary|imf|fiscal|budget|tax|vat|cabinet|parliament|policy|governor|ministry)\b/i,
};

export function matchesNewsTopic(
  item: NewsArticleCard,
  topic: NewsTopicId,
): boolean {
  if (topic === "all") return true;
  const hay = `${item.title} ${item.summary}`;
  return TOPIC_KEYWORDS[topic].test(hay);
}

export function filterNewsByTopic(
  items: NewsArticleCard[],
  topic: NewsTopicId,
): NewsArticleCard[] {
  if (topic === "all") return items;
  return items.filter((item) => matchesNewsTopic(item, topic));
}

/** Short desk labels + brand color for each outlet (fallback if logo missing). */
const SOURCE_BRAND: Record<string, { mark: string; bg: string; fg: string }> = {
  economynext: { mark: "EN", bg: "#c8102e", fg: "#ffffff" },
  lbo: { mark: "LBO", bg: "#0b4f8a", fg: "#ffffff" },
  "adaderana-biz": { mark: "AD", bg: "#e31837", fg: "#ffffff" },
  lmd: { mark: "LMD", bg: "#111111", fg: "#f2c94c" },
  "business-today": { mark: "BT", bg: "#12365c", fg: "#ffffff" },
  newswire: { mark: "NW", bg: "#e10600", fg: "#ffffff" },
  ft: { mark: "FT", bg: "#005eb8", fg: "#ffffff" },
  echelon: { mark: "ECH", bg: "#1a1a1a", fg: "#f07a3a" },
  "daily-mirror-biz": { mark: "DM", bg: "#b71c1c", fg: "#ffffff" },
  "sunday-times": { mark: "ST", bg: "#243447", fg: "#ffffff" },
  "the-morning": { mark: "TM", bg: "#d0141a", fg: "#ffffff" },
};

/** Local brand marks under /public/news-logos (real outlet assets). */
const SOURCE_LOGO: Record<string, string> = {
  economynext: "/news-logos/economynext.png",
  lbo: "/news-logos/lbo.png",
  "adaderana-biz": "/news-logos/adaderana-biz.png",
  lmd: "/news-logos/lmd.png",
  "business-today": "/news-logos/business-today.png",
  newswire: "/news-logos/newswire.jpg",
  ft: "/news-logos/ft.jpg",
  echelon: "/news-logos/echelon.jpg",
  "daily-mirror-biz": "/news-logos/daily-mirror-biz.jpg",
  "sunday-times": "/news-logos/sunday-times.jpg",
  "the-morning": "/news-logos/the-morning.svg",
};

function brandFor(sourceId: string, sourceName: string) {
  return (
    SOURCE_BRAND[sourceId] ?? {
      mark:
        sourceName
          .split(/\s+/)
          .map((w) => w[0] ?? "")
          .join("")
          .slice(0, 3)
          .toUpperCase() || "MP",
      bg: "#0b7a6b",
      fg: "#ffffff",
    }
  );
}

const MONTHS_EN = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** Desk-relative stamp. Locale-fixed so SSR and client match. */
export function formatNewsTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const diffMs = Date.now() - t;
  const mins = Math.round(diffMs / 60_000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 36) return `${hrs}h`;
  const days = Math.round(hrs / 24);
  if (days < 14) return `${days}d`;
  const d = new Date(t);
  return `${MONTHS_EN[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

function SourceBrand({
  sourceId,
  sourceName,
  size = "sm",
}: {
  sourceId: string;
  sourceName: string;
  size?: "sm" | "md" | "lg";
}) {
  const brand = brandFor(sourceId, sourceName);
  const logo = SOURCE_LOGO[sourceId];
  const [imgFailed, setImgFailed] = useState(false);

  if (logo && !imgFailed) {
    return (
      <span
        className={`news-brand news-brand-logo news-brand-${size}`}
        title={sourceName}
        aria-hidden
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logo}
          alt=""
          loading="lazy"
          onError={() => setImgFailed(true)}
        />
      </span>
    );
  }

  return (
    <span
      className={`news-brand news-brand-${size}`}
      style={{ background: brand.bg, color: brand.fg }}
      title={sourceName}
      aria-hidden
    >
      {brand.mark}
    </span>
  );
}

function SourceRow({
  item,
  large,
}: {
  item: NewsArticleCard;
  large?: boolean;
}) {
  return (
    <div className={`news-source-row${large ? " is-large" : ""}`}>
      <SourceBrand
        sourceId={item.sourceId}
        sourceName={item.sourceName}
        size={large ? "lg" : "sm"}
      />
      <span className="news-source-name">{item.sourceName}</span>
    </div>
  );
}

function NewsPreviewModal({
  item,
  onClose,
}: {
  item: NewsArticleCard;
  onClose: () => void;
}) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const when = formatNewsTime(item.publishedAt);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div className="news-modal-root" role="presentation">
      <button
        type="button"
        className="news-modal-backdrop"
        aria-label="Close preview"
        onClick={onClose}
      />
      <div
        className="news-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="news-modal-top">
          <SourceRow item={item} large />
        </div>

        {item.imageUrl ? (
          <div className="news-modal-media">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.imageUrl} alt="" />
          </div>
        ) : null}

        <div className="news-modal-body">
          <h2 id={titleId} className="news-modal-title">
            {item.title}
          </h2>
          {when ? (
            <p className="news-modal-meta" suppressHydrationWarning>
              {when === "now" ? "Just now" : `${when} ago`}
            </p>
          ) : null}
          {item.summary ? (
            <p className="news-modal-summary">{item.summary}</p>
          ) : (
            <p className="news-modal-summary muted">
              Preview only — open the source for the full story.
            </p>
          )}
          <p className="news-modal-note">
            Full article lives on {item.sourceName}. We keep a short desk
            snapshot here.
          </p>

          <div className="news-modal-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() =>
                window.open(item.url, "_blank", "noopener,noreferrer")
              }
            >
              Read full at source
            </button>
            <button
              ref={closeRef}
              type="button"
              className="btn"
              onClick={onClose}
            >
              Stay on MarketPulse
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function useNewsPreview() {
  const [open, setOpen] = useState(false);
  return {
    open,
    show: () => setOpen(true),
    hide: () => setOpen(false),
    modal: (item: NewsArticleCard) =>
      open ? <NewsPreviewModal item={item} onClose={() => setOpen(false)} /> : null,
  };
}

/** Compact one-line desk row — source · headline · time. */
export function NewsRow({ item }: { item: NewsArticleCard }) {
  const preview = useNewsPreview();
  const when = formatNewsTime(item.publishedAt);

  return (
    <>
      <button type="button" className="news-row" onClick={preview.show}>
        <SourceBrand sourceId={item.sourceId} sourceName={item.sourceName} />
        <span className="news-row-title">{item.title}</span>
        {when ? (
          <time className="news-row-time" suppressHydrationWarning>
            {when}
          </time>
        ) : null}
      </button>
      {preview.modal(item)}
    </>
  );
}

/** Lead story with one-line summary for the top of the desk. */
export function NewsLeadItem({ item }: { item: NewsArticleCard }) {
  const preview = useNewsPreview();
  const when = formatNewsTime(item.publishedAt);

  return (
    <>
      <button type="button" className="news-lead" onClick={preview.show}>
        <div className="news-lead-meta">
          <SourceBrand
            sourceId={item.sourceId}
            sourceName={item.sourceName}
            size="md"
          />
          <span className="news-lead-source">{item.sourceName}</span>
          {when ? (
            <time className="news-lead-time" suppressHydrationWarning>
              {when}
            </time>
          ) : null}
        </div>
        <h3 className="news-lead-title">{item.title}</h3>
        {item.summary ? (
          <p className="news-lead-summary">{item.summary}</p>
        ) : null}
      </button>
      {preview.modal(item)}
    </>
  );
}

/** @deprecated Prefer NewsRow / NewsLeadItem for desk scanning. */
export function NewsCard({ item }: { item: NewsArticleCard }) {
  return <NewsLeadItem item={item} />;
}

export function NewsPreview({
  item,
  onClose,
}: {
  item: NewsArticleCard;
  onClose: () => void;
}): ReactNode {
  return <NewsPreviewModal item={item} onClose={onClose} />;
}
