import { useParams } from "@solidjs/router";

import type { Component } from "solid-js";
import { Show, createResource, createSignal, onCleanup } from "solid-js";

import { t } from "~/shared/i18n";
import { getCampaign } from "~/shared/api";
import { GiveFlow } from "~/app/donor/GiveFlow";
import { formatMoney } from "~/shared/lib/money";
import { ErrorState, Spinner } from "~/shared/ui";
import { readableForeground } from "~/shared/lib/color";

type Phase = "start" | "give" | "thanks";

const RESET_MS = 6000;

const KioskPage: Component = () => {
  const params = useParams<{ slug: string }>();
  const [campaign] = createResource(() => params.slug, getCampaign);
  const [phase, setPhase] = createSignal<Phase>("start");
  const [lastAmount, setLastAmount] = createSignal(0);
  let resetTimer: ReturnType<typeof setTimeout> | undefined;

  const scheduleReset = () => {
    if (resetTimer) clearTimeout(resetTimer);
    resetTimer = setTimeout(() => setPhase("start"), RESET_MS);
  };

  onCleanup(() => resetTimer && clearTimeout(resetTimer));

  return (
    <Show when={!campaign.loading} fallback={<Spinner class="mx-auto mt-24" />}>
      <Show when={campaign()} fallback={<ErrorState error={campaign.error} />}>
        {(c) => (
          <div class="flex min-h-screen flex-col bg-surface" style={{ "--brand": c().brandColor, "--brand-fg": readableForeground(c().brandColor) }}>
            <header class="flex items-center justify-center gap-2 border-b border-border bg-surface-raised py-4">
              <span class="inline-flex size-8 items-center justify-center rounded-md bg-brand text-sm font-bold text-brand-fg">GT</span>
              <span class="font-display text-h2 font-semibold text-fg">{c().name}</span>
            </header>

            <main class="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-10">
              <Show when={phase() === "start"}>
                <button
                  type="button"
                  onClick={() => setPhase("give")}
                  class="flex min-h-64 flex-col items-center justify-center gap-4 rounded-lg border-2 border-brand bg-brand/8 p-8 text-center">
                  <span class="font-display text-display font-semibold text-brand">{c().name}</span>
                  <span class="font-sans text-h3 font-semibold text-fg">{t("donor.kioskTapToStart")}</span>
                </button>
              </Show>

              <Show when={phase() === "give"}>
                <GiveFlow
                  campaign={c()}
                  currency={c().currency}
                  source="kiosk"
                  big
                  onSuccess={(_result, amountMinor) => {
                    setLastAmount(amountMinor);
                    setPhase("thanks");
                    scheduleReset();
                  }}
                />
              </Show>

              <Show when={phase() === "thanks"}>
                <div class="space-y-4 text-center">
                  <div class="mx-auto flex size-20 items-center justify-center rounded-full bg-positive/12 text-positive">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                  </div>
                  <h1 class="font-display text-display font-semibold text-fg">{t("donor.kioskThanks")}</h1>
                  <p class="font-mono text-h2 tabular-nums text-fg">{formatMoney(lastAmount(), c().currency)}</p>
                  <p class="font-sans text-fs-sm text-fg-muted">{t("donor.kioskResetting")}</p>
                </div>
              </Show>
            </main>
          </div>
        )}
      </Show>
    </Show>
  );
};

export default KioskPage;
