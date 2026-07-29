import { api } from "@/lib/api";
import { historyToPoints } from "@/components/ei/eiSeries";
import { MarketDesk } from "./MarketDesk";
import {
  DESK_BY_TAB,
  allLiveSeriesIds,
  type MarketDeskConfig,
} from "./marketDeskConfig";

export async function MarketDeskPage({
  tabId,
}: {
  tabId: keyof typeof DESK_BY_TAB;
}) {
  const config: MarketDeskConfig = DESK_BY_TAB[tabId];
  const ids = allLiveSeriesIds(config);

  const [all, ...details] = await Promise.all([
    api.search("").catch(() => [] as Awaited<ReturnType<typeof api.search>>),
    ...ids.map((id) => api.series(id, "MAX").catch(() => null)),
  ]);

  const initialBundle: Record<string, { period: string; value: number }[]> = {};
  ids.forEach((id, i) => {
    initialBundle[id] = historyToPoints(details[i]?.history);
  });

  const meta = all.length
    ? all.filter((row) => ids.includes(row.seriesId))
    : details.filter(Boolean).map((d) => d!);

  return (
    <MarketDesk config={config} initialBundle={initialBundle} meta={meta} />
  );
}
