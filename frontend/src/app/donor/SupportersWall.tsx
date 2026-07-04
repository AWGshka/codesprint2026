import type { Component } from "solid-js";
import { For, Show, createEffect, createResource, on, onCleanup } from "solid-js";

import { t } from "~/shared/i18n";
import { cn } from "~/shared/lib/cn";
import { listSupporters } from "~/shared/api";
import type { Supporter } from "~/shared/api";
import { formatMoney } from "~/shared/lib/money";
import { formatDateTime } from "~/shared/lib/datetime";
import { createSupporterEvents } from "~/shared/lib/useSSE";

const MAX_SHOWN = 12;

/**
 * Live supporters wall (S1.3): recent donors for one campaign.
 * Anonymous donors are shown as "Anonymous".
 * `compact` renders a single horizontal auto-scrolling strip (kiosk bottom);
 * the default renders a card-friendly vertical list (campaign landing page).
 */
export const SupportersWall: Component<{ slug: string; compact?: boolean; class?: string }> = (props) => {
  const [supporters, { mutate }] = createResource(() => props.slug, listSupporters);
  let scrollRef: HTMLDivElement | undefined;
  let scrollRAF: number | undefined;

  const { connected } = createSupporterEvents(props.slug, (incoming) => {
    // Anonymous gifts still appear on the wall — displayed as "Anonymous".
    const entry: Supporter = {
      donorName: incoming.donorName || "",
      amountMinor: incoming.amountMinor,
      currency: incoming.currency,
      createdAt: incoming.createdAt,
    };
    mutate((current) => [entry, ...(current ?? [])].slice(0, MAX_SHOWN));
  });

  /** Display name: show "Anonymous" (i18n) when donorName is empty/null. */
  const displayName = (name: string | null | undefined) => (name ? name : t("donor.anonymous"));

  // Auto-scroll for compact mode: translate the inner track instead of
  // using scrollLeft (which rounds to integers and causes micro-stutter).
  // CSS transforms support sub-pixel rendering on the GPU.
  let trackRef: HTMLDivElement | undefined;
  createEffect(
    on(
      () => props.compact && (supporters()?.length ?? 0) > 0,
      (shouldScroll) => {
        if (!shouldScroll || !scrollRef || !trackRef) return;
        let prev: number | undefined;
        const pxPerMs = 0.03;
        let pos = 0;
        let dir = 1;
        const tick = (now: number) => {
          if (!scrollRef || !trackRef) return;
          const dt = prev === undefined ? 16 : Math.min(now - prev, 50);
          prev = now;
          const max = trackRef.scrollWidth - scrollRef.clientWidth;
          if (max <= 0) {
            scrollRAF = requestAnimationFrame(tick);
            return;
          }
          pos += pxPerMs * dt * dir;
          if (pos >= max) {
            pos = max;
            dir = -1;
          } else if (pos <= 0) {
            pos = 0;
            dir = 1;
          }
          trackRef.style.transform = `translateX(${-pos}px)`;
          scrollRAF = requestAnimationFrame(tick);
        };
        scrollRAF = requestAnimationFrame(tick);
        onCleanup(() => {
          if (scrollRAF) cancelAnimationFrame(scrollRAF);
        });
      },
    ),
  );

  return (
    <div class={cn("relative", props.class)}>
      <div class="mb-3 flex items-center justify-between">
        <Show when={!props.compact}>
          <h2 class="font-display text-h3 font-semibold text-fg">{t("donor.supportersWall")}</h2>
        </Show>
        <Show when={props.compact}>
          <p class="font-sans text-label uppercase tracking-wide text-fg-muted">{t("donor.recentSupporters")}</p>
        </Show>
        <span class="inline-flex items-center gap-1.5 font-sans text-label text-fg-muted">
          <span class="relative inline-flex size-2">
            <span classList={{ "bg-live": connected(), "bg-border-strong": !connected() }} class="absolute inset-0 rounded-full" />
            <Show when={connected()}>
              <span class="absolute inset-0 animate-[gt-pulse_2s_ease-out_infinite] rounded-full bg-live" />
            </Show>
          </span>
          {connected() ? t("dashboard.live") : t("dashboard.connecting")}
        </span>
      </div>

      <Show when={supporters()}>
        {(rows) => (
          <Show when={rows().length > 0} fallback={<p class="font-sans text-fs-sm text-fg-muted">{t("donor.noSupportersYet")}</p>}>
            <Show
              when={props.compact}
              fallback={
                <ul class="space-y-2">
                  <For each={rows()}>
                    {(supporter) => (
                      <li class="flex items-baseline justify-between gap-3 font-sans text-fs-sm animate-[gt-toast-in_0.3s_ease-out]">
                        <span class="min-w-0 truncate font-medium text-fg">{displayName(supporter.donorName)}</span>
                        <span class="flex shrink-0 items-baseline gap-2">
                          <span class="font-mono tabular-nums text-fg">{formatMoney(supporter.amountMinor, supporter.currency)}</span>
                          <span class="hidden text-label text-fg-muted sm:inline">{formatDateTime(supporter.createdAt)}</span>
                        </span>
                      </li>
                    )}
                  </For>
                </ul>
              }>
              <div ref={scrollRef} class="overflow-hidden">
                <div ref={trackRef} class="flex w-max items-center gap-2" style={{ "will-change": "transform" }}>
                  <For each={rows()}>
                    {(supporter) => (
                      <span class="flex shrink-0 items-baseline gap-1.5 rounded-full border border-border bg-surface-raised px-3 py-1.5 font-sans text-label animate-[gt-toast-in_0.3s_ease-out]">
                        <span class="font-medium text-fg">{displayName(supporter.donorName)}</span>
                        <span class="font-mono tabular-nums text-fg-muted">{formatMoney(supporter.amountMinor, supporter.currency)}</span>
                      </span>
                    )}
                  </For>
                </div>
              </div>
            </Show>
          </Show>
        )}
      </Show>
    </div>
  );
};
