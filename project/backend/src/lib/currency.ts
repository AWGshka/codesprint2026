import { t } from "elysia";

// Static conversion table (spec §7.3) — hardcoded, no live FX. EUR is the base
// for dashboard aggregation; per-currency totals are shown alongside it so
// mixed currencies are never silently summed.
export type Currency = "EUR" | "USD" | "GBP";

export const SUPPORTED_CURRENCIES: Currency[] = ["EUR", "USD", "GBP"];

export const BASE_CURRENCY: Currency = "EUR";

export const RATES: Record<Currency, number> = { EUR: 1, USD: 1.08, GBP: 0.85 };

export const isSupportedCurrency = (value: string): value is Currency => (SUPPORTED_CURRENCIES as string[]).includes(value);

// Converts a minor-unit amount in `currency` to minor-unit EUR. Rates express
// "1 EUR = rate units of currency", so EUR = amountMinor / rate, rounded to
// the nearest integer minor unit (never floats persisted, only aggregated).
export const toEURMinor = (amountMinor: number, currency: Currency): number => Math.round(amountMinor / RATES[currency]);

// Inverse of `toEURMinor` — EUR minor units back into another currency.
export const fromEURMinor = (eurAmountMinor: number, currency: Currency): number => Math.round(eurAmountMinor * RATES[currency]);

// Cross-currency conversion via the EUR bridge (only 3 currencies, all rated against EUR).
export const convertMinor = (amountMinor: number, from: Currency, to: Currency): number =>
  from === to ? amountMinor : fromEURMinor(toEURMinor(amountMinor, from), to);

// Shared TypeBox schema for `currency` fields across modules.
export const CurrencySchema = t.Union(SUPPORTED_CURRENCIES.map((c) => t.Literal(c)));
