import type { CreateCampaignInput, UpdateCampaignInput } from "./model";

import { and, count, desc, eq, inArray, like, or } from "drizzle-orm";

import { db } from "~/db";
import { donations } from "~/db/donations";
import { AuditService } from "~/modules/audit/service";
import { type Paginated, paginate } from "~/lib/pagination";
import { BadRequest, Conflict, NotFound } from "~/lib/errors";
import { convertMinor, isSupportedCurrency } from "~/lib/currency";
import { type Campaign, type CampaignStatus, type NewCampaign, campaigns } from "~/db/campaigns";

const toPublic = (row: Campaign) => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  cause: row.cause,
  description: row.description,
  story: row.story ?? null,
  targetMinor: row.targetMinor,
  currency: row.currency,
  status: row.status,
  brandColor: row.brandColor,
  logoUrl: row.logoUrl ?? null,
  heroImageUrl: row.heroImageUrl ?? null,
  presetsMinor: row.presetsMinor,
  allowCustom: row.allowCustom,
  frequencies: row.frequencies,
});

const toAdmin = (row: Campaign) => ({
  ...toPublic(row),
  createdBy: row.createdBy,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

export abstract class CampaignService {
  static async listPublicActive() {
    const rows = await db.select().from(campaigns).where(eq(campaigns.status, "active")).orderBy(desc(campaigns.createdAt));
    if (rows.length === 0) return [];

    // Batched progress: one grouped query for completed donations across all
    // returned campaigns, instead of N+1 per-campaign lookups.
    const campaignIds = rows.map((row) => row.id);
    const donationRows = await db
      .select({ campaignId: donations.campaignId, amountMinor: donations.amountMinor, currency: donations.currency })
      .from(donations)
      .where(and(inArray(donations.campaignId, campaignIds), eq(donations.status, "completed")));

    const byCampaign = new Map<string, { amountMinor: number; currency: string }[]>();
    for (const d of donationRows) {
      const list = byCampaign.get(d.campaignId) ?? [];
      list.push(d);
      byCampaign.set(d.campaignId, list);
    }

    return rows.map((row) => {
      const donationsForCampaign = byCampaign.get(row.id) ?? [];
      const target = isSupportedCurrency(row.currency) ? row.currency : "EUR";
      const raisedMinor = donationsForCampaign.reduce(
        (sum, d) => sum + (isSupportedCurrency(d.currency) ? convertMinor(d.amountMinor, d.currency, target) : 0),
        0,
      );
      return { ...toPublic(row), progress: { raisedMinor, targetMinor: row.targetMinor, donorCount: donationsForCampaign.length } };
    });
  }

  static async getPublicBySlug(slug: string) {
    const [row] = await db.select().from(campaigns).where(eq(campaigns.slug, slug)).limit(1);
    if (!row || row.status === "draft") throw NotFound("Campaign not found");

    const progress = await CampaignService.progressFor(row);
    return { ...toPublic(row), progress };
  }

  // Aggregates completed donations for a campaign, converting each into the
  // campaign's own currency so the progress bar never mixes currencies.
  static async progressFor(row: Campaign) {
    const rows = await db
      .select({ amountMinor: donations.amountMinor, currency: donations.currency })
      .from(donations)
      .where(and(eq(donations.campaignId, row.id), eq(donations.status, "completed")));

    const target = isSupportedCurrency(row.currency) ? row.currency : "EUR";
    const raisedMinor = rows.reduce((sum, d) => sum + (isSupportedCurrency(d.currency) ? convertMinor(d.amountMinor, d.currency, target) : 0), 0);

    return { raisedMinor, targetMinor: row.targetMinor, donorCount: rows.length };
  }

  static async findByIdOrThrow(id: string): Promise<Campaign> {
    const [row] = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
    if (!row) throw NotFound("Campaign not found");
    return row;
  }

  static async listAdmin(filters: { status?: CampaignStatus; q?: string; page?: number; pageSize?: number }): Promise<Paginated<ReturnType<typeof toAdmin>>> {
    const conditions = [];
    if (filters.status) conditions.push(eq(campaigns.status, filters.status));
    if (filters.q) conditions.push(or(like(campaigns.name, `%${filters.q}%`), like(campaigns.slug, `%${filters.q}%`)));

    const where = conditions.length ? and(...conditions) : undefined;
    const { page, pageSize, offset, limit } = paginate(filters.page, filters.pageSize);

    const [rows, [totalRow]] = await Promise.all([
      db.select().from(campaigns).where(where).orderBy(desc(campaigns.createdAt)).limit(limit).offset(offset),
      db.select({ total: count() }).from(campaigns).where(where),
    ]);

    return { rows: rows.map(toAdmin), total: totalRow?.total ?? 0, page, pageSize };
  }

  static async getAdmin(id: string) {
    return toAdmin(await CampaignService.findByIdOrThrow(id));
  }

  static async create(input: CreateCampaignInput, actor: { id: string; email: string }) {
    const [existing] = await db.select({ id: campaigns.id }).from(campaigns).where(eq(campaigns.slug, input.slug)).limit(1);
    if (existing) throw BadRequest("Slug already in use", { field: "slug" });

    const insert: NewCampaign = { ...input, createdBy: actor.id };
    const [row] = await db.insert(campaigns).values(insert).returning();
    if (!row) throw BadRequest("Failed to create campaign");

    await AuditService.record({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "campaign.create",
      targetType: "campaign",
      targetId: row.id,
      metadata: { name: row.name, slug: row.slug },
    });
    return toAdmin(row);
  }

  static async update(id: string, input: UpdateCampaignInput, actor: { id: string; email: string }) {
    const before = await CampaignService.findByIdOrThrow(id);

    if (input.slug) {
      const [existing] = await db.select({ id: campaigns.id }).from(campaigns).where(eq(campaigns.slug, input.slug)).limit(1);
      if (existing && existing.id !== id) throw BadRequest("Slug already in use", { field: "slug" });
    }

    const [row] = await db.update(campaigns).set(input).where(eq(campaigns.id, id)).returning();
    if (!row) throw NotFound("Campaign not found");

    // Per-field diff so the audit log can answer "updated what, exactly?" — only fields
    // whose value actually changed, with old and new values.
    const changes = Object.keys(input).flatMap((key) => {
      const from = before[key as keyof typeof before];
      const to = row[key as keyof typeof row];
      return JSON.stringify(from) === JSON.stringify(to) ? [] : [{ field: key, from, to }];
    });

    await AuditService.record({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "campaign.update",
      targetType: "campaign",
      targetId: id,
      metadata: { name: row.name, slug: row.slug, changes },
    });
    return toAdmin(row);
  }

  static async remove(id: string, actor: { id: string; email: string }) {
    const existing = await CampaignService.findByIdOrThrow(id);

    // `donations.campaignId` has a FK to `campaigns.id` — deleting a campaign
    // with donation history would violate it, so refuse with a clear 409
    // rather than letting the constraint bubble up as a 500.
    const [donationCountRow] = await db.select({ total: count() }).from(donations).where(eq(donations.campaignId, id));
    if ((donationCountRow?.total ?? 0) > 0) throw Conflict("Campaign has donations and cannot be deleted", { donationCount: donationCountRow?.total });

    await db.delete(campaigns).where(eq(campaigns.id, id));

    await AuditService.record({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "campaign.delete",
      targetType: "campaign",
      targetId: id,
      metadata: { name: existing.name, slug: existing.slug },
    });
    return { deleted: true };
  }
}
