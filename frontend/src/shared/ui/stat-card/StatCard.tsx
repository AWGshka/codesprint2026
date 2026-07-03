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
  /** Period-over-period change: arrow + green/red percentage with a context label. */
  delta?: { pct: number; label: string };
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
    <Show when={props.delta}>
      {(delta) => (
        <div class={cn("flex items-center gap-1 font-sans text-label font-semibold", delta().pct >= 0 ? "text-positive" : "text-danger")}>
          <span aria-hidden="true">{delta().pct >= 0 ? "▲" : "▼"}</span>
          <span class="tabular-nums">{Math.abs(delta().pct).toFixed(1)}%</span>
          <span class="font-normal text-fg-muted">{delta().label}</span>
        </div>
      )}
    </Show>
    <Show when={props.hint}>
      <div class="font-sans text-label text-fg-muted">{props.hint}</div>
    </Show>
  </Card>
);
