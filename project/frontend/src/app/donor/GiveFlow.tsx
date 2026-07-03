import type { Component } from "solid-js";
import { For, Show, createMemo, createSignal } from "solid-js";

import { t } from "~/shared/i18n";
import { cn } from "~/shared/lib/cn";
import { convertMinor, formatMoney } from "~/shared/lib/money";
import { Banner, Button, Field, Input, Stepper } from "~/shared/ui";
import { ApiError, apiErrorCode, createDonation, lookupBin } from "~/shared/api";
import type { BinDetails, CampaignWithProgress, CreateDonationResponse, CurrencyCode, DonationFrequency } from "~/shared/api";

export interface GiveFlowProps {
  campaign: CampaignWithProgress;
  currency: CurrencyCode;
  source: "web" | "kiosk";
  /** Kiosk mode — oversized touch targets. */
  big?: boolean;
  /** Kiosk payment: replaces card entry + review with a tap-to-pay screen (simulated NFC). */
  tapToPay?: boolean;
  onSuccess: (result: CreateDonationResponse, amountMinor: number, currency: CurrencyCode, frequency: DonationFrequency) => void;
  onCancel?: () => void;
}

type ErrorKind = "declined" | "network" | "other" | undefined;

const frequencyLabelKey: Record<DonationFrequency, "donor.oneTime" | "donor.monthly" | "donor.roundUp"> = {
  one_time: "donor.oneTime",
  monthly: "donor.monthly",
  roundup: "donor.roundUp",
};

const CARD_DIGITS = 16;

/** "4242424242420002x" → "4242 4242 4242 0002" — digits only, capped at 16, spaced per group of 4. */
const formatCardNumber = (raw: string): string =>
  raw
    .replace(/\D/g, "")
    .slice(0, CARD_DIGITS)
    .replace(/(\d{4})(?=\d)/g, "$1 ");

