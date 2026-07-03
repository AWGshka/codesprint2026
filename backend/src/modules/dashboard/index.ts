import { DashboardService } from "./service";
import { DashboardStatsSchema } from "./model";

import { Elysia } from "elysia";

import { data, ok } from "~/lib/response";
import { authPlugin } from "~/plugins/auth";

export const dashboard = new Elysia({ name: "dashboard" })
  .use(authPlugin)
  .get("/admin/dashboard", async () => ok(await DashboardService.stats()), {
    auth: true,
    permissions: { donation: ["read"] },
    response: { 200: data(DashboardStatsSchema) },
    detail: { summary: "Live dashboard stats: totals, EUR-equivalent, top campaigns, recent donations, 90-day trend", tags: ["Admin", "Dashboard"] },
  });
