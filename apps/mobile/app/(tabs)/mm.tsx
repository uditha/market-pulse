import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { api, type SeriesLatest } from "@/lib/api";
import { MiniSpark } from "@/components/MiniSpark";
import { useTheme } from "@/lib/ThemeProvider";
import type { ThemeColors } from "@/lib/theme";

export default function HomeScreen() {
  const router = useRouter();
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [brief, setBrief] = useState<SeriesLatest[]>([]);
  const [siblings, setSiblings] = useState<SeriesLatest[]>([]);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SeriesLatest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.morningBrief(), api.siblings()])
      .then(([briefData, siblingData]) => {
        setBrief(briefData);
        setSiblings(siblingData);
        setError(null);
      })
      .catch(() => {
        setBrief([]);
        setSiblings([]);
        setError(`No data from ${api.baseUrl}. Keep API running on same Wi‑Fi.`);
      })
      .finally(() => setLoading(false));
  }, []);

  const lastUpdated = brief
    .map((b) => b.lastUpdated)
    .filter(Boolean)
    .sort()
    .at(-1);
  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      api.search(q).then(setResults).catch(() => setResults([]));
    }, 180);
    return () => clearTimeout(t);
  }, [q]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={C.accent} size="large" />
        <Text style={styles.loadingHint}>Connecting…</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.eyebrow}>SRI LANKA · MM</Text>
      <Text style={styles.brand}>
        Market<Text style={{ color: C.accent }}>Pulse</Text>
      </Text>
      <Text style={styles.sub}>Verified rates — Call WA · SDF · 91d</Text>
      {lastUpdated ? (
        <Text style={styles.updated}>
          Last updated {new Date(lastUpdated).toLocaleString()}
        </Text>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.searchWrap}>
        <TextInput
          style={styles.search}
          placeholder="Search call, repo, 91d, SDF…"
          placeholderTextColor={C.mutedSoft}
          value={q}
          onChangeText={setQ}
          returnKeyType="search"
          onSubmitEditing={() => {
            if (results[0]) router.push(`/series/${encodeURIComponent(results[0].seriesId)}`);
          }}
        />
      </View>

      {results.slice(0, 5).map((r) => (
        <Pressable
          key={r.seriesId}
          style={({ pressed }) => [styles.result, pressed && styles.pressed]}
          onPress={() => router.push(`/series/${encodeURIComponent(r.seriesId)}`)}
        >
          <View>
            <Text style={styles.resultTitle}>{r.shortTitle}</Text>
            <Text style={styles.resultMeta}>{r.title}</Text>
          </View>
          <Text style={styles.mono}>
            {r.value?.toFixed(2)}
            {r.unit}
          </Text>
        </Pressable>
      ))}

      <View style={styles.rowBetween}>
        <Text style={styles.h2}>Morning brief</Text>
        <Text style={styles.link}>Verified</Text>
      </View>

      <View style={styles.grid}>
        {brief.map((item) => {
          const up = item.change != null && item.change > 0;
          const down = item.change != null && item.change < 0;
          return (
            <Pressable
              key={item.seriesId}
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
              onPress={() => router.push(`/series/${encodeURIComponent(item.seriesId)}`)}
            >
              <View style={styles.cardAccent} />
              <Text style={styles.label}>{item.shortTitle}</Text>
              <Text style={styles.value}>
                {item.value?.toFixed(2)}
                <Text style={styles.unit}> {item.unit}</Text>
              </Text>
              <Text style={[styles.delta, up && styles.up, down && styles.down]}>
                {item.change == null
                  ? "—"
                  : `${item.change > 0 ? "+" : ""}${item.change.toFixed(2)}`}
                <Text style={styles.deltaAsOf}> · {item.asOf}</Text>
              </Text>
              <MiniSpark values={item.sparkline} up={!down} />
            </Pressable>
          );
        })}
      </View>

      {siblings.length > 0 ? (
        <>
          <View style={styles.rowBetween}>
            <Text style={styles.h2}>Siblings</Text>
            <Text style={styles.link}>Same scrape</Text>
          </View>
          {siblings.map((item) => (
            <Pressable
              key={item.seriesId}
              style={({ pressed }) => [styles.result, pressed && styles.pressed]}
              onPress={() => router.push(`/series/${encodeURIComponent(item.seriesId)}`)}
            >
              <View>
                <Text style={styles.resultTitle}>{item.shortTitle}</Text>
                <Text style={styles.resultMeta}>{item.asOf ?? "—"}</Text>
              </View>
              <Text style={styles.mono}>
                {item.value != null ? item.value.toFixed(2) : "—"}
                {item.unit}
              </Text>
            </Pressable>
          ))}
        </>
      ) : null}
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
    loadingHint: { marginTop: 14, color: C.muted, fontSize: 13, fontWeight: "500" },
    container: { padding: 22, paddingBottom: 36 },
    eyebrow: {
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 1.4,
      color: C.accentDeep,
      marginBottom: 8,
    },
    brand: {
      fontSize: 36,
      fontWeight: "800",
      color: C.ink,
      letterSpacing: -1.2,
    },
    sub: { color: C.muted, marginBottom: 8, marginTop: 6, fontSize: 15, lineHeight: 21 },
    updated: {
      color: C.mutedSoft,
      fontSize: 12,
      fontWeight: "500",
      marginBottom: 16,
    },
    error: {
      color: C.down,
      marginBottom: 14,
      fontSize: 13,
      lineHeight: 18,
      backgroundColor: "rgba(194,59,50,0.08)",
      padding: 12,
      borderRadius: 12,
    },
    searchWrap: {
      borderRadius: 14,
      backgroundColor: C.panel,
      borderWidth: 1,
      borderColor: C.line,
      marginBottom: 12,
    },
    search: {
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 16,
      fontWeight: "500",
      color: C.ink,
    },
    result: {
      backgroundColor: C.panel,
      borderRadius: 12,
      padding: 14,
      marginBottom: 8,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      borderWidth: 1,
      borderColor: C.line,
    },
    pressed: { opacity: 0.88, transform: [{ scale: 0.99 }] },
    resultTitle: { fontWeight: "700", color: C.ink, fontSize: 15 },
    resultMeta: { color: C.muted, fontSize: 12, marginTop: 2, maxWidth: 220 },
    rowBetween: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 22,
      marginBottom: 12,
    },
    h2: { fontSize: 20, fontWeight: "700", color: C.ink, letterSpacing: -0.3 },
    link: { color: C.accentDeep, fontWeight: "700", fontSize: 14 },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    card: {
      width: "48%",
      backgroundColor: C.panel,
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: C.line,
      overflow: "hidden",
    },
    cardAccent: {
      position: "absolute",
      left: 0,
      top: 0,
      bottom: 0,
      width: 3,
      backgroundColor: C.accent,
      opacity: 0.85,
    },
    label: {
      color: C.muted,
      fontSize: 10,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.9,
      marginLeft: 4,
    },
    value: {
      fontSize: 28,
      fontWeight: "700",
      marginTop: 8,
      color: C.ink,
      letterSpacing: -0.5,
      marginLeft: 4,
      fontVariant: ["tabular-nums"],
    },
    unit: { fontSize: 13, color: C.mutedSoft, fontWeight: "500" },
    delta: {
      marginTop: 6,
      marginLeft: 4,
      fontSize: 12,
      fontWeight: "600",
      color: C.muted,
      fontVariant: ["tabular-nums"],
    },
    deltaAsOf: { fontWeight: "500", color: C.mutedSoft },
    up: { color: C.up },
    down: { color: C.down },
    mono: { fontVariant: ["tabular-nums"], fontWeight: "700", fontSize: 16, color: C.ink },
  });
}
