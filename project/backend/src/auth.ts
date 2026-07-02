import { betterAuth } from "better-auth";
import { admin, username } from "better-auth/plugins";
import { createAuthMiddleware } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements } from "better-auth/plugins/admin/access";

import { db } from "~/db";
import { env } from "~/env";
import { AuditService } from "~/modules/audit/service";

// GiveTap RBAC (spec §5.2) - single organization, no org scoping.
// `defaultStatements` (user/session) are the admin plugin's own resources -
// its built-in routes (list/ban/set-role/impersonate/...) check permissions
// against them internally, so every role must carry the actions it needs
// there even though the spec's table simplifies "user" to read/manage.
const statement = {
  ...defaultStatements,
  campaign: ["read", "create", "update", "delete"],
  donation: ["read", "export"],
  reconciliation: ["read", "run"],
  audit: ["read"],
} as const;

export const ac = createAccessControl(statement);

export const viewer = ac.newRole({ campaign: ["read"], donation: ["read"], reconciliation: ["read"], audit: ["read"] });

export const manager = ac.newRole({ campaign: ["read", "create", "update"], donation: ["read", "export"], reconciliation: ["read", "run"], audit: ["read"] });

export const admin_ = ac.newRole({
  campaign: ["read", "create", "update", "delete"],
  donation: ["read", "export"],
  reconciliation: ["read", "run"],
  audit: ["read"],
  user: [...defaultStatements.user],
  session: [...defaultStatements.session],
});

// Login is a normalized username (lowercase, no spaces) + password - not email.
// Better Auth still keeps email on the user record (unique account key / future
// recovery), but sign-in uses the username. Expand here: social providers, 2FA.
export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.FRONTEND_URL],
  database: drizzleAdapter(db, { provider: "sqlite" }),
  emailAndPassword: { enabled: true },
  // Nullable profile fields (D7, run 2) - surfaced on `auth.api.updateUser` and
  // the users list DTO; `name` stays the Better Auth display name (backend
  // derives it as `firstName + " " + lastName`, falling back to `username`).
  user: { additionalFields: { firstName: { type: "string", required: false, input: true }, lastName: { type: "string", required: false, input: true } } },
  plugins: [
    username({
      minUsernameLength: 3,
      maxUsernameLength: 30,
      usernameNormalization: (value) => value.toLowerCase(),
      usernameValidator: (value) => /^[a-zA-Z0-9_]+$/.test(value),
    }),
    admin({ ac, roles: { viewer, manager, admin: admin_ }, defaultRole: "viewer", adminRoles: ["admin"] }),
  ],
  // Cross-site prod (Cloudflare Pages ↔ VPS) needs SameSite=None; Secure cookies.
  // Uncomment in production; leave off in dev (same-site localhost works as-is).
  // advanced: { defaultCookieAttributes: { sameSite: "none", secure: true } },
  // D7 (run 2): `POST /update-user` accepts `firstName`/`lastName` (registered
  // additionalFields above) but never touches `name` on its own. This keeps
  // Better Auth's display `name` in sync in the same DB write when the caller
  // sends both fields and doesn't already set `name` explicitly. Partial
  // updates (only one of the two) leave `name` untouched rather than risk
  // stale-value guessing - the settings-page form should always submit both.
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (!ctx.path.startsWith("/update-user")) return;

      const body = ctx.body as Record<string, unknown> | undefined;
      if (!body || typeof body !== "object" || Array.isArray(body)) return;
      if (body.name !== undefined) return; // caller set `name` explicitly - respect it

      const firstName = typeof body.firstName === "string" ? body.firstName.trim() : undefined;
      const lastName = typeof body.lastName === "string" ? body.lastName.trim() : undefined;
      if (firstName === undefined || lastName === undefined) return;

      const derivedName = `${firstName} ${lastName}`.trim();
      if (!derivedName) return;

      return { context: { body: { ...body, name: derivedName } } };
    }),
    // Records `auth.login` in the audit trail (spec §7.6) on any successful sign-in.
    after: createAuthMiddleware(async (ctx) => {
      if (!ctx.path.startsWith("/sign-in")) return;

      const newSession = ctx.context.newSession;
      if (!newSession) return;

      await AuditService.record({
        actorId: newSession.user.id,
        actorEmail: newSession.user.email,
        action: "auth.login",
        targetType: "auth",
        targetId: newSession.user.id,
      });
    }),
  },
});
