import type { TSchema } from "@sinclair/typebox";

import { t } from "elysia";

// The whole API speaks one envelope: success -> { data }, failure -> { error }.
// `ok` builds the success body; `data` wraps a payload schema for `response`.
export const ok = <T>(payload: T) => ({ data: payload });

export const data = <T extends TSchema>(schema: T) => t.Object({ data: schema });

export const ApiError = t.Object({ error: t.Object({ code: t.String(), message: t.String(), details: t.Optional(t.Unknown()) }) });
