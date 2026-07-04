import type { Component } from "solid-js";
import { For, Show, createMemo, createResource, createSignal } from "solid-js";

import { t } from "~/shared/i18n";
import { can, useAuth } from "~/shared/auth";
import { formatMoney } from "~/shared/lib/money";
import { formatDateTime } from "~/shared/lib/datetime";
import type { ReconciliationRow, ReconciliationStatus } from "~/shared/api";
import { getReconciliation, reconcileAutoMatch, reconcileMatch } from "~/shared/api";
import { Badge, Button, Card, EmptyState, ErrorState, Input, Select, Skeleton, StatCard, showToast } from "~/shared/ui";

const statusVariant: Record<ReconciliationStatus, "positive" | "warning" | "danger"> = {
  matched: "positive",
  mismatched: "danger",
  missingInProcessor: "warning",
  missingInApp: "warning",
};

const statusLabelKey: Record<ReconciliationStatus, "admin.unmatchedChip" | "admin.mismatched" | "admin.missingInProcessor" | "admin.missingInApp"> = {
  matched: "admin.unmatchedChip",
  mismatched: "admin.mismatched",
  missingInProcessor: "admin.missingInProcessor",
  missingInApp: "admin.missingInApp",
};

const headerCell = "px-4 py-2.5 font-sans text-label font-semibold uppercase tracking-wide text-fg-muted";

const amountOf = (row: ReconciliationRow) => row.donation ?? row.settlement;

const PAGE_SIZE = 15;

const matchesSearch = (row: ReconciliationRow, term: string): boolean => {
  if (!term) return true;
  const lower = term.toLowerCase();
  return row.paymentRef.toLowerCase().includes(lower) || (row.reference?.toLowerCase().includes(lower) ?? false);
};

