import { Show } from "solid-js";
import { Portal } from "solid-js/web";
import type { Component, JSX } from "solid-js";

import { cn } from "~/shared/lib/cn";
import { CloseIcon } from "~/shared/icons";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: JSX.Element;
  class?: string;
}

export const Modal: Component<ModalProps> = (props) => (
  <Show when={props.open}>
    <Portal>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: click/Escape-to-close backdrop; the focusable dialog beneath carries the real semantics. */}
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        role="presentation"
        onClick={props.onClose}
        onKeyDown={(event) => event.key === "Escape" && props.onClose()}>
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: stops backdrop-close from firing when the dialog itself is clicked. */}
        <div
          class={cn("w-full max-w-md rounded-lg bg-surface-raised p-6 shadow-e3", props.class)}
          role="dialog"
          aria-modal="true"
          onClick={(event) => event.stopPropagation()}>
          <div class="mb-4 flex items-center justify-between gap-4">
            <Show when={props.title}>
              <h2 class="font-display text-h2 font-semibold text-fg">{props.title}</h2>
            </Show>
            <button
              type="button"
              aria-label="Close"
              onClick={props.onClose}
              class="ml-auto rounded-md p-1 text-fg-muted hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
              <CloseIcon class="size-4" aria-hidden="true" />
            </button>
          </div>
          {props.children}
        </div>
      </div>
    </Portal>
  </Show>
);
