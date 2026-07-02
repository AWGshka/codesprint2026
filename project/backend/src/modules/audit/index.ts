import { AuditService } from "./service";
import { AuditListQuery, AuditListResponse, ClientEventBody } from "./model";

import { Elysia, t } from "elysia";

import { data, ok } from "~/lib/response";
import { authPlugin } from "~/plugins/auth";

export const audit = new Elysia({ name: "audit" })
  .use(authPlugin)
  .get("/admin/audit", async ({ query }) => ok(await AuditService.list(query)), {
    auth: true,
    permissions: { audit: ["read"] },
    query: AuditListQuery,
    response: { 200: data(AuditListResponse) },
    detail: { summary: "List audit log entries (filters: action, actorId, dateFrom, dateTo)", tags: ["Admin", "Audit"] },
  })
  .post(
    "/admin/audit/client-event",
    async ({ body, user }) => {
      await AuditService.record({
        actorId: user.id,
        actorEmail: user.email,
        action: body.action,
        targetType: body.targetType,
        targetId: body.targetId,
        metadata: body.metadata as Record<string, unknown> | undefined,
      });
      return ok({ recorded: true });
    },
    {
      auth: true,
      permissions: { donation: ["read"] },
      body: ClientEventBody,
      response: { 200: data(t.Object({ recorded: t.Boolean() })) },
      detail: { summary: "Record a restricted client-side audit event (e.g. ledger.export.pdf)", tags: ["Admin", "Audit"] },
    },
  );
