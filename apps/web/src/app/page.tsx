import {
  api,
  type NewsEdition,
  type MorningMarketBoard,
} from "@/lib/api";
import { SearchHome } from "@/components/SearchHome";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let markets: MorningMarketBoard[] = [];
  let news: NewsEdition | null = null;
  try {
    const [m, n] = await Promise.all([
      api.morningMarkets(),
      api.newsLatest({ home: true }),
    ]);
    markets = m;
    if (n && "id" in n && typeof n.id === "string") {
      news = n as NewsEdition;
    }
  } catch {
    markets = [];
    news = null;
  }

  return <SearchHome markets={markets} news={news} />;
}
