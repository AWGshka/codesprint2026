import { CampaignService } from "./service";
import { CampaignListQuery, CampaignListResponse, CampaignWithProgressSchema, CreateCampaignBody, IdParams, SlugParams, UpdateCampaignBody } from "./model";

import { Elysia, t } from "elysia";

import { data, ok } from "~/lib/response";
import { authPlugin } from "~/plugins/auth";

export const campaigns = new Elysia({ name: "campaigns" })
  .use(authPlugin)
  // Public — discover
  .get("/campaigns", async () => ok(await CampaignService.listPublicActive()), {
    response: { 200: data(t.Array(CampaignWithProgressSchema)) },
    detail: { summary: "List active campaigns (public discover)", tags: ["Campaigns"] },
  })
  .get("/campaigns/:slug", async ({ params }) => ok(await CampaignService.getPublicBySlug(params.slug)), {
    params: SlugParams,
    response: { 200: data(CampaignWithProgressSchema) },
    detail: { summary: "Campaign landing page data (branding + progress)", tags: ["Campaigns"] },
  })
  // Admin — CRUD
  .get("/admin/campaigns", async ({ query }) => ok(await CampaignService.listAdmin(query)), {
    auth: true,
    permissions: { campaign: ["read"] },
    query: CampaignListQuery,
    response: { 200: data(CampaignListResponse) },
    detail: { summary: "List campaigns (admin, filters: status, q)", tags: ["Admin", "Campaigns"] },
  })
  .post("/admin/campaigns", async ({ body, user }) => ok(await CampaignService.create(body, { id: user.id, email: user.email })), {
    auth: true,
    permissions: { campaign: ["create"] },
    body: CreateCampaignBody,
    detail: { summary: "Create a campaign (audited)", tags: ["Admin", "Campaigns"] },
  })
  .get("/admin/campaigns/:id", async ({ params }) => ok(await CampaignService.getAdmin(params.id)), {
    auth: true,
    permissions: { campaign: ["read"] },
    params: IdParams,
    detail: { summary: "Campaign detail (admin)", tags: ["Admin", "Campaigns"] },
  })
  .put("/admin/campaigns/:id", async ({ params, body, user }) => ok(await CampaignService.update(params.id, body, { id: user.id, email: user.email })), {
    auth: true,
    permissions: { campaign: ["update"] },
    params: IdParams,
    body: UpdateCampaignBody,
    detail: { summary: "Update a campaign (audited)", tags: ["Admin", "Campaigns"] },
  })
  .delete("/admin/campaigns/:id", async ({ params, user }) => ok(await CampaignService.remove(params.id, { id: user.id, email: user.email })), {
    auth: true,
    permissions: { campaign: ["delete"] },
    params: IdParams,
    detail: { summary: "Delete a campaign (audited)", tags: ["Admin", "Campaigns"] },
  });
