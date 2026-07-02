import { DonorCampaignProvider, useDonorCampaign } from "../donor/DonorCampaignContext";

import { A } from "@solidjs/router";
import type { RouteSectionProps } from "@solidjs/router";

import { Show } from "solid-js";
import type { Component, ParentComponent } from "solid-js";

import { t } from "~/shared/i18n";
import { PrefsPopover } from "~/shared/prefs";
import type { CurrencyCode } from "~/shared/api";
import { PageTransition } from "~/shared/motion";
import { readableForeground } from "~/shared/lib/color";
import { ErrorState, Select, Spinner } from "~/shared/ui";

const CURRENCY_OPTIONS = [
  { value: "EUR", label: "EUR €" },
  { value: "USD", label: "USD $" },
  { value: "GBP", label: "GBP £" },
];

const DonorShell: ParentComponent = (props) => {
  const donor = useDonorCampaign();

  return (
    <Show when={!donor.loading()} fallback={<Spinner class="mx-auto mt-24" />}>
      <Show when={donor.campaign()} fallback={<ErrorState error={donor.error() ?? new Error(t("donor.campaignNotFound"))} />}>
        {(campaign) => (
          <div class="min-h-screen bg-surface" style={{ "--brand": campaign().brandColor, "--brand-fg": readableForeground(campaign().brandColor) }}>
            <header class="border-b border-border bg-surface-raised">
              <div class="mx-auto flex max-w-md flex-wrap items-center justify-between gap-2 px-4 py-3">
                <A href={`/c/${campaign().slug}`} class="flex items-center gap-2 font-display text-h3 font-semibold text-fg">
                  <span class="inline-flex size-6 items-center justify-center rounded-md bg-brand text-[11px] font-bold text-brand-fg">GT</span>
                  GiveTap
                </A>
                <div class="flex flex-wrap items-center gap-2">
                  <Select
                    aria-label={t("donor.currency")}
                    class="min-h-[44px] w-24 px-2 py-1 text-fs-sm"
                    options={CURRENCY_OPTIONS}
                    value={donor.currency()}
                    onChange={(e) => donor.setCurrency(e.currentTarget.value as CurrencyCode)}
                  />
                  <PrefsPopover />
                </div>
              </div>
            </header>
            <main class="mx-auto w-full max-w-md flex-1 px-4 py-6">
              <PageTransition>{props.children}</PageTransition>
            </main>
          </div>
        )}
      </Show>
    </Show>
  );
};

const DonorLayout: Component<RouteSectionProps> = (props) => (
  <DonorCampaignProvider>
    <DonorShell>{props.children}</DonorShell>
  </DonorCampaignProvider>
);

export default DonorLayout;
