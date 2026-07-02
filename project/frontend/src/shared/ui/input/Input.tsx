import { splitProps } from "solid-js";
import type { Component, JSX } from "solid-js";

import { cn } from "~/shared/lib/cn";

export interface InputProps extends JSX.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input: Component<InputProps> = (props) => {
  const [local, rest] = splitProps(props, ["class", "invalid"]);
  return (
    <input
      class={cn(
        "w-full rounded-md border bg-surface-raised px-3 py-2.5 font-sans text-body text-fg placeholder:text-fg-muted",
        "focus:outline-none focus:ring-3 focus:ring-focus/20",
        local.invalid ? "border-danger focus:border-danger" : "border-border-strong focus:border-focus",
        local.class,
      )}
      {...rest}
    />
  );
};
