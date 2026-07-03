import { Show } from "solid-js";
import type { Component, JSX } from "solid-js";

import { cn } from "~/shared/lib/cn";
import { AlertCircleIcon } from "~/shared/icons";

export interface FieldProps {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  class?: string;
  children: JSX.Element;
}

/** Label + hint/error wrapper — pair with Input/Select/Toggle/Checkbox. Wraps its
 * control in a native <label> so the association holds for whatever `children` renders. */
export const Field: Component<FieldProps> = (props) => (
  // biome-ignore lint/a11y/noLabelWithoutControl: the control is always provided via `children`.
  <label class={cn("block", props.class)}>
    <Show when={props.label}>
      <span class="mb-1.5 block font-sans text-label font-semibold text-fg-muted">
        {props.label}
        <Show when={props.required}>
          {" "}
          <span class="text-danger">*</span>
        </Show>
      </span>
    </Show>

    {props.children}

    <Show
      when={props.error}
      fallback={
        <Show when={props.hint}>
          <span class="mt-1.5 block font-sans text-label text-fg-muted">{props.hint}</span>
        </Show>
      }>
      <span class="mt-1.5 flex items-center gap-1 font-sans text-label text-danger">
        <AlertCircleIcon class="size-3 shrink-0" aria-hidden="true" />
        {props.error}
      </span>
    </Show>
  </label>
);
