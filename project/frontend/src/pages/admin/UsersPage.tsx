import type { Component } from "solid-js";
import { For, Show, createResource, createSignal } from "solid-js";

import { t } from "~/shared/i18n";
import { useAuth } from "~/shared/auth";
import { apiErrorCode } from "~/shared/api";
import type { UserRole } from "~/shared/api";
import { adminListUsers, adminSetUserRole } from "~/shared/api";
import { Badge, Card, ErrorState, Select, Skeleton, showToast } from "~/shared/ui";

const roleVariant: Record<UserRole, "neutral" | "warning" | "positive"> = { viewer: "neutral", manager: "warning", admin: "positive" };
const ROLES: UserRole[] = ["viewer", "manager", "admin"];

const UsersPage: Component = () => {
  const auth = useAuth();
  const [users, { refetch }] = createResource(adminListUsers);
  const [updating, setUpdating] = createSignal<string>();

  const changeRole = async (id: string, role: UserRole) => {
    setUpdating(id);
    try {
      await adminSetUserRole(id, role);
      showToast(t("admin.changeRole"), "success");
      refetch();
    } catch (err) {
      const code = apiErrorCode(err);
      if (code === "cannot_change_own_role") showToast(t("admin.cannotChangeOwnRole"), "danger");
      else if (code === "last_admin") showToast(t("admin.lastAdmin"), "danger");
      else showToast(t("common.error"), "danger");
      // The dropdown's `value` is still `users()`'s server-truth role (never optimistic), so a
      // rejected change just leaves it showing the unchanged role - no local reset needed.
    } finally {
      setUpdating(undefined);
    }
  };

  return (
    <div class="space-y-5">
      <h1 class="font-display text-h1 font-semibold text-fg">{t("admin.users")}</h1>

      <Show when={!users.loading} fallback={<Skeleton variant="block" class="h-64" />}>
        <Show when={!users.error} fallback={<ErrorState error={users.error} />}>
          <Card padding="none" class="overflow-x-auto">
            <table class="w-full min-w-[560px] border-collapse">
              <thead>
                <tr class="bg-surface-sunken text-left">
                  <th class="px-4 py-2.5 font-sans text-label font-semibold uppercase tracking-wide text-fg-muted">{t("admin.name")}</th>
                  <th class="px-4 py-2.5 font-sans text-label font-semibold uppercase tracking-wide text-fg-muted">{t("admin.email")}</th>
                  <th class="px-4 py-2.5 font-sans text-label font-semibold uppercase tracking-wide text-fg-muted">{t("admin.role")}</th>
                  <th class="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                <For each={users()?.rows}>
                  {(u) => {
                    const isSelf = () => u.id === auth.state.user?.id;
                    return (
                      <tr class="border-t border-border font-sans text-fs-sm text-fg">
                        <td class="px-4 py-2.5">{u.username}</td>
                        <td class="px-4 py-2.5 text-fg-muted">{u.email}</td>
                        <td class="px-4 py-2.5">
                          <Badge variant={roleVariant[u.role]}>{u.role}</Badge>
                        </td>
                        <td class="px-4 py-2.5">
                          <Select
                            class="max-w-[140px]"
                            value={u.role}
                            disabled={updating() === u.id || isSelf()}
                            title={isSelf() ? t("admin.cannotChangeOwnRoleHint") : undefined}
                            aria-label={isSelf() ? t("admin.cannotChangeOwnRoleHint") : t("admin.role")}
                            onChange={(e) => changeRole(u.id, e.currentTarget.value as UserRole)}
                            options={ROLES.map((r) => ({ value: r, label: r }))}
                          />
                        </td>
                      </tr>
                    );
                  }}
                </For>
              </tbody>
            </table>
          </Card>
        </Show>
      </Show>
    </div>
  );
};

export default UsersPage;
