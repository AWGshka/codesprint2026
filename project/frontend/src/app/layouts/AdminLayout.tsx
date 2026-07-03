import { AdminProfileMenu } from "./AdminProfileMenu";

import { A } from "@solidjs/router";
import type { RouteSectionProps } from "@solidjs/router";

import type { Component, ParentComponent } from "solid-js";
import { ErrorBoundary, For, Show, Suspense, createSignal } from "solid-js";

import { t } from "~/shared/i18n";
import { cn } from "~/shared/lib/cn";
import { PageTransition } from "~/shared/motion";
import { ErrorState, Spinner } from "~/shared/ui";
import type { UserRole } from "~/shared/api/types";
import { RequireAuth, can, useAuth } from "~/shared/auth";
import {
  AuditIcon,
  CampaignsIcon,
  CollapseIcon,
  DashboardIcon,
  ExpandIcon,
  ImpactIcon,
  LedgerIcon,
  ReconcileIcon,
  UsersIcon,
} from "~/shared/icons";

const alwaysShow = (_role: UserRole | undefined) => true;

const navItems: {
  href: string;
  labelKey: "admin.title" | "admin.campaigns" | "admin.ledger" | "admin.reconciliation" | "admin.auditLog" | "admin.impact" | "admin.users";
  icon: Component<{ class?: string }>;
  end: boolean;
  show: (role: UserRole | undefined) => boolean;
}[] = [
  { href: "/admin", labelKey: "admin.title", icon: DashboardIcon, end: true, show: alwaysShow },
  { href: "/admin/campaigns", labelKey: "admin.campaigns", icon: CampaignsIcon, end: false, show: alwaysShow },
  { href: "/admin/ledger", labelKey: "admin.ledger", icon: LedgerIcon, end: false, show: alwaysShow },
  { href: "/admin/reconciliation", labelKey: "admin.reconciliation", icon: ReconcileIcon, end: false, show: alwaysShow },
  { href: "/admin/audit", labelKey: "admin.auditLog", icon: AuditIcon, end: false, show: alwaysShow },
  { href: "/admin/impact", labelKey: "admin.impact", icon: ImpactIcon, end: false, show: alwaysShow },
  { href: "/admin/users", labelKey: "admin.users", icon: UsersIcon, end: false, show: can.manageUsers },
];

const SIDEBAR_KEY = "gt-admin-sidebar";

const AdminShell: ParentComponent = (props) => {
  const auth = useAuth();
  const [collapsed, setCollapsed] = createSignal(localStorage.getItem(SIDEBAR_KEY) === "collapsed");
  const toggleSidebar = () => {
    const next = !collapsed();
    setCollapsed(next);
    localStorage.setItem(SIDEBAR_KEY, next ? "collapsed" : "open");
  };

  return (
    <div class="flex min-h-screen flex-col bg-surface sm:flex-row">
      {/* Mobile: the sidebar is hidden below `sm`, so a sticky top bar carries the same nav
          (horizontally scrollable) plus the profile/prefs menu. */}
      <header class="sticky top-0 z-20 border-b border-border bg-surface-raised sm:hidden">
        <div class="flex items-center justify-between px-4 py-2.5">
          <A href="/admin" class="font-display text-h3 font-semibold text-fg">
            Give<span class="text-brand">Tap</span>
          </A>
          <AdminProfileMenu direction="down" class="w-auto" />
        </div>
        <nav class="flex gap-1 overflow-x-auto px-3 pb-2">
          <For each={navItems}>
            {(item) => (
              <Show when={item.show(auth.role())}>
                <A
                  href={item.href}
                  end={item.end}
                  class="whitespace-nowrap rounded-md px-3 py-1.5 font-sans text-fs-sm font-medium text-fg-muted hover:bg-surface-sunken"
                  activeClass="bg-brand/10 text-brand">
                  {t(item.labelKey)}
                </A>
              </Show>
            )}
          </For>
        </nav>
      </header>

      {/* Sticky, exactly viewport height — never taller than the screen. Collapsible to an
          icon rail; the choice persists in localStorage. */}
      <aside
        class={cn(
          "sticky top-0 hidden h-screen shrink-0 flex-col overflow-hidden border-r border-border bg-surface-raised transition-[width] duration-200 sm:flex",
          collapsed() ? "w-16 p-2" : "w-60 p-4",
        )}>
        <div class={cn("flex items-center", collapsed() ? "justify-center" : "justify-between px-2")}>
          <A href="/admin" class="py-3 font-display text-h3 font-semibold text-fg" title="GiveTap">
            <Show when={!collapsed()} fallback={<span class="text-brand">GT</span>}>
              Give<span class="text-brand">Tap</span>
            </Show>
          </A>
        </div>
        <nav class="mt-4 flex flex-col gap-1">
          <For each={navItems}>
            {(item) => (
              <Show when={item.show(auth.role())}>
                <A
                  href={item.href}
                  end={item.end}
                  title={collapsed() ? t(item.labelKey) : undefined}
                  class={cn(
                    "flex items-center gap-2.5 rounded-md py-2 font-sans text-fs-sm font-medium text-fg-muted hover:bg-surface-sunken",
                    collapsed() ? "justify-center px-0" : "px-3",
                  )}
                  activeClass="bg-brand/10 text-brand">
                  <item.icon class="size-4.5 shrink-0" />
                  <Show when={!collapsed()}>{t(item.labelKey)}</Show>
                </A>
              </Show>
            )}
          </For>
        </nav>

        {/* Profile card: avatar/name/role, opens a popover with prefs (theme/text size/
            language/high-contrast) + sign-out — the sidebar's only prefs/account surface. */}
        <div class="mt-auto flex flex-col gap-1 pt-4">
          <button
            type="button"
            onClick={toggleSidebar}
            title={collapsed() ? t("admin.expandNav") : t("admin.collapseNav")}
            class={cn(
              "flex items-center gap-2.5 rounded-md py-2 font-sans text-fs-sm font-medium text-fg-muted hover:bg-surface-sunken",
              collapsed() ? "justify-center px-0" : "px-3",
            )}>
            <Show when={collapsed()} fallback={<CollapseIcon class="size-4.5 shrink-0" />}>
              <ExpandIcon class="size-4.5 shrink-0" />
            </Show>
            <Show when={!collapsed()}>{t("admin.collapseNav")}</Show>
          </button>
          <AdminProfileMenu compact={collapsed()} />
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
