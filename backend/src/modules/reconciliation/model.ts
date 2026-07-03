import { t } from "elysia";

export const ReconStatusSchema = t.Union([t.Literal("matched"), t.Literal("mismatched"), t.Literal("missingInProcessor"), t.Literal("missingInApp")]);

export const ReconSideSchema = t.Nullable(t.Object({ amountMinor: t.Integer(), currency: t.String(), status: t.String() }));

export const ReconRowSchema = t.Object({
  paymentRef: t.String(),
  status: ReconStatusSchema,
  reference: t.Nullable(t.String()),
  donation: ReconSideSchema,
  settlement: ReconSideSchema,
});

export const ReconciliationSummarySchema = t.Object({
  matched: t.Integer(),
  mismatched: t.Integer(),
  missingInProcessor: t.Integer(),
  missingInApp: t.Integer(),
});

export const ReconciliationResultSchema = t.Object({ summary: ReconciliationSummarySchema, rows: t.Array(ReconRowSchema) });

export const SettlementSchema = t.Object({
  id: t.String(),
  paymentRef: t.String(),
  amountMinor: t.Integer(),
  currency: t.String(),
  status: t.String(),
  processedAt: t.String(),
});
