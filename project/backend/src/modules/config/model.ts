import { t } from "elysia";

export const CurrencyConfigSchema = t.Object({ base: t.String(), currencies: t.Array(t.String()), rates: t.Record(t.String(), t.Number()) });
