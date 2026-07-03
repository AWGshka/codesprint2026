import { t } from "elysia";

export const CurrencyTotalSchema = t.Object({ currency: t.String(), totalMinor: t.Integer(), count: t.Integer() });

export const TopCampaignSchema = t.Object({ campaignId: t.String(), name: t.String(), raisedEURMinor: t.Integer(), donationCount: t.Integer() });

export const RecentDonationSchema = t.Object({
  reference: t.String(),
  campaignName: t.String(),
  amountMinor: t.Integer(),
  currency: t.String(),
  source: t.String(),
  createdAt: t.String(),
});

export const TrendPointSchema = t.Object({ date: t.String(), totalEURMinor: t.Integer(), count: t.Integer() });

export const DashboardStatsSchema = t.Object({
  totalsByCurrency: t.Array(CurrencyTotalSchema),
  totalEURMinor: t.Integer(),
  donationCount: t.Integer(),
  activeCampaignCount: t.Integer(),
  topCampaigns: t.Array(TopCampaignSchema),
  recentDonations: t.Array(RecentDonationSchema),
  trend: t.Array(TrendPointSchema),
});
