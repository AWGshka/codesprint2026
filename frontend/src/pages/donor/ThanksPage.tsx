import { useParams } from "@solidjs/router";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Component } from "solid-js";
import { For, Show, createResource, createSignal } from "solid-js";

import { t } from "~/shared/i18n";
import { formatMoney } from "~/shared/lib/money";
import { formatDateTime } from "~/shared/lib/datetime";
import { createDonation, getReceipt, sendReceipt } from "~/shared/api";
import { Banner, Button, Card, ErrorState, Field, Input, Spinner, showToast } from "~/shared/ui";

const frequencyLabelKey = { one_time: "donor.oneTime", monthly: "donor.monthly" } as const;
const methodLabelKey = { card: "donor.methodCard", tap: "donor.methodTap" } as const;

const ThanksPage: Component = () => {
  const params = useParams<{ slug: string; reference: string }>();
  const [receipt, { refetch }] = createResource(
    () => ({ slug: params.slug, reference: params.reference }),
    (p) => getReceipt(p.slug, p.reference),
  );
  const [settingUpMonthly, setSettingUpMonthly] = createSignal(false);
  const [monthlyDone, setMonthlyDone] = createSignal(false);
  const [channel, setChannel] = createSignal<"email" | "sms">("email");
  const [sendTo, setSendTo] = createSignal("");
  const [sending, setSending] = createSignal(false);
  const [sendError, setSendError] = createSignal<string>();

  // Simulated delivery (M1.4): the backend validates + records the send; no
  // real email/SMS leaves the demo.
  const doSendReceipt = async (event: Event) => {
    event.preventDefault();
    setSendError(undefined);
    setSending(true);
    try {
      const result = await sendReceipt(params.slug, params.reference, { channel: channel(), to: sendTo().trim() });
      showToast(t("donor.receiptSent", { to: result.to }), "success");
      setSendTo("");
    } catch (err) {
      setSendError(err instanceof Error ? err.message : t("donor.receiptInvalidDestination"));
    } finally {
      setSending(false);
    }
  };

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
        [t("donor.charity"), "GiveTap"],
        [t("donor.cause"), r.campaignName],
        [t("donor.reference"), r.reference],
        [t("donor.sandboxTxn"), r.paymentRef],
        [t("donor.methodLabel"), t(methodLabelKey[r.method])],
        [t("donor.amount"), formatMoney(r.amountMinor, r.currency)],
        [t("donor.frequency"), t(frequencyLabelKey[r.frequency])],
        [t("donor.date"), formatDateTime(r.createdAt)],
        ...(r.giftAid ? [[t("donor.giftAidShort"), t("common.yes")] as [string, string]] : []),
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

            <Show when={r().status === "offline"}>
              <Banner variant="warning">
                <strong class="block font-semibold">{t("donor.offlineQueuedTitle")}</strong>
                {t("donor.offlineQueuedBody")}
              </Banner>
            </Show>

            {/* Receipt fields per the reference: charity, campaign, date,
                reference, sandbox txn, method, amount (+ donor options). */}
            <Card padding="md" class="space-y-2 text-left">
              <For
                each={[
                  [t("donor.charity"), "GiveTap"],
                  [t("donor.cause"), r().campaignName],
                  [t("donor.date"), formatDateTime(r().createdAt)],
                  [t("donor.reference"), r().reference],
                  [t("donor.sandboxTxn"), r().paymentRef],
                  [t("donor.methodLabel"), t(methodLabelKey[r().method])],
                  [t("donor.frequency"), t(frequencyLabelKey[r().frequency])],
                ]}>
                {(row) => (
                  <div class="flex justify-between gap-4 font-sans text-fs-sm">
                    <span class="shrink-0 text-fg-muted">{row[0]}</span>
                    <span class="min-w-0 truncate font-mono text-fg" title={row[1]}>
                      {row[1]}
                    </span>
                  </div>
                )}
              </For>
              <Show when={r().giftAid}>
                <div class="flex justify-between gap-4 font-sans text-fs-sm">
                  <span class="text-fg-muted">{t("donor.giftAidShort")}</span>
                  <span class="text-fg">{t("common.yes")}</span>
                </div>
              </Show>
              <div class="flex justify-between gap-4 border-t border-border pt-2 font-sans text-fs-sm">
                <span class="text-fg-muted">{t("donor.amount")}</span>
                <span class="font-mono text-h3 font-semibold tabular-nums text-fg">{formatMoney(r().amountMinor, r().currency)}</span>
              </div>
            </Card>

            {/* Send the receipt by email or SMS — simulated delivery (M1.4). */}
            <Card padding="md" class="space-y-3 text-left">
              <h2 class="font-display text-h3 font-semibold text-fg">{t("donor.sendReceiptTitle")}</h2>
              <div class="flex gap-1 rounded-md border border-border bg-surface-sunken p-1">
                <For each={["email", "sms"] as const}>
                  {(option) => (
                    <button
                      type="button"
                      onClick={() => {
                        setChannel(option);
                        setSendError(undefined);
                      }}
                      class={
                        channel() === option
                          ? "min-h-10 flex-1 rounded-sm bg-fg font-sans text-label font-semibold text-surface"
                          : "min-h-10 flex-1 rounded-sm font-sans text-label font-semibold text-fg-muted"
                      }>
                      {option === "email" ? t("donor.receiptEmail") : t("donor.receiptSms")}
                    </button>
                  )}
                </For>
              </div>
              <form class="flex gap-2" onSubmit={doSendReceipt}>
                <Field class="flex-1" error={sendError()}>
                  <Show
                    when={channel() === "sms"}
                    fallback={
                      <Input
                        type="email"
                        class="min-h-11"
                        placeholder={t("donor.receiptEmailPlaceholder")}
                        invalid={Boolean(sendError())}
                        value={sendTo()}
                        onInput={(e) => setSendTo(e.currentTarget.value)}
                        required
                      />
                    }>
                    <div class="flex items-center gap-0">
                      <span class="flex min-h-11 items-center rounded-l-md border border-r-0 border-border bg-surface-sunken px-3 font-mono text-fs-sm text-fg-muted">
                        +356
                      </span>
                      <Input
                        type="tel"
                        class="min-h-11 rounded-l-none"
                        placeholder="XXXX XXXX"
                        maxlength={9}
                        invalid={Boolean(sendError())}
                        value={sendTo().replace(/^\+356\s?/, "")}
                        onInput={(e) => {
                          const digits = e.currentTarget.value.replace(/\D/g, "").slice(0, 8);
                          const formatted = digits.replace(/(\d{4})(?=\d)/, "$1 ");
                          e.currentTarget.value = formatted;
                          setSendTo(digits.length > 0 ? `+356 ${formatted}` : "");
                        }}
                        required
                      />
                    </div>
                  </Show>
                </Field>
                <Button type="submit" class="min-h-11" loading={sending()}>
                  {t("donor.sendReceiptButton")}
                </Button>
              </form>
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
            <Show when={r().frequency === "one_time" && r().status === "completed" && !monthlyDone()}>
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
