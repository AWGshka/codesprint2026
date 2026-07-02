import { t } from "elysia";

export const RoleSchema = t.Union([t.Literal("viewer"), t.Literal("manager"), t.Literal("admin")]);

export const UserSchema = t.Object({
  id: t.String(),
  name: t.String(),
  email: t.String(),
  username: t.Nullable(t.String()),
  firstName: t.Nullable(t.String()),
  lastName: t.Nullable(t.String()),
  image: t.Nullable(t.String()),
  role: t.Nullable(t.String()),
  banned: t.Nullable(t.Boolean()),
  createdAt: t.String(),
});

export const UserListResponse = t.Object({ rows: t.Array(UserSchema), total: t.Integer() });

export const UpdateRoleBody = t.Object({ role: RoleSchema });

export const UserIdParams = t.Object({ id: t.String() });
