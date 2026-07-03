import { useParams } from "@solidjs/router";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Component } from "solid-js";
import { Show, createResource, createSignal } from "solid-js";

import { t } from "~/shared/i18n";
import { formatMoney } from "~/shared/lib/money";
import { formatDateTime } from "~/shared/lib/datetime";
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
    const pageWidth = doc.internal.pageSize.getWidth();
    const brand: [number, number, number] = [14, 140, 122];

    // Brand header band
    doc.setFillColor(...brand);
    doc.rect(0, 0, pageWidth, 34, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("GiveTap", 16, 15);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(t("donor.receiptTitle"), 16, 24);
    doc.setFontSize(10);
    doc.text(r.reference, pageWidth - 16, 24, { align: "right" });

    // Headline amount
    doc.setTextColor(30, 30, 34);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(26);
    doc.text(formatMoney(r.amountMinor, r.currency), 16, 52);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(107, 107, 114);
    doc.text(`${t("donor.receiptTo")} ${r.campaignName}`, 16, 60);

    autoTable(doc, {
      startY: 70,
      theme: "plain",
      styles: { fontSize: 11, cellPadding: { top: 3, bottom: 3, left: 0, right: 8 } },
      columnStyles: { 0: { textColor: [107, 107, 114], cellWidth: 45 }, 1: { fontStyle: "bold" } },
      body: [
        [t("donor.reference"), r.reference],
        [t("donor.cause"), r.campaignName],
        [t("donor.amount"), formatMoney(r.amountMinor, r.currency)],
        [t("donor.frequency"), t(frequencyLabelKey[r.frequency])],
        [t("donor.date"), formatDateTime(r.createdAt)],
        ...(r.donorName ? [[t("donor.donorName"), r.donorName] as [string, string]] : []),
      ],
      didDrawCell: (data) => {
        // hairline divider under each row (draw once per row, from the first column)
        if (data.column.index !== 0) return;
        doc.setDrawColor(230, 230, 233);
        doc.line(16, data.cell.y + data.cell.height, pageWidth - 16, data.cell.y + data.cell.height);
      },
    });

    doc.setFontSize(9);
    doc.setTextColor(150, 150, 156);
    doc.text(t("donor.receiptFooter"), 16, 285);
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
                <span class="text-fg">{formatDateTime(r().createdAt)}</span>
              </div>
            </Card>

            <Show when={monthlyDone()}>
              <Banner variant="neutral">{t("donor.monthlyStarted")}</Banner>
            </Show>

            <div class="grid grid-cols-2 gap-2">
              <Button variant="secondary" class="min-h-13" onClick={downloadPdf}>
                {t("donor.downloadReceipt")}
              </Button>
              <Button variant="secondary" class="min-h-13" onClick={share}>
                {t("donor.shareReceipt")}
              </Button>
            </div>
            <Show when={r().frequency === "one_time" && !monthlyDone()}>
              <Button class="min-h-13 w-full" loading={settingUpMonthly()} onClick={makeMonthly}>
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
