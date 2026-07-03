import type { Component } from "solid-js";

import { t } from "~/shared/i18n";
import { Badge, Banner, Card, StatCard } from "~/shared/ui";

/** S1.2 — static mockup only. Not wired to live data; a preview of a future donor-facing impact panel. */
const ImpactPage: Component = () => (
  <div class="max-w-3xl space-y-5">
    <Banner variant="neutral">{t("admin.staticPreviewBanner")}</Banner>

    <div class="flex items-center gap-3">
      <h1 class="font-display text-h1 font-semibold text-fg">{t("admin.impact")}</h1>
      <Badge variant="neutral">{t("admin.previewBadge")}</Badge>
    </div>

    <Card padding="lg" class="space-y-4">
      <h2 class="font-display text-h2 font-semibold text-fg">{t("admin.impactHeadline")}</h2>
      <p class="max-w-prose font-sans text-body text-fg-muted">{t("admin.impactBody")}</p>

      <div class="grid grid-cols-3 gap-3">
        <StatCard label={t("admin.mealsServed")} value="18,204" hint="Malta Food Bank" />
        <StatCard label={t("admin.familiesHoused")} value="312" hint="Winter Shelter" />
        <StatCard label={t("admin.careMonthsFunded")} value="1,020" hint="Health Fund" />
      </div>

      <div class="rounded-lg border border-dashed border-border-strong p-6 text-center font-sans text-fs-sm text-fg-muted">
        {t("admin.staticWireframeNote")}
      </div>
    </Card>
  </div>
);

export default ImpactPage;
