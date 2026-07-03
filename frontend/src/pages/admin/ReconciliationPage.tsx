import type { Component } from "solid-js";
import { For, Show, createMemo, createResource, createSignal } from "solid-js";

import { t } from "~/shared/i18n";
import { getReconciliation } from "~/shared/api";
import { formatMoney } from "~/shared/lib/money";
import type { ReconciliationRow, ReconciliationStatus } from "~/shared/api";
import { Badge, Card, EmptyState, ErrorState, Skeleton, StatCard, Tabs } from "~/shared/ui";

const statusVariant: Record<ReconciliationStatus, "positive" | "warning" | "danger"> = {
  matched: "positive",
  mismatched: "danger",
  missingInProcessor: "warning",
  missingInApp: "warning",
};

const tabLabelKey: Record<ReconciliationStatus, "admin.matched" | "admin.mismatched" | "admin.missingInProcessor" | "admin.missingInApp"> = {
  matched: "admin.matched",
  mismatched: "admin.mismatched",
  missingInProcessor: "admin.missingInProcessor",
  missingInApp: "admin.missingInApp",
};

const ReconciliationPage: Component = () => {
  const [result] = createResource(getReconciliation);
  const [tab, setTab] = createSignal<"all" | ReconciliationStatus>("all");

  const rows = createMemo<ReconciliationRow[]>(() => {
    const all = result()?.rows ?? [];
    return tab() === "all" ? all : all.filter((r) => r.status === tab()).sort((a, b) => a.paymentRef.localeCompare(b.paymentRef));
  });

  return (
    <div class="space-y-5">
      <h1 class="font-display text-h1 font-semibold text-fg">{t("admin.reconciliationSummary")}</h1>

      <Show when={!result.loading} fallback={<Skeleton variant="block" class="h-24" />}>
        <Show when={!result.error} fallback={<ErrorState error={result.error} />}>
          <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label={t("admin.matched")} value={result()?.summary.matched ?? 0} />
            <StatCard label={t("admin.mismatched")} value={result()?.summary.mismatched ?? 0} />
            <StatCard label={t("admin.missingInProcessor")} value={result()?.summary.missingInProcessor ?? 0} />
            <StatCard label={t("admin.missingInApp")} value={result()?.summary.missingInApp ?? 0} />
          </div>

          <Tabs
            value={tab()}
            onChange={(v) => setTab(v as "all" | ReconciliationStatus)}
            items={[
              { value: "all", label: t("admin.filters") },
              { value: "matched", label: t("admin.matched") },
              { value: "mismatched", label: t("admin.mismatched") },
              { value: "missingInProcessor", label: t("admin.missingInProcessor") },
              { value: "missingInApp", label: t("admin.missingInApp") },
            ]}
          />

          <Show when={rows().length > 0} fallback={<EmptyState title={t("admin.noRows")} />}>
            <Card padding="none" class="overflow-x-auto">
              <table class="w-full min-w-180 border-collapse">
                <thead>
                  <tr class="bg-surface-sunken text-left">
                    <th class="px-4 py-2.5 font-sans text-label font-semibold uppercase tracking-wide text-fg-muted">{t("admin.paymentRef")}</th>
                    <th class="px-4 py-2.5 font-sans text-label font-semibold uppercase tracking-wide text-fg-muted">{t("admin.status")}</th>
                    <th class="px-4 py-2.5 text-right font-sans text-label font-semibold uppercase tracking-wide text-fg-muted">{t("admin.appSide")}</th>
                    <th class="px-4 py-2.5 text-right font-sans text-label font-semibold uppercase tracking-wide text-fg-muted">{t("admin.processorSide")}</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={rows()}>
                    {(row) => (
                      <tr class="border-t border-border font-sans text-fs-sm text-fg">
                        <td class="px-4 py-2.5 font-mono">{row.paymentRef}</td>
                        <td class="px-4 py-2.5">
                          <Badge variant={statusVariant[row.status]}>{t(tabLabelKey[row.status])}</Badge>
                        </td>
                        <td class="px-4 py-2.5 text-right font-mono tabular-nums">
                          {row.donation ? formatMoney(row.donation.amountMinor, row.donation.currency) : "-"}
                        </td>
                        <td class="px-4 py-2.5 text-right font-mono tabular-nums">
                          {row.settlement ? formatMoney(row.settlement.amountMinor, row.settlement.currency) : "-"}
                        </td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </Card>
          </Show>
        </Show>
      </Show>
    </div>
  );
};

export default ReconciliationPage;
