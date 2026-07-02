import { useAuth } from "./context";

import { Navigate } from "@solidjs/router";

import { Show } from "solid-js";
import type { ParentComponent } from "solid-js";

import { ErrorState, Spinner } from "~/shared/ui";
import type { UserRole } from "~/shared/api/types";

// Route guard: wait for the session check, then render or redirect to /login.
export const RequireAuth: ParentComponent<{ redirectTo?: string }> = (props) => {
  const auth = useAuth();

  return (
    <Show
      when={!auth.state.loading}
      fallback={
        <div class="flex justify-center py-20">
          <Spinner />
        </div>
      }>
      <Show when={auth.state.user} fallback={<Navigate href={props.redirectTo ?? "/login"} />}>
        {props.children}
      </Show>
    </Show>
  );
};

/** Nests inside RequireAuth - 403-style in-app fallback rather than a redirect, since the user *is* signed in. */
export const RequireRole: ParentComponent<{ roles: UserRole[] }> = (props) => {
  const auth = useAuth();
  return (
    <Show
      when={auth.role() && props.roles.includes(auth.role() as UserRole)}
      fallback={<ErrorState error={new Error("You don't have permission to view this page.")} />}>
      {props.children}
    </Show>
  );
};
