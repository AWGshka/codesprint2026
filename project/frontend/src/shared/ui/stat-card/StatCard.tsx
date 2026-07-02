import { Card } from "../card/Card";

import { Show } from "solid-js";
import type { Component, JSX } from "solid-js";

import { cn } from "~/shared/lib/cn";

export interface StatCardProps {
  label: string;
  value: JSX.Element;
  hint?: string;
  /** Shows the kit's live pulse dot next to the label (dashboard "updated just now" pattern). */
  live?: boolean;
  class?: string;
}

export const StatCard: Component<StatCardProps> = (props) => (
  <Card padding="sm" class={cn("flex flex-col gap-1", props.class)}>
    <div class="flex items-center justify-between">
      <span class="font-sans text-label text-fg-muted">{props.label}</span>
      <Show when={props.live}>
        <span class="relative inline-flex size-2" aria-hidden="true">
          <span class="absolute inset-0 rounded-full bg-live" />
          <span class="absolute inset-0 animate-[gt-pulse_2s_ease-out_infinite] rounded-full bg-live" />
        </span>
      </Show>
    </div>
    <div class="font-mono text-2xl font-medium tracking-tight tabular-nums text-fg">{props.value}</div>
    <Show when={props.hint}>
      <div class="font-sans text-label text-fg-muted">{props.hint}</div>
    </Show>
  </Card>
);
