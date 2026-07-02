import { useParams } from "@solidjs/router";

import jsPDF from "jspdf";
import type { Component } from "solid-js";
import { Show, createResource, createSignal } from "solid-js";

import { t } from "~/shared/i18n";
import { formatMoney } from "~/shared/lib/money";
import { createDonation, getReceipt } from "~/shared/api";
import { Banner, Button, Card, ErrorState, Spinner, showToast } from "~/shared/ui";

const frequencyLabelKey = { one_time: "donor.oneTime", monthly: "donor.monthly", roundup: "donor.roundUp" } as const;

const ThanksPage: Component = () => {
  const params = useParams<{ slug: string; reference: string }>();
  const [receipt, { refetch }] = createResource(
    () => ({ slug: params.slug, reference: params.reference }),
    (p) => getReceipt(p.slug, p.reference),
  );
  const [settingUpMonthly, setSettingUpMonthly] = createSignal(false);
  const [monthlyDone, setMonthlyDone] = createSignal(false);

  const downloadPdf = () => {
    const r = receipt();
    if (!r) return;
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("GiveTap receipt", 20, 24);
    doc.setFontSize(11);
    const lines = [
      `Reference: ${r.reference}`,
      `Campaign: ${r.campaignName}`,
      `Amount: ${formatMoney(r.amountMinor, r.currency)}`,
      `Frequency: ${r.frequency}`,
      `Date: ${new Date(r.createdAt).toLocaleString()}`,
    ];
    lines.forEach((line, i) => {
      doc.text(line, 20, 40 + i * 8);
    });
    doc.save(`givetap-receipt-${r.reference}.pdf`);
  };

  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: "GiveTap receipt", url }).catch(() => undefined);
      return;
    }
    await navigator.clipboard.writeText(url);
    showToast(t("donor.shareCopied"), "success");
  };

  const makeMonthly = async () => {
    const r = receipt();
    if (!r) return;
    setSettingUpMonthly(true);
    try {
      await createDonation(params.slug, {
        amountMinor: r.amountMinor,
        currency: r.currency,
        frequency: "monthly",
        donorEmail: r.donorEmail ?? undefined,
        donorName: r.donorName ?? undefined,
        source: "web",
        card: { last4: "4242" },
      });
      setMonthlyDone(true);
      showToast(t("donor.monthlyStarted"), "success");
      refetch();
    } catch {
      showToast(t("common.error"), "danger");
    } finally {
      setSettingUpMonthly(false);
    }
  };

  return (
    <Show when={!receipt.loading} fallback={<Spinner class="mx-auto mt-24" />}>
      <Show when={receipt()} fallback={<ErrorState error={receipt.error} />}>
        {(r) => (
          <div class="space-y-5 text-center">
            <div class="mx-auto flex size-14 items-center justify-center rounded-full bg-positive/12 text-positive">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </div>
            <h1 class="font-display text-h1 font-semibold text-fg">{t("donor.thankYou")}</h1>
            <p class="font-sans text-body text-fg-muted">{r().campaignName}</p>

            <Card padding="md" class="space-y-2 text-left">
              <div class="flex justify-between font-sans text-fs-sm">
                <span class="text-fg-muted">{t("donor.amount")}</span>
                <span class="font-mono font-semibold tabular-nums text-fg">{formatMoney(r().amountMinor, r().currency)}</span>
              </div>
              <div class="flex justify-between font-sans text-fs-sm">
                <span class="text-fg-muted">{t("donor.frequency")}</span>
                <span class="text-fg">{t(frequencyLabelKey[r().frequency])}</span>
              </div>
              <div class="flex justify-between font-sans text-fs-sm">
                <span class="text-fg-muted">{t("donor.reference")}</span>
                <span class="font-mono text-fg">{r().reference}</span>
              </div>
              <div class="flex justify-between font-sans text-fs-sm">
                <span class="text-fg-muted">{t("donor.date")}</span>
                <span class="text-fg">{new Date(r().createdAt).toLocaleString()}</span>
              </div>
            </Card>

            <Show when={monthlyDone()}>
              <Banner variant="neutral">{t("donor.monthlyStarted")}</Banner>
            </Show>

            <div class="grid grid-cols-2 gap-2">
              <Button variant="secondary" class="min-h-[52px]" onClick={downloadPdf}>
                {t("donor.downloadReceipt")}
              </Button>
              <Button variant="secondary" class="min-h-[52px]" onClick={share}>
                {t("donor.shareReceipt")}
              </Button>
            </div>
            <Show when={r().frequency === "one_time" && !monthlyDone()}>
              <Button class="min-h-[52px] w-full" loading={settingUpMonthly()} onClick={makeMonthly}>
                {t("donor.makeItMonthly")}
              </Button>
            </Show>
          </div>
        )}
      </Show>
    </Show>
  );
};

export default ThanksPage;
