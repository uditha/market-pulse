import { Pressable, Text } from "react-native";
import { Tabs } from "expo-router";
import { MarketTabIcon } from "@/components/MarketTabIcon";
import type { MarketTabId } from "@/lib/markets";
import { useTheme } from "@/lib/ThemeProvider";

function TabLabel({ label, focused, color }: { label: string; focused: boolean; color: string }) {
  return (
    <Text
      style={{
        fontSize: 11,
        fontWeight: "800",
        letterSpacing: 0.35,
        color,
        marginTop: 2,
        opacity: focused ? 1 : 0.85,
      }}
    >
      {label}
    </Text>
  );
}

function tabIcon(id: MarketTabId) {
  return ({ color }: { color: string }) => <MarketTabIcon id={id} color={color} size={22} />;
}

export default function MarketsTabsLayout() {
  const { colors, preference, cyclePreference } = useTheme();
  const prefLabel = preference === "system" ? "Auto" : preference === "dark" ? "Dark" : "Light";

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.paper },
        headerTintColor: colors.ink,
        headerTitleStyle: { fontWeight: "700" },
        headerShadowVisible: false,
        headerRight: () => (
          <Pressable
            onPress={cyclePreference}
            hitSlop={10}
            style={{
              marginRight: 12,
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: colors.line,
              backgroundColor: colors.panel,
            }}
          >
            <Text style={{ color: colors.accentDeep, fontWeight: "700", fontSize: 12 }}>
              {prefLabel}
            </Text>
          </Pressable>
        ),
        tabBarStyle: {
          backgroundColor: colors.panelRaised,
          borderTopColor: colors.line,
          height: 56,
          paddingTop: 4,
          paddingBottom: 0,
          marginBottom: 0,
        },
        tabBarSafeAreaInsets: { bottom: 0 },
        tabBarActiveTintColor: colors.accentDeep,
        tabBarInactiveTintColor: colors.muted,
      }}
    >
      <Tabs.Screen
        name="mm"
        options={{
          title: "Money Market",
          tabBarLabel: ({ focused, color }) => (
            <TabLabel label="MM" focused={focused} color={color} />
          ),
          tabBarIcon: tabIcon("mm"),
        }}
      />
      <Tabs.Screen
        name="fx"
        options={{
          title: "Forex",
          tabBarLabel: ({ focused, color }) => (
            <TabLabel label="FX" focused={focused} color={color} />
          ),
          tabBarIcon: tabIcon("fx"),
        }}
      />
      <Tabs.Screen
        name="fi"
        options={{
          title: "Fixed Income",
          tabBarLabel: ({ focused, color }) => (
            <TabLabel label="FI" focused={focused} color={color} />
          ),
          tabBarIcon: tabIcon("fi"),
        }}
      />
      <Tabs.Screen
        name="share"
        options={{
          title: "Shares",
          tabBarLabel: ({ focused, color }) => (
            <TabLabel label="Share" focused={focused} color={color} />
          ),
          tabBarIcon: tabIcon("share"),
        }}
      />
      <Tabs.Screen
        name="ei"
        options={{
          title: "Economic Indicators",
          tabBarLabel: ({ focused, color }) => (
            <TabLabel label="EI" focused={focused} color={color} />
          ),
          tabBarIcon: tabIcon("ei"),
        }}
      />
    </Tabs>
  );
}
