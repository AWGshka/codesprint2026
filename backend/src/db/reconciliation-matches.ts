import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Persisted reconciliation state, keyed by the pair's paymentRef. A row here
// means an operator (or the auto-matcher) confirmed the sandbox settlement and
// the app's donation record agree. Rows without an entry are "awaiting match".
// Kept separate from processor_settlements because missing-in-processor pairs
// have no settlement row to hang a flag on.
export type MatchMethod = "auto" | "manual";

export const reconciliationMatches = sqliteTable("reconciliation_matches", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  paymentRef: text("payment_ref").notNull().unique(),
  method: text("method").notNull().$type<MatchMethod>(),
  matchedBy: text("matched_by").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type ReconciliationMatch = typeof reconciliationMatches.$inferSelect;
export type NewReconciliationMatch = typeof reconciliationMatches.$inferInsert;
