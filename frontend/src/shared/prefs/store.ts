import { createEffect, createRoot, createSignal } from "solid-js";

export type Theme = "light" | "dark";
export type TextSize = "100" | "112" | "125";
export type Locale = "en" | "mt" | "it" | "es";

const THEMES = ["light", "dark"] as const;
const TEXT_SIZES = ["100", "112", "125"] as const;
const LOCALES = ["en", "mt", "it", "es"] as const;

const STORAGE_KEYS = { theme: "givetap:theme", contrast: "givetap:contrast", textSize: "givetap:textsize", locale: "givetap:locale" } as const;

function readStored<T extends string>(key: string, fallback: T, allowed: readonly T[]): T {
  const value = window.localStorage.getItem(key);
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

// The old model was a single `theme: "light" | "contrast"` axis. The new model splits
// theme (light/dark) from contrast (normal/high) — 4 combinations via [data-theme] +
// [data-contrast] on <html>. Migrate the legacy stored value: "contrast" -> light + high.
function readTheme(): Theme {
  const raw = window.localStorage.getItem(STORAGE_KEYS.theme);
  return raw === "dark" ? "dark" : "light"; // "light", legacy "contrast", or unset all resolve to light
}

function readContrast(): boolean {
  const raw = window.localStorage.getItem(STORAGE_KEYS.contrast);
  if (raw === "true") return true;
  if (raw === "false") return false;
  // No explicit contrast preference stored yet — migrate the legacy theme="contrast" value.
  return window.localStorage.getItem(STORAGE_KEYS.theme) === "contrast";
}

// A single module-scoped root: prefs are app-wide singletons (not tied to a
// component's lifecycle), so these effects are intentionally never disposed —
// they live for the app's whole life, same as the auth store.
const store = createRoot(() => {
  const [theme, setTheme] = createSignal<Theme>(readTheme());
  const [contrast, setContrast] = createSignal<boolean>(readContrast());
  const [textSize, setTextSize] = createSignal<TextSize>(readStored(STORAGE_KEYS.textSize, "100", TEXT_SIZES));
  const [locale, setLocale] = createSignal<Locale>(readStored(STORAGE_KEYS.locale, "en", LOCALES));

  createEffect(() => {
    document.documentElement.setAttribute("data-theme", theme());
    // Overwrites any legacy "contrast" value stored under the same key — completes the migration.
    window.localStorage.setItem(STORAGE_KEYS.theme, theme());
  });

  createEffect(() => {
    document.documentElement.setAttribute("data-contrast", contrast() ? "high" : "normal");
    window.localStorage.setItem(STORAGE_KEYS.contrast, String(contrast()));
  });

  createEffect(() => {
    document.documentElement.setAttribute("data-textsize", textSize());
    window.localStorage.setItem(STORAGE_KEYS.textSize, textSize());
  });

  createEffect(() => {
    document.documentElement.setAttribute("lang", locale());
    window.localStorage.setItem(STORAGE_KEYS.locale, locale());
  });

  return { theme, setTheme, contrast, setContrast, textSize, setTextSize, locale, setLocale };
});

export const prefs = { theme: store.theme, contrast: store.contrast, textSize: store.textSize, locale: store.locale };
export const setPrefs = { setTheme: store.setTheme, setContrast: store.setContrast, setTextSize: store.setTextSize, setLocale: store.setLocale };
