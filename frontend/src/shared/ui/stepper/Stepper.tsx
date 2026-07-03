import { For, Show } from "solid-js";
import type { Component } from "solid-js";

import { cn } from "~/shared/lib/cn";
import { CheckIcon } from "~/shared/icons";

export interface StepperProps {
  steps: string[];
  /** 0-based index of the current step. */
  current: number;
  class?: string;
}

/** Numbered-circle step indicator — the donor flow's amount → pay → review progression. */
export const Stepper: Component<StepperProps> = (props) => (
  <ol class={cn("flex items-center gap-1.5 font-mono text-[10px] text-fg-muted", props.class)}>
    <For each={props.steps}>
      {(step, index) => (
        <li class="flex flex-1 items-center gap-1.5 last:flex-none">
          <span
            class={cn(
              "flex size-4 shrink-0 items-center justify-center rounded-full",
              index() < props.current
                ? "bg-positive text-white"
                : index() === props.current
                  ? "bg-brand font-semibold text-white"
                  : "border border-border-strong",
            )}>
            <Show when={index() < props.current} fallback={index() + 1}>
              <CheckIcon class="size-2.5" aria-hidden="true" />
            </Show>
          </span>
          <span class={cn(index() === props.current && "font-semibold text-brand")}>{step}</span>
          <Show when={index() < props.steps.length - 1}>
            <span class="h-px flex-1 bg-border" />
          </Show>
        </li>
      )}
    </For>
  </ol>
);