const ReconciliationPage: Component = () => {
  const auth = useAuth();
  const [result, { refetch }] = createResource(getReconciliation);
  const [autoMatching, setAutoMatching] = createSignal(false);
  const [matchingRef, setMatchingRef] = createSignal<string>();

  // Filters
  const [search, setSearch] = createSignal("");
  const [statusFilter, setStatusFilter] = createSignal("");

  // Pagination
  const [awaitingPage, setAwaitingPage] = createSignal(1);
  const [matchedPage, setMatchedPage] = createSignal(1);

  // Reset pages when filters change
  const updateSearch = (v: string) => {
    setSearch(v);
    setAwaitingPage(1);
    setMatchedPage(1);
  };
  const updateStatus = (v: string) => {
    setStatusFilter(v);
    setAwaitingPage(1);
  };

  const filteredAwaiting = createMemo(() => {
    const rows = (result()?.rows ?? []).filter((r) => !r.reconciled);
    const term = search();
    const status = statusFilter();
    return rows
      .filter((r) => matchesSearch(r, term))
      .filter((r) => !status || r.status === status)
      .sort((a, b) => (b.occurredAt ?? "").localeCompare(a.occurredAt ?? ""));
  });

  const filteredMatched = createMemo(() => {
    const rows = (result()?.rows ?? []).filter((r) => r.reconciled);
    const term = search();
    return rows.filter((r) => matchesSearch(r, term)).sort((a, b) => (b.matchedAt ?? "").localeCompare(a.matchedAt ?? ""));
  });

  const awaitingPageCount = createMemo(() => Math.max(1, Math.ceil(filteredAwaiting().length / PAGE_SIZE)));
  const matchedPageCount = createMemo(() => Math.max(1, Math.ceil(filteredMatched().length / PAGE_SIZE)));

  const pagedAwaiting = createMemo(() => {
    const start = (awaitingPage() - 1) * PAGE_SIZE;
    return filteredAwaiting().slice(start, start + PAGE_SIZE);
  });

  const pagedMatched = createMemo(() => {
    const start = (matchedPage() - 1) * PAGE_SIZE;
    return filteredMatched().slice(start, start + PAGE_SIZE);
  });

  const statusOptions = [
    { value: "", label: t("admin.allStatuses") },
    { value: "matched", label: t("admin.unmatchedChip") },
    { value: "mismatched", label: t("admin.mismatched") },
    { value: "missingInProcessor", label: t("admin.missingInProcessor") },
    { value: "missingInApp", label: t("admin.missingInApp") },
  ];

  const runAutoMatch = async () => {
    setAutoMatching(true);
    try {
      const { matchedCount } = await reconcileAutoMatch();
      showToast(t("admin.autoMatchedToast", { count: String(matchedCount) }), "success");
      await refetch();
    } catch {
      showToast(t("common.error"), "danger");
    } finally {
      setAutoMatching(false);
    }
  };

  const runMatchOne = async (row: ReconciliationRow) => {
    setMatchingRef(row.paymentRef);
    try {
      await reconcileMatch(row.paymentRef);
      showToast(t("admin.reconciledToast", { ref: row.reference ?? row.paymentRef }), "success");
      await refetch();
    } catch {
      showToast(t("common.error"), "danger");
    } finally {
      setMatchingRef(undefined);
    }
  };

  return (
    <div class="space-y-5">
      <h1 class="font-display text-h1 font-semibold text-fg">{t("admin.reconciliation")}</h1>

      <Show when={result() || !result.loading} fallback={<Skeleton variant="block" class="h-24" />}>
        <Show when={!result.error} fallback={<ErrorState error={result.error} />}>
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard label={t("admin.matched")} value={result()?.summary.matched ?? 0} hint={t("admin.sandboxToLedger")} />
            <StatCard label={t("admin.awaitingMatch")} value={result()?.summary.awaiting ?? 0} hint={t("admin.needsReview")} />
            <StatCard label={t("admin.matchRate")} value={`${Math.round((result()?.summary.matchRate ?? 0) * 100)}%`} hint={t("admin.ofTracked")} />
          </div>

          {/* Filters */}
          <div class="flex flex-wrap items-end gap-3">
            <Input placeholder={t("admin.searchRefOrTxn")} value={search()} onInput={(e) => updateSearch(e.currentTarget.value)} class="max-w-64" />
            <Select value={statusFilter()} onChange={(e) => updateStatus(e.currentTarget.value)} options={statusOptions} class="max-w-48" />
          </div>

          {/* Awaiting reconciliation */}
          <Card padding="none">
            <div class="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
              <h2 class="font-display text-h3 font-semibold text-fg">
                {t("admin.awaitingTable")} ({filteredAwaiting().length})
              </h2>
              <Show when={can.reconcile(auth.role())}>
                <Button size="sm" onClick={runAutoMatch} loading={autoMatching()}>
                  {t("admin.autoMatchAll")}
                </Button>
              </Show>
            </div>
            <Show when={pagedAwaiting().length > 0} fallback={<EmptyState title={t("admin.noAwaitingRows")} />}>
              <div class="overflow-x-auto">
                <table class="w-full min-w-180 border-collapse">
                  <thead>
                    <tr class="bg-surface-sunken text-left">
                      <th class={headerCell}>{t("admin.reference")}</th>
                      <th class={headerCell}>{t("donor.sandboxTxn")}</th>
                      <th class={`${headerCell} text-right`}>{t("admin.amount")}</th>
                      <th class={headerCell}>{t("admin.createdAtCol")}</th>
                      <th class={headerCell}>{t("admin.status")}</th>
                      <Show when={can.reconcile(auth.role())}>
                        <th class={headerCell} />
                      </Show>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={pagedAwaiting()}>
                      {(row) => (
                        <tr class="border-t border-border font-sans text-fs-sm text-fg">
                          <td class="px-4 py-2.5 font-mono">{row.reference ?? "-"}</td>
                          <td class="max-w-45 truncate px-4 py-2.5 font-mono text-fg-muted" title={row.paymentRef}>
                            {row.paymentRef}
                          </td>
                          <td class="px-4 py-2.5 text-right font-mono tabular-nums">
                            {(() => {
                              const side = amountOf(row);
                              return side ? formatMoney(side.amountMinor, side.currency) : "-";
                            })()}
                          </td>
                          <td class="px-4 py-2.5 text-fg-muted">{row.occurredAt ? formatDateTime(row.occurredAt) : "-"}</td>
                          <td class="px-4 py-2.5">
                            <Badge variant={row.status === "matched" ? "danger" : statusVariant[row.status]}>{t(statusLabelKey[row.status])}</Badge>
                          </td>
                          <Show when={can.reconcile(auth.role())}>
                            <td class="px-4 py-2.5 text-right">
                              <Button size="sm" variant="secondary" loading={matchingRef() === row.paymentRef} onClick={() => runMatchOne(row)}>
                                {t("admin.reconcileAction")}
                              </Button>
                            </td>
                          </Show>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </div>
            </Show>
            <Show when={filteredAwaiting().length > PAGE_SIZE}>
              <div class="flex items-center justify-between border-t border-border px-4 py-2.5 font-sans text-fs-sm text-fg-muted">
                <span>
                  {t("admin.page")} {awaitingPage()} {t("admin.of")} {awaitingPageCount()}
                </span>
                <div class="flex gap-2">
                  <Button size="sm" variant="secondary" disabled={awaitingPage() <= 1} onClick={() => setAwaitingPage((p) => p - 1)}>
                    {t("common.back")}
                  </Button>
                  <Button size="sm" variant="secondary" disabled={awaitingPage() >= awaitingPageCount()} onClick={() => setAwaitingPage((p) => p + 1)}>
                    {t("common.next")}
                  </Button>
                </div>
              </div>
            </Show>
          </Card>

          {/* Matched */}
          <Card padding="none">
            <div class="border-b border-border px-4 py-3">
              <h2 class="font-display text-h3 font-semibold text-fg">
                {t("admin.matchedTable")} ({filteredMatched().length})
              </h2>
            </div>
            <Show when={pagedMatched().length > 0} fallback={<EmptyState title={t("admin.noRows")} />}>
              <div class="overflow-x-auto">
                <table class="w-full min-w-180 border-collapse">
                  <thead>
                    <tr class="bg-surface-sunken text-left">
                      <th class={headerCell}>{t("admin.reference")}</th>
                      <th class={headerCell}>{t("donor.sandboxTxn")}</th>
                      <th class={`${headerCell} text-right`}>{t("admin.amount")}</th>
                      <th class={headerCell}>{t("admin.status")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={pagedMatched()}>
                      {(row) => (
                        <tr class="border-t border-border font-sans text-fs-sm text-fg">
                          <td class="px-4 py-2.5 font-mono">{row.reference ?? "-"}</td>
                          <td class="max-w-45 truncate px-4 py-2.5 font-mono text-fg-muted" title={row.paymentRef}>
                            {row.paymentRef}
                          </td>
                          <td class="px-4 py-2.5 text-right font-mono tabular-nums">
                            {(() => {
                              const side = amountOf(row);
                              return side ? formatMoney(side.amountMinor, side.currency) : "-";
                            })()}
                          </td>
                          <td class="px-4 py-2.5">
                            <span class="flex items-center gap-1.5">
                              <Badge variant="positive">{t("admin.matchedChip")}</Badge>
                              <Show when={row.matchMethod}>
                                <Badge variant="neutral">{row.matchMethod === "manual" ? t("admin.manualChip") : t("admin.autoChip")}</Badge>
                              </Show>
                            </span>
                          </td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </div>
            </Show>
            <Show when={filteredMatched().length > PAGE_SIZE}>
              <div class="flex items-center justify-between border-t border-border px-4 py-2.5 font-sans text-fs-sm text-fg-muted">
                <span>
                  {t("admin.page")} {matchedPage()} {t("admin.of")} {matchedPageCount()}
                </span>
                <div class="flex gap-2">
                  <Button size="sm" variant="secondary" disabled={matchedPage() <= 1} onClick={() => setMatchedPage((p) => p - 1)}>
                    {t("common.back")}
                  </Button>
                  <Button size="sm" variant="secondary" disabled={matchedPage() >= matchedPageCount()} onClick={() => setMatchedPage((p) => p + 1)}>
                    {t("common.next")}
                  </Button>
                </div>
              </div>
            </Show>
          </Card>
        </Show>
      </Show>
    </div>
  );
};

export default ReconciliationPage;
