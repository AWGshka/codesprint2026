import type { CreateDonationInput, DonationListFilters, ExportListFilters } from "./model";

import { and, asc, count, desc, eq, gte, like, lte, or } from "drizzle-orm";

import { db } from "~/db";
import { emit } from "~/plugins/events";
import { campaigns } from "~/db/campaigns";
import { AuditService } from "~/modules/audit/service";
import { type Paginated, paginate } from "~/lib/pagination";
import { BadRequest, NotFound, PaymentDeclined } from "~/lib/errors";
import { generatePaymentRef, generateReference } from "~/lib/reference";
import { type Donation, type NewDonation, donations } from "~/db/donations";
import { type NewProcessorSettlement, processorSettlements } from "~/db/processor-settlements";

const DECLINE_LAST4 = "0002";

const toPublic = (row: Donation) => ({
  id: row.id,
  reference: row.reference,
  campaignId: row.campaignId,
  donorName: row.donorName ?? null,
  donorEmail: row.donorEmail ?? null,
  amountMinor: row.amountMinor,
  currency: row.currency,
  frequency: row.frequency,
  status: row.status,
  source: row.source,
  createdAt: row.createdAt.toISOString(),
});

export abstract class DonationService {
  // Simulated payment (spec §7.1): validate -> deterministic decline -> persist
  // donation + settlement -> emit donation.created -> return receipt.
  static async create(slug: string, input: CreateDonationInput) {
    const [campaign] = await db.select().from(campaigns).where(eq(campaigns.slug, slug)).limit(1);
    if (!campaign) throw NotFound("Campaign not found");
    if (campaign.status !== "active") throw BadRequest("Campaign is not accepting donations", { field: "campaign" });
    if (!campaign.frequencies.includes(input.frequency)) throw BadRequest("Frequency not offered by this campaign", { field: "frequency" });

    if (input.card?.last4 === DECLINE_LAST4) throw PaymentDeclined("The card was declined by the payment processor");

    const reference = generateReference(campaign.name);
    const paymentRef = generatePaymentRef();

    const insert: NewDonation = {
      reference,
      campaignId: campaign.id,
      donorName: input.donorName ?? null,
      donorEmail: input.donorEmail ?? null,
      amountMinor: input.amountMinor,
      currency: input.currency,
      frequency: input.frequency,
      status: "completed",
      source: input.source,
      paymentRef,
    };

    const [donation] = await db.insert(donations).values(insert).returning();
    if (!donation) throw BadRequest("Failed to record donation");

    const settlement: NewProcessorSettlement = { paymentRef, amountMinor: input.amountMinor, currency: input.currency, status: "settled" };
    await db.insert(processorSettlements).values(settlement);

    emit("donation.created", {
      reference: donation.reference,
      campaignId: campaign.id,
      campaignName: campaign.name,
      amountMinor: donation.amountMinor,
      currency: donation.currency,
      source: donation.source,
      createdAt: donation.createdAt.toISOString(),
    });

    return { reference: donation.reference, status: donation.status, donation: toPublic(donation) };
  }

  static async getReceipt(slug: string, reference: string) {
    const [row] = await db
      .select({ donation: donations, campaignName: campaigns.name, campaignSlug: campaigns.slug })
      .from(donations)
      .innerJoin(campaigns, eq(donations.campaignId, campaigns.id))
      .where(and(eq(campaigns.slug, slug), eq(donations.reference, reference)))
      .limit(1);

    if (!row) throw NotFound("Donation not found");

    return { ...toPublic(row.donation), campaignName: row.campaignName, campaignSlug: row.campaignSlug };
  }

  private static buildWhere(filters: DonationListFilters) {
    const conditions = [];
    if (filters.campaignId) conditions.push(eq(donations.campaignId, filters.campaignId));
    if (filters.currency) conditions.push(eq(donations.currency, filters.currency));
    if (filters.status) conditions.push(eq(donations.status, filters.status as Donation["status"]));
    if (filters.source) conditions.push(eq(donations.source, filters.source as Donation["source"]));
    if (filters.dateFrom) conditions.push(gte(donations.createdAt, new Date(filters.dateFrom)));
    if (filters.dateTo) conditions.push(lte(donations.createdAt, new Date(filters.dateTo)));
    if (filters.q)
      conditions.push(
        or(like(donations.reference, `%${filters.q}%`), like(donations.donorName, `%${filters.q}%`), like(donations.donorEmail, `%${filters.q}%`)),
      );

    return conditions.length ? and(...conditions) : undefined;
  }

