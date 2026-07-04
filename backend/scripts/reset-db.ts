// Wipe all application data and re-seed. Run with `bun run db:reset`.
//
// Deletes rows in dependency order (FK-safe), then runs the seed script.
// Auth tables (user/session/account/verification) are cleared too so the
// seed can recreate the demo profiles from scratch.

import { sql } from "drizzle-orm";

import { db } from "~/db";

const tables = [
  "reconciliation_matches",
  "processor_settlements",
  "audit_logs",
  "donations",
  "campaigns",
  "session",
  "account",
  "verification",
  "user",
];

async function reset() {
  console.log("Clearing all tables...");
  for (const table of tables) {
    await db.run(sql.raw(`DELETE FROM ${table}`));
    console.log(`  - ${table}`);
  }
  console.log("Done. Running seed...\n");

  // Import seed dynamically so it runs after the wipe.
  await import("~/db/seed");
}

reset().catch((err) => {
  console.error("Reset failed:", err);
  process.exit(1);
});
