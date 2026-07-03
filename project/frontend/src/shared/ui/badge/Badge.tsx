import { Show } from "solid-js";
import { Dynamic } from "solid-js/web";
import type { Component, JSX } from "solid-js";

import { cn } from "~/shared/lib/cn";
import { CheckIcon, ErrorIcon, WarningIcon } from "~/shared/icons";

export type BadgeVariant = "positive" | "warning" | "danger" | "neutral";

export interface BadgeProps {
  variant?: BadgeVariant;
  /** Set false to hide the icon (defaults to on for positive/warning/danger — status is never colour alone). */
  icon?: boolean;
  class?: string;
  children: JSX.Element;
}

const variantClass: Record<BadgeVariant, string> = {
  positive: "bg-positive/12 text-positive",
  warning: "bg-warning/14 text-warning",
  danger: "bg-danger/12 text-danger",
  neutral: "border border-border-strong text-fg",
};

const variantIcon: Record<BadgeVariant, Component<{ class?: string }> | undefined> = {
  positive: CheckIcon,
  warning: WarningIcon,
  danger: ErrorIcon,
  neutral: undefined,
};

export const Badge: Component<BadgeProps> = (props) => {
  const variant = () => props.variant ?? "neutral";
  const Icon = () => (props.icon === false ? undefined : variantIcon[variant()]);

  return (
    <span class={cn("inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 font-sans text-label font-semibold", variantClass[variant()], props.class)}>
      <Show when={Icon()}>{(IconComponent) => <Dynamic component={IconComponent()} class="size-3" aria-hidden="true" />}</Show>
      {props.children}
    </span>
  );
};
