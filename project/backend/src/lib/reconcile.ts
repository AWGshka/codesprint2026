// Pure reconciliation classification (spec §7.2) — factored out of the
// service so it's testable without a database. A full-join on `paymentRef`
// between completed donations (source A) and processor settlements (source B).
export type ReconStatus = "matched" | "mismatched" | "missingInProcessor" | "missingInApp";

export type ReconSide = { amountMinor: number; currency: string; status: string } | null;

export const classify = (donation: ReconSide, settlement: ReconSide): ReconStatus => {
  if (donation && !settlement) return "missingInProcessor";
  if (!donation && settlement) return "missingInApp";
  if (donation && settlement && donation.amountMinor === settlement.amountMinor && donation.currency === settlement.currency && settlement.status === "settled")
    return "matched";

  return "mismatched";
};
