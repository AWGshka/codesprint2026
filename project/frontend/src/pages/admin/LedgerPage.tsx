import { createColumnHelper, createSolidTable, flexRender, getCoreRowModel } from "@tanstack/solid-table";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Component } from "solid-js";
import { For, Show, createMemo, createResource, createSignal } from "solid-js";

import { t } from "~/shared/i18n";
import { env } from "~/shared/config/env";
import { can, useAuth } from "~/shared/auth";
import { formatMoney } from "~/shared/lib/money";
import type { DonationLedgerRow, LedgerExportQuery } from "~/shared/api";
import { Badge, Button, Card, EmptyState, ErrorState, Field, Input, Modal, Select, Skeleton, showToast } from "~/shared/ui";
import { adminExportDonationsJson, adminListCampaigns, adminListDonations, ledgerExportUrl, recordClientEvent } from "~/shared/api";

const statusVariant = { completed: "positive", pending: "warning", failed: "danger" } as const;
const columnHelper = createColumnHelper<DonationLedgerRow>();

const PAGE_SIZE = 20;

/** Mirrors the server's `pages` grammar exactly (`DonationService.parsePagesSpec`, run 2 D4):
 * comma-separated 1-indexed page numbers/ranges, e.g. `"1-3,5"`. */
const PAGES_PATTERN = /^\d+(-\d+)?(,\d+(-\d+)?)*$/;

type PagesSpecError = "required" | "invalid";

/** Client-side mirror of the server's validation, so a malformed range never reaches the network. */
const validatePagesSpec = (spec: string): PagesSpecError | undefined => {
  const trimmed = spec.trim();
  if (!trimmed) return "required";
  if (!PAGES_PATTERN.test(trimmed)) return "invalid";
  for (const part of trimmed.split(",")) {
    const [a, b] = part.split("-").map(Number);
    if (a === undefined || a < 1) return "invalid";
    if (b !== undefined && b < a) return "invalid";
  }
  return undefined;
};

/** Rough row-count estimate for a validated `pages` spec - the last page in a range may hold fewer
 * than `pageSize` rows, so this is an upper bound, clamped to the known filtered total. */
const estimateRowsForPages = (spec: string, pageSize: number, total: number): number => {
  let pageCount = 0;
  for (const part of spec.trim().split(",")) {
    const [a, b] = part.split("-").map(Number);
    pageCount += (b ?? a ?? 0) - (a ?? 0) + 1;
  }
  return Math.min(pageCount * pageSize, total);
};

const buildLedgerPdf = (rows: DonationLedgerRow[]) => {
  const doc = new jsPDF();
  doc.setFontSize(14);
  doc.text("GiveTap ledger export", 14, 16);
  autoTable(doc, {
    startY: 22,
    head: [[t("admin.reference"), t("admin.donor"), t("admin.campaign"), t("admin.amount"), t("admin.status"), t("admin.source"), t("admin.createdAtCol")]],
    body: rows.map((r) => [
      r.reference,
      r.donorName ?? "-",
      r.campaignName,
      formatMoney(r.amountMinor, r.currency),
      r.status,
      r.source,
      new Date(r.createdAt).toLocaleString(),
    ]),
    styles: { fontSize: 8 },
  });
  doc.save("givetap-ledger.pdf");
};

