import Constants from "expo-constants";

/** On a physical device, localhost is the phone — use Metro's host IP instead. */
function resolveApiUrl() {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, "");
  }

  const hostUri =
    Constants.expoConfig?.hostUri ??
    Constants.linkingUri?.replace(/^[a-z]+:\/\//, "") ??
    "";

  const host = hostUri.split(":")[0];
  if (host && host !== "localhost" && host !== "127.0.0.1") {
    return `http://${host}:4000`;
  }

  return "http://localhost:4000";
}

const API_URL = resolveApiUrl();

export type SeriesLatest = {
  seriesId: string;
  title: string;
  shortTitle: string;
  unit: string;
  value: number | null;
  previousValue: number | null;
  change: number | null;
  period: string | null;
  asOf: string | null;
  lastUpdated?: string | null;
  status: string | null;
  sourceUrl: string | null;
  confidence?: number | null;
  sparkline: number[];
  description?: string;
  history?: { period: string; value: number }[];
};

async function getJson<T>(path: string): Promise<T> {
  const url = `${API_URL}${path}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${url}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  baseUrl: API_URL,
  morningBrief: () => getJson<SeriesLatest[]>("/brief/morning"),
  siblings: () => getJson<SeriesLatest[]>("/brief/siblings"),
  search: (q: string) =>
    getJson<SeriesLatest[]>(`/series/search?q=${encodeURIComponent(q)}`),
  series: (id: string) =>
    getJson<SeriesLatest>(`/series/${encodeURIComponent(id)}?range=1Y`),
};
