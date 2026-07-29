import { api } from "@/lib/api";
import { EspDashboard } from "@/components/esp/EspDashboard";
import { ESP_SERIES_IDS } from "@/components/esp/catalog";
import { historyToPoints } from "@/components/ei/eiSeries";

export const dynamic = "force-dynamic";

export default async function ExternalSectorPage() {
  const details = await Promise.all(
    ESP_SERIES_IDS.map((id) => api.series(id, "MAX").catch(() => null)),
  );

  const initialBundle: Record<string, { period: string; value: number }[]> = {};
  ESP_SERIES_IDS.forEach((id, i) => {
    initialBundle[id] = historyToPoints(details[i]?.history);
  });

  return <EspDashboard initialBundle={initialBundle} initialRange="1Y" />;
}
