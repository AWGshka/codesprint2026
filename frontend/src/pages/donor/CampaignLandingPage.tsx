import { A } from "@solidjs/router";

import type { Component } from "solid-js";
import { Show, createMemo } from "solid-js";

import { t } from "~/shared/i18n";
import { Banner, Button, Card, ProgressBar } from "~/shared/ui";
import { convertMinor, formatMoney } from "~/shared/lib/money";
import { useDonorCampaign } from "~/app/donor/DonorCampaignContext";

const CampaignLandingPage: Component = () => {
  const donor = useDonorCampaign();

  const progress = createMemo(() => {
    const c = donor.campaign();
    if (!c) return undefined;
    // `progress` can be missing (see CampaignWithProgress) — fall back to 0 raised /
    // the campaign's own `targetMinor` so the page still renders.
    const raised = convertMinor(c.progress?.raisedMinor ?? 0, c.currency, donor.currency());
    const target = convertMinor(c.progress?.targetMinor ?? c.targetMinor, c.currency, donor.currency());
    return { raised, target, pct: target > 0 ? (raised / target) * 100 : 0, donorCount: c.progress?.donorCount ?? 0 };
  });

  return (
    <Show when={donor.campaign()}>
      {(campaign) => (
        <div class="space-y-5">
          <div
            class="flex h-40 items-end rounded-lg p-4 text-brand-fg"
            style={{ background: "linear-gradient(160deg, var(--brand), color-mix(in srgb, var(--brand) 55%, black))" }}>
            <div>
              <p class="font-sans text-label uppercase tracking-wide opacity-80">{campaign().cause}</p>
              <h1 class="font-display text-h1 font-semibold">{campaign().name}</h1>
            </div>
          </div>

          <p class="font-sans text-body text-fg-muted">{campaign().description}</p>
          <Show when={campaign().story}>
            <p class="font-sans text-fs-sm text-fg-muted">{campaign().story}</p>
          </Show>

          <Show when={progress()}>
            {(p) => (
              <Card padding="md" class="space-y-2">
                <div class="flex items-baseline justify-between font-mono text-fs-sm tabular-nums">
                  <span class="text-h3 font-semibold text-fg">{formatMoney(p().raised, donor.currency())}</span>
                  <span class="text-fg-muted">
                    {t("donor.raisedOf")} {formatMoney(p().target, donor.currency())}
                  </span>
                </div>
                <ProgressBar value={p().pct} />
                <p class="font-sans text-label text-fg-muted">
                  {p().donorCount} {t("donor.donors")}
                </p>
              </Card>
            )}
          </Show>

          {/* Non-active campaigns state it plainly instead of offering a donate CTA the
              server would reject anyway. */}
          <Show when={campaign().status === "active"}>
            <A href={`/c/${campaign().slug}/give`}>
              <Button class="min-h-13 w-full" size="lg">
                {t("donor.donateNow")}
              </Button>
            </A>
          </Show>
          <Show when={campaign().status === "paused"}>
            <Banner variant="warning">{t("donor.campaignPaused")}</Banner>
          </Show>
          <Show when={campaign().status === "ended"}>
            <Banner variant="neutral">{t("donor.campaignEnded")}</Banner>
          </Show>
        </div>
      )}
    </Show>
  );
};

export default CampaignLandingPage;
