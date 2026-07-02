import { Elysia } from "elysia";
import { sql } from "drizzle-orm";

import { db } from "~/db";

// Operational probes - intentionally outside the data/error envelope so
// orchestrators (Docker, Cloudflare, k8s) get a minimal, stable body.
export const health = new Elysia({ prefix: "/health" })
  .get("/live", () => ({ ok: true }), { detail: { summary: "Liveness probe" } })
  .get(
    "/ready",
    async ({ status }) => {
      try {
        await db.run(sql`select 1`);
        return { ok: true };
      } catch {
        return status(503, { ok: false });
      }
    },
    { detail: { summary: "Readiness probe (checks the database)" } },
  );
