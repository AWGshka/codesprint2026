import { betterAuth } from "better-auth";
import { admin, username } from "better-auth/plugins";
import { createAuthMiddleware } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements } from "better-auth/plugins/admin/access";

import { db } from "~/db";
import { env } from "~/env";
import { AuditService } from "~/modules/audit/service";

// GiveTap RBAC — single organization, no org scoping.
// `defaultStatements` (user/session) are the admin plugin's own resources —
// its built-in routes (list/ban/set-role/impersonate/...) check permissions
// against them internally, so every role must carry the actions it needs
// there for viewer/manager as well, not only admin.
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

// Login is a normalized username (lowercase, no spaces) + password — not email.
// Better Auth still keeps email on the user record (unique account key / future
// recovery), but sign-in uses the username. Expand here: social providers, 2FA.
export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: env.FRONTEND_ORIGINS,
  database: drizzleAdapter(db, { provider: "sqlite" }),
  emailAndPassword: { enabled: true },
  user: {
    additionalFields: {
      firstName: { type: "string", required: false },
      lastName: { type: "string", required: false },
    },
  },
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
  // Records `auth.login` in the audit trail on any successful sign-in.
  hooks: {
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
