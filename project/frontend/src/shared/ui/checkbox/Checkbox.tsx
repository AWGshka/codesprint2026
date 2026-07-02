import { Show } from "solid-js";
import type { Component } from "solid-js";

import { cn } from "~/shared/lib/cn";
import { CheckIcon } from "~/shared/icons";

export interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  class?: string;
}

export const Checkbox: Component<CheckboxProps> = (props) => (
  <label class={cn("inline-flex cursor-pointer items-center gap-2", props.disabled && "cursor-not-allowed opacity-50", props.class)}>
    <input
      type="checkbox"
      class="peer sr-only"
      checked={props.checked}
      disabled={props.disabled}
      onChange={(event) => props.onChange(event.currentTarget.checked)}
    />
    <span
      class={cn("flex size-[18px] items-center justify-center rounded-[5px]", props.checked ? "bg-brand" : "border border-border-strong bg-surface-raised")}>
      <Show when={props.checked}>
        <CheckIcon class="size-3 text-white" stroke-width={3} aria-hidden="true" />
      </Show>
    </span>
    <Show when={props.label}>
      <span class="font-sans text-fs-sm text-fg">{props.label}</span>
    </Show>
  </label>
);
