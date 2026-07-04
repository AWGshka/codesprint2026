import { dismissToast, toastStore } from "./store";

import { For, Show } from "solid-js";
import type { Component } from "solid-js";

import { cn } from "~/shared/lib/cn";
import { CheckIcon } from "~/shared/icons";

const variantIcon: Record<string, string> = { success: "text-positive", danger: "text-danger" };

/** Mount once near the app root (see App.tsx) — renders queued `showToast()` calls. */
export const ToastViewport: Component = () => (
  <div class="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
    <For each={toastStore.toasts()}>
      {(toast) => (
        <button
          type="button"
          class={cn(
            "pointer-events-auto flex items-center gap-2.5 rounded-md border border-border bg-surface-raised px-3.5 py-2.5 text-left shadow-e2 animate-[gt-toast-in_0.25s_ease-out]",
            "text-fg",
          )}
          onClick={() => dismissToast(toast.id)}>
          <Show when={toast.variant === "success" || toast.variant === "danger"}>
            <CheckIcon class={cn("size-4", variantIcon[toast.variant])} aria-hidden="true" />
          </Show>
          <span class="font-sans text-fs-sm font-semibold" role="status">
            {toast.message}
          </span>
        </button>
      )}
    </For>
  </div>
);
