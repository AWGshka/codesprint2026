import { prefs, setPrefs } from "./store";
import type { Locale, TextSize, Theme } from "./store";

import { For } from "solid-js";
import type { Component } from "solid-js";

import { t } from "~/shared/i18n";
import { cn } from "~/shared/lib/cn";
import { MoonIcon, SunIcon } from "~/shared/icons";
import { Toggle } from "~/shared/ui/toggle/Toggle";

// `labelKey` is looked up with `t()` at render time (inside the JSX expression
// below) so the label stays reactive to locale changes - resolving it here at
// module scope would freeze it at the locale active on first import.
const themeOptions: { value: Theme; labelKey: "prefs.light" | "prefs.dark" }[] = [
  { value: "light", labelKey: "prefs.light" },
  { value: "dark", labelKey: "prefs.dark" },
];

const textSizeOptions: { value: TextSize; label: string }[] = [
  { value: "100", label: "100%" },
  { value: "112", label: "112%" },
  { value: "125", label: "125%" },
];

const localeOptions: { value: Locale; label: string }[] = [
  { value: "en", label: "EN" },
  { value: "mt", label: "MT" },
];

const segmentClass = (active: string, value: string, stacked: boolean | undefined) =>
  cn(
    "rounded-md px-2.5 py-1.5 font-sans text-label font-semibold whitespace-nowrap transition-colors",
    stacked && "flex-1",
    active === value ? "bg-fg text-white" : "bg-transparent text-fg-muted hover:text-fg",
  );

export interface PrefsControlsProps {
  class?: string;
  /** Vertical layout (each group full-width) - used inside the settings popover and the admin sidebar. */
  stacked?: boolean;
}

/** Reachable accessibility + locale controls - theme, high contrast, text size, language. */
export const PrefsControls: Component<PrefsControlsProps> = (props) => (
  <div class={cn("flex flex-wrap items-center gap-2.5", props.stacked && "flex-col items-stretch gap-3", props.class)}>
    <fieldset class={cn("inline-flex gap-0.5 rounded-md border border-border bg-surface-sunken p-0.5", props.stacked && "w-full")}>
      <legend class="sr-only">{t("prefs.theme")}</legend>
      <For each={themeOptions}>
        {(item) => (
          <button type="button" class={segmentClass(prefs.theme(), item.value, props.stacked)} onClick={() => setPrefs.setTheme(item.value)}>
            <span class="inline-flex items-center justify-center gap-1.5">
              {item.value === "dark" ? <MoonIcon class="size-3.5" aria-hidden="true" /> : <SunIcon class="size-3.5" aria-hidden="true" />}
              {t(item.labelKey)}
            </span>
          </button>
        )}
      </For>
    </fieldset>

    <div class={cn("rounded-md border border-border bg-surface-sunken px-2.5 py-1.5", props.stacked && "w-full")}>
      <Toggle checked={prefs.contrast()} onChange={setPrefs.setContrast} label={t("prefs.contrast")} />
    </div>

    <fieldset class={cn("inline-flex gap-0.5 rounded-md border border-border bg-surface-sunken p-0.5", props.stacked && "w-full")}>
      <legend class="sr-only">{t("prefs.textSize")}</legend>
      <For each={textSizeOptions}>
        {(item) => (
          <button type="button" class={segmentClass(prefs.textSize(), item.value, props.stacked)} onClick={() => setPrefs.setTextSize(item.value)}>
            {item.label}
          </button>
        )}
      </For>
    </fieldset>
    <fieldset class={cn("inline-flex gap-0.5 rounded-md border border-border bg-surface-sunken p-0.5", props.stacked && "w-full")}>
      <legend class="sr-only">{t("prefs.language")}</legend>
      <For each={localeOptions}>
        {(item) => (
          <button type="button" class={segmentClass(prefs.locale(), item.value, props.stacked)} onClick={() => setPrefs.setLocale(item.value)}>
            {item.label}
          </button>
        )}
      </For>
    </fieldset>
  </div>
);
