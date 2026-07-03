import type { Component, JSX } from "solid-js";

import { cn } from "~/shared/lib/cn";
import { WarningIcon } from "~/shared/icons";

export interface BannerProps {
  variant?: "warning" | "danger" | "neutral";
  children: JSX.Element;
  class?: string;
}

const variantClass: Record<NonNullable<BannerProps["variant"]>, string> = {
  warning: "bg-warning/10 border-warning/40",
  danger: "bg-danger/10 border-danger/40",
  neutral: "bg-surface-sunken border-border",
};

export const Banner: Component<BannerProps> = (props) => (
  <div class={cn("flex items-start gap-2.5 rounded-md border p-3", variantClass[props.variant ?? "warning"], props.class)}>
    <WarningIcon class="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
    <span class="font-sans text-fs-sm text-fg">{props.children}</span>
  </div>
);
