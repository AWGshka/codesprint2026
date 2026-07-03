export type CurrencyCode = "EUR" | "USD" | "GBP";

/** Static conversion rates *to* EUR-equivalent — not live FX. */
export const RATES_TO_EUR: Record<CurrencyCode, number> = { EUR: 1, USD: 1.08, GBP: 0.85 };

/** Formats minor units (e.g. cents) as a localized currency string. */
export const formatMoney = (minorUnits: number, currency: CurrencyCode, locale = "en"): string =>
  new Intl.NumberFormat(locale, { style: "currency", currency }).format(minorUnits / 100);

/** Converts minor units in `currency` to EUR-equivalent minor units using the static rates. */
export const toEURMinor = (minorUnits: number, currency: CurrencyCode): number => Math.round(minorUnits / RATES_TO_EUR[currency]);

/** Converts minor units from one currency to another, bridging through EUR (matches the backend's `convertMinor`). */
export const convertMinor = (minorUnits: number, from: CurrencyCode, to: CurrencyCode): number =>
  from === to ? minorUnits : Math.round(toEURMinor(minorUnits, from) * RATES_TO_EUR[to]);

/** Tailwind classes for money/reference display — tabular figures, per the kit's mono type. */
export const tabularNumsClass = "font-mono tabular-nums";
