import { ReconciliationService } from "./service";
import { ReconciliationResultSchema, SettlementSchema } from "./model";

import { Elysia, t } from "elysia";

import { data, ok } from "~/lib/response";
import { authPlugin } from "~/plugins/auth";

export const reconciliation = new Elysia({ name: "reconciliation" })
  .use(authPlugin)
  .get("/admin/reconciliation", async ({ user }) => ok(await ReconciliationService.run({ id: user.id, email: user.email })), {
    auth: true,
    permissions: { reconciliation: ["run"] },
    response: { 200: data(ReconciliationResultSchema) },
    detail: { summary: "Run the donation <-> processor-settlement reconciliation diff (audited)", tags: ["Admin", "Reconciliation"] },
  })
  .get("/mock-processor/settlements", async () => ok(await ReconciliationService.settlementsFeed()), {
    response: { 200: data(t.Array(SettlementSchema)) },
    detail: { summary: "Mock external payment-processor settlements feed", tags: ["Reconciliation"] },
  });
