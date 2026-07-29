import { api } from "@/lib/api";
import { EiAnalyticsDashboard } from "@/components/ei/EiAnalyticsDashboard";
import {
  EI_SERIES_IDS,
  historyToPoints,
  type EiBundle,
} from "@/components/ei/eiSeries";

export const dynamic = "force-dynamic";

export default async function EconomicIndicatorsClassicPage() {
  const [all, ...details] = await Promise.all([
    api.search("").catch(() => [] as Awaited<ReturnType<typeof api.search>>),
    ...EI_SERIES_IDS.map((id) => api.series(id, "MAX").catch(() => null)),
  ]);

  const initialBundle: EiBundle = {};
  EI_SERIES_IDS.forEach((id, i) => {
    initialBundle[id] = historyToPoints(details[i]?.history);
  });

  const meta = all.length
    ? all
    : details.filter(Boolean).map((d) => d!);

  return (
    <EiAnalyticsDashboard
      initialBundle={initialBundle}
      initialRange="1Y"
      meta={meta}
    />
  );
}
