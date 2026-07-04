import { t } from "elysia";

export const ReconStatusSchema = t.Union([t.Literal("matched"), t.Literal("mismatched"), t.Literal("missingInProcessor"), t.Literal("missingInApp")]);

export const ReconSideSchema = t.Nullable(t.Object({ amountMinor: t.Integer(), currency: t.String(), status: t.String() }));

export const ReconRowSchema = t.Object({
  paymentRef: t.String(),
  status: ReconStatusSchema,
  reference: t.Nullable(t.String()),
  donation: ReconSideSchema,
  settlement: ReconSideSchema,
  reconciled: t.Boolean(),
  matchMethod: t.Nullable(t.Union([t.Literal("auto"), t.Literal("manual")])),
  matchedAt: t.Nullable(t.String()),
  occurredAt: t.Nullable(t.String()),
});

export const ReconciliationSummarySchema = t.Object({
  matched: t.Integer(),
  awaiting: t.Integer(),
  matchRate: t.Number(),
  mismatched: t.Integer(),
  missingInProcessor: t.Integer(),
  missingInApp: t.Integer(),
});

export const ReconciliationResultSchema = t.Object({ summary: ReconciliationSummarySchema, rows: t.Array(ReconRowSchema) });

export const MatchBody = t.Object({ paymentRef: t.String({ minLength: 1 }) });

export const MatchResponse = t.Object({ matched: t.Boolean(), alreadyMatched: t.Boolean() });

export const AutoMatchResponse = t.Object({ matchedCount: t.Integer() });

export const SettlementSchema = t.Object({
  id: t.String(),
  paymentRef: t.String(),
  amountMinor: t.Integer(),
  currency: t.String(),
  status: t.String(),
  processedAt: t.String(),
});
