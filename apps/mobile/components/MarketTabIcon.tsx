import Svg, { Circle, Path } from "react-native-svg";
import type { MarketTabId } from "@/lib/markets";

export function MarketTabIcon({
  id,
  color,
  size = 22,
}: {
  id: MarketTabId;
  color: string;
  size?: number;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color,
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (id) {
    case "mm":
      return (
        <Svg {...common}>
          <Path d="M4 10h16v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8Z" />
          <Path d="M8 10V7a4 4 0 0 1 8 0v3" />
          <Path d="M12 14v2" />
        </Svg>
      );
    case "fx":
      return (
        <Svg {...common}>
          <Circle cx="12" cy="12" r="9" />
          <Path d="M3 12h18" />
          <Path d="M12 3a14 14 0 0 1 0 18" />
          <Path d="M12 3a14 14 0 0 0 0 18" />
        </Svg>
      );
    case "fi":
      return (
        <Svg {...common}>
          <Path d="M4 19V5" />
          <Path d="M4 19h16" />
          <Path d="M8 15v-4" />
          <Path d="M12 15V8" />
          <Path d="M16 15v-6" />
        </Svg>
      );
    case "share":
      return (
        <Svg {...common}>
          <Path d="M4 16l5-5 3 3 7-8" />
          <Path d="M14 6h5v5" />
        </Svg>
      );
    case "ei":
      return (
        <Svg {...common}>
          <Path d="M5 19V9" />
          <Path d="M10 19V5" />
          <Path d="M15 19v-7" />
          <Path d="M20 19V11" />
        </Svg>
      );
    default:
      return null;
  }
}