  private static sortColumn(sort?: string) {
    switch (sort) {
      case "amountMinor":
        return donations.amountMinor;
      case "currency":
        return donations.currency;
      case "status":
        return donations.status;
      default:
        return donations.createdAt;
    }
  }

  static async listAdmin(filters: DonationListFilters): Promise<Paginated<ReturnType<typeof toPublic> & { paymentRef: string; campaignName: string }>> {
    const where = DonationService.buildWhere(filters);
    const { page, pageSize, offset, limit } = paginate(filters.page, filters.pageSize);
    const orderFn = filters.dir === "asc" ? asc : desc;
    const orderBy = orderFn(DonationService.sortColumn(filters.sort));

    const [rows, [totalRow]] = await Promise.all([
      db
        .select({ donation: donations, campaignName: campaigns.name })
        .from(donations)
        .innerJoin(campaigns, eq(donations.campaignId, campaigns.id))
        .where(where)
        .orderBy(orderBy)
        .limit(limit)
        .offset(offset),
      db.select({ total: count() }).from(donations).where(where),
    ]);

    return {
      rows: rows.map((r) => ({ ...toPublic(r.donation), paymentRef: r.donation.paymentRef, campaignName: r.campaignName })),
      total: totalRow?.total ?? 0,
      page,
      pageSize,
    };
  }

  // Parses a `pages` query value like "1-3,5" into 1-indexed inclusive page
  // ranges. Throws 400 BAD_REQUEST on anything that doesn't match the format
  // or contains a page number below 1 / an inverted range.
  static parsePagesSpec(spec: string): { from: number; to: number }[] {
    if (!/^\d+(-\d+)?(,\d+(-\d+)?)*$/.test(spec)) throw BadRequest("Invalid pages parameter (expected e.g. '1-3,5')", { field: "pages" });

    return spec.split(",").map((part) => {
      const [fromRaw, toRaw] = part.split("-");
      const from = Number(fromRaw);
      const to = toRaw === undefined ? from : Number(toRaw);
      if (from < 1) throw BadRequest("Page numbers must be >= 1", { field: "pages" });
      if (to < from) throw BadRequest("Invalid page range (end before start)", { field: "pages" });
      return { from, to };
    });
  }

  // Full filtered set (no pagination) capped at `cap`, for CSV/JSON export.
  // Without `pages`, returns the whole filtered set (existing CSV behavior).
  // With `pages`, returns only the rows in those pageSize-sized chunks of the
  // same ordered result set (relative to `pageSize`, default 20).
  static async listForExport(filters: ExportListFilters, cap = 50_000) {
    const where = DonationService.buildWhere(filters);
    const orderBy = desc(donations.createdAt);

    if (!filters.pages) {
      const rows = await db
        .select({ donation: donations, campaignName: campaigns.name })
        .from(donations)
        .innerJoin(campaigns, eq(donations.campaignId, campaigns.id))
        .where(where)
        .orderBy(orderBy)
        .limit(cap);

      return rows.map((r) => ({ ...toPublic(r.donation), paymentRef: r.donation.paymentRef, campaignName: r.campaignName }));
    }

    const pageSize = Math.min(100, Math.max(1, Math.trunc(filters.pageSize ?? 20)));
    const ranges = DonationService.parsePagesSpec(filters.pages);

    const out: (ReturnType<typeof toPublic> & { paymentRef: string; campaignName: string })[] = [];
    let remaining = cap;
    for (const range of ranges) {
      if (remaining <= 0) break;
      const offset = (range.from - 1) * pageSize;
      const want = (range.to - range.from + 1) * pageSize;
      const limit = Math.min(want, remaining);

      const chunk = await db
        .select({ donation: donations, campaignName: campaigns.name })
        .from(donations)
        .innerJoin(campaigns, eq(donations.campaignId, campaigns.id))
        .where(where)
        .orderBy(orderBy)
        .limit(limit)
        .offset(offset);

      out.push(...chunk.map((r) => ({ ...toPublic(r.donation), paymentRef: r.donation.paymentRef, campaignName: r.campaignName })));
      remaining -= chunk.length;
    }

    return out;
  }

  static async recordExportAudit(actor: { id: string; email: string }) {
    await AuditService.record({ actorId: actor.id, actorEmail: actor.email, action: "ledger.export.csv", targetType: "ledger" });
  }
}
