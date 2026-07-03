import { splitProps } from "solid-js";
import type { Component, JSX } from "solid-js";

import { cn } from "~/shared/lib/cn";

export interface CardProps extends JSX.HTMLAttributes<HTMLDivElement> {
  padding?: "none" | "sm" | "md" | "lg";
}

const paddings: Record<NonNullable<CardProps["padding"]>, string> = { none: "", sm: "p-4", md: "p-5", lg: "p-6" };

export const Card: Component<CardProps> = (props) => {
  const [local, rest] = splitProps(props, ["padding", "class", "children"]);
  return (
    <div class={cn("rounded-lg border border-border bg-surface-raised shadow-e1", paddings[local.padding ?? "md"], local.class)} {...rest}>
      {local.children}
    </div>
  );
};
