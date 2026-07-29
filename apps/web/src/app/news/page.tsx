import { api, type NewsEdition, type NewsEditionSummary } from "@/lib/api";
import { NewsPageClient } from "./NewsPageClient";

export const dynamic = "force-dynamic";

function isFullEdition(
  e: NewsEdition | { items: unknown[] } | null,
): e is NewsEdition {
  return !!e && "id" in e && typeof e.id === "string" && Array.isArray(e.items);
}

export default async function NewsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const sp = await searchParams;

  let editions: NewsEditionSummary[] = [];
  let edition: NewsEdition | null = null;

  try {
    editions = await api.newsEditions();
  } catch {
    editions = [];
  }

  const date = sp.date || editions[0]?.editionDate || null;

  try {
    if (date) {
      edition = await api.newsEdition(date);
    } else {
      const latest = await api.newsLatest();
      if (isFullEdition(latest)) {
        edition = latest;
      }
    }
  } catch {
    edition = null;
  }

  return (
    <NewsPageClient edition={edition} editions={editions} selectedDate={date} />
  );
}
