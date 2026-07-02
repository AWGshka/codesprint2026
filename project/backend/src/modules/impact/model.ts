import { t } from "elysia";

export const ImpactPerCampaignSchema = t.Object({
  id: t.String(),
  title: t.String(),
  slug: t.String(),
  raisedMinor: t.Integer(),
  targetMinor: t.Integer(),
  donorCount: t.Integer(),
});

// `totalRaisedMinor` is EUR-equivalent (mirrors the dashboard's
// `totalEURMinor`, since campaigns can be in different currencies and a
// single total has to pick one). Per-campaign `raisedMinor`/`targetMinor`
// stay in the *campaign's own* currency (like `CampaignProgressSchema`) so
// they're directly comparable on a progress bar.
export const ImpactStatsSchema = t.Object({
  totalRaisedMinor: t.Integer(),
  donorCount: t.Integer(),
  donationCount: t.Integer(),
  activeCampaignCount: t.Integer(),
  perCampaign: t.Array(ImpactPerCampaignSchema),
});
