import { CampaignService } from "./service";

import { describe, expect, it } from "bun:test";

// DB-touching (assumes `db:migrate` + `db:seed` have run).
describe("CampaignService.listPublicActive", () => {
  it("returns the same `progress` shape as getPublicBySlug (fixes the /discover crash)", async () => {
    const rows = await CampaignService.listPublicActive();
    expect(rows.length).toBeGreaterThan(0);

    for (const row of rows) {
      expect(row.status).toBe("active");
      expect(row.progress).toBeDefined();
      expect(typeof row.progress.raisedMinor).toBe("number");
      expect(row.progress.targetMinor).toBe(row.targetMinor);
      expect(typeof row.progress.donorCount).toBe("number");
      expect(row.progress.raisedMinor).toBeGreaterThanOrEqual(0);
      expect(row.progress.donorCount).toBeGreaterThanOrEqual(0);
    }
  });

  it("matches getPublicBySlug's progress for each active campaign (single grouped query stays correct)", async () => {
    const rows = await CampaignService.listPublicActive();
    for (const row of rows.slice(0, 3)) {
      const detail = await CampaignService.getPublicBySlug(row.slug);
      expect(detail.progress).toEqual(row.progress);
    }
  });
});
