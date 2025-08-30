export type ThemeColors = Record<string, string>;

const COLOR_VAR = {
  resources: "--color-resources",
  quantile: "--color-quantile",
  pity: "--color-pity",
  grid: "--color-grid",
  curve: "--color-curve",
  sim: "--color-sim",
  mc: "--color-mc",
  A: "--color-a",
  E: "--color-e",
  T: "--color-t",
} as const;

export function readThemeColors(doc: Document = document): ThemeColors {
  const cs = doc.defaultView?.getComputedStyle(doc.documentElement);
  const get = (name: string) => (cs ? cs.getPropertyValue(name).trim() : "");
  const out: ThemeColors = {};
  for (const key in COLOR_VAR) {
    const val = get((COLOR_VAR as any)[key]);
    if (val) (out as any)[key] = val;
  }
  return out;
}

import { useEffect, useState } from "react";

export function useThemeColors(initial?: ThemeColors): ThemeColors {
  // Lazy read once on mount; MutationObserver watches for dark-mode toggle
  const [colors, setColors] = useState<ThemeColors>(() => initial || readThemeColors());
  useEffect(() => {
    const update = () => setColors((c) => ({ ...c, ...readThemeColors() }));
    update();
    const obs = new MutationObserver(update);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return colors;
}
