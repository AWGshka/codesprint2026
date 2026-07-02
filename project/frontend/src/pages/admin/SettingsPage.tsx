import { createSignal } from "solid-js";
import type { Component } from "solid-js";

import { t } from "~/shared/i18n";
import { useAuth } from "~/shared/auth";
import { PrefsControls } from "~/shared/prefs";
import { Avatar, Badge, Button, Card, Field, Input, showToast } from "~/shared/ui";

const roleVariant = { viewer: "neutral", manager: "warning", admin: "positive" } as const;

/** Profile + preferences (D7) - reachable from the admin sidebar's profile block. All roles land
 * here (not permission-gated); everyone can edit their own name and app preferences. */
const SettingsPage: Component = () => {
  const auth = useAuth();
  const user = () => auth.state.user;

  const [firstName, setFirstName] = createSignal(user()?.firstName ?? "");
  const [lastName, setLastName] = createSignal(user()?.lastName ?? "");
  const [saving, setSaving] = createSignal(false);

  const saveProfile = async (event: Event) => {
    event.preventDefault();
    setSaving(true);
    try {
      // Always send both fields together - the backend only derives the display `name` from
      // `firstName` + `lastName` when both arrive in the same write (see
      // backend-engineer-run2.md's "name-sync caveat"); `auth.updateProfile` refreshes the
      // session on success, so the sidebar reflects the new name immediately.
      await auth.updateProfile(firstName().trim(), lastName().trim());
      showToast(t("admin.profileSaved"), "success");
    } catch {
      showToast(t("common.error"), "danger");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div class="max-w-2xl space-y-5">
      <h1 class="font-display text-h1 font-semibold text-fg">{t("admin.settings")}</h1>

      <Card padding="lg" class="space-y-4">
        <div class="flex items-center gap-3">
          <Avatar
            firstName={user()?.firstName}
            lastName={user()?.lastName}
            username={user()?.username ?? undefined}
            image={user()?.image}
            userId={user()?.id ?? ""}
          />
          <div>
            <p class="font-sans text-body font-semibold text-fg">{[user()?.firstName, user()?.lastName].filter(Boolean).join(" ") || user()?.username}</p>
            <Badge variant={roleVariant[auth.role() ?? "viewer"]}>{auth.role()}</Badge>
          </div>
        </div>

        <form class="space-y-4" onSubmit={saveProfile}>
          <div class="grid grid-cols-2 gap-3">
            <Field label={t("admin.firstName")}>
              <Input value={firstName()} onInput={(e) => setFirstName(e.currentTarget.value)} />
            </Field>
            <Field label={t("admin.lastName")}>
              <Input value={lastName()} onInput={(e) => setLastName(e.currentTarget.value)} />
            </Field>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <Field label={t("admin.username")} hint={t("admin.usernameHint")}>
              <Input value={user()?.username ?? ""} disabled />
            </Field>
            <Field label={t("admin.email")}>
              <Input value={user()?.email ?? ""} disabled />
            </Field>
          </div>

          <div class="flex justify-end pt-2">
            <Button type="submit" loading={saving()}>
              {t("admin.save")}
            </Button>
          </div>
        </form>
      </Card>

      <Card padding="lg" class="space-y-4">
        <h2 class="font-display text-h2 font-semibold text-fg">{t("prefs.settings")}</h2>
        <PrefsControls />
      </Card>
    </div>
  );
};

export default SettingsPage;
