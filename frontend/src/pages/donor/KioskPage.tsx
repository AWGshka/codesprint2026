import { useParams } from "@solidjs/router";

import type { Component } from "solid-js";
import { Motion, Presence } from "solid-motionone";
import { Show, createMemo, createResource, createSignal, onCleanup } from "solid-js";

import { t } from "~/shared/i18n";
import { getCampaign } from "~/shared/api";
import { PrefsControls } from "~/shared/prefs";
import { GiveFlow } from "~/app/donor/GiveFlow";
import { formatMoney } from "~/shared/lib/money";
import { readableForeground } from "~/shared/lib/color";
import { SupportersWall } from "~/app/donor/SupportersWall";
import { ErrorState, ProgressBar, Spinner } from "~/shared/ui";

type Phase = "start" | "give" | "thanks";

const RESET_MS = 6000;

const phaseTransition = { duration: 0.35, easing: [0.22, 1, 0.36, 1] as [number, number, number, number] };
const fadeIn = { initial: { opacity: 0, scale: 0.97 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.97 } };

const KioskPage: Component = () => {
  const params = useParams<{ slug: string }>();
  const [campaign, { refetch }] = createResource(() => params.slug, getCampaign);
  const [phase, setPhase] = createSignal<Phase>("start");
  const [lastAmount, setLastAmount] = createSignal(0);
  let resetTimer: ReturnType<typeof setTimeout> | undefined;

  const scheduleReset = () => {
    if (resetTimer) clearTimeout(resetTimer);
    resetTimer = setTimeout(() => setPhase("start"), RESET_MS);
  };

  onCleanup(() => resetTimer && clearTimeout(resetTimer));

  const progress = createMemo(() => {
    const c = campaign();
    if (!c) return undefined;
    const raised = c.progress?.raisedMinor ?? 0;
    const target = c.progress?.targetMinor ?? c.targetMinor;
    return { raised, target, pct: target > 0 ? (raised / target) * 100 : 0 };
  });

  return (
    <Show when={!campaign.loading} fallback={<Spinner class="mx-auto mt-24" />}>
      <Show when={campaign()} fallback={<ErrorState error={campaign.error} />}>
        {(c) => (
          <div class="flex min-h-screen flex-col bg-surface" style={{ "--brand": c().brandColor, "--brand-fg": readableForeground(c().brandColor) }}>
            <header class="space-y-3 border-b border-border bg-surface-raised px-6 py-4">
              <div class="flex items-center justify-center gap-2">
                <span class="inline-flex size-8 items-center justify-center rounded-md bg-brand text-sm font-bold text-brand-fg">
                  {c().logoUrl || c().name.slice(0, 2).toUpperCase()}
                </span>
                <span class="font-display text-h2 font-semibold text-fg">{c().name}</span>
                <span class="hidden rounded-full border border-border px-2.5 py-0.5 font-sans text-label text-fg-muted sm:inline">{c().cause}</span>
                <span class="ml-auto">
                  <PrefsControls />
                </span>
              </div>
              <Show when={progress()}>
                {(p) => (
                  <div class="mx-auto w-full max-w-xl space-y-1.5">
                    <ProgressBar value={p().pct} />
                    <p class="text-center font-mono text-label tabular-nums text-fg-muted">
                      {formatMoney(p().raised, c().currency)} {t("donor.raisedOf")} {formatMoney(p().target, c().currency)}
                    </p>
                  </div>
                )}
              </Show>
            </header>

            <main class="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-8">
              <Presence exitBeforeEnter>
                <Show when={phase() === "start" && c().status !== "active"} keyed>
                  <Motion.div {...fadeIn} transition={phaseTransition}>
                    <p class="rounded-md border border-border bg-surface-raised p-6 text-center font-sans text-body text-fg-muted">
                      {c().status === "paused" ? t("donor.campaignPaused") : t("donor.campaignEnded")}
                    </p>
                  </Motion.div>
                </Show>
                <Show when={phase() === "start" && c().status === "active"} keyed>
                  <Motion.div {...fadeIn} transition={phaseTransition}>
                    <button
                      type="button"
                      onClick={() => setPhase("give")}
                      class="flex min-h-64 w-full flex-col items-center justify-center gap-4 rounded-lg border-2 border-brand bg-brand/8 p-8 text-center transition-transform active:scale-[0.98]">
                      <span class="font-display text-display font-semibold text-brand">{c().name}</span>
                      <span class="font-sans text-h3 font-semibold text-fg">{t("donor.kioskTapToStart")}</span>
                    </button>
                  </Motion.div>
                </Show>

                <Show when={phase() === "give"} keyed>
                  <Motion.div {...fadeIn} transition={phaseTransition}>
                    <GiveFlow
                      campaign={c()}
                      currency={c().currency}
                      source="kiosk"
                      big
                      tapToPay
                      onSuccess={(_result, amountMinor) => {
                        setLastAmount(amountMinor);
                        setPhase("thanks");
                        scheduleReset();
                        void refetch();
                      }}
                    />
                  </Motion.div>
                </Show>

                <Show when={phase() === "thanks"} keyed>
                  <Motion.div {...fadeIn} transition={phaseTransition}>
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
                  </Motion.div>
                </Show>
              </Presence>
            </main>

            <footer class="border-t border-border bg-surface-raised px-6 py-4">
              <SupportersWall slug={params.slug} compact />
            </footer>
          </div>
        )}
      </Show>
    </Show>
  );
};

export default KioskPage;
