import { useNavigate } from "@solidjs/router";

import type { Component } from "solid-js";
import { Show, createSignal, onCleanup } from "solid-js";

import { t } from "~/shared/i18n";
import { cn } from "~/shared/lib/cn";
import { useAuth } from "~/shared/auth";
import { Avatar, Badge } from "~/shared/ui";
import { SignOutIcon } from "~/shared/icons";
import { fullName } from "~/shared/lib/user";
import type { UserRole } from "~/shared/api/types";
import { PrefsPanelContent } from "~/shared/prefs";

const roleVariant: Record<UserRole, "neutral" | "warning" | "positive"> = { auditor: "neutral", volunteer: "warning", admin: "positive" };

const roleLabelKey: Record<UserRole, "admin.roleAuditor" | "admin.roleVolunteer" | "admin.roleAdmin"> = {
  auditor: "admin.roleAuditor",
  volunteer: "admin.roleVolunteer",
  admin: "admin.roleAdmin",
};

/**
 * Bottom-of-sidebar profile card — avatar/name/role trigger that opens a popover combining the
 * prefs panel (theme/text size/language/high-contrast, shared with `PrefsControls`) and sign-out,
 * so the admin layout only hosts one prefs+account surface instead of two separate ones.
 */
export const AdminProfileMenu: Component<{ class?: string; direction?: "up" | "down"; compact?: boolean }> = (props) => {
  const auth = useAuth();
  const navigate = useNavigate();
  let root: HTMLDivElement | undefined;
  let trigger: HTMLButtonElement | undefined;
  const [open, setOpen] = createSignal(false);
  const [anchor, setAnchor] = createSignal<DOMRect>();

  const onDocPointerDown = (event: PointerEvent) => {
    if (root && !root.contains(event.target as Node)) setOpen(false);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") setOpen(false);
  };
  document.addEventListener("pointerdown", onDocPointerDown);
  document.addEventListener("keydown", onKeyDown);
  onCleanup(() => {
    document.removeEventListener("pointerdown", onDocPointerDown);
    document.removeEventListener("keydown", onKeyDown);
  });

  const signOut = async () => {
    await auth.signOut();
    navigate("/admin/login", { replace: true });
  };

  const username = () => auth.state.user?.username ?? "";
  const role = () => auth.role();

  return (
    <div ref={root} class={cn("relative", props.class)}>
      <button
        ref={trigger}
        type="button"
        aria-label={t("prefs.settings")}
        aria-expanded={open()}
        onClick={() => {
          setAnchor(trigger?.getBoundingClientRect());
          setOpen((v) => !v);
        }}
        class={cn("flex w-full items-center gap-2.5 rounded-md p-2 text-left transition-colors hover:bg-surface-sunken", props.compact && "justify-center")}>
        <Avatar firstName={auth.firstName()} lastName={auth.lastName()} username={username()} size="sm" />
        <Show when={!props.compact}>
          <div class="min-w-0 flex-1">
            <p class="truncate font-sans text-fs-sm font-semibold text-fg">{fullName(auth.firstName(), auth.lastName(), username())}</p>
            <Show when={role()}>
              <Badge variant={roleVariant[role() as UserRole]}>{t(roleLabelKey[role() as UserRole])}</Badge>
            </Show>
          </div>
        </Show>
      </button>

      <Show when={open()}>
        {/* "up" (sidebar) renders position:fixed off the trigger rect — the aside is
            overflow-hidden and narrower than the panel, so an absolute popover gets clipped. */}
        <div
          class={cn(
            "z-50 w-64 space-y-4 rounded-lg border border-border bg-surface-raised p-4 shadow-e2",
            props.direction === "down" ? "absolute right-0 top-full mt-2" : "fixed",
          )}
          style={
            props.direction !== "down" && anchor()
              ? { left: `${Math.max(8, anchor()!.left)}px`, bottom: `${window.innerHeight - anchor()!.top + 8}px` }
              : undefined
          }>
          <PrefsPanelContent />
          <button
            type="button"
            onClick={signOut}
            class="flex min-h-10 w-full items-center gap-2 rounded-md px-3 py-2 text-left font-sans text-fs-sm font-semibold text-danger hover:bg-danger/10">
            <SignOutIcon class="size-4" aria-hidden="true" />
            {t("nav.signOut")}
          </button>
        </div>
      </Show>
    </div>
  );
};
