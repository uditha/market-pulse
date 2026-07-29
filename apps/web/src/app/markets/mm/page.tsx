import { api } from "@/lib/api";
import { MmAnalyticsDashboard } from "@/components/mm/MmAnalyticsDashboard";
import {
  MM_CARRY_IDS,
  MM_SERIES_IDS,
  historyToPoints,
  type MmBundle,
} from "@/components/mm/mmSeries";

export const dynamic = "force-dynamic";

export default async function MoneyMarketPage() {
  const [brief, all, termBook, ...details] = await Promise.all([
    api.morningBrief().catch(() => []),
    api.search("").catch(() => [] as Awaited<ReturnType<typeof api.search>>),
    api.termRepoBook().catch(() => null),
    ...MM_SERIES_IDS.map((id) =>
      api.series(id, MM_CARRY_IDS.has(id) ? "MAX" : "1Y").catch(() => null),
    ),
  ]);

  const initialBundle: MmBundle = {};
  MM_SERIES_IDS.forEach((id, i) => {
    initialBundle[id] = historyToPoints(details[i]?.history);
  });

  const meta = all.length
    ? all
    : details.filter(Boolean).map((d) => d!);

  return (
    <MmAnalyticsDashboard
      initialBundle={initialBundle}
      initialRange="1Y"
      meta={meta}
      termBook={termBook}
      brief={brief}
    />
  );
}
