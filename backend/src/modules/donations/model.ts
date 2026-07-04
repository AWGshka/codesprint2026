import { t } from "elysia";

import { CurrencySchema } from "~/lib/currency";
import { FrequencySchema, SlugParams } from "~/modules/campaigns/model";

export const DonationStatusSchema = t.Union([t.Literal("completed"), t.Literal("declined"), t.Literal("refunded"), t.Literal("offline")]);

export const DonationSourceSchema = t.Union([t.Literal("web"), t.Literal("kiosk")]);

export const DonationMethodSchema = t.Union([t.Literal("card"), t.Literal("tap")]);

// Tap-to-pay simulation outcome, chosen on the terminal's tap screen.
// "cancelled" never reaches the server (the donor backed out before a read);
// declined/offline persist as ledger rows so every attempt is accounted for.
export const TapOutcomeSchema = t.Union([t.Literal("approved"), t.Literal("declined"), t.Literal("offline")]);

export const CreateDonationBody = t.Object({
  amountMinor: t.Integer({ minimum: 1 }),
  currency: CurrencySchema,
  frequency: FrequencySchema,
  donorName: t.Optional(t.Nullable(t.String())),
  donorEmail: t.Optional(t.Nullable(t.String())),
  source: DonationSourceSchema,
  method: t.Optional(DonationMethodSchema),
  roundedUp: t.Optional(t.Boolean()),
  giftAid: t.Optional(t.Boolean()),
  showOnWall: t.Optional(t.Boolean()),
  outcome: t.Optional(TapOutcomeSchema),
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
  method: DonationMethodSchema,
  roundedUp: t.Boolean(),
  giftAid: t.Boolean(),
  showOnWall: t.Boolean(),
  createdAt: t.String(),
});

export const DonationReceiptSchema = t.Composite([DonationSchema, t.Object({ campaignName: t.String(), campaignSlug: t.String(), paymentRef: t.String() })]);

export const CreateDonationResponse = t.Object({ reference: t.String(), status: DonationStatusSchema, donation: DonationSchema });

// Simulated receipt delivery — validated, recorded on the donation, never
// actually sent anywhere (prototype).
export const SendReceiptBody = t.Object({ channel: t.Union([t.Literal("email"), t.Literal("sms")]), to: t.String({ minLength: 3, maxLength: 254 }) });

export const SendReceiptResponse = t.Object({ sent: t.Boolean(), channel: t.String(), to: t.String() });

// Live supporters wall - all completed donations. Empty donorName = anonymous.
export const SupporterSchema = t.Object({ donorName: t.String(), amountMinor: t.Integer(), currency: t.String(), createdAt: t.String() });

export const ReferenceParams = t.Object({ ...SlugParams.properties, reference: t.String() });

export const DonationAdminSchema = t.Composite([DonationSchema, t.Object({ paymentRef: t.String(), campaignName: t.String() })]);

export const DonationListQuery = t.Object({
  campaignId: t.Optional(t.String()),
  currency: t.Optional(t.String()),
  status: t.Optional(t.String()),
  source: t.Optional(t.String()),
  dateFrom: t.Optional(t.String()),
  dateTo: t.Optional(t.String()),
  // Amount bounds in EUR minor units — compared against each row's amount
  // converted to EUR, so a "min €50" filter works across currencies.
  minEURMinor: t.Optional(t.Numeric()),
  maxEURMinor: t.Optional(t.Numeric()),
  q: t.Optional(t.String()),
  sort: t.Optional(t.String()),
  dir: t.Optional(t.Union([t.Literal("asc"), t.Literal("desc")])),
  page: t.Optional(t.Numeric()),
  pageSize: t.Optional(t.Numeric()),
});

export const DonationListResponse = t.Object({ rows: t.Array(DonationAdminSchema), total: t.Integer(), page: t.Integer(), pageSize: t.Integer() });

export const DonationExportQuery = t.Object({ ...DonationListQuery.properties, pages: t.Optional(t.String()) });

export type CreateDonationInput = typeof CreateDonationBody.static;
export type DonationListFilters = typeof DonationListQuery.static;
