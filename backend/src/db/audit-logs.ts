import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { user } from "~/db/auth-schema";

// Fixed enum — every admin mutation writes one of these.
export type AuditAction =
  | "campaign.create"
  | "campaign.update"
  | "campaign.delete"
  | "user.role_change"
  | "reconciliation.run"
  | "reconciliation.match"
  | "reconciliation.automatch"
  | "donation.recorded"
  | "ledger.export.csv"
  | "ledger.export.pdf"
  | "auth.login";

export type AuditTargetType = "campaign" | "user" | "ledger" | "reconciliation" | "donation" | "auth";

export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    actorId: text("actor_id")
      .notNull()
      .references(() => user.id),
    actorEmail: text("actor_email").notNull(),
    action: text("action").notNull().$type<AuditAction>(),
    targetType: text("target_type").$type<AuditTargetType>(),
    targetId: text("target_id"),
    metadata: text("metadata", { mode: "json" }).$type<Record<string, unknown>>(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("audit_logs_created_at_idx").on(table.createdAt),
    index("audit_logs_actor_id_idx").on(table.actorId),
    index("audit_logs_action_idx").on(table.action),
  ],
);

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
