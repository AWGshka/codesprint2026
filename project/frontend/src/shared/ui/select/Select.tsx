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
  const [local, rest] = splitProps(props, ["class", "invalid", "options"]);
  return (
    <select
      class={cn(
        "w-full rounded-md border bg-surface-raised px-3 py-2.5 font-sans text-body text-fg",
        "focus:outline-none focus:ring-3 focus:ring-focus/20",
        local.invalid ? "border-danger focus:border-danger" : "border-border-strong focus:border-focus",
        local.class,
      )}
      {...rest}>
      {/* `selected` is set per-option (not just `value` on the <select>) because <For> mounts
          options asynchronously - the browser resolves the native `value` binding against
          whatever option happens to be in the DOM at that instant, which was always the first
          one, so every select rendered its first option regardless of `props.value` (this is
          why the Users role dropdown always showed "viewer"). */}
      <For each={local.options}>
        {(option) => (
          <option value={option.value} selected={option.value === props.value}>
            {option.label}
          </option>
        )}
      </For>
    </select>
  );
};
