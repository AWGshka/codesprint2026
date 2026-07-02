import { A, useNavigate, useParams } from "@solidjs/router";

import type { Component } from "solid-js";
import { Show, createResource } from "solid-js";

import { t } from "~/shared/i18n";
import { env } from "~/shared/config/env";
import { can, useAuth } from "~/shared/auth";
import { adminGetCampaign } from "~/shared/api";
import { formatMoney } from "~/shared/lib/money";
import { ExternalLinkIcon } from "~/shared/icons";
import { Badge, Button, Card, ErrorState, Skeleton } from "~/shared/ui";

const publicPageLinkClass =
  "inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border-strong bg-surface-raised px-3 py-1.5 font-sans text-label font-semibold text-fg transition-colors hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus";

const statusVariant = { active: "positive", paused: "warning", ended: "neutral", draft: "neutral" } as const;

const CampaignDetailPage: Component = () => {
  const params = useParams<{ id: string }>();
  const navigate = useNavigate();
  const auth = useAuth();
  const [campaign] = createResource(() => params.id, adminGetCampaign);

  const donorAppOrigin = () => window.location.origin;

  return (
    <Show when={!campaign.loading} fallback={<Skeleton variant="block" class="h-64" />}>
      <Show when={campaign()} fallback={<ErrorState error={campaign.error} />}>
        {(c) => (
          <div class="max-w-2xl space-y-5">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 class="font-display text-h1 font-semibold text-fg">{c().name}</h1>
                <p class="font-sans text-fs-sm text-fg-muted">{c().cause}</p>
              </div>
              <div class="flex items-center gap-2">
                <Badge variant={statusVariant[c().status]}>{c().status}</Badge>
                <a href={`/c/${c().slug}`} target="_blank" rel="noopener" class={publicPageLinkClass}>
                  <ExternalLinkIcon class="size-4" aria-hidden="true" />
                  {t("admin.openPublicPage")}
                </a>
                <Show when={can.updateCampaign(auth.role())}>
                  <Button size="sm" variant="secondary" onClick={() => navigate(`/admin/campaigns/${c().id}/edit`)}>
                    {t("admin.edit")}
                  </Button>
                </Show>
              </div>
            </div>

            <Card padding="md" class="space-y-3">
              <div class="flex justify-between font-sans text-fs-sm">
                <span class="text-fg-muted">{t("admin.targetAmount")}</span>
                <span class="font-mono tabular-nums text-fg">{formatMoney(c().targetMinor, c().currency)}</span>
              </div>
              <div class="flex justify-between font-sans text-fs-sm">
                <span class="text-fg-muted">{t("admin.currency")}</span>
                <span class="text-fg">{c().currency}</span>
              </div>
              <div class="flex justify-between font-sans text-fs-sm">
                <span class="text-fg-muted">{t("admin.frequencies")}</span>
                <span class="text-fg">{c().frequencies.join(", ")}</span>
              </div>
              <div class="flex justify-between font-sans text-fs-sm">
                <span class="text-fg-muted">{t("admin.createdAt")}</span>
                <span class="text-fg">{new Date(c().createdAt).toLocaleDateString()}</span>
              </div>
            </Card>

            <Card padding="md" class="space-y-2">
              <p class="font-sans text-fs-sm font-semibold text-fg">{t("admin.publicLink")}</p>
              <A href={`/c/${c().slug}`} class="block break-all font-mono text-fs-sm text-brand hover:underline">
                {donorAppOrigin()}/c/{c().slug}
              </A>
              <p class="pt-2 font-sans text-fs-sm font-semibold text-fg">{t("admin.kioskLink")}</p>
              <A href={`/kiosk/${c().slug}`} class="block break-all font-mono text-fs-sm text-brand hover:underline">
                {donorAppOrigin()}/kiosk/{c().slug}
              </A>
              <p class="pt-2 font-sans text-label text-fg-muted">API base: {env.apiBaseUrl}</p>
            </Card>
          </div>
        )}
      </Show>
    </Show>
  );
};

export default CampaignDetailPage;
