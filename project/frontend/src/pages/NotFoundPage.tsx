import { A } from "@solidjs/router";

import type { Component } from "solid-js";

import { Button } from "~/shared/ui";

const NotFoundPage: Component = () => (
  <section class="flex min-h-screen flex-col items-center justify-center gap-4 text-center">
    <p class="font-display text-display font-semibold text-fg">404</p>
    <p class="font-sans text-body text-fg-muted">This page could not be found.</p>
    <A href="/">
      <Button variant="secondary">Back home</Button>
    </A>
  </section>
);

export default NotFoundPage;
