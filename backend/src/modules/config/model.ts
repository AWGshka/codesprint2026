import { t } from "elysia";

export const CurrencyConfigSchema = t.Object({
  base: t.String(),
  currencies: t.Array(t.String()),
  rates: t.Record(t.String(), t.Number()),
  // "live" when rates came from the Mastercard Currency Conversion API, "static" for the built-in table.
  rateSource: t.Union([t.Literal("live"), t.Literal("static")]),
});

export const BinLookupQuery = t.Object({ bin: t.String({ minLength: 6, maxLength: 11, pattern: "^\\d+$" }) });

export const BinDetailsSchema = t.Nullable(
  t.Object({
    scheme: t.Optional(t.String()),
    issuer: t.Optional(t.String()),
    country: t.Optional(t.String()),
    fundingSource: t.Optional(t.String()),
  }),
);
