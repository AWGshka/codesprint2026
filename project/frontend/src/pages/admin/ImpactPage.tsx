import type { Component } from "solid-js";
import { For, Show, createResource } from "solid-js";

import { t } from "~/shared/i18n";
import { getImpactStats } from "~/shared/api";
import { formatMoney } from "~/shared/lib/money";
import { Card, EmptyState, ErrorState, ProgressBar, Skeleton, StatCard } from "~/shared/ui";

const ImpactPage: Component = () => {
  const [stats] = createResource(getImpactStats);

  return (
    <div class="max-w-3xl space-y-5">
      <div class="space-y-2">
        <h1 class="font-display text-h1 font-semibold text-fg">{t("admin.impact")}</h1>
        <p class="max-w-prose font-sans text-body text-fg-muted">{t("admin.impactBody")}</p>
      </div>

      <Show
        when={!stats.loading}
        fallback={
          <div class="space-y-4">
            <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <For each={[0, 1, 2, 3]}>{() => <Skeleton variant="block" class="h-20" />}</For>
            </div>
            <Skeleton variant="block" class="h-48" />
          </div>
        }>
        <Show when={!stats.error} fallback={<ErrorState error={stats.error} />}>
          <Show when={stats()}>
            {(data) => (
              <div class="space-y-5">
                <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <StatCard label={t("admin.impactTotalRaised")} value={formatMoney(data().totalRaisedMinor, "EUR")} />
                  <StatCard label={t("admin.impactDonations")} value={data().donationCount.toLocaleString()} />
                  <StatCard label={t("admin.impactDonors")} value={data().donorCount.toLocaleString()} />
                  <StatCard label={t("admin.impactActiveCampaigns")} value={data().activeCampaignCount.toLocaleString()} />
                </div>

                <Card padding="lg" class="space-y-4">
                  <h2 class="font-display text-h2 font-semibold text-fg">{t("admin.impactPerCampaign")}</h2>
                  <Show when={data().perCampaign.length > 0} fallback={<EmptyState title={t("admin.impactEmpty")} />}>
                    <ul class="space-y-4">
                      <For each={data().perCampaign}>
                        {(c) => {
                          const pct = c.targetMinor > 0 ? (c.raisedMinor / c.targetMinor) * 100 : 0;
                          return (
                            <li class="space-y-1.5">
                              <div class="flex items-center justify-between gap-3">
                                <span class="font-sans text-fs-sm font-semibold text-fg">{c.title}</span>
                                {/* No campaign-level currency is exposed by the impact endpoint (see
                                    frontend-engineer-run2b.md notes) - show a currency-agnostic
                                    percentage rather than risk mislabeling an amount. */}
                                <span class="font-mono text-label tabular-nums text-fg-muted">{Math.round(Math.min(100, pct))}%</span>
                              </div>
                              <ProgressBar value={pct} />
                              <p class="font-sans text-label text-fg-muted">
                                {c.donorCount} {t("donor.donors")}
                              </p>
                            </li>
                          );
                        }}
                      </For>
                    </ul>
                  </Show>
                </Card>
              </div>
            )}
          </Show>
        </Show>
      </Show>
    </div>
  );
};

export default ImpactPage;
