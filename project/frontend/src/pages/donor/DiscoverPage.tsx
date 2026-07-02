import { A } from "@solidjs/router";

import type { Component } from "solid-js";
import { For, Show, createMemo, createResource, createSignal } from "solid-js";

import { t } from "~/shared/i18n";
import { listCampaigns } from "~/shared/api";
import { formatMoney } from "~/shared/lib/money";
import { Card, EmptyState, ErrorState, Input, ProgressBar, Skeleton } from "~/shared/ui";

const DiscoverPage: Component = () => {
  const [campaigns] = createResource(listCampaigns);
  const [query, setQuery] = createSignal("");

  const filtered = createMemo(() => {
    const q = query().trim().toLowerCase();
    const rows = campaigns() ?? [];
    if (!q) return rows;
    return rows.filter((c) => c.name.toLowerCase().includes(q) || c.cause.toLowerCase().includes(q) || c.description.toLowerCase().includes(q));
  });

  return (
    <div class="space-y-6">
      <div class="space-y-2">
        <h1 class="font-display text-h1 font-semibold text-fg">{t("donor.discoverTitle")}</h1>
        <p class="font-sans text-body text-fg-muted">{t("donor.discoverSubtitle")}</p>
      </div>

      <Input placeholder={t("donor.searchCampaigns")} value={query()} onInput={(e) => setQuery(e.currentTarget.value)} class="max-w-sm" />

      <Show
        when={!campaigns.loading}
        fallback={
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <For each={[0, 1, 2, 3, 4, 5]}>{() => <Skeleton variant="block" class="h-48" />}</For>
          </div>
        }>
        <Show when={!campaigns.error} fallback={<ErrorState error={campaigns.error} />}>
          <Show when={filtered().length > 0} fallback={<EmptyState title={t("donor.noResults")} />}>
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <For each={filtered()}>
                {(c) => {
                  // Defensive: `progress` should always be present on the list response (server fix,
                  // BE-2), but never crash the whole grid over one malformed/missing entry - fall
                  // back to zeroes rather than reading through `undefined`.
                  const raisedMinor = c.progress?.raisedMinor ?? 0;
                  const targetMinor = c.progress?.targetMinor ?? 0;
                  const pct = targetMinor > 0 ? (raisedMinor / targetMinor) * 100 : 0;
                  return (
                    <A href={`/c/${c.slug}`}>
                      <Card padding="none" class="h-full overflow-hidden transition-shadow hover:shadow-e2">
                        <div class="h-24" style={{ background: `linear-gradient(160deg, ${c.brandColor}, color-mix(in srgb, ${c.brandColor} 55%, black))` }} />
                        <div class="space-y-2 p-4">
                          <p class="font-sans text-label uppercase tracking-wide text-fg-muted">{c.cause}</p>
                          <h2 class="font-display text-h3 font-semibold text-fg">{c.name}</h2>
                          <p class="line-clamp-2 font-sans text-fs-sm text-fg-muted">{c.description}</p>
                          <ProgressBar value={pct} />
                          <p class="font-mono text-label tabular-nums text-fg-muted">
                            {formatMoney(raisedMinor, c.currency)} / {formatMoney(targetMinor, c.currency)}
                          </p>
                        </div>
                      </Card>
                    </A>
                  );
                }}
              </For>
            </div>
          </Show>
        </Show>
      </Show>
    </div>
  );
};

export default DiscoverPage;
