import type { Component } from "solid-js";
import { For, Show, createMemo, createResource, createSignal } from "solid-js";

import { t } from "~/shared/i18n";
import { adminListAudit } from "~/shared/api";
import { formatDateTime } from "~/shared/lib/datetime";
import type { AuditAction, AuditLog } from "~/shared/api";
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

// Human-friendly label per raw action enum (i18n key under admin.auditAction.*) — covers
// every literal in the backend's AuditActionSchema (project/backend/src/modules/audit/model.ts).
const actionLabelKey: Record<
  AuditAction,
  | "admin.auditAction.campaignCreate"
  | "admin.auditAction.campaignUpdate"
  | "admin.auditAction.campaignDelete"
  | "admin.auditAction.userRoleChange"
  | "admin.auditAction.reconciliationRun"
  | "admin.auditAction.ledgerExportCsv"
  | "admin.auditAction.ledgerExportPdf"
  | "admin.auditAction.authLogin"
> = {
  "campaign.create": "admin.auditAction.campaignCreate",
  "campaign.update": "admin.auditAction.campaignUpdate",
  "campaign.delete": "admin.auditAction.campaignDelete",
  "user.role_change": "admin.auditAction.userRoleChange",
  "reconciliation.run": "admin.auditAction.reconciliationRun",
  "ledger.export.csv": "admin.auditAction.ledgerExportCsv",
  "ledger.export.pdf": "admin.auditAction.ledgerExportPdf",
  "auth.login": "admin.auditAction.authLogin",
};

const PAGE_SIZE = 25;

/** Human-readable target: role changes read "Vera Vella: viewer → manager", campaign entries
 * show the campaign name — the raw id stays available as the secondary line. */
const describeTarget = (row: AuditLog): { primary: string; secondary?: string } => {
  const meta = (row.metadata ?? {}) as Record<string, unknown>;
  if (row.action === "user.role_change") {
    const who = (typeof meta.targetName === "string" && meta.targetName) || (typeof meta.targetUsername === "string" && meta.targetUsername) || row.targetId;
    return { primary: who, secondary: row.targetId };
  }
  if (row.targetType === "campaign" && typeof meta.name === "string") {
    return { primary: meta.name, secondary: row.targetId };
  }
  if (row.targetType && row.targetId) return { primary: row.targetId, secondary: row.targetType };
  return { primary: "-" };
};

const compact = (value: unknown): string => {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > 40 ? `${text.slice(0, 37)}…` : text;
};

/** What exactly happened — one line per changed field for updates, row counts for exports. */
const describeDetails = (row: AuditLog): string[] => {
  const meta = (row.metadata ?? {}) as Record<string, unknown>;
  if (Array.isArray(meta.changes) && meta.changes.length > 0)
    return meta.changes.map((c) => {
      const change = c as { field: string; from: unknown; to: unknown };
      return `${change.field}: ${compact(change.from)} → ${compact(change.to)}`;
    });
  if (row.action === "user.role_change") {
    const from = typeof meta.fromRole === "string" ? meta.fromRole : "?";
    const to = typeof meta.toRole === "string" ? meta.toRole : (meta.role as string) || "?";
    return [`${from} → ${to}`];
  }
  if (row.action === "campaign.create" && typeof meta.slug === "string") return [`/c/${meta.slug}`];
  if (typeof meta.rowCount === "number") return [`${meta.rowCount} rows`];
  return [];
};

const AuditPage: Component = () => {
  const [action, setAction] = createSignal("");
  const [page, setPage] = createSignal(1);
  const query = createMemo(() => ({ action: action() || undefined, page: page(), pageSize: PAGE_SIZE }));
  const [audit] = createResource(query, adminListAudit);

  return (
    <div class="space-y-5">
      <h1 class="font-display text-h1 font-semibold text-fg">{t("admin.auditLog")}</h1>

      <Select
        class="max-w-60"
        value={action()}
        onChange={(e) => {
          setAction(e.currentTarget.value);
          setPage(1);
        }}
        options={[{ value: "", label: t("admin.filters") }, ...ACTIONS.map((a) => ({ value: a, label: a }))]}
      />

      <Show when={!audit.loading} fallback={<Skeleton variant="block" class="h-64" />}>
        <Show when={!audit.error} fallback={<ErrorState error={audit.error} />}>
          <Show when={(audit()?.rows.length ?? 0) > 0} fallback={<EmptyState title={t("admin.noRows")} />}>
            <Card padding="none" class="overflow-x-auto">
              <table class="w-full min-w-170 border-collapse">
                <thead>
                  <tr class="bg-surface-sunken text-left">
                    <th class="px-4 py-2.5 font-sans text-label font-semibold uppercase tracking-wide text-fg-muted">{t("admin.action")}</th>
                    <th class="px-4 py-2.5 font-sans text-label font-semibold uppercase tracking-wide text-fg-muted">{t("admin.actor")}</th>
                    <th class="px-4 py-2.5 font-sans text-label font-semibold uppercase tracking-wide text-fg-muted">{t("admin.targetLabel")}</th>
                    <th class="px-4 py-2.5 font-sans text-label font-semibold uppercase tracking-wide text-fg-muted">{t("admin.details")}</th>
                    <th class="px-4 py-2.5 font-sans text-label font-semibold uppercase tracking-wide text-fg-muted">{t("admin.when")}</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={audit()?.rows}>
                    {(row) => (
                      <tr class="border-t border-border font-sans text-fs-sm text-fg">
                        <td class="px-4 py-2.5" title={row.action}>
                          <p>{t(actionLabelKey[row.action])}</p>
                          <p class="font-mono text-label text-fg-muted">{row.action}</p>
                        </td>
                        <td class="px-4 py-2.5">
                          <p class="font-medium text-fg">{row.actorName ?? row.actorEmail}</p>
                          <p class="font-mono text-label text-fg-muted">{row.actorUsername ?? row.actorEmail}</p>
                        </td>
                        <td class="px-4 py-2.5">
                          <p>{describeTarget(row).primary}</p>
                          <Show when={describeTarget(row).secondary}>
                            <p class="font-mono text-label text-fg-muted">{describeTarget(row).secondary}</p>
                          </Show>
                        </td>
                        <td class="px-4 py-2.5">
                          <For each={describeDetails(row)} fallback={<span class="text-fg-muted">-</span>}>
                            {(line) => <p class="font-mono text-label text-fg-muted">{line}</p>}
                          </For>
                        </td>
                        <td class="px-4 py-2.5">{formatDateTime(row.createdAt)}</td>
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
