import { A, useNavigate } from "@solidjs/router";
import type { RouteSectionProps } from "@solidjs/router";

import type { Component, ParentComponent } from "solid-js";
import { ErrorBoundary, For, Show, Suspense } from "solid-js";

import { t } from "~/shared/i18n";
import { PageTransition } from "~/shared/motion";
import type { UserRole } from "~/shared/api/types";
import { RequireAuth, can, useAuth } from "~/shared/auth";
import { Avatar, Badge, ErrorState, Spinner } from "~/shared/ui";

const alwaysShow = (_role: UserRole | undefined) => true;

const roleVariant: Record<UserRole, "neutral" | "warning" | "positive"> = { viewer: "neutral", manager: "warning", admin: "positive" };

const navItems: {
  href: string;
  labelKey: "admin.title" | "admin.campaigns" | "admin.ledger" | "admin.reconciliation" | "admin.auditLog" | "admin.impact" | "admin.users";
  end: boolean;
  show: (role: UserRole | undefined) => boolean;
}[] = [
  { href: "/admin", labelKey: "admin.title", end: true, show: alwaysShow },
  { href: "/admin/campaigns", labelKey: "admin.campaigns", end: false, show: alwaysShow },
  { href: "/admin/ledger", labelKey: "admin.ledger", end: false, show: alwaysShow },
  { href: "/admin/reconciliation", labelKey: "admin.reconciliation", end: false, show: alwaysShow },
  { href: "/admin/audit", labelKey: "admin.auditLog", end: false, show: alwaysShow },
  { href: "/admin/impact", labelKey: "admin.impact", end: false, show: alwaysShow },
  { href: "/admin/users", labelKey: "admin.users", end: false, show: can.manageUsers },
];

const AdminShell: ParentComponent = (props) => {
  const auth = useAuth();
  const navigate = useNavigate();

  const signOut = async () => {
    await auth.signOut();
    navigate("/admin/login", { replace: true });
  };

  return (
    <div class="flex min-h-screen bg-surface">
      <aside class="hidden w-60 shrink-0 flex-col border-r border-border bg-surface-raised p-4 sm:flex">
        <A href="/admin" class="px-2 py-3 font-display text-h3 font-semibold text-fg">
          Give<span class="text-brand">Tap</span>
        </A>
        <nav class="mt-4 flex flex-col gap-1">
          <For each={navItems}>
            {(item) => (
              <Show when={item.show(auth.role())}>
                <A
                  href={item.href}
                  end={item.end}
                  class="flex items-center rounded-md px-3 py-2 font-sans text-fs-sm font-medium text-fg-muted hover:bg-surface-sunken"
                  activeClass="bg-brand/10 text-brand">
                  {t(item.labelKey)}
                </A>
              </Show>
            )}
          </For>
        </nav>

        <div class="mt-auto space-y-1 pt-4">
          <A
            href="/admin/settings"
            class="flex items-center gap-2.5 rounded-md p-2 hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            activeClass="bg-brand/10">
            <Avatar
              size="sm"
              firstName={auth.state.user?.firstName}
              lastName={auth.state.user?.lastName}
              username={auth.state.user?.username ?? undefined}
              image={auth.state.user?.image}
              userId={auth.state.user?.id ?? ""}
            />
            <span class="min-w-0 flex-1">
              <span class="block truncate font-sans text-fs-sm font-semibold text-fg">
                {[auth.state.user?.firstName, auth.state.user?.lastName].filter(Boolean).join(" ") || auth.state.user?.username}
              </span>
              <Badge variant={roleVariant[auth.role() ?? "viewer"]} class="mt-0.5">
                {auth.role()}
              </Badge>
            </span>
          </A>
          <button
            type="button"
            onClick={signOut}
            class="min-h-[40px] w-full rounded-md px-3 py-2 text-left font-sans text-fs-sm font-medium text-fg-muted hover:bg-surface-sunken">
            {t("nav.signOut")}
          </button>
        </div>
      </aside>

      <main class="flex-1 px-5 py-6 sm:px-8 sm:py-8">
        <div class="mx-auto max-w-6xl">
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
        </div>
      </main>
    </div>
  );
};

const AdminLayout: Component<RouteSectionProps> = (props) => (
  <RequireAuth redirectTo="/admin/login">
    <AdminShell>{props.children}</AdminShell>
  </RequireAuth>
);

export default AdminLayout;
