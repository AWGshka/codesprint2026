import { useNavigate } from "@solidjs/router";

import { createSignal } from "solid-js";
import type { Component } from "solid-js";

import { t } from "~/shared/i18n";
import { useAuth } from "~/shared/auth";
import { Button, Card, Field, Input } from "~/shared/ui";

const AdminLoginPage: Component = () => {
  const auth = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [error, setError] = createSignal<string>();
  const [busy, setBusy] = createSignal(false);

  const submit = async (event: Event) => {
    event.preventDefault();
    setError(undefined);
    setBusy(true);
    try {
      await auth.signIn(username(), password());
      navigate("/admin", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.genericError"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div class="flex min-h-screen items-center justify-center bg-surface-sunken px-4">
      <Card padding="lg" class="w-full max-w-sm space-y-6">
        <div class="space-y-1 text-center">
          <div class="mx-auto mb-2 inline-flex size-10 items-center justify-center rounded-md bg-brand text-sm font-bold text-brand-fg">GT</div>
          <h1 class="font-display text-h2 font-semibold text-fg">{t("auth.adminLoginTitle")}</h1>
          <p class="font-sans text-fs-sm text-fg-muted">{t("auth.adminLoginSubtitle")}</p>
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

        <p class="text-center font-sans text-label text-fg-muted">{t("auth.demoCredentials")}</p>
      </Card>
    </div>
  );
};

export default AdminLoginPage;
