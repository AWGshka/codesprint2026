import { For, splitProps } from "solid-js";
import type { Component, JSX } from "solid-js";

import { cn } from "~/shared/lib/cn";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends Omit<JSX.SelectHTMLAttributes<HTMLSelectElement>, "children"> {
  options: SelectOption[];
  invalid?: boolean;
}

export const Select: Component<SelectProps> = (props) => {
  const [local, rest] = splitProps(props, ["class", "invalid", "options", "value"]);
  return (
    // Layout classes land on the wrapper so the custom chevron stays anchored to the field.
    <span class={cn("relative inline-block w-full", local.class)}>
      <select
        class={cn(
          "w-full appearance-none rounded-md border bg-surface-raised py-2.5 pl-3 pr-9 font-sans text-body text-fg",
          "focus:outline-none focus:ring-3 focus:ring-focus/20",
          local.invalid ? "border-danger focus:border-danger" : "border-border-strong focus:border-focus",
        )}
        {...rest}>
        {/* `selected` on the matching option, not `value` on the select — assigning select.value
            before the <For> options exist silently resets to the first option (stale-value bug). */}
        <For each={local.options}>
          {(option) => (
            <option value={option.value} selected={option.value === String(local.value ?? "")}>
              {option.label}
            </option>
          )}
        </For>
      </select>
      {/* Custom chevron — native one hugs the edge; this sits at the same inset as the text (0.75rem). */}
      <svg
        class="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-fg-muted"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true">
        <path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </span>
  );
};
