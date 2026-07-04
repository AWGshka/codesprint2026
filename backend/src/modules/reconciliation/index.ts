import { ReconciliationService } from "./service";
import { AutoMatchResponse, MatchBody, MatchResponse, ReconciliationResultSchema, SettlementSchema } from "./model";

import { Elysia, t } from "elysia";

import { data, ok } from "~/lib/response";
import { authPlugin } from "~/plugins/auth";

// Viewing the diff is a read (auditor+); confirming matches mutates state and
// is reserved for the charity admin (`reconciliation.match`).
export const reconciliation = new Elysia({ name: "reconciliation" })
  .use(authPlugin)
  .get("/admin/reconciliation", async () => ok(await ReconciliationService.state()), {
    auth: true,
    permissions: { reconciliation: ["read"] },
    response: { 200: data(ReconciliationResultSchema) },
    detail: { summary: "Donation <-> processor-settlement diff with persisted match state", tags: ["Admin", "Reconciliation"] },
  })
  .post("/admin/reconciliation/automatch", async ({ user }) => ok(await ReconciliationService.autoMatch({ id: user.id, email: user.email })), {
    auth: true,
    permissions: { reconciliation: ["match"] },
    response: { 200: data(AutoMatchResponse) },
    detail: { summary: "Reconcile every exactly-matching awaiting pair (audited)", tags: ["Admin", "Reconciliation"] },
  })
  .post(
    "/admin/reconciliation/match",
    async ({ body, user }) => ok(await ReconciliationService.matchOne(body.paymentRef, { id: user.id, email: user.email })),
    {
      auth: true,
      permissions: { reconciliation: ["match"] },
      body: MatchBody,
      response: { 200: data(MatchResponse) },
      detail: { summary: "Manually reconcile a single pair (audited)", tags: ["Admin", "Reconciliation"] },
    },
  )
  .get("/mock-processor/settlements", async () => ok(await ReconciliationService.settlementsFeed()), {
    response: { 200: data(t.Array(SettlementSchema)) },
    detail: { summary: "Mock external payment-processor settlements feed", tags: ["Reconciliation"] },
  });
