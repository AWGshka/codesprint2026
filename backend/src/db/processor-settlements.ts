import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Mock external payment-processor feed — reconciliation source B. Mirrors
// `donations.paymentRef` for successful gifts, with deliberate seed
// discrepancies (see seed.ts header) so the reconciliation screen has real
// matched/mismatched/missing rows to demo. No FK to donations: the join is a
// logical full-join on `paymentRef` done by the reconciliation service, not a
// DB constraint (a constraint would forbid the intentional orphans).
export type SettlementStatus = "settled" | "failed";

export const processorSettlements = sqliteTable(
  "processor_settlements",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    paymentRef: text("payment_ref").notNull(),
    amountMinor: integer("amount_minor").notNull(),
    currency: text("currency").notNull(),
    status: text("status").notNull().$type<SettlementStatus>(),
    processedAt: integer("processed_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [index("processor_settlements_payment_ref_idx").on(table.paymentRef)],
);

export type ProcessorSettlement = typeof processorSettlements.$inferSelect;
export type NewProcessorSettlement = typeof processorSettlements.$inferInsert;
