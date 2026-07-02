import type { Component } from "solid-js";

import { cn } from "~/shared/lib/cn";
import { SpinnerIcon } from "~/shared/icons";

export const Spinner: Component<{ class?: string }> = (props) => (
  <SpinnerIcon role="status" aria-label="Loading" class={cn("size-5 animate-spin text-fg-muted", props.class)} />
);
