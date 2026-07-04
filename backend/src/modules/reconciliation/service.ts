import { eq, inArray } from "drizzle-orm";

import { db } from "~/db";
import { NotFound } from "~/lib/errors";
import { donations } from "~/db/donations";
import { classify } from "~/lib/reconcile";
import { AuditService } from "~/modules/audit/service";
import { processorSettlements } from "~/db/processor-settlements";
import { reconciliationMatches } from "~/db/reconciliation-matches";

// Full-join diff on `paymentRef`. `donations` is source A (only completed
// rows count — declined/offline attempts never settle), `processor_settlements`
// is source B (the mock external feed). On top of the computed classification,
// `reconciliation_matches` persists which pairs an operator (or the
// auto-matcher) has confirmed — those are the "matched" rows; everything else
// is awaiting review.
export abstract class ReconciliationService {
  private static async collectRows() {
    const [donationRows, settlementRows, matchRows] = await Promise.all([
      db.select().from(donations).where(eq(donations.status, "completed")),
      db.select().from(processorSettlements),
      db.select().from(reconciliationMatches),
    ]);

    const donationsByRef = new Map(donationRows.map((d) => [d.paymentRef, d]));
    const settlementsByRef = new Map(settlementRows.map((s) => [s.paymentRef, s]));
    const matchesByRef = new Map(matchRows.map((m) => [m.paymentRef, m]));
    const allRefs = new Set([...donationsByRef.keys(), ...settlementsByRef.keys()]);

    return [...allRefs].map((paymentRef) => {
      const donation = donationsByRef.get(paymentRef);
      const settlement = settlementsByRef.get(paymentRef);
      const match = matchesByRef.get(paymentRef);
      const donationSide = donation ? { amountMinor: donation.amountMinor, currency: donation.currency, status: donation.status } : null;
      const settlementSide = settlement ? { amountMinor: settlement.amountMinor, currency: settlement.currency, status: settlement.status } : null;

      return {
        paymentRef,
        status: classify(donationSide, settlementSide),
        reference: donation?.reference ?? null,
        donation: donationSide,
        settlement: settlementSide,
        reconciled: Boolean(match),
        matchMethod: match?.method ?? null,
        matchedAt: match?.createdAt.toISOString() ?? null,
        occurredAt: (donation?.createdAt ?? settlement?.processedAt)?.toISOString() ?? null,
      };
    });
  }

  static async state() {
    const rows = await ReconciliationService.collectRows();

    const matched = rows.filter((r) => r.reconciled).length;
    const awaiting = rows.length - matched;
    // Share of tracked pairs an operator has confirmed.
    const matchRate = rows.length > 0 ? matched / rows.length : 0;

    const summary = {
      matched,
      awaiting,
      matchRate,
      mismatched: rows.filter((r) => r.status === "mismatched").length,
      missingInProcessor: rows.filter((r) => r.status === "missingInProcessor").length,
      missingInApp: rows.filter((r) => r.status === "missingInApp").length,
    };

    return { summary, rows };
  }

  // Marks every exactly-matching awaiting pair as reconciled in one pass.
  // Discrepancies (mismatched/missing) are never auto-matched — they need a
  // human decision via `matchOne`.
  static async autoMatch(actor: { id: string; email: string }) {
    const rows = await ReconciliationService.collectRows();
    const candidates = rows.filter((r) => !r.reconciled && r.status === "matched");

    // Insert one-by-one so a single conflict doesn't block the rest.
    let matchedCount = 0;
    for (const r of candidates) {
      try {
        await db.insert(reconciliationMatches).values({ paymentRef: r.paymentRef, method: "auto" as const, matchedBy: actor.email });
        matchedCount++;
      } catch {
        // Already reconciled (unique constraint) — skip.
      }
    }

    await AuditService.record({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "reconciliation.automatch",
      targetType: "reconciliation",
      targetId: `${matchedCount} transactions`,
      metadata: { matchedCount },
    });

    return { matchedCount };
  }

  // Operator marks a single awaiting pair as reconciled — including
  // discrepancies, which is an explicit human override and is audited as such.
  static async matchOne(paymentRef: string, actor: { id: string; email: string }) {
    const rows = await ReconciliationService.collectRows();
    const row = rows.find((r) => r.paymentRef === paymentRef);
    if (!row) throw NotFound("No transaction with that payment reference");
    if (row.reconciled) return { matched: true, alreadyMatched: true };

    try {
      await db.insert(reconciliationMatches).values({ paymentRef, method: "manual", matchedBy: actor.email });
    } catch {
      // Already reconciled (unique constraint race) — treat as success.
      return { matched: true, alreadyMatched: true };
    }

    await AuditService.record({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "reconciliation.match",
      targetType: "reconciliation",
      targetId: row.reference ?? paymentRef,
      metadata: { paymentRef, classification: row.status },
    });

    return { matched: true, alreadyMatched: false };
  }

  // Un-matching (e.g. after realising an override was wrong) simply deletes
  // the persisted rows — exposed for seeding/tests, not routed yet.
  static async reset(paymentRefs: string[]) {
    if (paymentRefs.length > 0) await db.delete(reconciliationMatches).where(inArray(reconciliationMatches.paymentRef, paymentRefs));
  }

  // The mock external processor feed reconciliation reads.
  static async settlementsFeed() {
    const rows = await db.select().from(processorSettlements);
    return rows.map((s) => ({
      id: s.id,
      paymentRef: s.paymentRef,
      amountMinor: s.amountMinor,
      currency: s.currency,
      status: s.status,
      processedAt: s.processedAt.toISOString(),
    }));
  }
}
