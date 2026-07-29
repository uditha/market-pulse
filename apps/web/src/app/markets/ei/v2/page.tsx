import { api } from "@/lib/api";
import { EiV2Dashboard } from "@/components/ei-v2/EiV2Dashboard";
import { EI_V2_SERIES_IDS } from "@/components/ei-v2/catalog";
import { historyToPoints } from "@/components/ei/eiSeries";

export const dynamic = "force-dynamic";

export default async function EconomicIndicatorsV2Page() {
  const details = await Promise.all(
    EI_V2_SERIES_IDS.map((id) => api.series(id, "MAX").catch(() => null)),
  );

  const initialBundle: Record<string, { period: string; value: number }[]> = {};
  EI_V2_SERIES_IDS.forEach((id, i) => {
    initialBundle[id] = historyToPoints(details[i]?.history);
  });

  return <EiV2Dashboard initialBundle={initialBundle} initialRange="1Y" />;
}
