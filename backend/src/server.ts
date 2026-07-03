import { migrate } from "drizzle-orm/libsql/migrator";

import { db } from "./db";
import { app } from "./app";
import { env } from "./env";

// Idempotent — applies only pending migrations (tracked in __drizzle_migrations),
// so the VPS needs no drizzle-kit/dev deps. Folder matches drizzle.config.ts `out`.
await migrate(db, { migrationsFolder: "./migrations" });

app.listen({ port: env.PORT });

console.log(`API running on http://localhost:${env.PORT}`);
