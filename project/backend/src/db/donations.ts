import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { type Frequency, campaigns } from "~/db/campaigns";

export type DonationStatus = "completed" | "pending" | "failed";
export type DonationSource = "web" | "kiosk";

export const donations = sqliteTable(
  "donations",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    // Human-facing receipt reference, e.g. "MFB-7QX3" (<CAMP initials>-<base36x4>).
    reference: text("reference").notNull().unique(),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => campaigns.id),
    donorName: text("donor_name"),
    donorEmail: text("donor_email"),
    amountMinor: integer("amount_minor").notNull(),
    currency: text("currency").notNull(),
    frequency: text("frequency").notNull().$type<Frequency>(),
    status: text("status").notNull().$type<DonationStatus>(),
    source: text("source").notNull().$type<DonationSource>(),
    // Links to processor_settlements.payment_ref - a logical join for
    // reconciliation, not a DB foreign key (mismatches are intentional seed data).
    paymentRef: text("payment_ref").notNull().unique(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("donations_campaign_id_idx").on(table.campaignId),
    index("donations_status_idx").on(table.status),
    index("donations_currency_idx").on(table.currency),
    index("donations_created_at_idx").on(table.createdAt),
    index("donations_payment_ref_idx").on(table.paymentRef),
  ],
);

export type Donation = typeof donations.$inferSelect;
export type NewDonation = typeof donations.$inferInsert;
