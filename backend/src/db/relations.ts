import { relations } from "drizzle-orm";

import { user } from "~/db/auth-schema";
import { campaigns } from "~/db/campaigns";
import { donations } from "~/db/donations";
import { auditLogs } from "~/db/audit-logs";

// Cross-table relations live here (not inside each table file) to avoid
// circular imports between campaigns.ts <-> donations.ts.
export const campaignsRelations = relations(campaigns, ({ one, many }) => ({
  createdByUser: one(user, { fields: [campaigns.createdBy], references: [user.id] }),
  donations: many(donations),
}));

export const donationsRelations = relations(donations, ({ one }) => ({
  campaign: one(campaigns, { fields: [donations.campaignId], references: [campaigns.id] }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({ actor: one(user, { fields: [auditLogs.actorId], references: [user.id] }) }));
