import { UserService } from "./service";

import { eq } from "drizzle-orm";
import { describe, expect, it } from "bun:test";

import { db } from "~/db";
import { AppError } from "~/lib/errors";
import { user as userTable } from "~/db/auth-schema";

// Both guards short-circuit before `auth.api.setRole` is ever called, so a
// fake `Headers` is fine here - these are DB-touching (assumes `db:migrate` +
// `db:seed` have run against the seeded demo dataset: exactly one admin,
// "admin").
describe("UserService.setRole guards (D2)", () => {
  it("rejects changing your own role with 400 cannot_change_own_role", async () => {
    const [admin] = await db.select({ id: userTable.id, email: userTable.email }).from(userTable).where(eq(userTable.role, "admin")).limit(1);
    if (!admin) throw new Error("seeded admin user not found - run db:migrate && db:seed first");

    await expect(UserService.setRole(new Headers(), admin.id, "viewer", { id: admin.id, email: admin.email })).rejects.toMatchObject({
      status: 400,
      code: "cannot_change_own_role",
    });
  });

  it("rejects demoting the last remaining admin with 400 last_admin", async () => {
    const admins = await db.select({ id: userTable.id, email: userTable.email }).from(userTable).where(eq(userTable.role, "admin"));
    expect(admins.length).toBe(1);
    const [onlyAdmin] = admins;
    if (!onlyAdmin) throw new Error("seeded admin user not found - run db:migrate && db:seed first");

    // A different actor id than the target - proves the guard fires
    // independently of the self-change guard above.
    const fakeActor = { id: "not-the-target-actor-id", email: "someone-else@demo.gt" };

    await expect(UserService.setRole(new Headers(), onlyAdmin.id, "viewer", fakeActor)).rejects.toMatchObject({ status: 400, code: "last_admin" });
  });

  it("throws NotFound for an unknown user id", async () => {
    await expect(UserService.setRole(new Headers(), "does-not-exist", "viewer", { id: "someone-else", email: "x@demo.gt" })).rejects.toBeInstanceOf(AppError);
  });
});