export const GiveFlow: Component<GiveFlowProps> = (props) => {
  const [step, setStep] = createSignal(0);
  const presets = createMemo(() => props.campaign.presetsMinor.map((minor) => convertMinor(minor, props.campaign.currency, props.currency)));
  const [selectedPreset, setSelectedPreset] = createSignal<number | undefined>(presets()[0]);
  const [customAmount, setCustomAmount] = createSignal("");
  const [useCustom, setUseCustom] = createSignal(false);
  const [frequency, setFrequency] = createSignal<DonationFrequency>(props.campaign.frequencies[0] ?? "one_time");
  const [donorName, setDonorName] = createSignal("");
  const [donorEmail, setDonorEmail] = createSignal("");
  const [cardNumber, setCardNumber] = createSignal("");
  const [submitting, setSubmitting] = createSignal(false);
  const [errorKind, setErrorKind] = createSignal<ErrorKind>();
  const [errorMessage, setErrorMessage] = createSignal("");
  const [tapReading, setTapReading] = createSignal(false);
  const [binInfo, setBinInfo] = createSignal<BinDetails | null>(null);
  let binTimer: ReturnType<typeof setTimeout> | undefined;

  // Card scheme/issuer hint via Mastercard BIN Lookup — debounced on the first 8 digits;
  // silently absent when the lookup is unconfigured or the BIN is unknown.
  const refreshBinInfo = (digits: string) => {
    if (binTimer) clearTimeout(binTimer);
    if (digits.length < 8) return setBinInfo(null);
    binTimer = setTimeout(() => lookupBin(digits.slice(0, 8)).then(setBinInfo).catch(() => setBinInfo(null)), 350);
  };

  const amountMinor = createMemo(() => {
    if (useCustom()) {
      const parsed = Math.round(Number.parseFloat(customAmount() || "0") * 100);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    }
    return selectedPreset() ?? 0;
  });

  const canContinueAmount = () => amountMinor() > 0;
  const canContinuePay = () => cardNumber().replace(/\s/g, "").length === CARD_DIGITS;

  const targetSize = props.big ? "min-h-16 text-h3" : "min-h-13 text-body";

  const submit = async () => {
    setSubmitting(true);
    setErrorKind(undefined);
    try {
      const last4 = cardNumber().replace(/\s/g, "").slice(-4).padStart(4, "0");
      const result = await createDonation(props.campaign.slug, {
        amountMinor: amountMinor(),
        currency: props.currency,
        frequency: frequency(),
        donorName: donorName() || undefined,
        donorEmail: donorEmail() || undefined,
        source: props.source,
        card: { last4 },
      });
      props.onSuccess(result, amountMinor(), props.currency, frequency());
    } catch (err) {
      if (apiErrorCode(err) === "PAYMENT_DECLINED") setErrorKind("declined");
      else if (err instanceof ApiError && err.status === 0) setErrorKind("network");
      else {
        setErrorKind("other");
        setErrorMessage(err instanceof Error ? err.message : t("common.error"));
      }
    } finally {
      setSubmitting(false);
    }
  };

  /** Kiosk tap-to-pay: no card entry or review — an emulated NFC tap reads a demo card and pays immediately. */
  const emulateTap = async () => {
    setTapReading(true);
    setErrorKind(undefined);
    setCardNumber("4242 4242 4242 4242");
    await new Promise((resolve) => setTimeout(resolve, 1200));
    try {
      await submit();
    } finally {
      setTapReading(false);
    }
  };

  return (
    <div class="space-y-5">
      <Stepper
        steps={props.tapToPay ? [t("donor.amount"), t("donor.kioskTapCard")] : [t("donor.amount"), t("donor.payWith"), t("donor.reviewGift")]}
        current={step()}
      />

      <Show when={step() === 0}>
        <section class="space-y-4">
          <h1 class="font-display text-h3 font-semibold text-fg">{t("donor.howMuch")}</h1>
          <div class="grid grid-cols-2 gap-2">
            <For each={presets()}>
              {(preset) => (
                <button
                  type="button"
                  onClick={() => {
                    setUseCustom(false);
                    setSelectedPreset(preset);
                  }}
                  class={cn(
                    "flex items-center justify-center rounded-md border font-mono tabular-nums transition-colors",
                    targetSize,
                    !useCustom() && selectedPreset() === preset
                      ? "border-2 border-brand bg-brand/8 font-semibold text-brand"
                      : "border-border-strong text-fg hover:border-brand/60",
                  )}>
                  {formatMoney(preset, props.currency)}
                </button>
              )}
            </For>
          </div>
          <Show when={props.campaign.allowCustom}>
            <Field label={t("donor.customAmount")}>
              <Input
                type="number"
                min="1"
                step="0.01"
                inputmode="decimal"
                class={cn(targetSize)}
                placeholder="0.00"
                value={customAmount()}
                onInput={(e) => {
                  setUseCustom(true);
                  setCustomAmount(e.currentTarget.value);
                }}
                onFocus={() => setUseCustom(true)}
              />
            </Field>
          </Show>

          <Show when={props.campaign.frequencies.length > 1}>
            <div>
              <h2 class="mb-2 font-display text-h3 font-semibold text-fg">{t("donor.howOften")}</h2>
              <div class="flex gap-1 rounded-md border border-border bg-surface-sunken p-1">
                <For each={props.campaign.frequencies}>
                  {(freq) => (
                    <button
                      type="button"
                      onClick={() => setFrequency(freq)}
                      class={cn(
                        "flex-1 rounded-sm font-sans font-semibold transition-colors",
                        props.big ? "min-h-14 text-fs-sm" : "min-h-11 text-label",
                        // text-surface, not text-white — in dark theme fg is near-white, so
                        // white-on-fg would blend invisibly.
                        frequency() === freq ? "bg-fg text-surface" : "text-fg-muted",
                      )}>
                      {t(frequencyLabelKey[freq])}
                    </button>
                  )}
                </For>
              </div>
            </div>
          </Show>

          <Button class={cn("w-full", props.big && "min-h-16 text-h3")} disabled={!canContinueAmount()} onClick={() => setStep(1)}>
            {t("donor.continueLabel")} · {formatMoney(amountMinor(), props.currency)}
          </Button>
        </section>
      </Show>

      <Show when={step() === 1 && props.tapToPay}>
        <section class="space-y-5 text-center">
          <h1 class="font-display text-h3 font-semibold text-fg">{t("donor.kioskTapCard")}</h1>
          <div
            class={cn(
              "mx-auto flex size-40 items-center justify-center rounded-full border-2 border-brand bg-brand/8 text-brand",
              tapReading() && "animate-pulse",
            )}>
            <svg width="72" height="72" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="2.5" y="6" width="15" height="11" rx="2" stroke="currentColor" stroke-width="1.6" />
              <path d="M2.5 9.5h15" stroke="currentColor" stroke-width="1.6" />
              <path d="M19.5 8.5a6.5 6.5 0 0 1 0 7M21.5 6.5a9.5 9.5 0 0 1 0 11" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
            </svg>
          </div>
          <p class="font-sans text-body text-fg-muted">{tapReading() ? t("donor.kioskReading") : t("donor.kioskTapHint")}</p>

          <Show when={errorKind()}>
            <Banner variant="danger">{errorKind() === "network" ? t("donor.networkErrorBody") : errorMessage() || t("common.error")}</Banner>
          </Show>

          <div class="flex flex-col gap-2">
            <Button variant="ghost" size="sm" class="mx-auto" disabled={tapReading()} onClick={emulateTap}>
              {t("donor.kioskEmulate")}
            </Button>
            <Button variant="secondary" class={cn("w-full", props.big && "min-h-16 text-h3")} disabled={tapReading()} onClick={() => setStep(0)}>
              {t("donor.back")}
            </Button>
          </div>
        </section>
      </Show>

      <Show when={step() === 1 && !props.tapToPay}>
        <section class="space-y-4">
          <h1 class="font-display text-h3 font-semibold text-fg">{t("donor.payWith")}</h1>
          <Field label={t("donor.cardNumber")} hint={t("donor.cardHint")}>
            <Input
              inputmode="numeric"
              autocomplete="cc-number"
              maxlength={CARD_DIGITS + 3}
              class={targetSize}
              placeholder="4242 4242 4242 4242"
              value={cardNumber()}
              onInput={(e) => {
                const formatted = formatCardNumber(e.currentTarget.value);
                e.currentTarget.value = formatted;
                setCardNumber(formatted);
                refreshBinInfo(formatted.replace(/\s/g, ""));
                // A previous decline no longer applies once the number changes — the next
                // "Confirm and give" revalidates against the new card.
                setErrorKind(undefined);
              }}
            />
          </Field>
          <Show when={binInfo()}>
            {(bin) => (
              <p class="font-sans text-label text-fg-muted">
                {[bin().fundingSource, bin().issuer, bin().country].filter(Boolean).join(" · ")}
              </p>
            )}
          </Show>
          <Field label={t("donor.donorName")}>
            <Input class={targetSize} value={donorName()} onInput={(e) => setDonorName(e.currentTarget.value)} />
          </Field>
          <Field label={`${t("donor.donorEmail")} (${t("donor.optional")})`}>
            <Input type="email" class={targetSize} value={donorEmail()} onInput={(e) => setDonorEmail(e.currentTarget.value)} />
          </Field>
          <div class="flex gap-2">
            <Button variant="secondary" class={cn("flex-1", props.big && "min-h-16 text-h3")} onClick={() => setStep(0)}>
              {t("donor.back")}
            </Button>
            <Button class={cn("flex-1", props.big && "min-h-16 text-h3")} disabled={!canContinuePay()} onClick={() => setStep(2)}>
              {t("donor.continueLabel")}
            </Button>
          </div>
        </section>
      </Show>

      <Show when={step() === 2}>
        <section class="space-y-4">
          <h1 class="font-display text-h3 font-semibold text-fg">{t("donor.checkBeforeYouGive")}</h1>
          <dl class="space-y-2 rounded-md border border-border bg-surface-sunken p-4 font-sans text-fs-sm">
            <div class="flex justify-between">
              <dt class="text-fg-muted">{t("donor.cause")}</dt>
              <dd class="font-medium text-fg">{props.campaign.name}</dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-fg-muted">{t("donor.amount")}</dt>
              <dd class="font-mono font-semibold tabular-nums text-fg">{formatMoney(amountMinor(), props.currency)}</dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-fg-muted">{t("donor.frequency")}</dt>
              <dd class="text-fg">{t(frequencyLabelKey[frequency()])}</dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-fg-muted">{t("donor.card")}</dt>
              <dd class="font-mono text-fg">•••• {cardNumber().replace(/\s/g, "").slice(-4).padStart(4, "0")}</dd>
            </div>
          </dl>

          <Show when={errorKind() === "declined"}>
            <Banner variant="danger">
              <strong class="block font-semibold">{t("donor.paymentDeclined")}</strong>
              {t("donor.paymentDeclinedBody")}
            </Banner>
          </Show>
          <Show when={errorKind() === "network"}>
            <Banner variant="warning">{t("donor.networkErrorBody")}</Banner>
          </Show>
          <Show when={errorKind() === "other"}>
            <Banner variant="danger">{errorMessage()}</Banner>
          </Show>

          <div class="flex gap-2">
            <Show
              when={errorKind() === "declined"}
              fallback={
                <Button variant="secondary" class={cn("flex-1", props.big && "min-h-16 text-h3")} onClick={() => setStep(1)} disabled={submitting()}>
                  {t("donor.back")}
                </Button>
              }>
              <Button variant="secondary" class={cn("flex-1", props.big && "min-h-16 text-h3")} onClick={() => setStep(1)}>
                {t("donor.tryAnotherCard")}
              </Button>
            </Show>
            <Button class={cn("flex-1", props.big && "min-h-16 text-h3")} loading={submitting()} onClick={submit}>
              {t("donor.submitGift")}
            </Button>
          </div>
        </section>
      </Show>
    </div>
  );
};
