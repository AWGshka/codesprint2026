import { Show } from "solid-js";
import type { Component, JSX } from "solid-js";

import { cn } from "~/shared/lib/cn";
import { PlusIcon } from "~/shared/icons";

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: JSX.Element;
  class?: string;
}

/** An empty state should read as an invitation, not a dead end. */
export const EmptyState: Component<EmptyStateProps> = (props) => (
  <div class={cn("rounded-md border border-dashed border-border-strong p-7 text-center", props.class)}>
    <div class="mx-auto mb-3 flex size-10 items-center justify-center rounded-md bg-surface-sunken">
      <PlusIcon class="size-5 text-fg-muted" aria-hidden="true" />
    </div>
    <div class="mb-1 font-display text-h3 font-semibold text-fg">{props.title}</div>
    <Show when={props.description}>
      <div class="mb-3.5 font-sans text-fs-sm text-fg-muted">{props.description}</div>
    </Show>
    <Show when={props.action}>{props.action}</Show>
  </div>
);
