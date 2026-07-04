import type { Component } from "solid-js";
import { For, Show, createResource, createSignal } from "solid-js";

import { t } from "~/shared/i18n";
import { useAuth } from "~/shared/auth";
import { fullName } from "~/shared/lib/user";
import type { AdminUser, UserRole } from "~/shared/api";
import { adminListUsers, adminSetUserRole, apiErrorCode } from "~/shared/api";
import { Avatar, Badge, Card, ErrorState, Select, Skeleton, showToast } from "~/shared/ui";

const roleVariant: Record<UserRole, "neutral" | "warning" | "positive"> = { auditor: "neutral", volunteer: "warning", admin: "positive" };
// Only auditor/volunteer are ever assignable via this UI — the server never allows promoting to
// admin through PATCH /admin/users/:id/role (400 INVALID_ROLE), and admin rows are locked below.
const ASSIGNABLE_ROLES: UserRole[] = ["auditor", "volunteer"];

const roleLabelKey: Record<UserRole, "admin.roleAuditor" | "admin.roleVolunteer" | "admin.roleAdmin"> = {
  auditor: "admin.roleAuditor",
  volunteer: "admin.roleVolunteer",
  admin: "admin.roleAdmin",
};

const errorToastMessage = (err: unknown): string => {
  switch (apiErrorCode(err)) {
    case "CANNOT_CHANGE_OWN_ROLE":
      return t("admin.cannotChangeOwnRole");
    case "CANNOT_MODIFY_ADMIN":
      return t("admin.cannotModifyAdmin");
    case "INVALID_ROLE":
      return t("admin.invalidRole");
    default:
      return t("common.error");
  }
};

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
      showToast(errorToastMessage(err), "danger");
    } finally {
      setUpdating(undefined);
    }
  };

  // Mirrors the server's hierarchy rules (BE-2): a caller can never change their own role, and
  // admin rows are never editable from this UI (no demotion path here).
  const lockReason = (u: AdminUser): string | undefined => {
    if (u.id === auth.state.user?.id) return t("admin.cannotChangeOwnRole");
    if (u.role === "admin") return t("admin.cannotModifyAdmin");
    return undefined;
  };

  // Locked rows (own row, admin rows) never render the select, so only auditor/volunteer appear.
  const optionsFor = (_u: AdminUser) => ASSIGNABLE_ROLES.map((r) => ({ value: r, label: t(roleLabelKey[r]) }));

  return (
    <div class="space-y-5">
      <h1 class="font-display text-h1 font-semibold text-fg">{t("admin.users")}</h1>

      <Show when={!users.loading} fallback={<Skeleton variant="block" class="h-64" />}>
        <Show when={!users.error} fallback={<ErrorState error={users.error} />}>
          <Card padding="none" class="overflow-x-auto">
            <table class="w-full min-w-155 border-collapse">
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
                    const reason = () => lockReason(u);
                    return (
                      <tr class="border-t border-border font-sans text-fs-sm text-fg">
                        <td class="px-4 py-2.5">
                          <div class="flex items-center gap-2.5">
                            <Avatar firstName={u.firstName} lastName={u.lastName} username={u.username} size="sm" />
                            <div>
                              <p class="font-medium text-fg">{fullName(u.firstName, u.lastName, u.username)}</p>
                              <p class="font-mono text-label text-fg-muted">{u.username}</p>
                            </div>
                          </div>
                        </td>
                        <td class="px-4 py-2.5 text-fg-muted">{u.email}</td>
                        <td class="px-4 py-2.5">
                          <Badge variant={roleVariant[u.role]}>{t(roleLabelKey[u.role])}</Badge>
                        </td>
                        <td class="px-4 py-2.5">
                          {/* Rows the caller can't edit (own row, admin rows) get no control at
                              all — a disabled dropdown just reads as a bug. */}
                          <Show when={!reason()} fallback={<p class="font-sans text-label text-fg-muted">{reason()}</p>}>
                            <Select
                              class="max-w-35"
                              value={u.role}
                              disabled={updating() === u.id}
                              onChange={(e) => changeRole(u.id, e.currentTarget.value as UserRole)}
                              options={optionsFor(u)}
                            />
                          </Show>
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
