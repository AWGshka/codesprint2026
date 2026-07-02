import { A } from "@solidjs/router";

import type { Component } from "solid-js";

import { t } from "~/shared/i18n";
import { Button } from "~/shared/ui";

const HomePage: Component = () => (
  <section class="flex flex-col items-start gap-6 py-10">
    <div class="space-y-3">
      <h1 class="font-display text-h1 font-semibold tracking-tight text-fg">GiveTap</h1>
      <p class="max-w-prose font-sans text-body text-fg-muted">
        Contactless giving, receipted instantly. Browse active campaigns and give in seconds - no account needed.
      </p>
    </div>
    <div class="flex flex-wrap gap-3">
      <A href="/discover">
        <Button size="lg">{t("donor.discoverTitle")}</Button>
      </A>
      <A href="/admin/login">
        <Button size="lg" variant="secondary">
          {t("admin.title")}
        </Button>
      </A>
    </div>
  </section>
);

export default HomePage;
