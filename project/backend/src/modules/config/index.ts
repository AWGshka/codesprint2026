import { CurrencyConfigSchema } from "./model";

import { Elysia } from "elysia";

import { data, ok } from "~/lib/response";
import { BASE_CURRENCY, RATES, SUPPORTED_CURRENCIES } from "~/lib/currency";

export const config = new Elysia({ name: "config" }).get(
  "/config/currencies",
  () => ok({ base: BASE_CURRENCY, currencies: SUPPORTED_CURRENCIES, rates: RATES }),
  { response: { 200: data(CurrencyConfigSchema) }, detail: { summary: "Supported currencies + static conversion rates", tags: ["Config"] } },
);
