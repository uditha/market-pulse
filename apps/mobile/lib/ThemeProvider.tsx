import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Appearance, useColorScheme } from "react-native";
import {
  THEME_STORAGE_KEY,
  colorsFor,
  type ResolvedTheme,
  type ThemeColors,
  type ThemePreference,
} from "@/lib/theme";

type ThemeContextValue = {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  colors: ThemeColors;
  setPreference: (pref: ThemePreference) => void;
  cyclePreference: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const CYCLE: ThemePreference[] = ["system", "light", "dark"];

function readStoredPreference(): ThemePreference {
  try {
    // Expo Go / RN may expose localStorage in some runtimes; ignore if missing.
    const g = globalThis as { localStorage?: Storage };
    const raw = g.localStorage?.getItem(THEME_STORAGE_KEY);
    if (raw === "light" || raw === "dark" || raw === "system") return raw;
  } catch {
    /* ignore */
  }
  return "system";
}

function writeStoredPreference(pref: ThemePreference) {
  try {
    const g = globalThis as { localStorage?: Storage };
    g.localStorage?.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    /* ignore */
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>("system");

  useEffect(() => {
    setPreferenceState(readStoredPreference());
  }, []);

  const resolved: ResolvedTheme =
    preference === "system" ? (system === "dark" ? "dark" : "light") : preference;

  useEffect(() => {
    Appearance.setColorScheme(preference === "system" ? null : preference);
  }, [preference]);

  const setPreference = useCallback((pref: ThemePreference) => {
    writeStoredPreference(pref);
    setPreferenceState(pref);
  }, []);

  const cyclePreference = useCallback(() => {
    setPreferenceState((current) => {
      const next = CYCLE[(CYCLE.indexOf(current) + 1) % CYCLE.length];
      writeStoredPreference(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      preference,
      resolved,
      colors: colorsFor(resolved),
      setPreference,
      cyclePreference,
    }),
    [preference, resolved, setPreference, cyclePreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
