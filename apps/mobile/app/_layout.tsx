import "react-native-gesture-handler";
import { Pressable, Text } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ThemeProvider, useTheme } from "@/lib/ThemeProvider";

function RootNavigator() {
  const { colors, resolved, preference, cyclePreference } = useTheme();
  const prefLabel = preference === "system" ? "Auto" : preference === "dark" ? "Dark" : "Light";

  return (
    <>
      <StatusBar style={resolved === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.paper },
          headerTintColor: colors.ink,
          headerTitleStyle: { fontWeight: "700" },
          contentStyle: { backgroundColor: colors.paper },
          headerRight: () => (
            <Pressable
              onPress={cyclePreference}
              hitSlop={10}
              style={{
                marginRight: 4,
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
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="series/[id]" options={{ title: "Series" }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootNavigator />
    </ThemeProvider>
  );
}
