/**
 * Mastercard sandbox diagnostic — `bun run mastercard:check`.
 *
 * Exercises every integration point with PASS/FAIL output. Re-run this after any change
 * on the Mastercard Developers project (new keys, support ticket resolved, API added).
 *
 * Known state: Currency Conversion and BIN Lookup pass. The Donate service (guest-payments,
 * donors) returns an opaque 500 for ANY POST — including an empty body, which per its error
 * catalog should be a 400 — so the project appears not fully provisioned for Donate writes
 * on Mastercard's side. If Donate checks fail here, contact donate@mastercard.com or the
 * Donate support forum with the printed correlation id.
 */
import { MastercardDonateClient, MastercardServices, isMastercardConfigured } from "../src/lib/mastercard";

const check = async (name: string, run: () => Promise<unknown>) => {
  try {
    const result = await run();
    console.log(`PASS ${name}:`, JSON.stringify(result)?.slice(0, 160));
    return true;
  } catch (error) {
    console.log(`FAIL ${name}:`, String(error).slice(0, 260));
    return false;
  }
};

if (!isMastercardConfigured()) {
  console.log("Mastercard env not configured (MASTERCARD_CONSUMER_KEY / keystore missing) - nothing to check.");
  process.exit(1);
}

const results = await Promise.all([
  check("currency-conversion (EUR->USD)", () => MastercardServices.conversionRate("EUR", "USD")),
  check("bin-lookup (sample BIN 1125180)", () => MastercardServices.binLookup("1125180")),
]);

// Donate calls run sequentially — they share the service and failures are more readable one at a time.
results.push(
  await check("donate guest-payment", () =>
    MastercardDonateClient.guestPayment({ amountMinor: 500, currency: "EUR", reference: "CHECK-0001", donorName: "Check Donor" }),
  ),
);
results.push(
  await check("donate enroll-donor", () =>
    MastercardDonateClient.enrollDonor({ firstName: "Check", lastName: "Donor", email: `check${Date.now()}@givetap.example` }),
  ),
);

console.log(results.every(Boolean) ? "\nAll Mastercard integrations operational." : "\nSome checks failed - see above.");