const LedgerPage: Component = () => {
  const auth = useAuth();
  const [campaigns] = createResource(() => adminListCampaigns({ pageSize: 200 }));

  const [campaignId, setCampaignId] = createSignal("");
  const [currency, setCurrency] = createSignal("");
  const [status, setStatus] = createSignal("");
  const [source, setSource] = createSignal("");
  const [dateFrom, setDateFrom] = createSignal("");
  const [dateTo, setDateTo] = createSignal("");
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
    q: q() || undefined,
    sort: sortField(),
    dir: sortDir(),
    page: page(),
    pageSize: PAGE_SIZE,
  }));

  const [ledger] = createResource(query, adminListDonations);

  // ---- Export dialog state (D4) ----
  const [exportOpen, setExportOpen] = createSignal(false);
  const [exportFormat, setExportFormat] = createSignal<"csv" | "pdf">("csv");
  const [exportScope, setExportScope] = createSignal<"current" | "all" | "custom">("current");
  const [exportPages, setExportPages] = createSignal("");
  const [pagesTouched, setPagesTouched] = createSignal(false);
  const [exporting, setExporting] = createSignal(false);

  const pagesError = createMemo(() => (exportScope() === "custom" ? validatePagesSpec(exportPages()) : undefined));

  const exportFilters = createMemo<Omit<LedgerExportQuery, "pages" | "pageSize">>(() => ({
    campaignId: campaignId() || undefined,
    currency: currency() || undefined,
    status: status() || undefined,
    source: source() || undefined,
    dateFrom: dateFrom() || undefined,
    dateTo: dateTo() || undefined,
    q: q() || undefined,
    sort: sortField(),
    dir: sortDir(),
  }));

  const exportQuery = createMemo<LedgerExportQuery>(() => {
    const filters = exportFilters();
    if (exportScope() === "current") return { ...filters, pages: String(page()), pageSize: PAGE_SIZE };
    if (exportScope() === "custom") return { ...filters, pages: exportPages().trim(), pageSize: PAGE_SIZE };
    return filters; // "all" - omit `pages`, server returns the full filtered set.
  });

  const exportRowEstimate = createMemo<number | undefined>(() => {
    const total = ledger()?.total ?? 0;
    if (exportScope() === "current") return Math.min(PAGE_SIZE, ledger()?.rows.length ?? 0);
    if (exportScope() === "all") return total;
    if (pagesError()) return undefined;
    return estimateRowsForPages(exportPages(), PAGE_SIZE, total);
  });

  const columns = [
    columnHelper.accessor("reference", { header: t("admin.reference"), cell: (info) => <span class="font-mono text-fs-sm">{info.getValue()}</span> }),
    columnHelper.accessor("donorName", { header: t("admin.donor"), cell: (info) => info.getValue() ?? "-" }),
    columnHelper.accessor("campaignName", { header: t("admin.campaign") }),
    columnHelper.accessor("amountMinor", {
      header: t("admin.amount"),
      cell: (info) => <span class="font-mono tabular-nums">{formatMoney(info.getValue(), info.row.original.currency)}</span>,
    }),
    columnHelper.accessor("status", { header: t("admin.status"), cell: (info) => <Badge variant={statusVariant[info.getValue()]}>{info.getValue()}</Badge> }),
    columnHelper.accessor("source", { header: t("admin.source") }),
    columnHelper.accessor("createdAt", { header: t("admin.createdAtCol"), cell: (info) => new Date(info.getValue()).toLocaleString() }),
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

  const openExport = () => {
    setExportFormat("csv");
    setExportScope("current");
    setExportPages("");
    setPagesTouched(false);
    setExportOpen(true);
  };

  const runExport = async () => {
    if (exportScope() === "custom") {
      setPagesTouched(true);
      if (validatePagesSpec(exportPages())) return;
    }

    setExporting(true);
    try {
      if (exportFormat() === "csv") {
        window.open(ledgerExportUrl(exportQuery(), env.apiBaseUrl), "_blank", "noopener");
        showToast(t("admin.exportCsv"), "success");
        setExportOpen(false);
        return;
      }

      const { rows } = await adminExportDonationsJson(exportQuery());
      buildLedgerPdf(rows);
      try {
        // "ledger" scoped to the current campaign filter when set, otherwise the whole ledger -
        // a stable, human-legible target for the audit trail (D5).
        await recordClientEvent("ledger.export.pdf", {
          targetType: "ledger",
          targetId: campaignId() || "all-campaigns",
          metadata: { rowCount: rows.length, scope: exportScope(), pages: exportQuery().pages },
        });
      } catch {
        // audit write failure shouldn't block the download the user already has
      }
      showToast(t("admin.exportPdf"), "success");
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
          <Button variant="secondary" onClick={openExport}>
            {t("admin.export")}
          </Button>
        </Show>
      </div>

      <div class="flex flex-wrap gap-2">
        <Input placeholder={t("admin.search")} value={q()} onInput={(e) => setQ(e.currentTarget.value)} class="max-w-[200px]" />
        <Select
          class="max-w-[180px]"
          value={campaignId()}
          onChange={(e) => setCampaignId(e.currentTarget.value)}
          options={[{ value: "", label: t("admin.campaign") }, ...(campaigns()?.rows.map((c) => ({ value: c.id, label: c.name })) ?? [])]}
        />
        <Select
          class="max-w-[140px]"
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
          class="max-w-[140px]"
          value={status()}
          onChange={(e) => setStatus(e.currentTarget.value)}
          options={[
            { value: "", label: t("admin.allStatuses") },
            { value: "completed", label: "completed" },
            { value: "pending", label: "pending" },
            { value: "failed", label: "failed" },
          ]}
        />
        <Select
          class="max-w-[140px]"
          value={source()}
          onChange={(e) => setSource(e.currentTarget.value)}
          options={[
            { value: "", label: t("admin.allSources") },
            { value: "web", label: "web" },
            { value: "kiosk", label: "kiosk" },
          ]}
        />
        <Input type="date" value={dateFrom()} onInput={(e) => setDateFrom(e.currentTarget.value)} class="max-w-[160px]" />
        <Input type="date" value={dateTo()} onInput={(e) => setDateTo(e.currentTarget.value)} class="max-w-[160px]" />
      </div>

      <Show when={!ledger.loading} fallback={<Skeleton variant="block" class="h-64" />}>
        <Show when={!ledger.error} fallback={<ErrorState error={ledger.error} />}>
          <Show when={(ledger()?.rows.length ?? 0) > 0} fallback={<EmptyState title={t("admin.noRows")} />}>
            <Card padding="none" class="overflow-x-auto">
              <table class="w-full min-w-[820px] border-collapse">
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

      <Modal open={exportOpen()} onClose={() => setExportOpen(false)} title={t("admin.exportLedger")} class="max-w-lg">
        <div class="space-y-4">
          <Field label={t("admin.exportFormat")}>
            <div class="inline-flex gap-0.5 rounded-md border border-border bg-surface-sunken p-0.5">
              <For each={["csv", "pdf"] as const}>
                {(fmt) => (
                  <button
                    type="button"
                    class={`rounded-md px-3 py-1.5 font-sans text-label font-semibold uppercase transition-colors ${
                      exportFormat() === fmt ? "bg-fg text-white" : "bg-transparent text-fg-muted hover:text-fg"
                    }`}
                    onClick={() => setExportFormat(fmt)}>
                    {fmt}
                  </button>
                )}
              </For>
            </div>
          </Field>

          <Field label={t("admin.exportScope")}>
            <div class="space-y-2">
              <label class="flex items-center gap-2 font-sans text-fs-sm text-fg">
                <input
                  type="radio"
                  name="export-scope"
                  class="size-4 accent-brand"
                  checked={exportScope() === "current"}
                  onChange={() => setExportScope("current")}
                />
                {t("admin.exportScopeCurrent")} ({t("admin.page")} {page()})
              </label>
              <label class="flex items-center gap-2 font-sans text-fs-sm text-fg">
                <input type="radio" name="export-scope" class="size-4 accent-brand" checked={exportScope() === "all"} onChange={() => setExportScope("all")} />
                {t("admin.exportScopeAll")}
              </label>
              <label class="flex items-center gap-2 font-sans text-fs-sm text-fg">
                <input
                  type="radio"
                  name="export-scope"
                  class="size-4 accent-brand"
                  checked={exportScope() === "custom"}
                  onChange={() => setExportScope("custom")}
                />
                {t("admin.exportScopeCustom")}
              </label>
            </div>
          </Field>

          <Show when={exportScope() === "custom"}>
            <Field
              label={t("admin.exportCustomPages")}
              hint={t("admin.exportCustomPagesHint")}
              error={
                pagesTouched() && pagesError() ? (pagesError() === "required" ? t("admin.exportPagesRequired") : t("admin.exportPagesInvalid")) : undefined
              }>
              <Input
                placeholder="1-3,5"
                value={exportPages()}
                invalid={pagesTouched() && Boolean(pagesError())}
                onInput={(e) => {
                  setExportPages(e.currentTarget.value);
                  setPagesTouched(true);
                }}
              />
            </Field>
          </Show>

          <Show when={exportRowEstimate() !== undefined}>
            <p class="font-sans text-label text-fg-muted">
              {t("admin.exportRowEstimate")}: {exportRowEstimate()}
            </p>
          </Show>

          <div class="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setExportOpen(false)}>
              {t("common.close")}
            </Button>
            <Button onClick={runExport} loading={exporting()} disabled={exportScope() === "custom" && Boolean(pagesError()) && pagesTouched()}>
              {t("admin.exportConfirm")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default LedgerPage;
