import type { Component } from "solid-js";
import { For, Show, createMemo, createResource, createSignal } from "solid-js";

import { t } from "~/shared/i18n";
import { adminListAudit } from "~/shared/api";
import type { AuditAction } from "~/shared/api";
import { Card, EmptyState, ErrorState, Select, Skeleton } from "~/shared/ui";

const ACTIONS: AuditAction[] = [
  "campaign.create",
  "campaign.update",
  "campaign.delete",
  "user.role_change",
  "reconciliation.run",
  "ledger.export.csv",
  "ledger.export.pdf",
  "auth.login",
];

// Maps each raw action code to a friendly i18n label - the raw code stays visible (secondary
// line + `title`) so admins can still recognize/search on it, but the primary text is human.
const actionLabelKey: Record<
  AuditAction,
  | "admin.auditActionLabels.campaignCreate"
  | "admin.auditActionLabels.campaignUpdate"
  | "admin.auditActionLabels.campaignDelete"
  | "admin.auditActionLabels.userRoleChange"
  | "admin.auditActionLabels.reconciliationRun"
  | "admin.auditActionLabels.ledgerExportCsv"
  | "admin.auditActionLabels.ledgerExportPdf"
  | "admin.auditActionLabels.authLogin"
> = {
  "campaign.create": "admin.auditActionLabels.campaignCreate",
  "campaign.update": "admin.auditActionLabels.campaignUpdate",
  "campaign.delete": "admin.auditActionLabels.campaignDelete",
  "user.role_change": "admin.auditActionLabels.userRoleChange",
  "reconciliation.run": "admin.auditActionLabels.reconciliationRun",
  "ledger.export.csv": "admin.auditActionLabels.ledgerExportCsv",
  "ledger.export.pdf": "admin.auditActionLabels.ledgerExportPdf",
  "auth.login": "admin.auditActionLabels.authLogin",
};

const PAGE_SIZE = 25;

const AuditPage: Component = () => {
  const [action, setAction] = createSignal("");
  const [page, setPage] = createSignal(1);
  const query = createMemo(() => ({ action: action() || undefined, page: page(), pageSize: PAGE_SIZE }));
  const [audit] = createResource(query, adminListAudit);

  return (
    <div class="space-y-5">
      <h1 class="font-display text-h1 font-semibold text-fg">{t("admin.auditLog")}</h1>

      <Select
        class="max-w-[240px]"
        value={action()}
        onChange={(e) => {
          setAction(e.currentTarget.value);
          setPage(1);
        }}
        options={[{ value: "", label: t("admin.filters") }, ...ACTIONS.map((a) => ({ value: a, label: t(actionLabelKey[a]) }))]}
      />

      <Show when={!audit.loading} fallback={<Skeleton variant="block" class="h-64" />}>
        <Show when={!audit.error} fallback={<ErrorState error={audit.error} />}>
          <Show when={(audit()?.rows.length ?? 0) > 0} fallback={<EmptyState title={t("admin.noRows")} />}>
            <Card padding="none" class="overflow-x-auto">
              <table class="w-full min-w-[680px] border-collapse">
                <thead>
                  <tr class="bg-surface-sunken text-left">
                    <th class="px-4 py-2.5 font-sans text-label font-semibold uppercase tracking-wide text-fg-muted">{t("admin.action")}</th>
                    <th class="px-4 py-2.5 font-sans text-label font-semibold uppercase tracking-wide text-fg-muted">{t("admin.actor")}</th>
                    <th class="px-4 py-2.5 font-sans text-label font-semibold uppercase tracking-wide text-fg-muted">{t("admin.targetLabel")}</th>
                    <th class="px-4 py-2.5 font-sans text-label font-semibold uppercase tracking-wide text-fg-muted">{t("admin.when")}</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={audit()?.rows}>
                    {(row) => (
                      <tr class="border-t border-border font-sans text-fs-sm text-fg">
                        <td class="px-4 py-2.5" title={row.action}>
                          <p class="text-fg">{t(actionLabelKey[row.action])}</p>
                          <p class="font-mono text-label text-fg-muted">{row.action}</p>
                        </td>
                        <td class="px-4 py-2.5">{row.actorEmail}</td>
                        <td class="px-4 py-2.5 font-mono text-fg-muted">{row.targetType && row.targetId ? `${row.targetType}: ${row.targetId}` : "-"}</td>
                        <td class="px-4 py-2.5">{new Date(row.createdAt).toLocaleString()}</td>
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

export default AuditPage;
