import { prefs, setPrefs } from "./store";
import type { Locale, TextSize, Theme } from "./store";

import type { Component } from "solid-js";
import { Show, createSignal, onCleanup } from "solid-js";

import { t } from "~/shared/i18n";
import { cn } from "~/shared/lib/cn";
import { SettingsIcon } from "~/shared/icons";
import { Field, Select, Toggle } from "~/shared/ui";

// `labelKey` is looked up with `t()` at render time (inside the JSX expression
// below) so the label stays reactive to locale changes — resolving it here at
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

// Flag + name per locale (C2.1) — the EN/MT/FR/NL set mirrors MeDirect's
// geographies; IT/ES are bonus locales carried over from the practice build.
const localeOptions: { value: Locale; label: string }[] = [
  { value: "en", label: "🇬🇧 English" },
  { value: "mt", label: "🇲🇹 Malti" },
  { value: "fr", label: "🇫🇷 Français" },
  { value: "nl", label: "🇳🇱 Nederlands" },
  { value: "it", label: "🇮🇹 Italiano" },
  { value: "es", label: "🇪🇸 Español" },
];

/**
 * The actual Theme/Text size/Language/High-contrast controls, with no trigger or positioning
 * of its own — reused by `PrefsControls` (the standalone gear-button popover, donor + public
 * headers) and by the admin sidebar's profile popover (`app/layouts/AdminProfileMenu.tsx`),
 * which folds these into the same panel as sign-out instead of duplicating a second trigger.
 */
export const PrefsPanelContent: Component<{ class?: string }> = (props) => (
  <div class={cn("space-y-3", props.class)}>
    <Field label={t("prefs.theme")}>
      <Select
        value={prefs.theme()}
        onChange={(e) => setPrefs.setTheme(e.currentTarget.value as Theme)}
        options={themeOptions.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
      />
    </Field>
    <Field label={t("prefs.textSize")}>
      <Select value={prefs.textSize()} onChange={(e) => setPrefs.setTextSize(e.currentTarget.value as TextSize)} options={textSizeOptions} />
    </Field>
    <Field label={t("prefs.language")}>
      <Select value={prefs.locale()} onChange={(e) => setPrefs.setLocale(e.currentTarget.value as Locale)} options={localeOptions} />
    </Field>
    <Toggle checked={prefs.contrast()} onChange={(v) => setPrefs.setContrast(v)} label={t("prefs.highContrast")} />
  </div>
);

/**
 * Reachable, always-visible accessibility + locale controls — rendered as a compact
 * popover behind a fixed-size gear button so switching locale/text-size never shifts
 * surrounding layout (previously an inline segmented-control cluster that grew/shrank
 * with the active locale's label width). Used in the donor header and the public layout;
 * the admin layout folds `PrefsPanelContent` into its own profile popover instead (see
 * `AdminProfileMenu`), so it isn't duplicated there.
 */
export const PrefsControls: Component<{ class?: string }> = (props) => {
  let root: HTMLDivElement | undefined;
  const [open, setOpen] = createSignal(false);

  const onDocPointerDown = (event: PointerEvent) => {
    if (root && !root.contains(event.target as Node)) setOpen(false);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") setOpen(false);
  };
  document.addEventListener("pointerdown", onDocPointerDown);
  document.addEventListener("keydown", onKeyDown);
  onCleanup(() => {
    document.removeEventListener("pointerdown", onDocPointerDown);
    document.removeEventListener("keydown", onKeyDown);
  });

  return (
    <div ref={root} class={cn("relative", props.class)}>
      <button
        type="button"
        aria-label={t("prefs.settings")}
        aria-expanded={open()}
        onClick={() => setOpen((v) => !v)}
        class="flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-surface-sunken text-fg-muted transition-colors hover:text-fg">
        <SettingsIcon class="size-4" aria-hidden="true" />
      </button>

      <Show when={open()}>
        <div class="absolute right-0 top-full z-30 mt-2 w-64 rounded-lg border border-border bg-surface-raised p-4 shadow-e2">
          <PrefsPanelContent />
        </div>
      </Show>
    </div>
  );
};
