import { UserService } from "./service";
import { UpdateRoleBody, UserIdParams, UserListResponse, UserSchema } from "./model";

import { Elysia } from "elysia";

import { data, ok } from "~/lib/response";
import { authPlugin } from "~/plugins/auth";

export const users = new Elysia({ name: "users" })
  .use(authPlugin)
  .get("/admin/users", async ({ request }) => ok(await UserService.list(request.headers)), {
    auth: true,
    permissions: { user: ["list"] },
    response: { 200: data(UserListResponse) },
    detail: { summary: "List users (admin only)", tags: ["Admin", "Users"] },
  })
  .patch(
    "/admin/users/:id/role",
    async ({ request, params, body, user }) => ok(await UserService.setRole(request.headers, params.id, body.role, { id: user.id, email: user.email })),
    {
      auth: true,
      permissions: { user: ["set-role"] },
      params: UserIdParams,
      body: UpdateRoleBody,
      response: { 200: data(UserSchema) },
      detail: { summary: "Change a user's role via the Better Auth admin API (audited, admin only)", tags: ["Admin", "Users"] },
    },
  );
