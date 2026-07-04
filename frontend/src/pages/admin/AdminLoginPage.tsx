import { useNavigate } from "@solidjs/router";

import type { Component } from "solid-js";
import { For, createSignal } from "solid-js";

import { t } from "~/shared/i18n";
import { useAuth } from "~/shared/auth";
import { Button, Card, Field, Input } from "~/shared/ui";

// One-click demo profiles (role ladder: Auditor < Volunteer < Charity Admin).
// Buttons sign in with the seeded demo accounts; the manual form below still
// works for any staff account.
const DEMO_PASSWORD = "demo1234";
const demoProfiles = [
  { username: "auditor", titleKey: "admin.roleAuditor", bodyKey: "auth.profileAuditorBody" },
  { username: "volunteer", titleKey: "admin.roleVolunteer", bodyKey: "auth.profileVolunteerBody" },
  { username: "admin", titleKey: "admin.roleAdmin", bodyKey: "auth.profileAdminBody" },
] as const;

const AdminLoginPage: Component = () => {
  const auth = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [error, setError] = createSignal<string>();
  const [busy, setBusy] = createSignal(false);
  const [busyProfile, setBusyProfile] = createSignal<string>();

  const signIn = async (user: string, pass: string) => {
    setError(undefined);
    try {
      await auth.signIn(user, pass);
      navigate("/admin", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.genericError"));
    }
  };

  const submit = async (event: Event) => {
    event.preventDefault();
    setBusy(true);
    await signIn(username(), password());
    setBusy(false);
  };

  const quickSignIn = async (user: string) => {
    setBusyProfile(user);
    await signIn(user, DEMO_PASSWORD);
    setBusyProfile(undefined);
  };

  return (
    <div class="flex min-h-screen items-center justify-center bg-surface-sunken px-4 py-8">
      <Card padding="lg" class="w-full max-w-md space-y-6">
        <div class="space-y-1 text-center">
          <div class="mx-auto mb-2 inline-flex size-10 items-center justify-center rounded-md bg-brand text-sm font-bold text-brand-fg">GT</div>
          <h1 class="font-display text-h2 font-semibold text-fg">{t("auth.adminLoginTitle")}</h1>
          <p class="font-sans text-fs-sm text-fg-muted">{t("auth.demoProfilesTitle")}</p>
        </div>

        <div class="space-y-2">
          <For each={demoProfiles}>
            {(profile) => (
              <button
                type="button"
                disabled={Boolean(busyProfile())}
                onClick={() => quickSignIn(profile.username)}
                class="w-full rounded-md border border-border-strong px-4 py-3 text-left transition-colors hover:border-brand hover:bg-brand/5 disabled:opacity-60">
                <span class="flex items-center justify-between font-sans text-body font-semibold text-fg">
                  {t(profile.titleKey)}
                  <span class="font-mono text-label text-fg-muted">{busyProfile() === profile.username ? t("common.loading") : profile.username}</span>
                </span>
                <span class="mt-0.5 block font-sans text-label text-fg-muted">{t(profile.bodyKey)}</span>
              </button>
            )}
          </For>
          <p class="text-center font-sans text-label text-fg-muted">{t("auth.demoCredentials")}</p>
        </div>

        <div class="flex items-center gap-3" aria-hidden="true">
          <span class="h-px flex-1 bg-border" />
          <span class="font-sans text-label text-fg-muted">{t("auth.orSignInManually")}</span>
          <span class="h-px flex-1 bg-border" />
        </div>

        <form class="space-y-3" onSubmit={submit}>
          <Field label={t("auth.usernameLabel")}>
            <Input class="min-h-11" autocomplete="username" required value={username()} onInput={(e) => setUsername(e.currentTarget.value)} />
          </Field>
          <Field label={t("auth.passwordLabel")} error={error()}>
            <Input
              type="password"
              class="min-h-11"
              autocomplete="current-password"
              required
              invalid={Boolean(error())}
              value={password()}
              onInput={(e) => setPassword(e.currentTarget.value)}
            />
          </Field>
          <Button type="submit" class="min-h-11 w-full" loading={busy()}>
            {t("nav.signIn")}
          </Button>
        </form>
      </Card>
    </div>
  );
};

export default AdminLoginPage;
