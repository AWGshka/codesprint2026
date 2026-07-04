import { A } from "@solidjs/router";

import { For } from "solid-js";
import type { Component } from "solid-js";

import { t } from "~/shared/i18n";
import { Button, Card } from "~/shared/ui";

const halves = [
  {
    title: "home.terminalCardTitle",
    subtitle: "home.terminalCardSubtitle",
    features: ["home.terminalFeature1", "home.terminalFeature2", "home.terminalFeature3", "home.terminalFeature4"],
    cta: "home.openTerminal",
    href: "/discover",
    primary: true,
  },
  {
    title: "home.adminCardTitle",
    subtitle: "home.adminCardSubtitle",
    features: ["home.adminFeature1", "home.adminFeature2", "home.adminFeature3", "home.adminFeature4"],
    cta: "home.openAdmin",
    href: "/admin/",
    primary: false,
  },
] as const;

const steps = [
  { title: "home.step1Title", body: "home.step1Body" },
  { title: "home.step2Title", body: "home.step2Body" },
  { title: "home.step3Title", body: "home.step3Body" },
] as const;

const HomePage: Component = () => (
  <div class="space-y-10 py-6">
    <section class="space-y-3 text-center">
      <h1 class="font-display text-h1 font-semibold tracking-tight text-fg">
        Give<span class="text-brand">Tap</span>
      </h1>
      <p class="font-display text-h3 font-semibold text-fg">{t("home.tagline")}</p>
      <p class="mx-auto max-w-prose font-sans text-body text-fg-muted">{t("home.intro")}</p>
    </section>

    <section class="grid gap-4 md:grid-cols-2">
      <For each={halves}>
        {(half) => (
          <Card padding="lg" class="flex flex-col gap-4">
            <div class="space-y-1">
              <h2 class="font-display text-h2 font-semibold text-fg">{t(half.title)}</h2>
              <p class="font-sans text-fs-sm text-fg-muted">{t(half.subtitle)}</p>
            </div>
            <ul class="flex-1 space-y-2">
              <For each={[...half.features]}>
                {(feature) => (
                  <li class="flex items-start gap-2 font-sans text-fs-sm text-fg-muted">
                    <svg class="mt-0.5 size-4 shrink-0 text-brand" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                    {t(feature)}
                  </li>
                )}
              </For>
            </ul>
            <A href={half.href} class="mt-auto">
              <Button size="lg" class="w-full" variant={half.primary ? "primary" : "secondary"}>
                {t(half.cta)}
              </Button>
            </A>
          </Card>
        )}
      </For>
    </section>

    <section class="space-y-4">
      <h2 class="text-center font-display text-h2 font-semibold text-fg">{t("home.howItWorksTitle")}</h2>
      <div class="grid gap-4 sm:grid-cols-3">
        <For each={steps}>
          {(step, i) => (
            <Card padding="md" class="space-y-2">
              <span class="inline-flex size-8 items-center justify-center rounded-full bg-brand/10 font-mono text-fs-sm font-bold text-brand">{i() + 1}</span>
              <h3 class="font-display text-h3 font-semibold text-fg">{t(step.title)}</h3>
              <p class="font-sans text-fs-sm text-fg-muted">{t(step.body)}</p>
            </Card>
          )}
        </For>
      </div>
    </section>

    <section class="grid gap-4 md:grid-cols-2">
      <Card padding="lg" class="space-y-2">
        <div class="inline-flex size-10 items-center justify-center rounded-lg bg-brand/10 text-brand">
          <svg class="size-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" fill="currentColor" />
          </svg>
        </div>
        <h2 class="font-display text-h2 font-semibold text-fg">{t("home.forCharitiesTitle")}</h2>
        <p class="font-sans text-fs-sm text-fg-muted">{t("home.forCharitiesBody")}</p>
      </Card>
      <Card padding="lg" class="space-y-2">
        <div class="inline-flex size-10 items-center justify-center rounded-lg bg-brand/10 text-brand">
          <svg class="size-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="4" y="2" width="16" height="20" rx="2" stroke="currentColor" stroke-width="1.8" />
            <path d="M9 18h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
          </svg>
        </div>
        <h2 class="font-display text-h2 font-semibold text-fg">{t("home.kioskTitle")}</h2>
        <p class="font-sans text-fs-sm text-fg-muted">{t("home.kioskBody")}</p>
      </Card>
    </section>
  </div>
);

export default HomePage;
