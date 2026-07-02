import { eq } from "drizzle-orm";

import { db } from "~/db";
import { auth } from "~/auth";
import { user as userTable } from "~/db/auth-schema";
import { AuditService } from "~/modules/audit/service";
import { CannotChangeOwnRole, LastAdmin, NotFound } from "~/lib/errors";

// `auth.api.listUsers`/`setRole` type as `UserWithRole` from the admin
// plugin's own declaration, which doesn't know about the `username` plugin's
// or our `firstName`/`lastName` additional fields - read them defensively via
// an index cast.
const usernameOf = (u: object): string | null => (u as { username?: string | null }).username ?? null;
const stringFieldOf = (u: object, key: "firstName" | "lastName"): string | null => {
  const value = (u as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
};

export type Role = "viewer" | "manager" | "admin";

export abstract class UserService {
  static async list(headers: Headers) {
    const result = await auth.api.listUsers({ headers, query: {} });

    return {
      rows: result.users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        username: usernameOf(u),
        firstName: stringFieldOf(u, "firstName"),
        lastName: stringFieldOf(u, "lastName"),
        image: u.image ?? null,
        role: u.role ?? null,
        banned: u.banned ?? null,
        createdAt: u.createdAt.toISOString(),
      })),
      total: result.total,
    };
  }

  static async setRole(headers: Headers, userId: string, role: Role, actor: { id: string; email: string }) {
    // Guard 1 (D2): admins may not change their own role - prevents accidental
    // self-lockout and keeps role changes auditable by a different actor.
    if (actor.id === userId) throw CannotChangeOwnRole();

    const [target] = await db.select({ role: userTable.role }).from(userTable).where(eq(userTable.id, userId)).limit(1);
    if (!target) throw NotFound("User not found");

    // Guard 2 (D2): refuse a change that would leave zero admins. Only
    // relevant when demoting a *current* admin to a non-admin role.
    if (target.role === "admin" && role !== "admin") {
      const admins = await db.select({ id: userTable.id }).from(userTable).where(eq(userTable.role, "admin"));
      if (admins.length <= 1) throw LastAdmin();
    }

    const result = await auth.api.setRole({ headers, body: { userId, role } });

    await AuditService.record({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "user.role_change",
      targetType: "user",
      targetId: userId,
      metadata: { role },
    });

    return {
      id: result.user.id,
      name: result.user.name,
      email: result.user.email,
      username: usernameOf(result.user),
      firstName: stringFieldOf(result.user, "firstName"),
      lastName: stringFieldOf(result.user, "lastName"),
      image: result.user.image ?? null,
      role: result.user.role ?? null,
      banned: result.user.banned ?? null,
      createdAt: result.user.createdAt.toISOString(),
    };
  }
}
