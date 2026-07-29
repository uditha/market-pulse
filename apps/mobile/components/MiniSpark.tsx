import { View } from "react-native";
import { useTheme } from "@/lib/ThemeProvider";

/** Lightweight bar sparkline — no native SVG dependency. */
export function MiniSpark({
  values,
  up = true,
}: {
  values: number[];
  up?: boolean;
}) {
  const { colors } = useTheme();
  const pts = (values?.length ? values : [1, 1]).slice(-14);
  const max = Math.max(...pts, 1);
  const color = up ? colors.up : colors.down;

  return (
    <View
      style={{
        height: 28,
        marginTop: 10,
        marginLeft: 4,
        flexDirection: "row",
        alignItems: "flex-end",
        gap: 2,
      }}
    >
      {pts.map((v, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: Math.max(4, (v / max) * 26),
            borderRadius: 2,
            backgroundColor: color,
            opacity: 0.25 + (i / pts.length) * 0.55,
          }}
        />
      ))}
    </View>
  );
}
