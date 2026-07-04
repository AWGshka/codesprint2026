import type { Component } from "solid-js";
import { For, Show, createEffect, createMemo, createSignal, onCleanup } from "solid-js";

import { t } from "~/shared/i18n";
import { cn } from "~/shared/lib/cn";
import { convertMinor, formatMoney } from "~/shared/lib/money";
import { Banner, Button, Checkbox, Field, Input, Stepper } from "~/shared/ui";
import { mockPanForTap, nfcAvailable, startNfcTapScan } from "~/shared/lib/nfc";
import { ApiError, apiErrorCode, createDonation, lookupBin } from "~/shared/api";
import type { BinDetails, CampaignWithProgress, CreateDonationResponse, CurrencyCode, DonationFrequency, TapOutcome } from "~/shared/api";

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

type ErrorKind = "declined" | "network" | "offline" | "cancelled" | "other" | undefined;

const frequencyLabelKey: Record<DonationFrequency, "donor.oneTime" | "donor.monthly"> = { one_time: "donor.oneTime", monthly: "donor.monthly" };

const CARD_DIGITS = 16;

// Round-up granularity: the next multiple of 10 major units (€10 / $10 / £10).
const ROUND_TO_MINOR = 1000;

/** Luhn checksum — the industry-standard validity test for card numbers. */
const luhnValid = (digits: string): boolean => {
  let sum = 0;
  for (let i = digits.length - 1, alt = false; i >= 0; i--, alt = !alt) {
    let n = parseInt(digits[i]!, 10);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return sum > 0 && sum % 10 === 0;
};

/** "4242424242420002x" → "4242 4242 4242 0002" — digits only, capped at 16, spaced per group of 4. */
const formatCardNumber = (raw: string): string =>
  raw
    .replace(/\D/g, "")
    .slice(0, CARD_DIGITS)
    .replace(/(\d{4})(?=\d)/g, "$1 ");

const formatExpiry = (raw: string): string => {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  if (digits.length > 2) return digits.slice(0, 2) + "/" + digits.slice(2);
  return digits;
};

const parseExpiry = (formatted: string): { month: number; year: number } | null => {
  const m = formatted.match(/^(\d{2})\/(\d{2})$/);
  if (!m) return null;
  const month = parseInt(m[1]!, 10);
  const year = 2000 + parseInt(m[2]!, 10);
  if (month < 1 || month > 12) return null;
  return { month, year };
};

export const GiveFlow: Component<GiveFlowProps> = (props) => {
  const [step, setStep] = createSignal(0);
  const presets = createMemo(() => props.campaign.presetsMinor.map((minor) => convertMinor(minor, props.campaign.currency, props.currency)));
  const [selectedPreset, setSelectedPreset] = createSignal<number | undefined>(presets()[0]);
  const [customAmount, setCustomAmount] = createSignal("");
  const [useCustom, setUseCustom] = createSignal(false);
  const [frequency, setFrequency] = createSignal<DonationFrequency>(props.campaign.frequencies[0] ?? "one_time");
  const [roundUp, setRoundUp] = createSignal(false);
  const [giftAid, setGiftAid] = createSignal(false);
  const [giftAidName, setGiftAidName] = createSignal("");
  const [giftAidAddress, setGiftAidAddress] = createSignal("");
  const [giftAidConfirm, setGiftAidConfirm] = createSignal(false);
  const [showOnWall, setShowOnWall] = createSignal(false);
  const [donorName, setDonorName] = createSignal("");
  const [donorEmail, setDonorEmail] = createSignal("");
  const [cardNumber, setCardNumber] = createSignal("");
  const [cardExpiry, setCardExpiry] = createSignal("");
  const [cardCvv, setCardCvv] = createSignal("");
  const [cardNumberTouched, setCardNumberTouched] = createSignal(false);
  const [cardExpiryTouched, setCardExpiryTouched] = createSignal(false);
  const [cardCvvTouched, setCardCvvTouched] = createSignal(false);
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
    binTimer = setTimeout(
      () =>
        lookupBin(digits.slice(0, 8))
          .then(setBinInfo)
          .catch(() => setBinInfo(null)),
      350,
    );
  };

  const baseAmountMinor = createMemo(() => {
    if (useCustom()) {
      const parsed = Math.round(Number.parseFloat(customAmount() || "0") * 100);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    }
    return selectedPreset() ?? 0;
  });

  // What actually gets charged: the chosen amount, optionally bumped to the
  // next multiple of 10 (S1.1 round-up).
  const amountMinor = createMemo(() => {
    const base = baseAmountMinor();
    if (base <= 0 || !roundUp()) return base;
    return Math.ceil(base / ROUND_TO_MINOR) * ROUND_TO_MINOR;
  });

  const wasRoundedUp = () => roundUp() && amountMinor() !== baseAmountMinor();

  // The supporters wall shows names — opting in needs one. On the tap flow the
  // name is captured right here in step 0; the card flow captures it in step 1.
  const needsNameHere = () => props.tapToPay && showOnWall();
  const giftAidValid = () => !giftAid() || (giftAidName().trim().length > 0 && giftAidAddress().trim().length > 0 && giftAidConfirm());
  const canContinueAmount = () => amountMinor() > 0 && (!needsNameHere() || donorName().trim().length > 0) && giftAidValid();
  const cardNumberError = (): string | undefined => {
    const digits = cardNumber().replace(/\s/g, "");
    if (digits.length === 0) return undefined; // empty = not yet started
    if (digits.length !== CARD_DIGITS || !luhnValid(digits)) return t("donor.cardNumberError");
    return undefined;
  };
  const cardExpiryError = (): string | undefined => {
    const raw = cardExpiry();
    if (raw.length === 0) return undefined;
    return parseExpiry(raw) !== null ? undefined : t("donor.cardExpiryError");
  };
  const cardCvvError = (): string | undefined => {
    const raw = cardCvv();
    if (raw.length === 0) return undefined;
    return raw.length >= 3 ? undefined : t("donor.cardCvvError");
  };

  const canContinuePay = () =>
    cardNumber().replace(/\s/g, "").length === CARD_DIGITS &&
    luhnValid(cardNumber().replace(/\s/g, "")) &&
    parseExpiry(cardExpiry()) !== null &&
    cardCvv().length >= 3 &&
    (!showOnWall() || donorName().trim().length > 0);

  const targetSize = props.big ? "min-h-16 text-h3" : "min-h-13 text-body";

  const submit = async (outcome?: TapOutcome) => {
    setSubmitting(true);
    setErrorKind(undefined);
    try {
      const last4 = cardNumber().replace(/\s/g, "").slice(-4).padStart(4, "0");
      const result = await createDonation(props.campaign.slug, {
        amountMinor: amountMinor(),
        currency: props.currency,
        frequency: frequency(),
        donorName: donorName().trim() || undefined,
        donorEmail: donorEmail().trim() || undefined,
        source: props.source,
        method: props.tapToPay ? "tap" : "card",
        roundedUp: wasRoundedUp(),
        giftAid: giftAid(),
        showOnWall: showOnWall(),
        outcome,
        card: {
          last4,
          pan: cardNumber().replace(/\s/g, ""),
          expiryMonth: parseExpiry(cardExpiry())?.month,
          expiryYear: parseExpiry(cardExpiry())?.year,
          cvv: cardCvv(),
        },
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

  /** Kiosk tap-to-pay (M1.3/M1.6): a tap — real NFC, or one of the four simulation
   * buttons — reads a mock card and runs the outcome. "cancelled" never reaches the
   * server (the donor backed out); declined/offline round-trip so the ledger keeps
   * a row for every attempt. Browsers can't read real PANs, so the number is simulated. */
  const performTap = async (outcome: TapOutcome | "cancelled" = "approved", pan = "4242424242424242") => {
    if (tapReading() || submitting()) return;
    setTapReading(true);
    setErrorKind(undefined);
    setCardNumber(formatCardNumber(pan));
    // "Contacting Mastercard sandbox…" beat so the simulation reads like a real terminal.
    await new Promise((resolve) => setTimeout(resolve, 1200));
    try {
      if (outcome === "cancelled") {
        setErrorKind("cancelled");
        return;
      }
      if (outcome === "offline") {
        setErrorKind("offline");
        return;
      }
      await submit(outcome === "declined" ? "declined" : undefined);
    } finally {
      setTapReading(false);
    }
  };

  const [nfcActive, setNfcActive] = createSignal(false);

  // Real NFC tap detection (Chrome/Android + secure context): any tag — including a payment
  // card, which surfaces as a reading error — triggers the same simulated payment as the
  // demo buttons (always the approved path). Scan runs only while the tap screen is showing.
  createEffect(() => {
    if (!props.tapToPay || step() !== 1 || !nfcAvailable()) return;
    let stop: (() => void) | undefined;
    let disposed = false;
    startNfcTapScan((serial) => performTap("approved", mockPanForTap(serial)))
      .then((stopScan) => {
        if (disposed) return stopScan();
        stop = stopScan;
        setNfcActive(true);
      })
      .catch(() => setNfcActive(false));
    onCleanup(() => {
      disposed = true;
      stop?.();
      setNfcActive(false);
    });
  });

  const simButtons: { outcome: TapOutcome | "cancelled"; labelKey: "donor.simApproved" | "donor.simDeclined" | "donor.simCancelled" | "donor.simOffline" }[] = [
    { outcome: "approved", labelKey: "donor.simApproved" },
    { outcome: "declined", labelKey: "donor.simDeclined" },
    { outcome: "cancelled", labelKey: "donor.simCancelled" },
    { outcome: "offline", labelKey: "donor.simOffline" },
  ];

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

          {/* Donor options: round-up (S1.1), supporters wall (S1.3), Gift Aid (S1.2). */}
          <div class="space-y-3 rounded-md border border-border bg-surface-sunken p-4">
            <Checkbox checked={roundUp()} onChange={setRoundUp} label={t("donor.roundUpLabel", { amount: formatMoney(ROUND_TO_MINOR, props.currency) })} />
            <div class="space-y-1">
              <Checkbox checked={showOnWall()} onChange={setShowOnWall} label={t("donor.showOnWallLabel")} />
              <p class="pl-7 font-sans text-label text-fg-muted">{t("donor.wallAnonymousHint")}</p>
            </div>
            <div class="space-y-1">
              <Checkbox checked={giftAid()} onChange={setGiftAid} label={t("donor.giftAidLabel")} />
              <p class="pl-7 font-sans text-label text-fg-muted">{t("donor.giftAidBody")}</p>
            </div>
            <Show when={giftAid()}>
              <div class="space-y-3 pl-7">
                <Field label={t("donor.giftAidFullName")}>
                  <Input
                    class={props.big ? "min-h-13 text-body" : "min-h-10 text-fs-sm"}
                    value={giftAidName()}
                    onInput={(e) => setGiftAidName(e.currentTarget.value)}
                  />
                </Field>
                <Field label={t("donor.giftAidAddress")}>
                  <Input
                    class={props.big ? "min-h-13 text-body" : "min-h-10 text-fs-sm"}
                    value={giftAidAddress()}
                    onInput={(e) => setGiftAidAddress(e.currentTarget.value)}
                    placeholder={t("donor.giftAidAddressPlaceholder")}
                  />
                </Field>
                <Checkbox checked={giftAidConfirm()} onChange={setGiftAidConfirm} label={t("donor.giftAidConfirmLabel")} />
              </div>
            </Show>
            <Show when={needsNameHere()}>
              <Field label={t("donor.donorName")}>
                <Input class={targetSize} value={donorName()} onInput={(e) => setDonorName(e.currentTarget.value)} />
              </Field>
            </Show>
          </div>

          <Show when={wasRoundedUp()}>
            <p class="font-sans text-label text-fg-muted">{t("donor.roundedUpFrom", { amount: formatMoney(baseAmountMinor(), props.currency) })}</p>
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
          <p class="font-sans text-body text-fg-muted">
            {tapReading() ? t("donor.contactingSandbox") : nfcActive() ? t("donor.kioskNfcHint") : t("donor.kioskTapHint")}
          </p>
          <Show when={tapReading()}>
            <p class="font-mono text-h3 tabular-nums text-fg">{cardNumber()}</p>
          </Show>

          <Show when={errorKind() === "declined"}>
            <Banner variant="danger">
              <strong class="font-semibold">{t("donor.paymentDeclined")}</strong> {t("donor.paymentDeclinedBody")}
            </Banner>
          </Show>
          <Show when={errorKind() === "cancelled"}>
            <Banner variant="warning">
              <strong class="font-semibold">{t("donor.paymentCancelled")}</strong> {t("donor.tapCancelledBody")}
            </Banner>
          </Show>
          <Show when={errorKind() === "network"}>
            <Banner variant="warning">{t("donor.networkErrorBody")}</Banner>
          </Show>
          <Show when={errorKind() === "offline"}>
            <Banner variant="warning">
              <strong class="font-semibold">{t("donor.offlineQueuedTitle")}</strong> {t("donor.offlineQueuedBody")}
            </Banner>
          </Show>
          <Show when={errorKind() === "other"}>
            <Banner variant="danger">{errorMessage() || t("common.error")}</Banner>
          </Show>

          {/* Terminal simulation controls — a real NFC tap always takes the approved path. */}
          <div class="space-y-2">
            <p class="font-sans text-label uppercase tracking-wide text-fg-muted">{t("donor.simulateTap")}</p>
            <div class="grid grid-cols-2 gap-2">
              <For each={simButtons}>
                {(sim) => (
                  <Button variant="secondary" size="sm" class="min-h-11" disabled={tapReading()} onClick={() => performTap(sim.outcome)}>
                    {t(sim.labelKey)}
                  </Button>
                )}
              </For>
            </div>
            <Show when={nfcActive()}>
              <p class="font-sans text-label text-fg-muted">{t("donor.kioskNfcHint")}</p>
            </Show>
          </div>

          <Button variant="ghost" class={cn("w-full", props.big && "min-h-16 text-h3")} disabled={tapReading()} onClick={() => setStep(0)}>
            {t("donor.back")}
          </Button>
        </section>
      </Show>

      <Show when={step() === 1 && !props.tapToPay}>
        <section class="space-y-4">
          <h1 class="font-display text-h3 font-semibold text-fg">{t("donor.payWith")}</h1>
          <Field label={t("donor.cardNumber")} hint={t("donor.cardHint")} error={cardNumberTouched() ? cardNumberError() : undefined}>
            <Input
              inputmode="numeric"
              autocomplete="cc-number"
              maxlength={CARD_DIGITS + 3}
              class={targetSize}
              invalid={cardNumberTouched() && !!cardNumberError()}
              placeholder="4242 4242 4242 4242"
              value={cardNumber()}
              onBlur={() => setCardNumberTouched(true)}
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
            {(bin) => <p class="font-sans text-label text-fg-muted">{[bin().fundingSource, bin().issuer, bin().country].filter(Boolean).join(" · ")}</p>}
          </Show>
          <div class="grid grid-cols-2 gap-3">
            <Field label={t("donor.cardExpiry")} error={cardExpiryTouched() ? cardExpiryError() : undefined}>
              <Input
                inputmode="numeric"
                autocomplete="cc-exp"
                maxlength={5}
                class={targetSize}
                invalid={cardExpiryTouched() && !!cardExpiryError()}
                placeholder="MM/YY"
                value={cardExpiry()}
                onBlur={() => setCardExpiryTouched(true)}
                onInput={(e) => {
                  const formatted = formatExpiry(e.currentTarget.value);
                  e.currentTarget.value = formatted;
                  setCardExpiry(formatted);
                }}
              />
            </Field>
            <Field label={t("donor.cardCvv")} error={cardCvvTouched() ? cardCvvError() : undefined}>
              <Input
                inputmode="numeric"
                autocomplete="cc-csc"
                maxlength={4}
                class={targetSize}
                invalid={cardCvvTouched() && !!cardCvvError()}
                placeholder="123"
                value={cardCvv()}
                onBlur={() => setCardCvvTouched(true)}
                onInput={(e) => {
                  const v = e.currentTarget.value.replace(/\D/g, "").slice(0, 4);
                  e.currentTarget.value = v;
                  setCardCvv(v);
                }}
              />
            </Field>
          </div>
          <Field label={showOnWall() ? t("donor.donorName") : `${t("donor.donorName")} (${t("donor.optional")})`}>
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
            <Show when={wasRoundedUp()}>
              <div class="flex justify-between">
                <dt class="text-fg-muted">{t("donor.roundUp")}</dt>
                <dd class="text-fg">{t("donor.roundedUpFrom", { amount: formatMoney(baseAmountMinor(), props.currency) })}</dd>
              </div>
            </Show>
            <div class="flex justify-between">
              <dt class="text-fg-muted">{t("donor.frequency")}</dt>
              <dd class="text-fg">{t(frequencyLabelKey[frequency()])}</dd>
            </div>
            <Show when={giftAid()}>
              <div class="flex justify-between">
                <dt class="text-fg-muted">{t("donor.giftAidShort")}</dt>
                <dd class="text-fg">{t("common.yes")}</dd>
              </div>
              <div class="flex justify-between">
                <dt class="text-fg-muted">{t("donor.giftAidFullName")}</dt>
                <dd class="min-w-0 truncate text-fg">{giftAidName()}</dd>
              </div>
              <div class="flex justify-between">
                <dt class="text-fg-muted">{t("donor.giftAidAddress")}</dt>
                <dd class="min-w-0 truncate text-fg">{giftAidAddress()}</dd>
              </div>
            </Show>
            <Show when={showOnWall()}>
              <div class="flex justify-between">
                <dt class="text-fg-muted">{t("donor.supportersWall")}</dt>
                <dd class="text-fg">{donorName().trim() || t("donor.anonymous")}</dd>
              </div>
            </Show>
            <div class="flex justify-between">
              <dt class="text-fg-muted">{t("donor.card")}</dt>
              <dd class="font-mono text-fg">•••• {cardNumber().replace(/\s/g, "").slice(-4).padStart(4, "0")}</dd>
            </div>
          </dl>

          <Show when={errorKind() === "declined"}>
            <Banner variant="danger">
              <strong class="font-semibold">{t("donor.paymentDeclined")}</strong> {t("donor.paymentDeclinedBody")}
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
            <Button class={cn("flex-1", props.big && "min-h-16 text-h3")} loading={submitting()} onClick={() => submit()}>
              {t("donor.submitGift")}
            </Button>
          </div>
        </section>
      </Show>
    </div>
  );
};
