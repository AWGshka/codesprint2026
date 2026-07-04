import { BinDetailsSchema, BinLookupQuery, CurrencyConfigSchema } from "./model";

import { Elysia } from "elysia";

import { data, ok } from "~/lib/response";
import type { Currency } from "~/lib/currency";
import { BASE_CURRENCY, RATES, SUPPORTED_CURRENCIES } from "~/lib/currency";
import { MastercardServices, isMastercardConfigured } from "~/lib/mastercard";

const RATES_TTL_MS = 3_600_000;

type RatesCache = { rates: Record<Currency, number>; rateSource: "live" | "static"; fetchedAt: number };

let ratesCache: RatesCache | undefined;

// Live FX via the Mastercard Currency Conversion API (1h cache), static table as fallback.
// Rates express "1 EUR = rate units of currency", matching lib/currency.
const currentRates = async (): Promise<RatesCache> => {
  if (ratesCache && Date.now() - ratesCache.fetchedAt < RATES_TTL_MS) return ratesCache;
  if (isMastercardConfigured()) {
    try {
      const [usd, gbp] = await Promise.all([MastercardServices.conversionRate("EUR", "USD"), MastercardServices.conversionRate("EUR", "GBP")]);
      if (usd && gbp) {
        ratesCache = { rates: { EUR: 1, USD: usd, GBP: gbp }, rateSource: "live", fetchedAt: Date.now() };
        return ratesCache;
      }
    } catch (error) {
      console.warn("[mastercard] live FX unavailable, using static rates:", String(error).slice(0, 200));
    }
  }
  ratesCache = { rates: RATES, rateSource: "static", fetchedAt: Date.now() };
  return ratesCache;
};

export const config = new Elysia({ name: "config" })
  .get(
    "/config/currencies",
    async () => {
      const { rates, rateSource } = await currentRates();
      return ok({ base: BASE_CURRENCY, currencies: SUPPORTED_CURRENCIES, rates, rateSource });
    },
    {
      response: { 200: data(CurrencyConfigSchema) },
      detail: { summary: "Supported currencies + conversion rates (Mastercard live FX with static fallback)", tags: ["Config"] },
    },
  )
  .get(
    "/config/bin",
    // Card-scheme hint for the donor pay step via Mastercard BIN Lookup; null when the
    // integration is unconfigured or the BIN is unknown — the UI simply shows nothing.
    async ({ query }) => {
      if (!isMastercardConfigured()) return ok(null);
      try {
        return ok(await MastercardServices.binLookup(query.bin));
      } catch {
        return ok(null);
      }
    },
    {
      query: BinLookupQuery,
      response: { 200: data(BinDetailsSchema) },
      detail: { summary: "BIN lookup (Mastercard) — card scheme/issuer hint for the pay step", tags: ["Config"] },
    },
  );
