import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { MARKET_TABS, type MarketTabId } from "@/lib/markets";
import { useTheme } from "@/lib/ThemeProvider";
import type { ThemeColors } from "@/lib/theme";

export function MarketComingSoon({ tabId }: { tabId: MarketTabId }) {
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const tab = MARKET_TABS.find((t) => t.id === tabId);
  if (!tab) return null;

  return (
    <View style={styles.screen}>
      <Text style={styles.eyebrow}>MARKETS · {tab.label}</Text>
      <Text style={styles.title}>{tab.title}</Text>
      <Text style={styles.blurb}>{tab.blurb}</Text>
      <View style={styles.card}>
        <Text style={styles.badge}>{tab.label}</Text>
        <Text style={styles.cardTitle}>Coming soon</Text>
        <Text style={styles.cardBody}>
          Money Market is live. {tab.title} will use the same verified publish flow.
        </Text>
      </View>
    </View>
  );
}

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: C.paper,
      padding: 22,
      paddingBottom: 36,
    },
    eyebrow: {
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 1.4,
      color: C.accentDeep,
      marginBottom: 8,
    },
    title: {
      fontSize: 30,
      fontWeight: "800",
      color: C.ink,
      letterSpacing: -0.8,
      marginBottom: 8,
    },
    blurb: { color: C.muted, fontSize: 15, lineHeight: 21, marginBottom: 22 },
    card: {
      backgroundColor: C.panel,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: C.line,
      padding: 20,
    },
    badge: {
      alignSelf: "flex-start",
      fontWeight: "700",
      fontSize: 12,
      letterSpacing: 0.8,
      color: C.accentDeep,
      backgroundColor: C.accentSoft,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      overflow: "hidden",
      marginBottom: 12,
    },
    cardTitle: { fontSize: 20, fontWeight: "700", color: C.ink, marginBottom: 8 },
    cardBody: { color: C.muted, fontSize: 14, lineHeight: 20 },
  });
}
