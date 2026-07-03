import { Show, splitProps } from "solid-js";
import type { Component, JSX } from "solid-js";

import { cn } from "~/shared/lib/cn";
import { SpinnerIcon } from "~/shared/icons";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variants: Record<Variant, string> = {
  primary: "border border-transparent bg-brand text-brand-fg hover:opacity-90",
  secondary: "border border-border-strong bg-surface-raised text-fg hover:bg-surface-sunken",
  ghost: "border border-transparent bg-transparent text-brand hover:bg-surface-sunken",
  danger: "border border-danger bg-transparent text-danger hover:bg-danger/10",
};

const sizes: Record<Size, string> = {
  sm: "min-h-8 gap-1.5 rounded-sm px-2.5 py-1.5 text-label",
  md: "min-h-10 gap-2 rounded-md px-4 py-2.5 text-fs-sm",
  lg: "min-h-12 gap-2 rounded-md px-5 py-3.5 text-body",
};

export const Button: Component<ButtonProps> = (props) => {
  // splitProps (not destructuring) keeps the forwarded `rest` reactive.
  const [local, rest] = splitProps(props, ["variant", "size", "loading", "class", "children", "disabled"]);

  return (
    <button
      class={cn(
        "inline-flex items-center justify-center font-sans font-semibold transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1",
        "disabled:pointer-events-none disabled:opacity-50",
        variants[local.variant ?? "primary"],
        sizes[local.size ?? "md"],
        local.class,
      )}
      disabled={local.disabled || local.loading}
      {...rest}>
      <Show when={local.loading}>
        <SpinnerIcon class="size-4 animate-spin" aria-hidden="true" />
      </Show>
      {local.children}
    </button>
  );
};
