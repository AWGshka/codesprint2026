import { ImpactService } from "./service";
import { ImpactStatsSchema } from "./model";

import { Elysia } from "elysia";

import { data, ok } from "~/lib/response";
import { authPlugin } from "~/plugins/auth";

export const impact = new Elysia({ name: "impact" }).use(authPlugin).get("/admin/impact", async () => ok(await ImpactService.stats()), {
  auth: true,
  // Any admin-console role (viewer included) - same grant the dashboard uses.
  permissions: { donation: ["read"] },
  response: { 200: data(ImpactStatsSchema) },
  detail: { summary: "Real donation/campaign impact aggregates (completed donations only)", tags: ["Admin", "Impact"] },
});
