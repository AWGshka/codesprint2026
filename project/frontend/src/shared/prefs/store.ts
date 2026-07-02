import { createEffect, createRoot, createSignal } from "solid-js";

export type Theme = "light" | "dark";
export type TextSize = "100" | "112" | "125";
export type Locale = "en" | "mt";

const TEXT_SIZES = ["100", "112", "125"] as const;
const LOCALES = ["en", "mt"] as const;

const STORAGE_KEYS = { theme: "givetap:theme", contrast: "givetap:contrast", textSize: "givetap:textsize", locale: "givetap:locale" } as const;

function readStored<T extends string>(key: string, fallback: T, allowed: readonly T[]): T {
  const value = window.localStorage.getItem(key);
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

/**
 * `givetap:theme` used to store a two-valued `"light" | "contrast"` union (run 1). Run 2 splits
 * that into an independent `theme: "light" | "dark"` + `contrast: boolean`, so a legacy
 * `"contrast"` value migrates to `theme: "light"` + `contrast: true` and a legacy `"light"`
 * value carries over as-is. With no stored value at all, default `theme` from the OS's
 * `prefers-color-scheme` (until the user picks explicitly).
 */
function readInitialThemeAndContrast(): { theme: Theme; contrast: boolean } {
  const legacyThemeRaw = window.localStorage.getItem(STORAGE_KEYS.theme);
  const storedContrastRaw = window.localStorage.getItem(STORAGE_KEYS.contrast);
  const storedContrast = storedContrastRaw === "true";

  if (legacyThemeRaw === "contrast") {
    return { theme: "light", contrast: storedContrastRaw !== null ? storedContrast : true };
  }
  if (legacyThemeRaw === "light" || legacyThemeRaw === "dark") {
    return { theme: legacyThemeRaw, contrast: storedContrast };
  }

  const prefersDark = typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches;
  return { theme: prefersDark ? "dark" : "light", contrast: storedContrast };
}

// A single module-scoped root: prefs are app-wide singletons (not tied to a component's
// lifecycle), so these effects are intentionally never disposed - they live for the app's whole
// life, same as the auth store.
const store = createRoot(() => {
  const initial = readInitialThemeAndContrast();
  const [theme, setTheme] = createSignal<Theme>(initial.theme);
  const [contrast, setContrast] = createSignal<boolean>(initial.contrast);
  const [textSize, setTextSize] = createSignal<TextSize>(readStored(STORAGE_KEYS.textSize, "100", TEXT_SIZES));
  const [locale, setLocale] = createSignal<Locale>(readStored(STORAGE_KEYS.locale, "en", LOCALES));

  createEffect(() => {
    document.documentElement.setAttribute("data-theme", theme());
    window.localStorage.setItem(STORAGE_KEYS.theme, theme());
  });

  createEffect(() => {
    if (contrast()) document.documentElement.setAttribute("data-contrast", "high");
    else document.documentElement.removeAttribute("data-contrast");
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
