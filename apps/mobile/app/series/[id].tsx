import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { api, type SeriesLatest } from "@/lib/api";
import { SeriesAreaChart } from "@/components/SeriesAreaChart";
import { useTheme } from "@/lib/ThemeProvider";
import type { ThemeColors } from "@/lib/theme";

export default function SeriesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [series, setSeries] = useState<SeriesLatest | null>(null);

  useEffect(() => {
    if (!id) return;
    api.series(decodeURIComponent(id)).then(setSeries).catch(() => setSeries(null));
  }, [id]);

  if (!series) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={C.accent} size="large" />
      </View>
    );
  }

  const history = [...(series.history ?? [])].reverse().slice(0, 24);
  const up = series.change != null && series.change > 0;
  const down = series.change != null && series.change < 0;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <View style={styles.badgeRow}>
        <Text style={styles.badge}>Verified</Text>
        <Text style={styles.badgeMuted}>As of {series.asOf}</Text>
      </View>
      {series.lastUpdated ? (
        <Text style={styles.badgeMuted}>Updated {new Date(series.lastUpdated).toLocaleString()}</Text>
      ) : null}
      <Text style={styles.title}>{series.title}</Text>
      <Text style={styles.value}>
        {series.value?.toFixed(2)}
        <Text style={styles.unit}> {series.unit}</Text>
      </Text>
      <Text style={[styles.delta, up && styles.up, down && styles.down]}>
        {series.change == null
          ? "No prior print"
          : `${series.change > 0 ? "+" : ""}${series.change.toFixed(2)} vs prior`}
      </Text>

      <View style={styles.chartPanel}>
        <Text style={styles.chartLabel}>History</Text>
        <SeriesAreaChart
          points={series.history ?? []}
          unit={series.unit}
          accent={down ? C.down : C.chart}
        />
      </View>

      {series.description ? <Text style={styles.desc}>{series.description}</Text> : null}

      {series.sourceUrl ? (
        <Pressable onPress={() => Linking.openURL(series.sourceUrl!)} style={styles.sourceBtn}>
          <Text style={styles.sourceText}>Open CBSL source</Text>
        </Pressable>
      ) : null}

      <Text style={styles.h2}>Recent</Text>
      {history.map((row) => (
        <View key={row.period} style={styles.row}>
          <Text style={styles.rowPeriod}>{row.period}</Text>
          <Text style={styles.rowValue}>
            {row.value.toFixed(2)}
            {series.unit}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: C.paper },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: C.paper,
    },
    container: { padding: 22, paddingBottom: 48 },
    badgeRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
    badge: {
      backgroundColor: C.accentSoft,
      color: C.accentDeep,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 8,
      overflow: "hidden",
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 0.4,
      textTransform: "uppercase",
    },
    badgeMuted: {
      backgroundColor: C.panel,
      color: C.muted,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 8,
      overflow: "hidden",
      fontSize: 11,
      fontWeight: "600",
      borderWidth: 1,
      borderColor: C.line,
    },
    title: { fontSize: 22, fontWeight: "700", color: C.ink, letterSpacing: -0.4 },
    value: {
      fontSize: 48,
      fontWeight: "700",
      marginTop: 10,
      color: C.ink,
      letterSpacing: -1.2,
      fontVariant: ["tabular-nums"],
    },
    unit: { fontSize: 18, color: C.mutedSoft, fontWeight: "500" },
    delta: { marginTop: 6, fontWeight: "700", color: C.muted, fontSize: 14 },
    up: { color: C.up },
    down: { color: C.down },
    chartPanel: { marginTop: 18 },
    chartLabel: {
      fontSize: 13,
      fontWeight: "700",
      color: C.muted,
      letterSpacing: 0.6,
      textTransform: "uppercase",
      marginBottom: 8,
    },
    desc: { marginTop: 16, color: C.muted, lineHeight: 21, fontSize: 14 },
    sourceBtn: {
      marginTop: 14,
      alignSelf: "flex-start",
      backgroundColor: C.accent,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 10,
    },
    sourceText: { color: C.onAccent, fontWeight: "700", fontSize: 13 },
    h2: {
      marginTop: 28,
      marginBottom: 10,
      fontSize: 17,
      fontWeight: "700",
      color: C.ink,
    },
    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: C.line,
    },
    rowPeriod: { color: C.muted, fontWeight: "500" },
    rowValue: {
      fontWeight: "700",
      fontVariant: ["tabular-nums"],
      color: C.ink,
    },
  });
}
