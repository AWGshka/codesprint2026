import { cors } from "@elysiajs/cors";
import { openapi } from "@elysiajs/openapi";

import { Elysia } from "elysia";

import { env } from "~/env";
import { ok } from "~/lib/response";
import { examples } from "~/examples";
import { audit } from "~/modules/audit";
import { users } from "~/modules/users";
import { config } from "~/modules/config";
import { health } from "~/modules/health";
import { authPlugin } from "~/plugins/auth";
import { campaigns } from "~/modules/campaigns";
import { dashboard } from "~/modules/dashboard";
import { donations } from "~/modules/donations";
import { eventsPlugin } from "~/plugins/events";
import { errorHandler } from "~/plugins/error-handler";
import { reconciliation } from "~/modules/reconciliation";

// errorHandler first so its global onError covers every plugin mounted after.
// CORS allows credentials so the browser can carry the auth session cookie.
export const app = new Elysia()
  .use(errorHandler)
  .use(
    cors({
      origin: env.FRONTEND_ORIGINS,
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    }),
  )
  .use(openapi())
  .use(authPlugin)
  .get("/", () => ok({ name: "api", status: "ok" }), { detail: { summary: "Service root" } })
  .get("/me", ({ user }) => ok(user), { auth: true, detail: { summary: "Current user", tags: ["Auth"] } })
  .use(health)
  .use(examples)
  .group("/api", (app) => app.use(campaigns).use(donations).use(dashboard).use(reconciliation).use(audit).use(users).use(config).use(eventsPlugin));

export type App = typeof app;
