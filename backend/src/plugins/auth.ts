import { Elysia } from "elysia";

import { auth } from "~/auth";

// Subset of the `ac` statement shape — e.g. { campaign: ["create"] }.
type PermissionRequest = Record<string, string[]>;

// Mounts Better Auth's handler (/api/auth/*) and exposes two macros:
// - `auth: true` requires a session and injects `user`/`session`.
// - `permissions: { resource: [action] }` requires a session AND that
//   permission (via `auth.api.userHasPermission`), 401 without a session,
//   403 without the grant. Routes opt in per-route: `{ auth: true,
//   permissions: { campaign: ["create"] } }`.
// - `optionalAuth: true` injects `actor` (user or null) without gating the
//   route — used by public routes that audit the action when a signed-in
//   volunteer/admin performs it (e.g. recording a donation at the terminal).
export const authPlugin = new Elysia({ name: "better-auth" }).mount(auth.handler).macro({
  auth: {
    async resolve({ status, request: { headers } }) {
      const session = await auth.api.getSession({ headers });
      if (!session) return status(401, { error: { code: "UNAUTHORIZED", message: "Authentication required" } });

      return { user: session.user, session: session.session };
    },
  },
  optionalAuth: {
    async resolve({ request: { headers } }) {
      const session = await auth.api.getSession({ headers });
      return { actor: session ? { id: session.user.id, email: session.user.email } : null };
    },
  },
  permissions(required: PermissionRequest) {
    return {
      async resolve({ status, request: { headers } }) {
        const session = await auth.api.getSession({ headers });
        if (!session) return status(401, { error: { code: "UNAUTHORIZED", message: "Authentication required" } });

        const result = await auth.api.userHasPermission({ body: { userId: session.user.id, permissions: required } });
        if (!result.success) return status(403, { error: { code: "FORBIDDEN", message: "Insufficient permissions" } });

        return { user: session.user, session: session.session };
      },
    };
  },
});
