import { createColumnHelper, createSolidTable, flexRender, getCoreRowModel } from "@tanstack/solid-table";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Component } from "solid-js";
import { For, Show, createMemo, createResource, createSignal } from "solid-js";

import { t } from "~/shared/i18n";
import { env } from "~/shared/config/env";
import { can, useAuth } from "~/shared/auth";
import { parsePages } from "~/shared/lib/pages";
import { formatMoney } from "~/shared/lib/money";
import type { DonationLedgerRow } from "~/shared/api";
import { formatDateTime } from "~/shared/lib/datetime";
import { adminListCampaigns, adminListDonations, ledgerExportUrl, recordClientEvent } from "~/shared/api";
import { Badge, Button, Card, EmptyState, ErrorState, Field, Input, Modal, Select, Skeleton, showToast } from "~/shared/ui";

const statusVariant = { completed: "positive", declined: "danger", refunded: "neutral", offline: "warning" } as const;
const columnHelper = createColumnHelper<DonationLedgerRow>();

const PAGE_SIZE = 20;
// In-browser jsPDF/autoTable rendering doesn't scale to the server's 50k export cap — cap the
// "all filtered rows" / custom-pages PDF scope client-side so the tab doesn't hang. CSV export
// (a server-streamed download) is not affected by this cap.
const MAX_PDF_ROWS = 2000;
type ExportFormat = "csv" | "pdf";
type ExportScope = "current" | "all" | "custom";

