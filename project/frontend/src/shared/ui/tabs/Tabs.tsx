import { For } from "solid-js";
import type { Component } from "solid-js";

import { cn } from "~/shared/lib/cn";

export interface TabItem {
  value: string;
  label: string;
}

export interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (value: string) => void;
  class?: string;
}

export const Tabs: Component<TabsProps> = (props) => (
  <div role="tablist" class={cn("flex gap-1 border-b border-border", props.class)}>
    <For each={props.items}>
      {(item) => (
        <button
          type="button"
          role="tab"
          aria-selected={props.value === item.value}
          onClick={() => props.onChange(item.value)}
          class={cn(
            "-mb-px border-b-2 px-3 py-2 font-sans text-fs-sm transition-colors",
            props.value === item.value ? "border-brand font-semibold text-fg" : "border-transparent font-medium text-fg-muted hover:text-fg",
          )}>
          {item.label}
        </button>
      )}
    </For>
  </div>
);
