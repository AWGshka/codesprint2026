import type { CreateDonationInput, DonationListFilters } from "./model";

import { and, asc, count, desc, eq, gte, like, lte, or, sql } from "drizzle-orm";

import { db } from "~/db";
import { emit } from "~/plugins/events";
import { campaigns } from "~/db/campaigns";
import { AuditService } from "~/modules/audit/service";
import { type Paginated, paginate } from "~/lib/pagination";
import { RATES, SUPPORTED_CURRENCIES } from "~/lib/currency";
import { BadRequest, NotFound, PaymentDeclined } from "~/lib/errors";
import { generatePaymentRef, generateReference } from "~/lib/reference";
import { type Donation, type NewDonation, donations } from "~/db/donations";
import { MastercardDonateClient, isMastercardConfigured } from "~/lib/mastercard";
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
  method: row.method,
  roundedUp: row.roundedUp,
  giftAid: row.giftAid,
  showOnWall: row.showOnWall,
  createdAt: row.createdAt.toISOString(),
});

// Row amount expressed in EUR minor units, computed in SQL from the static
// rate table — lets min/max amount filters work across mixed currencies.
const amountEURMinor = sql`(${donations.amountMinor} / CASE ${donations.currency} ${sql.join(
  SUPPORTED_CURRENCIES.map((c) => sql`WHEN ${c} THEN ${RATES[c]}`),
  sql` `,
)} ELSE 1 END)`;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[0-9][0-9 -]{6,17}$/;

export abstract class DonationService {
  // Simulated payment: validate -> outcome (approved / declined / offline) ->
  // persist donation (+ settlement when it completed) -> emit donation.created
  // -> return receipt. Declined and offline attempts persist as ledger rows so
  // the ledger accounts for every attempt, but never settle or hit the dashboard.
  static async create(slug: string, input: CreateDonationInput, actor?: { id: string; email: string } | null) {
    const [campaign] = await db.select().from(campaigns).where(eq(campaigns.slug, slug)).limit(1);
    if (!campaign) throw NotFound("Campaign not found");
    if (campaign.status !== "active") throw BadRequest("Campaign is not accepting donations", { field: "campaign" });
    if (!campaign.frequencies.includes(input.frequency)) throw BadRequest("Frequency not offered by this campaign", { field: "frequency" });

    const reference = generateReference(campaign.name);

    const base: NewDonation = {
      reference,
      campaignId: campaign.id,
      donorName: input.donorName ?? null,
      donorEmail: input.donorEmail ?? null,
      amountMinor: input.amountMinor,
      currency: input.currency,
      frequency: input.frequency,
      status: "completed",
      source: input.source,
      method: input.method ?? "card",
      roundedUp: input.roundedUp ?? false,
      giftAid: input.giftAid ?? false,
      // The wall shows names only — an anonymous opt-in would render nothing.
      showOnWall: Boolean(input.showOnWall && input.donorName),
      paymentRef: generatePaymentRef(),
    };

    // Simulated declines: the terminal's "simulate declined" tap, or the
    // deterministic mock-processor card (last4 0002) on manual entry.
    if (input.outcome === "declined" || input.card?.last4 === DECLINE_LAST4) {
      await db.insert(donations).values({ ...base, status: "declined" });
      await DonationService.recordDonationAudit(actor, reference, "declined", input);
      throw PaymentDeclined("The card was declined by the payment processor", { reference });
    }

    // Offline terminal: the attempt is queued locally and settles later —
    // recorded so the ledger can show it, but no settlement row exists yet.
    if (input.outcome === "offline") {
      const [donation] = await db
        .insert(donations)
        .values({ ...base, status: "offline" })
        .returning();
      if (!donation) throw BadRequest("Failed to record donation");
      await DonationService.recordDonationAudit(actor, reference, "offline", input);
      return { reference: donation.reference, status: donation.status, donation: toPublic(donation) };
    }

    // When Mastercard Donate sandbox credentials are configured, route the (still simulated —
    // no real charge) payment through its guest-payments API and keep its payment id as our
    // paymentRef. Any sandbox failure falls back to the built-in mock processor so donations
    // never break because an external sandbox is down.
    if (isMastercardConfigured()) {
      try {
        const result = await MastercardDonateClient.guestPayment({
          amountMinor: input.amountMinor,
          currency: input.currency,
          donorName: input.donorName ?? undefined,
          donorEmail: input.donorEmail ?? undefined,
          reference,
        });
        base.paymentRef = result.paymentId;
      } catch (error) {
        console.warn("[mastercard] guest payment failed, falling back to mock processor:", error);
      }
    }

    const [donation] = await db.insert(donations).values(base).returning();
    if (!donation) throw BadRequest("Failed to record donation");

    const settlement: NewProcessorSettlement = { paymentRef: base.paymentRef, amountMinor: input.amountMinor, currency: input.currency, status: "settled" };
    await db.insert(processorSettlements).values(settlement);

    emit("donation.created", {
      reference: donation.reference,
      campaignId: campaign.id,
      campaignSlug: campaign.slug,
      campaignName: campaign.name,
      amountMinor: donation.amountMinor,
      currency: donation.currency,
      source: donation.source,
      // Only expose the donor's name when they opted into the public wall.
      donorName: donation.showOnWall ? donation.donorName : null,
      showOnWall: donation.showOnWall,
      createdAt: donation.createdAt.toISOString(),
    });

    await DonationService.recordDonationAudit(actor, reference, "completed", input);

    return { reference: donation.reference, status: donation.status, donation: toPublic(donation) };
  }

