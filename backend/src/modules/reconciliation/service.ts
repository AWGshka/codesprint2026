import { eq } from "drizzle-orm";

import { db } from "~/db";
import { donations } from "~/db/donations";
import { classify } from "~/lib/reconcile";
import { AuditService } from "~/modules/audit/service";
import { processorSettlements } from "~/db/processor-settlements";

// Full-join diff on `paymentRef`. `donations` is source A (only
// completed rows count — pending/failed never settle), `processor_settlements`
// is source B (the mock external feed).
export abstract class ReconciliationService {
  static async run(actor: { id: string; email: string }) {
    const [donationRows, settlementRows] = await Promise.all([
      db.select().from(donations).where(eq(donations.status, "completed")),
      db.select().from(processorSettlements),
    ]);

    const donationsByRef = new Map(donationRows.map((d) => [d.paymentRef, d]));
    const settlementsByRef = new Map(settlementRows.map((s) => [s.paymentRef, s]));
    const allRefs = new Set([...donationsByRef.keys(), ...settlementsByRef.keys()]);

    const summary = { matched: 0, mismatched: 0, missingInProcessor: 0, missingInApp: 0 };

    const rows = [...allRefs].map((paymentRef) => {
      const donation = donationsByRef.get(paymentRef);
      const settlement = settlementsByRef.get(paymentRef);
      const donationSide = donation ? { amountMinor: donation.amountMinor, currency: donation.currency, status: donation.status } : null;
      const settlementSide = settlement ? { amountMinor: settlement.amountMinor, currency: settlement.currency, status: settlement.status } : null;

      const status = classify(donationSide, settlementSide);
      summary[status] += 1;

      return { paymentRef, status, reference: donation?.reference ?? null, donation: donationSide, settlement: settlementSide };
    });

    await AuditService.record({ actorId: actor.id, actorEmail: actor.email, action: "reconciliation.run", targetType: "reconciliation" });

    return { summary, rows };
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
