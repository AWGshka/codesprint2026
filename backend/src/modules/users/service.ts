import { auth } from "~/auth";
import { AppError } from "~/lib/errors";
import { AuditService } from "~/modules/audit/service";

// `auth.api.listUsers`/`setRole`/`getUser` type as `UserWithRole` from the
// admin plugin's own declaration, which doesn't know about the `username`
// plugin's additional fields — read them defensively via an index cast.
const usernameOf = (u: object): string | null => (u as { username?: string | null }).username ?? null;
const firstNameOf = (u: object): string | null => (u as { firstName?: string | null }).firstName ?? null;
const lastNameOf = (u: object): string | null => (u as { lastName?: string | null }).lastName ?? null;

export type Role = "auditor" | "volunteer" | "admin";

// Roles assignable via PATCH :id/role — admin is deliberately excluded, an
// admin can never be minted through this API.
const ASSIGNABLE_ROLES: readonly Role[] = ["auditor", "volunteer"];

export abstract class UserService {
  static async list(headers: Headers) {
    const result = await auth.api.listUsers({ headers, query: {} });

    return {
      rows: result.users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        username: usernameOf(u),
        firstName: firstNameOf(u),
        lastName: lastNameOf(u),
        role: u.role ?? null,
        banned: u.banned ?? null,
        createdAt: u.createdAt.toISOString(),
      })),
      total: result.total,
    };
  }

  static async setRole(headers: Headers, userId: string, role: Role, actor: { id: string; email: string }) {
    if (!ASSIGNABLE_ROLES.includes(role)) {
      throw new AppError(400, "INVALID_ROLE", "Role must be one of: auditor, volunteer (admins cannot be granted via this API)");
    }

    if (userId === actor.id) {
      throw new AppError(403, "CANNOT_CHANGE_OWN_ROLE", "You cannot change your own role");
    }

    const target = await auth.api.getUser({ headers, query: { id: userId } });
    if (target?.role === "admin") {
      throw new AppError(403, "CANNOT_MODIFY_ADMIN", "Admins cannot modify the role of another admin");
    }

    const result = await auth.api.setRole({ headers, body: { userId, role } });

    await AuditService.record({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "user.role_change",
      targetType: "user",
      targetId: userId,
      // Enough context to read the entry without chasing the user id: who was
      // changed, and from what role to what role.
      metadata: {
        fromRole: target?.role ?? null,
        toRole: role,
        targetName: target ? [firstNameOf(target), lastNameOf(target)].filter(Boolean).join(" ") || target.name : null,
        targetUsername: target ? usernameOf(target) : null,
      },
    });

    return {
      id: result.user.id,
      name: result.user.name,
      email: result.user.email,
      username: usernameOf(result.user),
      firstName: firstNameOf(result.user),
      lastName: lastNameOf(result.user),
      role: result.user.role ?? null,
      banned: result.user.banned ?? null,
      createdAt: result.user.createdAt.toISOString(),
    };
  }
}
