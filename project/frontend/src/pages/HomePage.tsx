import { A } from "@solidjs/router";

import type { Component } from "solid-js";
import { For } from "solid-js";

import { t } from "~/shared/i18n";
import { Button, Card } from "~/shared/ui";

const steps = [
  { title: "home.step1Title", body: "home.step1Body" },
  { title: "home.step2Title", body: "home.step2Body" },
  { title: "home.step3Title", body: "home.step3Body" },
] as const;

const HomePage: Component = () => (
  <div class="space-y-12 py-6">
    <section class="flex flex-col items-start gap-6">
      <div class="space-y-3">
        <h1 class="font-display text-h1 font-semibold tracking-tight text-fg">
          Give<span class="text-brand">Tap</span>
        </h1>
        <p class="font-display text-h3 font-semibold text-fg">{t("home.tagline")}</p>
        <p class="max-w-prose font-sans text-body text-fg-muted">{t("home.intro")}</p>
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

    <section class="space-y-4">
      <h2 class="font-display text-h2 font-semibold text-fg">{t("home.howItWorksTitle")}</h2>
      <div class="grid gap-4 sm:grid-cols-3">
        <For each={steps}>
          {(step, i) => (
            <Card padding="md" class="space-y-2">
              <span class="inline-flex size-8 items-center justify-center rounded-full bg-brand/10 font-mono text-fs-sm font-bold text-brand">
                {i() + 1}
              </span>
              <h3 class="font-display text-h3 font-semibold text-fg">{t(step.title)}</h3>
              <p class="font-sans text-fs-sm text-fg-muted">{t(step.body)}</p>
            </Card>
          )}
        </For>
      </div>
    </section>

    <section class="grid gap-4 sm:grid-cols-2">
      <Card padding="md" class="space-y-2">
        <h3 class="font-display text-h3 font-semibold text-fg">{t("home.forCharitiesTitle")}</h3>
        <p class="font-sans text-fs-sm text-fg-muted">{t("home.forCharitiesBody")}</p>
      </Card>
      <Card padding="md" class="space-y-2">
        <h3 class="font-display text-h3 font-semibold text-fg">{t("home.kioskTitle")}</h3>
        <p class="font-sans text-fs-sm text-fg-muted">{t("home.kioskBody")}</p>
      </Card>
    </section>
  </div>
);

export default HomePage;
