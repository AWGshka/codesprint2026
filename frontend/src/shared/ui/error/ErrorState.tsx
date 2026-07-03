import { Button } from "../button/Button";

import { Show } from "solid-js";
import type { Component } from "solid-js";

import { RetryIcon } from "~/shared/icons";

export const ErrorState: Component<{ error: unknown; reset?: () => void }> = (props) => {
  const message = () => (props.error instanceof Error ? props.error.message : "Something went wrong");

  return (
    <div class="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <p class="font-sans text-body font-semibold text-fg">{message()}</p>
      <Show when={props.reset}>
        <Button variant="secondary" onClick={() => props.reset?.()}>
          <RetryIcon class="size-4" />
          Try again
        </Button>
      </Show>
    </div>
  );
};
