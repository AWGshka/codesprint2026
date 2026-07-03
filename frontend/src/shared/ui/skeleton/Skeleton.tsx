import type { Component } from "solid-js";

import { cn } from "~/shared/lib/cn";

export interface SkeletonProps {
  variant?: "text" | "circle" | "block";
  class?: string;
}

const variantClass: Record<NonNullable<SkeletonProps["variant"]>, string> = { text: "h-2.5 rounded", circle: "rounded-full", block: "rounded-md" };

/** Shimmer loading placeholder — animation defined once as `.gt-skeleton` in index.css. */
export const Skeleton: Component<SkeletonProps> = (props) => <div class={cn("gt-skeleton", variantClass[props.variant ?? "text"], props.class)} />;
