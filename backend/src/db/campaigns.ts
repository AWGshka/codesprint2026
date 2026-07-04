import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { user } from "~/db/auth-schema";

// Campaign status lifecycle. 'draft' campaigns are never returned
// by the public list/detail endpoints.
export type CampaignStatus = "draft" | "active" | "paused" | "ended";

// Subset of donation cadences a campaign can offer on its give flow.
// Round-up is not a cadence: it's a per-donation flag (donations.roundedUp)
// that bumps the charged amount to the next multiple of 10.
export type Frequency = "one_time" | "monthly";

export const campaigns = sqliteTable(
  "campaigns",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    cause: text("cause").notNull(),
    description: text("description").notNull(),
    story: text("story"),
    targetMinor: integer("target_minor").notNull(),
    currency: text("currency").notNull(),
    status: text("status").notNull().$type<CampaignStatus>(),
    brandColor: text("brand_color").notNull(),
    logoUrl: text("logo_url"),
    heroImageUrl: text("hero_image_url"),
    presetsMinor: text("presets_minor", { mode: "json" }).notNull().$type<number[]>(),
    allowCustom: integer("allow_custom", { mode: "boolean" }).notNull().default(true),
    frequencies: text("frequencies", { mode: "json" }).notNull().$type<Frequency[]>(),
    // Campaign run window (M2.2) — both optional: an open-ended campaign has neither.
    startsAt: integer("starts_at", { mode: "timestamp" }),
    endsAt: integer("ends_at", { mode: "timestamp" }),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (table) => [index("campaigns_status_idx").on(table.status), index("campaigns_slug_idx").on(table.slug)],
);

export type Campaign = typeof campaigns.$inferSelect;
export type NewCampaign = typeof campaigns.$inferInsert;
