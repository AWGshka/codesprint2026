import { ImpactService } from "./service";

import { describe, expect, it } from "bun:test";

import { DashboardService } from "~/modules/dashboard/service";

// DB-touching (assumes `db:migrate` + `db:seed` have run).
describe("ImpactService.stats", () => {
  it("returns real aggregates shaped per the contract", async () => {
    const stats = await ImpactService.stats();

    expect(stats.totalRaisedMinor).toBeGreaterThan(0);
    expect(stats.donationCount).toBeGreaterThan(0);
    expect(stats.donorCount).toBe(stats.donationCount);
    expect(stats.activeCampaignCount).toBeGreaterThan(0);
    expect(Array.isArray(stats.perCampaign)).toBe(true);
    expect(stats.perCampaign.length).toBeGreaterThan(0);

    for (const c of stats.perCampaign) {
      expect(typeof c.id).toBe("string");
      expect(typeof c.slug).toBe("string");
      expect(typeof c.title).toBe("string");
      expect(c.raisedMinor).toBeGreaterThanOrEqual(0);
      expect(c.targetMinor).toBeGreaterThan(0);
      expect(c.donorCount).toBeGreaterThanOrEqual(0);
    }
  });

  it("stays consistent with the dashboard's donation count (same completed-donations methodology)", async () => {
    const [impact, dashboard] = await Promise.all([ImpactService.stats(), DashboardService.stats()]);
    expect(impact.donationCount).toBe(dashboard.donationCount);
    expect(impact.activeCampaignCount).toBe(dashboard.activeCampaignCount);
  });
});
