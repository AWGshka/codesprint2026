import { count, desc, eq } from "drizzle-orm";

import { db } from "~/db";
import { campaigns } from "~/db/campaigns";
import { donations } from "~/db/donations";
import { isSupportedCurrency, toEURMinor } from "~/lib/currency";

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

// Aggregates in JS over the (seed-sized) completed-donations set — simple and
// correct beats a fancy SQL group-by for a few hundred rows in a prototype.
export abstract class DashboardService {
  static async stats() {
    const ninetyDaysAgo = new Date(Date.now() - NINETY_DAYS_MS);

    const completed = await db
      .select({ campaignId: donations.campaignId, amountMinor: donations.amountMinor, currency: donations.currency, createdAt: donations.createdAt })
      .from(donations)
      .where(eq(donations.status, "completed"));

    const totalsByCurrency = new Map<string, { totalMinor: number; count: number }>();
    const perCampaign = new Map<string, { raisedEURMinor: number; count: number }>();
    const trendByDay = new Map<string, { totalEURMinor: number; count: number }>();
    let totalEURMinor = 0;

    for (const d of completed) {
      const currency = isSupportedCurrency(d.currency) ? d.currency : "EUR";

      const byCurrency = totalsByCurrency.get(currency) ?? { totalMinor: 0, count: 0 };
      byCurrency.totalMinor += d.amountMinor;
      byCurrency.count += 1;
      totalsByCurrency.set(currency, byCurrency);

      const eur = toEURMinor(d.amountMinor, currency);
      totalEURMinor += eur;

      const campaignAgg = perCampaign.get(d.campaignId) ?? { raisedEURMinor: 0, count: 0 };
      campaignAgg.raisedEURMinor += eur;
      campaignAgg.count += 1;
      perCampaign.set(d.campaignId, campaignAgg);

      if (d.createdAt >= ninetyDaysAgo) {
        const day = d.createdAt.toISOString().slice(0, 10);
        const dayAgg = trendByDay.get(day) ?? { totalEURMinor: 0, count: 0 };
        dayAgg.totalEURMinor += eur;
        dayAgg.count += 1;
        trendByDay.set(day, dayAgg);
      }
    }

    const [activeRow] = await db.select({ total: count() }).from(campaigns).where(eq(campaigns.status, "active"));
    const campaignRows = await db
      .select({ id: campaigns.id, name: campaigns.name, targetMinor: campaigns.targetMinor, currency: campaigns.currency, status: campaigns.status })
      .from(campaigns);
    const campaignById = new Map(campaignRows.map((c) => [c.id, c]));

    const targetEUROf = (c: (typeof campaignRows)[number] | undefined) =>
      c ? toEURMinor(c.targetMinor, isSupportedCurrency(c.currency) ? c.currency : "EUR") : 0;

    const topCampaigns = [...perCampaign.entries()]
      .map(([campaignId, v]) => ({
        campaignId,
        name: campaignById.get(campaignId)?.name ?? "Unknown",
        raisedEURMinor: v.raisedEURMinor,
        targetEURMinor: targetEUROf(campaignById.get(campaignId)),
        donationCount: v.count,
      }))
      .sort((a, b) => b.raisedEURMinor - a.raisedEURMinor)
      .slice(0, 5);

    // Progress vs goal (M2.3): raised on active campaigns / summed targets of
    // active campaigns, both through the EUR bridge.
    const activeCampaigns = campaignRows.filter((c) => c.status === "active");
    const goalEURMinor = activeCampaigns.reduce((sum, c) => sum + targetEUROf(c), 0);
    const goalRaisedEURMinor = activeCampaigns.reduce((sum, c) => sum + (perCampaign.get(c.id)?.raisedEURMinor ?? 0), 0);
    const goalProgressPct = goalEURMinor > 0 ? (goalRaisedEURMinor / goalEURMinor) * 100 : 0;

    const recentRows = await db
      .select({ donation: donations, campaignName: campaigns.name })
      .from(donations)
      .innerJoin(campaigns, eq(donations.campaignId, campaigns.id))
      .orderBy(desc(donations.createdAt))
      .limit(10);

    const recentDonations = recentRows.map((r) => ({
      reference: r.donation.reference,
      campaignName: r.campaignName,
      amountMinor: r.donation.amountMinor,
      currency: r.donation.currency,
      source: r.donation.source,
      createdAt: r.donation.createdAt.toISOString(),
    }));

    const trend = [...trendByDay.entries()]
      .map(([date, v]) => ({ date, totalEURMinor: v.totalEURMinor, count: v.count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      totalsByCurrency: [...totalsByCurrency.entries()].map(([currency, v]) => ({ currency, totalMinor: v.totalMinor, count: v.count })),
      totalEURMinor,
      donationCount: completed.length,
      activeCampaignCount: activeRow?.total ?? 0,
      goalEURMinor,
      goalRaisedEURMinor,
      goalProgressPct,
      topCampaigns,
      recentDonations,
      trend,
    };
  }
}
