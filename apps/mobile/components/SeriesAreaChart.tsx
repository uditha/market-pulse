import { useMemo, useState } from "react";
import {
  GestureResponderEvent,
  LayoutChangeEvent,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  Stop,
  Line as SvgLine,
  Text as SvgText,
} from "react-native-svg";
import { useTheme } from "@/lib/ThemeProvider";
import type { ThemeColors } from "@/lib/theme";

type Point = { period: string; value: number };
type XY = Point & { x: number; y: number };

const PAD = { top: 16, right: 12, bottom: 28, left: 44 };

export function SeriesAreaChart({
  points,
  unit = "%",
  accent,
}: {
  points: Point[];
  unit?: string;
  accent?: string;
}) {
  const { colors: C } = useTheme();
  const stroke = accent ?? C.chart;
  const styles = useMemo(() => makeStyles(C), [C]);
  const [width, setWidth] = useState(0);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const height = 220;

  const chart = useMemo(() => {
    if (!points.length || width < 40) return null;

    const sorted = [...points].sort((a, b) => a.period.localeCompare(b.period));
    const values = sorted.map((p) => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const pad = span * 0.12;
    const yMin = min - pad;
    const yMax = max + pad;
    const ySpan = yMax - yMin || 1;

    const innerW = width - PAD.left - PAD.right;
    const innerH = height - PAD.top - PAD.bottom;

    const xy: XY[] = sorted.map((p, i) => {
      const x =
        PAD.left +
        (sorted.length === 1 ? innerW / 2 : (i / (sorted.length - 1)) * innerW);
      const y = PAD.top + (1 - (p.value - yMin) / ySpan) * innerH;
      return { ...p, x, y };
    });

    const line = xy
      .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(" ");
    const area = `${line} L${xy[xy.length - 1].x.toFixed(1)},${(PAD.top + innerH).toFixed(1)} L${xy[0].x.toFixed(1)},${(PAD.top + innerH).toFixed(1)} Z`;

    const yTicks = [0, 0.5, 1].map((t) => {
      const value = yMax - t * ySpan;
      const y = PAD.top + t * innerH;
      return { value, y };
    });

    const xLabels = [xy[0], xy[Math.floor(xy.length / 2)], xy[xy.length - 1]].filter(
      Boolean,
    ) as XY[];

    return { line, area, xy, yTicks, xLabels, last: xy[xy.length - 1] };
  }, [points, width]);

  function onLayout(e: LayoutChangeEvent) {
    setWidth(e.nativeEvent.layout.width);
  }

  function nearestIndex(locationX: number): number | null {
    if (!chart?.xy.length) return null;
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < chart.xy.length; i++) {
      const d = Math.abs(chart.xy[i].x - locationX);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    return best;
  }

  function onTouch(e: GestureResponderEvent) {
    const idx = nearestIndex(e.nativeEvent.locationX);
    if (idx != null) setActiveIdx(idx);
  }

  if (!points.length) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No history yet</Text>
      </View>
    );
  }

  const active = activeIdx != null && chart ? chart.xy[activeIdx] : null;

  return (
    <View style={styles.wrap} onLayout={onLayout}>
      {width > 0 && chart ? (
        <View
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={onTouch}
          onResponderMove={onTouch}
          onResponderRelease={() => setActiveIdx(null)}
          onResponderTerminate={() => setActiveIdx(null)}
        >
          <Svg width={width} height={height}>
            <Defs>
              <LinearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={stroke} stopOpacity="0.32" />
                <Stop offset="1" stopColor={stroke} stopOpacity="0.02" />
              </LinearGradient>
            </Defs>

            {chart.yTicks.map((tick, i) => (
              <SvgLine
                key={`g-${i}`}
                x1={PAD.left}
                x2={width - PAD.right}
                y1={tick.y}
                y2={tick.y}
                stroke={C.line}
                strokeWidth={1}
              />
            ))}

            {chart.yTicks.map((tick, i) => (
              <SvgText
                key={`yl-${i}`}
                x={PAD.left - 8}
                y={tick.y + 4}
                fill={C.muted}
                fontSize="10"
                fontWeight="600"
                textAnchor="end"
              >
                {tick.value.toFixed(2)}
              </SvgText>
            ))}

            <Path d={chart.area} fill="url(#areaFill)" />
            <Path
              d={chart.line}
              stroke={stroke}
              strokeWidth={2.25}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {active ? (
              <>
                <SvgLine
                  x1={active.x}
                  x2={active.x}
                  y1={PAD.top}
                  y2={height - PAD.bottom}
                  stroke={stroke}
                  strokeWidth={1}
                  strokeDasharray="4 3"
                  opacity={0.45}
                />
                <Circle
                  cx={active.x}
                  cy={active.y}
                  r={5.5}
                  fill={C.panel}
                  stroke={stroke}
                  strokeWidth={2}
                />
              </>
            ) : (
              <Circle
                cx={chart.last.x}
                cy={chart.last.y}
                r={4.5}
                fill={C.panel}
                stroke={stroke}
                strokeWidth={2}
              />
            )}

            {chart.xLabels.map((p, i) => (
              <SvgText
                key={`xl-${i}`}
                x={p.x}
                y={height - 8}
                fill={C.mutedSoft}
                fontSize="10"
                fontWeight="500"
                textAnchor={i === 0 ? "start" : i === chart.xLabels.length - 1 ? "end" : "middle"}
              >
                {p.period.slice(5)}
              </SvgText>
            ))}
          </Svg>
        </View>
      ) : (
        <View style={{ height }} />
      )}
      <Text style={styles.caption}>
        {active
          ? `${active.period} · ${active.value.toFixed(2)}${unit}`
          : `${points.length} points · ${unit} · drag to inspect`}
      </Text>
    </View>
  );
}

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
    wrap: {
      width: "100%",
      backgroundColor: C.panel,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: C.line,
      paddingTop: 8,
      paddingBottom: 10,
      overflow: "hidden",
    },
    caption: {
      marginTop: 2,
      marginLeft: 14,
      fontSize: 11,
      fontWeight: "600",
      color: C.mutedSoft,
      letterSpacing: 0.3,
    },
    empty: {
      height: 180,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: C.panel,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: C.line,
    },
    emptyText: { color: C.muted, fontWeight: "600" },
  });
}