const LedgerPage: Component = () => {
  const auth = useAuth();
  const [campaigns] = createResource(() => adminListCampaigns({ pageSize: 200 }));

  const [campaignId, setCampaignId] = createSignal("");
  const [currency, setCurrency] = createSignal("");
  const [status, setStatus] = createSignal("");
  const [source, setSource] = createSignal("");
  const [dateFrom, setDateFrom] = createSignal("");
  const [dateTo, setDateTo] = createSignal("");
  const [minEUR, setMinEUR] = createSignal("");
  const [maxEUR, setMaxEUR] = createSignal("");
  const [q, setQ] = createSignal("");
  const [page, setPage] = createSignal(1);
  const [sortField, setSortField] = createSignal("createdAt");
  const [sortDir, setSortDir] = createSignal<"asc" | "desc">("desc");

  const query = createMemo(() => ({
    campaignId: campaignId() || undefined,
    currency: currency() || undefined,
    status: status() || undefined,
    source: source() || undefined,
    dateFrom: dateFrom() || undefined,
    dateTo: dateTo() || undefined,
    // Major-unit € inputs → minor units for the API's EUR-normalised bounds.
    minEURMinor: minEUR() ? Math.round(Number.parseFloat(minEUR()) * 100) : undefined,
    maxEURMinor: maxEUR() ? Math.round(Number.parseFloat(maxEUR()) * 100) : undefined,
    q: q() || undefined,
    sort: sortField(),
    dir: sortDir(),
    page: page(),
    pageSize: PAGE_SIZE,
  }));

  const [ledger] = createResource(query, adminListDonations);

  const columns = [
    columnHelper.accessor("reference", { header: t("admin.reference"), cell: (info) => <span class="font-mono text-fs-sm">{info.getValue()}</span> }),
    columnHelper.accessor("donorName", { header: t("admin.donor"), cell: (info) => info.getValue() ?? "-" }),
    columnHelper.accessor("campaignName", { header: t("admin.campaign") }),
    columnHelper.accessor("amountMinor", {
      header: t("admin.amount"),
      cell: (info) => <span class="font-mono tabular-nums">{formatMoney(info.getValue(), info.row.original.currency)}</span>,
    }),
    columnHelper.accessor("status", { header: t("admin.status"), cell: (info) => <Badge variant={statusVariant[info.getValue()]}>{info.getValue()}</Badge> }),
    columnHelper.accessor("method", { header: t("admin.method"), cell: (info) => (info.getValue() === "tap" ? t("donor.methodTap") : t("donor.methodCard")) }),
    // Donor options at a glance: round-up and Gift Aid flags.
    columnHelper.display({
      id: "flags",
      header: t("admin.details"),
      cell: (info) => (
        <span class="flex gap-1">
          <Show when={info.row.original.roundedUp}>
            <Badge variant="neutral">{t("admin.roundedUpFlag")}</Badge>
          </Show>
          <Show when={info.row.original.giftAid}>
            <Badge variant="neutral">{t("admin.giftAidFlag")}</Badge>
          </Show>
        </span>
      ),
    }),
    columnHelper.accessor("createdAt", { header: t("admin.createdAtCol"), cell: (info) => formatDateTime(info.getValue()) }),
  ];

  const table = createSolidTable({
    get data() {
      return ledger()?.rows ?? [];
    },
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const toggleSort = (field: string) => {
    if (sortField() === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  // ---- Export scope dialog ----
  const [exportOpen, setExportOpen] = createSignal(false);
  const [exportFormat, setExportFormat] = createSignal<ExportFormat>("csv");
  const [exportScope, setExportScope] = createSignal<ExportScope>("all");
  const [customPages, setCustomPages] = createSignal("");
  const [customPagesError, setCustomPagesError] = createSignal<string>();
  const [exporting, setExporting] = createSignal(false);

  const openExportDialog = (format: ExportFormat) => {
    setExportFormat(format);
    setExportScope("all");
    setCustomPages("");
    setCustomPagesError(undefined);
    setExportOpen(true);
  };

  /** Fetches the rows for a given page-scope via the same filtered/sorted ledger endpoint the
   * table already uses — looping pages as needed, capped at MAX_PDF_ROWS for in-browser rendering. */
  const fetchScopedRows = async (pages: number[] | undefined): Promise<DonationLedgerRow[]> => {
    if (pages && pages.length > 0) {
      const rows: DonationLedgerRow[] = [];
      for (const p of pages) {
        if (rows.length >= MAX_PDF_ROWS) break;
        const res = await adminListDonations({ ...query(), page: p, pageSize: PAGE_SIZE });
        rows.push(...res.rows);
      }
      return rows.slice(0, MAX_PDF_ROWS);
    }
    // "All filtered rows" — loop sequential pages until every row is covered or the cap is hit.
    const first = await adminListDonations({ ...query(), page: 1, pageSize: PAGE_SIZE });
    const rows = [...first.rows];
    const lastPage = Math.min(Math.ceil(first.total / PAGE_SIZE), Math.ceil(MAX_PDF_ROWS / PAGE_SIZE));
    for (let p = 2; p <= lastPage && rows.length < MAX_PDF_ROWS; p++) {
      const res = await adminListDonations({ ...query(), page: p, pageSize: PAGE_SIZE });
      rows.push(...res.rows);
    }
    return rows.slice(0, MAX_PDF_ROWS);
  };

  const exportPdf = async (rows: DonationLedgerRow[]) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Brand header band + export context (when, how many rows)
    doc.setFillColor(14, 140, 122);
    doc.rect(0, 0, pageWidth, 26, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("GiveTap", 14, 11);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(t("admin.ledger"), 14, 19);
    doc.text(`${formatDateTime(new Date())} · ${rows.length} rows`, pageWidth - 14, 19, { align: "right" });

    autoTable(doc, {
      startY: 32,
      head: [
        [
          t("admin.reference"),
          t("admin.donor"),
          t("admin.campaign"),
          t("admin.amount"),
          t("admin.status"),
          t("admin.method"),
          t("admin.source"),
          t("admin.createdAtCol"),
        ],
      ],
      body: rows.map((r) => [
        r.reference,
        r.donorName ?? "-",
        r.campaignName,
        formatMoney(r.amountMinor, r.currency),
        r.status,
        r.method,
        r.source,
        formatDateTime(r.createdAt),
      ]),
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [14, 140, 122], textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [246, 249, 248] },
      columnStyles: { 3: { halign: "right", fontStyle: "bold" } },
    });
    doc.save("givetap-ledger.pdf");
    try {
      await recordClientEvent("ledger.export.pdf", { rowCount: rows.length });
    } catch {
      // audit write failure shouldn't block the download the user already has
    }
    showToast(t("admin.exportPdf"), "success");
  };

  const confirmExport = async () => {
    let pages: number[] | undefined;
    if (exportScope() === "current") {
      pages = [page()];
    } else if (exportScope() === "custom") {
      try {
        pages = parsePages(customPages());
      } catch {
        setCustomPagesError(t("admin.invalidPages"));
        return;
      }
    }
    setCustomPagesError(undefined);

    setExporting(true);
    try {
      if (exportFormat() === "csv") {
        const url = ledgerExportUrl({ ...query(), pages: pages?.join(",") }, env.apiBaseUrl);
        window.open(url, "_blank", "noopener");
      } else {
        const rows = exportScope() === "current" ? (ledger()?.rows ?? []) : await fetchScopedRows(pages);
        await exportPdf(rows);
      }
      setExportOpen(false);
    } catch {
      showToast(t("common.error"), "danger");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div class="space-y-5">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h1 class="font-display text-h1 font-semibold text-fg">{t("admin.ledger")}</h1>
        <Show when={can.exportLedger(auth.role())}>
          <div class="flex gap-2">
            <Button variant="secondary" onClick={() => openExportDialog("csv")}>
              {t("admin.exportCsv")}
            </Button>
            <Button variant="secondary" onClick={() => openExportDialog("pdf")}>
              {t("admin.exportPdf")}
            </Button>
          </div>
        </Show>
      </div>

      <div class="flex flex-wrap gap-2">
        <Input placeholder={t("admin.searchRefOrTxn")} value={q()} onInput={(e) => setQ(e.currentTarget.value)} class="max-w-56" />
        <Select
          class="max-w-45"
          value={campaignId()}
          onChange={(e) => setCampaignId(e.currentTarget.value)}
          options={[{ value: "", label: t("admin.campaign") }, ...(campaigns()?.rows.map((c) => ({ value: c.id, label: c.name })) ?? [])]}
        />
        <Select
          class="max-w-35"
          value={currency()}
          onChange={(e) => setCurrency(e.currentTarget.value)}
          options={[
            { value: "", label: t("admin.allCurrencies") },
            { value: "EUR", label: "EUR" },
            { value: "USD", label: "USD" },
            { value: "GBP", label: "GBP" },
          ]}
        />
        <Select
          class="max-w-35"
          value={status()}
          onChange={(e) => setStatus(e.currentTarget.value)}
          options={[
            { value: "", label: t("admin.allStatuses") },
            { value: "completed", label: t("admin.statusCompleted") },
            { value: "declined", label: t("admin.statusDeclined") },
            { value: "refunded", label: t("admin.statusRefunded") },
            { value: "offline", label: t("admin.statusOffline") },
          ]}
        />
        <Select
          class="max-w-35"
          value={source()}
          onChange={(e) => setSource(e.currentTarget.value)}
          options={[
            { value: "", label: t("admin.allSources") },
            { value: "web", label: "web" },
            { value: "kiosk", label: "kiosk" },
          ]}
        />
        <Input type="date" value={dateFrom()} onInput={(e) => setDateFrom(e.currentTarget.value)} class="max-w-40" />
        <Input type="date" value={dateTo()} onInput={(e) => setDateTo(e.currentTarget.value)} class="max-w-40" />
        <Input
          type="number"
          min="0"
          step="0.01"
          inputmode="decimal"
          placeholder={t("admin.minAmountEUR")}
          value={minEUR()}
          onInput={(e) => setMinEUR(e.currentTarget.value)}
          class="max-w-28"
        />
        <Input
          type="number"
          min="0"
          step="0.01"
          inputmode="decimal"
          placeholder={t("admin.maxAmountEUR")}
          value={maxEUR()}
          onInput={(e) => setMaxEUR(e.currentTarget.value)}
          class="max-w-28"
        />
      </div>

      <Show when={!ledger.loading} fallback={<Skeleton variant="block" class="h-64" />}>
        <Show when={!ledger.error} fallback={<ErrorState error={ledger.error} />}>
          <Show when={(ledger()?.rows.length ?? 0) > 0} fallback={<EmptyState title={t("admin.noRows")} />}>
            <Card padding="none" class="overflow-x-auto">
              <table class="w-full min-w-205 border-collapse">
                <thead>
                  <For each={table.getHeaderGroups()}>
                    {(headerGroup) => (
                      <tr class="bg-surface-sunken text-left">
                        <For each={headerGroup.headers}>
                          {(header) => (
                            <th
                              class="cursor-pointer px-4 py-2.5 font-sans text-label font-semibold uppercase tracking-wide text-fg-muted"
                              onClick={() => toggleSort(header.column.id)}>
                              {flexRender(header.column.columnDef.header, header.getContext())}
                              <Show when={sortField() === header.column.id}>{sortDir() === "asc" ? " ▲" : " ▼"}</Show>
                            </th>
                          )}
                        </For>
                      </tr>
                    )}
                  </For>
                </thead>
                <tbody>
                  <For each={table.getRowModel().rows}>
                    {(row) => (
                      <tr class="border-t border-border font-sans text-fs-sm text-fg">
                        <For each={row.getVisibleCells()}>
                          {(cell) => <td class="px-4 py-2.5">{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>}
                        </For>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </Card>

            <div class="flex items-center justify-between font-sans text-fs-sm text-fg-muted">
              <span>
                {t("admin.page")} {page()} {t("admin.of")} {Math.max(1, Math.ceil((ledger()?.total ?? 0) / PAGE_SIZE))}
              </span>
              <div class="flex gap-2">
                <Button size="sm" variant="secondary" disabled={page() <= 1} onClick={() => setPage((p) => p - 1)}>
                  {t("common.back")}
                </Button>
                <Button size="sm" variant="secondary" disabled={page() * PAGE_SIZE >= (ledger()?.total ?? 0)} onClick={() => setPage((p) => p + 1)}>
                  {t("common.next")}
                </Button>
              </div>
            </div>
          </Show>
        </Show>
      </Show>

      <Modal open={exportOpen()} onClose={() => setExportOpen(false)} title={t("admin.exportOptions")}>
        <div class="space-y-4">
          <fieldset class="space-y-2">
            <legend class="mb-1 font-sans text-label font-semibold text-fg-muted">{t("admin.exportScope")}</legend>
            <label class="flex items-center gap-2 font-sans text-fs-sm text-fg">
              <input type="radio" name="export-scope" class="accent-brand" checked={exportScope() === "current"} onChange={() => setExportScope("current")} />
              {t("admin.scopeCurrentPage")}
            </label>
            <label class="flex items-center gap-2 font-sans text-fs-sm text-fg">
              <input type="radio" name="export-scope" class="accent-brand" checked={exportScope() === "all"} onChange={() => setExportScope("all")} />
              {t("admin.scopeAllFiltered")}
            </label>
            <label class="flex items-center gap-2 font-sans text-fs-sm text-fg">
              <input type="radio" name="export-scope" class="accent-brand" checked={exportScope() === "custom"} onChange={() => setExportScope("custom")} />
              {t("admin.scopeCustom")}
            </label>
          </fieldset>

          <Show when={exportScope() === "custom"}>
            <Field label={t("admin.customPagesLabel")} hint={t("admin.customPagesHint")} error={customPagesError()}>
              <Input
                placeholder={t("admin.customPagesPlaceholder")}
                value={customPages()}
                onInput={(e) => {
                  setCustomPages(e.currentTarget.value);
                  setCustomPagesError(undefined);
                }}
              />
            </Field>
          </Show>

          <div class="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setExportOpen(false)}>
              {t("common.close")}
            </Button>
            <Button onClick={confirmExport} loading={exporting()}>
              {t("admin.export")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default LedgerPage;
