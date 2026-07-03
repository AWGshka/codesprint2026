import { t } from "elysia";

import { CurrencySchema } from "~/lib/currency";

export const CampaignStatusSchema = t.Union([t.Literal("draft"), t.Literal("active"), t.Literal("paused"), t.Literal("ended")]);

export const FrequencySchema = t.Union([t.Literal("one_time"), t.Literal("monthly"), t.Literal("roundup")]);

export const CampaignPublicSchema = t.Object({
  id: t.String(),
  slug: t.String(),
  name: t.String(),
  cause: t.String(),
  description: t.String(),
  story: t.Nullable(t.String()),
  targetMinor: t.Integer(),
  currency: t.String(),
  status: CampaignStatusSchema,
  brandColor: t.String(),
  logoUrl: t.Nullable(t.String()),
  heroImageUrl: t.Nullable(t.String()),
  presetsMinor: t.Array(t.Integer()),
  allowCustom: t.Boolean(),
  frequencies: t.Array(FrequencySchema),
});

export const CampaignProgressSchema = t.Object({ raisedMinor: t.Integer(), targetMinor: t.Integer(), donorCount: t.Integer() });

export const CampaignWithProgressSchema = t.Composite([CampaignPublicSchema, t.Object({ progress: CampaignProgressSchema })]);

export const CampaignAdminSchema = t.Composite([CampaignPublicSchema, t.Object({ createdBy: t.String(), createdAt: t.String(), updatedAt: t.String() })]);

export const CreateCampaignBody = t.Object({
  slug: t.String({ minLength: 1, pattern: "^[a-z0-9-]+$" }),
  name: t.String({ minLength: 1 }),
  cause: t.String({ minLength: 1 }),
  description: t.String({ minLength: 1 }),
  story: t.Optional(t.Nullable(t.String())),
  targetMinor: t.Integer({ minimum: 1 }),
  currency: CurrencySchema,
  status: CampaignStatusSchema,
  brandColor: t.String({ minLength: 1 }),
  logoUrl: t.Optional(t.Nullable(t.String())),
  heroImageUrl: t.Optional(t.Nullable(t.String())),
  presetsMinor: t.Array(t.Integer({ minimum: 1 }), { minItems: 1 }),
  allowCustom: t.Optional(t.Boolean()),
  frequencies: t.Array(FrequencySchema, { minItems: 1 }),
});

export const UpdateCampaignBody = t.Partial(CreateCampaignBody);

export const CampaignListQuery = t.Object({
  status: t.Optional(CampaignStatusSchema),
  q: t.Optional(t.String()),
  page: t.Optional(t.Numeric()),
  pageSize: t.Optional(t.Numeric()),
});

export const PublicCampaignListQuery = t.Object({ status: t.Optional(t.String()) });

export const SlugParams = t.Object({ slug: t.String() });
export const IdParams = t.Object({ id: t.String() });

export const CampaignListResponse = t.Object({ rows: t.Array(CampaignAdminSchema), total: t.Integer(), page: t.Integer(), pageSize: t.Integer() });

export type CreateCampaignInput = typeof CreateCampaignBody.static;
export type UpdateCampaignInput = typeof UpdateCampaignBody.static;
