import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { api, type SeriesLatest } from "@/lib/api";
import { MiniSpark } from "@/components/MiniSpark";
import { useTheme } from "@/lib/ThemeProvider";
import type { ThemeColors } from "@/lib/theme";

const EI_IDS = [
  "sl.ei.ccpi.headline_yoy",
  "sl.ei.ccpi.core_yoy",
  "sl.ei.ncpi.headline_yoy",
  "sl.ei.ncpi.core_yoy",
] as const;

function fmtPct(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

export default function EconomicIndicatorsScreen() {
  const router = useRouter();
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [rows, setRows] = useState<(SeriesLatest | null)[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all(EI_IDS.map((id) => api.series(id).catch(() => null)))
      .then((next) => {
        setRows(next);
        setError(null);
      })
      .catch(() => {
        setRows([]);
        setError(`No data from ${api.baseUrl}. Keep API running on same Wi‑Fi.`);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={C.accent} size="large" />
        <Text style={styles.loadingHint}>Loading inflation…</Text>
      </View>
    );
  }

  const asOf = rows
    .map((r) => r?.period)
    .filter(Boolean)
    .sort()
    .at(-1);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <Text style={styles.eyebrow}>MARKETS · EI</Text>
      <Text style={styles.title}>Economic Indicators</Text>
      <Text style={styles.blurb}>CCPI / NCPI headline and core — monthly CBSL prints.</Text>
      {asOf ? <Text style={styles.updated}>As of {String(asOf).slice(0, 7)}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.grid}>
        {EI_IDS.map((id, i) => {
          const row = rows[i];
          const value = row?.value ?? null;
          const spark = row?.sparkline?.length
            ? row.sparkline
            : (row?.history ?? []).slice(-28).map((h) => h.value);
          return (
            <Pressable
              key={id}
              style={styles.card}
              onPress={() => router.push(`/series/${encodeURIComponent(id)}`)}
            >
              <Text style={styles.cardLabel}>{row?.shortTitle ?? id}</Text>
              <Text style={styles.cardValue}>{fmtPct(value)}</Text>
              <MiniSpark values={spark} />
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.hint}>
        Full chart desk (Drivers / Analysis) is on the web at Markets → Economic Indicators.
      </Text>
    </ScrollView>
  );
}

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: C.paper },
    container: { padding: 22, paddingBottom: 40, gap: 10 },
    center: {
      flex: 1,
      backgroundColor: C.paper,
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
    },
    loadingHint: { color: C.muted, fontWeight: "600" },
    eyebrow: {
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 1.4,
      color: C.mutedSoft,
    },
    title: {
      fontSize: 28,
      fontWeight: "800",
      color: C.ink,
      letterSpacing: -0.5,
    },
    blurb: { fontSize: 15, color: C.muted, lineHeight: 21 },
    updated: { fontSize: 12, fontWeight: "600", color: C.mutedSoft },
    error: { color: C.down, fontWeight: "600" },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 8 },
    card: {
      width: "47%",
      flexGrow: 1,
      minWidth: 140,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: C.line,
      backgroundColor: C.panel,
      padding: 14,
      gap: 6,
    },
    cardLabel: {
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 0.6,
      textTransform: "uppercase",
      color: C.mutedSoft,
    },
    cardValue: {
      fontSize: 22,
      fontWeight: "800",
      color: C.ink,
      fontVariant: ["tabular-nums"],
    },
    hint: {
      marginTop: 12,
      fontSize: 13,
      lineHeight: 18,
      color: C.muted,
    },
  });
}
