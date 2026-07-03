import { dismissToast, toastStore } from "./store";

import { For, Show } from "solid-js";
import type { Component } from "solid-js";

import { cn } from "~/shared/lib/cn";
import { CheckIcon } from "~/shared/icons";

/** Mount once near the app root (see App.tsx) — renders queued `showToast()` calls. */
export const ToastViewport: Component = () => (
  <div class="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
    <For each={toastStore.toasts()}>
      {(toast) => (
        <button
          type="button"
          class={cn("pointer-events-auto flex items-center gap-2.5 rounded-md bg-fg px-3.5 py-2.5 text-left shadow-e2", "text-surface-raised")}
          onClick={() => dismissToast(toast.id)}>
          <Show when={toast.variant === "success"}>
            <CheckIcon class="size-4 text-positive" aria-hidden="true" />
          </Show>
          <span class="font-sans text-fs-sm font-semibold" role="status">
            {toast.message}
          </span>
        </button>
      )}
    </For>
  </div>
);
