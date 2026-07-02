import { prefs } from "~/shared/prefs";

export interface ChartTheme {
  fg: string;
  fgMuted: string;
  border: string;
  brand: string;
  accent: string;
  positive: string;
  warning: string;
  danger: string;
  /** Ordered palette for multi-series charts (bar/doughnut), read live from the active theme. */
  series: string[];
}

function cssVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

/** `#0e8c7a` -> `rgba(14, 140, 122, alpha)`, for chart fill colours (Chart.js needs an alpha channel, plain hex tokens don't carry one). */
export function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.replace(/./g, (c) => c + c) : clean;
  const r = Number.parseInt(full.slice(0, 2), 16) || 0;
  const g = Number.parseInt(full.slice(2, 4), 16) || 0;
  const b = Number.parseInt(full.slice(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Reads the current theme's CSS custom properties into chart-ready colours. Call this from
 * inside a reactive scope (createEffect/createMemo) - it reads `prefs.theme()`/`prefs.contrast()`
 * so the caller re-runs (and charts rebuild) whenever the theme flips, keeping series/gridline/
 * label colours legible in dark + high-contrast.
 */
export function chartTheme(): ChartTheme {
  prefs.theme();
  prefs.contrast();
  const fg = cssVar("--fg", "#1a1a1c");
  const fgMuted = cssVar("--fg-muted", "#6b6b72");
  const border = cssVar("--border", "#e6e6e9");
  const brand = cssVar("--brand", "#0e8c7a");
  const accent = cssVar("--accent", "#0b6857");
  const positive = cssVar("--positive", "#188a5e");
  const warning = cssVar("--warning", "#b4780f");
  const danger = cssVar("--danger", "#c43d3d");
  return { fg, fgMuted, border, brand, accent, positive, warning, danger, series: [brand, accent, warning, danger, positive] };
}