  // M2.7: "volunteer recorded donation DN-XXXX" — only when a signed-in
  // console user (volunteer/admin at the terminal) performed the action;
  // anonymous public donations are donor activity, not admin actions.
  private static async recordDonationAudit(
    actor: { id: string; email: string } | null | undefined,
    reference: string,
    status: string,
    input: CreateDonationInput,
  ) {
    if (!actor) return;
    await AuditService.record({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "donation.recorded",
      targetType: "donation",
      targetId: reference,
      metadata: { amountMinor: input.amountMinor, currency: input.currency, status, method: input.method ?? "card" },
    });
  }

  static async getReceipt(slug: string, reference: string) {
    const [row] = await db
      .select({ donation: donations, campaignName: campaigns.name, campaignSlug: campaigns.slug })
      .from(donations)
      .innerJoin(campaigns, eq(donations.campaignId, campaigns.id))
      .where(and(eq(campaigns.slug, slug), eq(donations.reference, reference)))
      .limit(1);

    if (!row) throw NotFound("Donation not found");

    return { ...toPublic(row.donation), campaignName: row.campaignName, campaignSlug: row.campaignSlug, paymentRef: row.donation.paymentRef };
  }

  // Simulated email/SMS receipt (M1.4): validates the address, records the
  // delivery on the donation row, sends nothing anywhere.
  static async sendReceipt(slug: string, reference: string, channel: "email" | "sms", to: string) {
    const [row] = await db
      .select({ id: donations.id })
      .from(donations)
      .innerJoin(campaigns, eq(donations.campaignId, campaigns.id))
      .where(and(eq(campaigns.slug, slug), eq(donations.reference, reference)))
      .limit(1);
    if (!row) throw NotFound("Donation not found");

    if (channel === "email" && !EMAIL_PATTERN.test(to)) throw BadRequest("Enter a valid email address", { field: "to" });
    if (channel === "sms" && !PHONE_PATTERN.test(to)) throw BadRequest("Enter a valid phone number", { field: "to" });

    await db.update(donations).set({ receiptChannel: channel, receiptTo: to, receiptSentAt: new Date() }).where(eq(donations.id, row.id));

    return { sent: true, channel, to };
  }

  // Public supporters wall (S1.3): most recent completed gifts.
  // Anonymous donors (no name / not opted into wall) are included and
  // displayed as "Anonymous" on the frontend.
  static async supporters(slug: string, limit = 12) {
    const rows = await db
      .select({ donorName: donations.donorName, amountMinor: donations.amountMinor, currency: donations.currency, createdAt: donations.createdAt })
      .from(donations)
      .innerJoin(campaigns, eq(donations.campaignId, campaigns.id))
      .where(and(eq(campaigns.slug, slug), eq(donations.status, "completed")))
      .orderBy(desc(donations.createdAt))
      .limit(limit);

    return rows.map((r) => ({ donorName: r.donorName ?? "", amountMinor: r.amountMinor, currency: r.currency, createdAt: r.createdAt.toISOString() }));
  }

