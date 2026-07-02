import { eq } from "drizzle-orm";

import { db } from "~/db";
import { campaigns } from "~/db/campaigns";
import { donations } from "~/db/donations";
import { convertMinor, isSupportedCurrency, toEURMinor } from "~/lib/currency";

// Public-facing "our impact" aggregates (D6, run 2) - completed donations
// only, same methodology as the dashboard (§ DashboardService) so the two
// pages never disagree. Small (seed-sized) dataset, so JS aggregation over a
// single unfiltered pass is simple and correct - matches the existing
// dashboard/reconciliation services' convention in this codebase.
export abstract class ImpactService {
  static async stats() {
    const [completed, campaignRows] = await Promise.all([
      db
        .select({ campaignId: donations.campaignId, amountMinor: donations.amountMinor, currency: donations.currency })
        .from(donations)
        .where(eq(donations.status, "completed")),
      db.select().from(campaigns),
    ]);

    const campaignById = new Map(campaignRows.map((c) => [c.id, c]));
    const perCampaignAgg = new Map<string, { raisedMinor: number; donationCount: number }>();

    let totalRaisedMinor = 0; // EUR-equivalent
    for (const d of completed) {
      const currency = isSupportedCurrency(d.currency) ? d.currency : "EUR";
      totalRaisedMinor += toEURMinor(d.amountMinor, currency);

      const campaign = campaignById.get(d.campaignId);
      const target = campaign && isSupportedCurrency(campaign.currency) ? campaign.currency : "EUR";
      const agg = perCampaignAgg.get(d.campaignId) ?? { raisedMinor: 0, donationCount: 0 };
      agg.raisedMinor += convertMinor(d.amountMinor, currency, target);
      agg.donationCount += 1;
      perCampaignAgg.set(d.campaignId, agg);
    }

    const activeCampaignCount = campaignRows.filter((c) => c.status === "active").length;

    // Published campaigns only (never surface drafts on an impact page).
    const perCampaign = campaignRows
      .filter((c) => c.status !== "draft")
      .map((c) => {
        const agg = perCampaignAgg.get(c.id) ?? { raisedMinor: 0, donationCount: 0 };
        return { id: c.id, title: c.name, slug: c.slug, raisedMinor: agg.raisedMinor, targetMinor: c.targetMinor, donorCount: agg.donationCount };
      });

    return {
      totalRaisedMinor,
      // `donorCount` counts completed donations, not unique donors (no donor
      // identity is tracked) - same convention as `CampaignProgressSchema`'s
      // `donorCount` elsewhere in this API.
      donorCount: completed.length,
      donationCount: completed.length,
      activeCampaignCount,
      perCampaign,
    };
  }
}
