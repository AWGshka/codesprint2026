import { A } from "@solidjs/router";
import type { RouteSectionProps } from "@solidjs/router";

import type { Component } from "solid-js";
import { ErrorBoundary, Suspense } from "solid-js";

import { t } from "~/shared/i18n";
import { PrefsPopover } from "~/shared/prefs";
import { PageTransition } from "~/shared/motion";
import { ErrorState, Spinner } from "~/shared/ui";

const PublicLayout: Component<RouteSectionProps> = (props) => (
  <div class="flex min-h-screen flex-col bg-surface">
    <header class="border-b border-border bg-surface-raised">
      <nav class="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-4">
        <A href="/" class="font-display text-h3 font-semibold text-fg">
          Give<span class="text-brand">Tap</span>
        </A>
        <div class="flex flex-wrap items-center gap-4">
          <A href="/discover" class="font-sans text-fs-sm font-semibold text-brand hover:opacity-80">
            {t("nav.discover")} →
          </A>
          <A href="/admin/login" class="font-sans text-fs-sm font-semibold text-fg-muted hover:text-fg">
            {t("admin.title")}
          </A>
          <PrefsPopover />
        </div>
      </nav>
    </header>

    <main class="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
      <ErrorBoundary fallback={(error, reset) => <ErrorState error={error} reset={reset} />}>
        <Suspense
          fallback={
            <div class="flex justify-center py-20">
              <Spinner />
            </div>
          }>
          <PageTransition>{props.children}</PageTransition>
        </Suspense>
      </ErrorBoundary>
    </main>
  </div>
);

export default PublicLayout;
