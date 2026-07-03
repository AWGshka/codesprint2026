import type { Component } from "solid-js";

import { t } from "~/shared/i18n";
import { cn } from "~/shared/lib/cn";
import { SpinnerIcon } from "~/shared/icons";

export const Spinner: Component<{ class?: string }> = (props) => (
  <SpinnerIcon role="status" aria-label={t("common.loading")} class={cn("size-5 animate-spin text-fg-muted", props.class)} />
);
