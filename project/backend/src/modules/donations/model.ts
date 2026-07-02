import { t } from "elysia";

import { CurrencySchema } from "~/lib/currency";
import { FrequencySchema, SlugParams } from "~/modules/campaigns/model";

export const DonationStatusSchema = t.Union([t.Literal("completed"), t.Literal("pending"), t.Literal("failed")]);

export const DonationSourceSchema = t.Union([t.Literal("web"), t.Literal("kiosk")]);

export const CreateDonationBody = t.Object({
  amountMinor: t.Integer({ minimum: 1 }),
  currency: CurrencySchema,
  frequency: FrequencySchema,
  donorName: t.Optional(t.Nullable(t.String())),
  donorEmail: t.Optional(t.Nullable(t.String())),
  source: DonationSourceSchema,
  card: t.Optional(t.Object({ last4: t.String({ minLength: 4, maxLength: 4 }) })),
});

export const DonationSchema = t.Object({
  id: t.String(),
  reference: t.String(),
  campaignId: t.String(),
  donorName: t.Nullable(t.String()),
  donorEmail: t.Nullable(t.String()),
  amountMinor: t.Integer(),
  currency: t.String(),
  frequency: FrequencySchema,
  status: DonationStatusSchema,
  source: DonationSourceSchema,
  createdAt: t.String(),
});

export const DonationReceiptSchema = t.Composite([DonationSchema, t.Object({ campaignName: t.String(), campaignSlug: t.String() })]);

export const CreateDonationResponse = t.Object({ reference: t.String(), status: DonationStatusSchema, donation: DonationSchema });

export const ReferenceParams = t.Object({ ...SlugParams.properties, reference: t.String() });

export const DonationAdminSchema = t.Composite([DonationSchema, t.Object({ paymentRef: t.String(), campaignName: t.String() })]);

export const DonationListQuery = t.Object({
  campaignId: t.Optional(t.String()),
  currency: t.Optional(t.String()),
  status: t.Optional(t.String()),
  source: t.Optional(t.String()),
  dateFrom: t.Optional(t.String()),
  dateTo: t.Optional(t.String()),
  q: t.Optional(t.String()),
  sort: t.Optional(t.String()),
  dir: t.Optional(t.Union([t.Literal("asc"), t.Literal("desc")])),
  page: t.Optional(t.Numeric()),
  pageSize: t.Optional(t.Numeric()),
});

export const DonationListResponse = t.Object({ rows: t.Array(DonationAdminSchema), total: t.Integer(), page: t.Integer(), pageSize: t.Integer() });

// `pages` (D4, run 2): a comma-separated list of page numbers/ranges (e.g.
// "1-3,5"), 1-indexed, relative to `pageSize` (defaults to 20 for exports,
// independent of the admin-list default of 25). Omitted -> full filtered set
// (existing behavior, capped at 50k). Format is validated in the service (400
// `BAD_REQUEST` on garbage), not via a TypeBox pattern, so a malformed value
// surfaces as our own error envelope instead of Elysia's 422 VALIDATION.
export const ExportListQuery = t.Composite([DonationListQuery, t.Object({ pages: t.Optional(t.String()) })]);

export const ExportJsonResponse = t.Object({ rows: t.Array(DonationAdminSchema) });

export type CreateDonationInput = typeof CreateDonationBody.static;
export type DonationListFilters = typeof DonationListQuery.static;
export type ExportListFilters = typeof ExportListQuery.static;
