import { A, useNavigate } from "@solidjs/router";

import type { Component } from "solid-js";
import { For, Show, createResource, createSignal } from "solid-js";

import { t } from "~/shared/i18n";
import { can, useAuth } from "~/shared/auth";
import { formatMoney } from "~/shared/lib/money";
import type { CampaignAdmin } from "~/shared/api";
import { ExternalLinkIcon } from "~/shared/icons";
import { adminDeleteCampaign, adminListCampaigns, apiErrorCode } from "~/shared/api";
import { Badge, Button, Card, ConfirmDialog, EmptyState, ErrorState, Input, Select, Skeleton, showToast } from "~/shared/ui";

const statusVariant = { active: "positive", paused: "warning", ended: "neutral", draft: "neutral" } as const;

const CampaignsListPage: Component = () => {
  const auth = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = createSignal("");
  const [q, setQ] = createSignal("");
  const [campaigns, { refetch }] = createResource(
    () => ({ status: status(), q: q() }),
    (query) => adminListCampaigns(query),
  );
  const [toDelete, setToDelete] = createSignal<CampaignAdmin | undefined>();
  const [deleting, setDeleting] = createSignal(false);

  const confirmDelete = async () => {
    const campaign = toDelete();
    if (!campaign) return;
    setDeleting(true);
    try {
      await adminDeleteCampaign(campaign.id);
      showToast(t("admin.delete"), "success");
      setToDelete(undefined);
      refetch();
    } catch (err) {
      showToast(apiErrorCode(err) === "CONFLICT" ? t("admin.campaignHasDonations") : t("common.error"), "danger");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div class="space-y-5">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h1 class="font-display text-h1 font-semibold text-fg">{t("admin.campaigns")}</h1>
        <Show when={can.createCampaign(auth.role())}>
          <Button onClick={() => navigate("/admin/campaigns/new")}>{t("admin.newCampaign")}</Button>
        </Show>
      </div>

      <div class="flex flex-wrap gap-3">
        <Input placeholder={t("admin.search")} value={q()} onInput={(e) => setQ(e.currentTarget.value)} class="max-w-xs" />
        <Select
          class="max-w-[180px]"
          value={status()}
          onChange={(e) => setStatus(e.currentTarget.value)}
          options={[
            { value: "", label: t("admin.allStatuses") },
            { value: "draft", label: "draft" },
            { value: "active", label: "active" },
            { value: "paused", label: "paused" },
            { value: "ended", label: "ended" },
          ]}
        />
      </div>

      <Show when={!campaigns.loading} fallback={<Skeleton variant="block" class="h-64" />}>
        <Show when={!campaigns.error} fallback={<ErrorState error={campaigns.error} />}>
          <Show when={(campaigns()?.rows.length ?? 0) > 0} fallback={<EmptyState title={t("admin.noRows")} />}>
            <Card padding="none" class="overflow-x-auto">
              <table class="w-full min-w-[720px] border-collapse">
                <thead>
                  <tr class="bg-surface-sunken text-left">
                    <th class="px-4 py-2.5 font-sans text-label font-semibold uppercase tracking-wide text-fg-muted">{t("admin.name")}</th>
                    <th class="px-4 py-2.5 font-sans text-label font-semibold uppercase tracking-wide text-fg-muted">{t("admin.cause")}</th>
                    <th class="px-4 py-2.5 text-right font-sans text-label font-semibold uppercase tracking-wide text-fg-muted">{t("admin.targetAmount")}</th>
                    <th class="px-4 py-2.5 font-sans text-label font-semibold uppercase tracking-wide text-fg-muted">{t("admin.status")}</th>
                    <th class="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  <For each={campaigns()?.rows}>
                    {(c) => (
                      <tr class="border-t border-border">
                        <td class="px-4 py-2.5 font-sans text-fs-sm font-medium text-fg">
                          <A href={`/admin/campaigns/${c.id}`} class="hover:text-brand">
                            {c.name}
                          </A>
                        </td>
                        <td class="px-4 py-2.5 font-sans text-fs-sm text-fg-muted">{c.cause}</td>
                        <td class="px-4 py-2.5 text-right font-mono text-fs-sm tabular-nums text-fg">{formatMoney(c.targetMinor, c.currency)}</td>
                        <td class="px-4 py-2.5">
                          <Badge variant={statusVariant[c.status]}>{c.status}</Badge>
                        </td>
                        <td class="px-4 py-2.5 text-right">
                          <div class="flex justify-end gap-2">
                            <a
                              href={`/c/${c.slug}`}
                              target="_blank"
                              rel="noopener"
                              aria-label={t("admin.openPublicPage")}
                              title={t("admin.openPublicPage")}
                              class="inline-flex size-8 items-center justify-center rounded-md border border-border-strong bg-surface-raised text-fg-muted hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
                              <ExternalLinkIcon class="size-4" aria-hidden="true" />
                            </a>
                            <Show when={can.updateCampaign(auth.role())}>
                              <Button size="sm" variant="secondary" onClick={() => navigate(`/admin/campaigns/${c.id}/edit`)}>
                                {t("admin.edit")}
                              </Button>
                            </Show>
                            <Show when={can.deleteCampaign(auth.role())}>
                              <Button size="sm" variant="danger" onClick={() => setToDelete(c)}>
                                {t("admin.delete")}
                              </Button>
                            </Show>
                          </div>
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

      <ConfirmDialog
        open={Boolean(toDelete())}
        title={t("admin.confirmDeleteCampaign")}
        description={t("admin.confirmDeleteCampaignBody")}
        confirmLabel={t("admin.delete")}
        danger
        busy={deleting()}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(undefined)}
      />
    </div>
  );
};

export default CampaignsListPage;
