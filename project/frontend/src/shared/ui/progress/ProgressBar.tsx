import type { Component } from "solid-js";

import { cn } from "~/shared/lib/cn";

export interface ProgressBarProps {
  /** 0-100. Values outside the range are clamped. */
  value: number;
  class?: string;
}

export const ProgressBar: Component<ProgressBarProps> = (props) => {
  const clamped = () => Math.min(100, Math.max(0, props.value));
  return (
    <div
      class={cn("h-2.5 overflow-hidden rounded-full bg-surface-sunken", props.class)}
      role="progressbar"
      aria-valuenow={clamped()}
      aria-valuemin={0}
      aria-valuemax={100}>
      <div class="h-full rounded-full bg-brand transition-[width]" style={{ width: `${clamped()}%` }} />
    </div>
  );
};
