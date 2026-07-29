import { api } from "@/lib/api";
import { EiV3Dashboard } from "@/components/ei-v3/EiV3Dashboard";
import { EI_V3_SERIES_IDS } from "@/components/ei-v3/catalog";
import { historyToPoints } from "@/components/ei/eiSeries";

export const dynamic = "force-dynamic";

export default async function EconomicIndicatorsPage() {
  const details = await Promise.all(
    EI_V3_SERIES_IDS.map((id) => api.series(id, "MAX").catch(() => null)),
  );

  const initialBundle: Record<string, { period: string; value: number }[]> = {};
  EI_V3_SERIES_IDS.forEach((id, i) => {
    initialBundle[id] = historyToPoints(details[i]?.history);
  });

  return <EiV3Dashboard initialBundle={initialBundle} initialRange="1Y" />;
}
