import { Show } from "solid-js";
import type { Component } from "solid-js";

import { cn } from "~/shared/lib/cn";

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  class?: string;
}

export const Toggle: Component<ToggleProps> = (props) => (
  <label class={cn("inline-flex cursor-pointer items-center gap-2", props.disabled && "cursor-not-allowed opacity-50", props.class)}>
    <input
      type="checkbox"
      class="peer sr-only"
      checked={props.checked}
      disabled={props.disabled}
      onChange={(event) => props.onChange(event.currentTarget.checked)}
    />
    <span class={cn("relative inline-block h-5 w-9 rounded-full transition-colors", props.checked ? "bg-brand" : "border border-border bg-surface-sunken")}>
      <span class={cn("absolute top-0.5 size-4 rounded-full bg-white shadow-e1 transition-transform", props.checked ? "translate-x-4.5" : "translate-x-0.5")} />
    </span>
    <Show when={props.label}>
      <span class="font-sans text-fs-sm text-fg">{props.label}</span>
    </Show>
  </label>
);