  private static buildWhere(filters: DonationListFilters) {
    const conditions = [];
    if (filters.campaignId) conditions.push(eq(donations.campaignId, filters.campaignId));
    if (filters.currency) conditions.push(eq(donations.currency, filters.currency));
    if (filters.status) conditions.push(eq(donations.status, filters.status as Donation["status"]));
    if (filters.source) conditions.push(eq(donations.source, filters.source as Donation["source"]));
    if (filters.dateFrom) conditions.push(gte(donations.createdAt, new Date(filters.dateFrom)));
    if (filters.dateTo) conditions.push(lte(donations.createdAt, new Date(filters.dateTo)));
    if (filters.minEURMinor !== undefined) conditions.push(gte(amountEURMinor, filters.minEURMinor));
    if (filters.maxEURMinor !== undefined) conditions.push(lte(amountEURMinor, filters.maxEURMinor));
    // Free-text search covers the human reference, donor identity and the
    // sandbox transaction id (paymentRef).
    if (filters.q)
      conditions.push(
        or(
          like(donations.reference, `%${filters.q}%`),
          like(donations.donorName, `%${filters.q}%`),
          like(donations.donorEmail, `%${filters.q}%`),
          like(donations.paymentRef, `%${filters.q}%`),
        ),
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

  // Full filtered set (no pagination), capped, for CSV export. Audited by the caller.
  static async listForExport(filters: DonationListFilters, cap = 50_000) {
    const where = DonationService.buildWhere(filters);

    const rows = await db
      .select({ donation: donations, campaignName: campaigns.name })
      .from(donations)
      .innerJoin(campaigns, eq(donations.campaignId, campaigns.id))
      .where(where)
      .orderBy(desc(donations.createdAt))
      .limit(cap);

    return rows.map((r) => ({ ...toPublic(r.donation), paymentRef: r.donation.paymentRef, campaignName: r.campaignName }));
  }

  // Same filtered/sorted view as `listAdmin`, but scoped to a specific set of
  // 1-based page numbers (under the given pageSize) instead of the full
  // filtered set. Used by the CSV export route's optional `pages` param.
  static async listForExportPages(filters: DonationListFilters, pages: number[], pageSize: number, cap = 50_000) {
    const where = DonationService.buildWhere(filters);
    const orderFn = filters.dir === "asc" ? asc : desc;
    const orderBy = orderFn(DonationService.sortColumn(filters.sort));

    const out: (ReturnType<typeof toPublic> & { paymentRef: string; campaignName: string })[] = [];
    for (const page of pages) {
      if (out.length >= cap) break;
      const offset = (page - 1) * pageSize;
      const limit = Math.min(pageSize, cap - out.length);

      const rows = await db
        .select({ donation: donations, campaignName: campaigns.name })
        .from(donations)
        .innerJoin(campaigns, eq(donations.campaignId, campaigns.id))
        .where(where)
        .orderBy(orderBy)
        .limit(limit)
        .offset(offset);

      out.push(...rows.map((r) => ({ ...toPublic(r.donation), paymentRef: r.donation.paymentRef, campaignName: r.campaignName })));
    }

    return out;
  }

  // `rowCount`/`filters` give the audit trail a meaningful target summary
  // (e.g. "42 rows") instead of a dangling/empty target composed from
  // missing parts — targetId is only ever a real summary string or omitted.
  static async recordExportAudit(actor: { id: string; email: string }, rowCount: number, filters: DonationListFilters, format: "csv" | "pdf" = "csv") {
    const filterSummary = Object.entries(filters)
      .filter(([key, value]) => value !== undefined && value !== "" && key !== "page" && key !== "pageSize")
      .map(([key, value]) => `${key}=${value}`)
      .join(",");

    await AuditService.record({
      actorId: actor.id,
      actorEmail: actor.email,
      action: format === "pdf" ? "ledger.export.pdf" : "ledger.export.csv",
      targetType: "ledger",
      targetId: `${rowCount} rows`,
      metadata: filterSummary ? { rowCount, filters: filterSummary } : { rowCount },
    });
  }
}
