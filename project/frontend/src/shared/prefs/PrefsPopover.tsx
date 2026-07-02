import { PrefsControls } from "./PrefsControls";

import type { Component } from "solid-js";
import { Show, createSignal, onCleanup, onMount } from "solid-js";

import { t } from "~/shared/i18n";
import { cn } from "~/shared/lib/cn";
import { SettingsIcon } from "~/shared/icons";

/**
 * Compact, fixed-size trigger button that opens a fixed-width panel holding the theme/contrast/
 * text-size/locale controls. The panel is absolutely positioned (out of document flow) below the
 * trigger, so nothing in the surrounding header can shift when its contents change width (e.g.
 * switching locale) - the trigger itself never changes size. Used in place of inline
 * `PrefsControls` in the public/donor headers (D3); the admin sidebar keeps its own stacked
 * `PrefsControls` block since it never had a shifting-header problem.
 */
export const PrefsPopover: Component<{ class?: string }> = (props) => {
  const [open, setOpen] = createSignal(false);
  let rootRef: HTMLDivElement | undefined;

  const close = () => setOpen(false);

  const onDocumentPointerDown = (event: PointerEvent) => {
    if (rootRef && event.target instanceof Node && !rootRef.contains(event.target)) close();
  };
  const onDocumentKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") close();
  };

  onMount(() => {
    document.addEventListener("pointerdown", onDocumentPointerDown);
    document.addEventListener("keydown", onDocumentKeyDown);
  });
  onCleanup(() => {
    document.removeEventListener("pointerdown", onDocumentPointerDown);
    document.removeEventListener("keydown", onDocumentKeyDown);
  });

  return (
    <div class={cn("relative", props.class)} ref={rootRef}>
      <button
        type="button"
        aria-expanded={open()}
        aria-haspopup="true"
        aria-label={t("prefs.settings")}
        onClick={() => setOpen((v) => !v)}
        class={cn(
          "inline-flex size-10 shrink-0 items-center justify-center rounded-md border border-border-strong bg-surface-raised text-fg-muted transition-colors",
          "hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
        )}>
        <SettingsIcon class="size-4" aria-hidden="true" />
      </button>
      <Show when={open()}>
        <div
          role="dialog"
          aria-label={t("prefs.settings")}
          class="absolute right-0 top-[calc(100%+8px)] z-40 w-64 space-y-3 rounded-lg border border-border bg-surface-raised p-4 shadow-e3">
          <PrefsControls stacked />
        </div>
      </Show>
    </div>
  );
};
