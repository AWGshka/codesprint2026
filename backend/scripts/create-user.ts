/**
 * Creates a staff user against the current DATABASE_URL — `bun run user:create <username> <password> [role]`.
 *
 * Role defaults to `admin` (also accepts `manager`/`viewer`). Goes through Better Auth's
 * server-side createUser (no session headers = trusted call), same as the seed, so the
 * password is hashed and the role assigned correctly. Exits cleanly if the username is taken.
 * On the VPS: cd /opt/backend && /root/.bun/bin/bun run user:create awgsh <password>
 */
import { eq } from "drizzle-orm";

import { db } from "../src/db";
import { auth } from "../src/auth";
import { user } from "../src/db/auth-schema";

const ROLES = ["admin", "manager", "viewer"] as const;

const [username = "", password = "", role = "admin"] = process.argv.slice(2);
const normalized = username.toLowerCase();

const fail = (message: string): never => {
  console.error(message);
  process.exit(1);
};

if (!normalized || !password) fail("Usage: bun run user:create <username> <password> [admin|manager|viewer]");
if (!/^[a-zA-Z0-9_]{3,30}$/.test(normalized)) fail("Username must be 3-30 chars, letters/digits/underscore only.");
if (password.length < 8) fail("Password must be at least 8 characters (Better Auth minimum).");
if (!ROLES.includes(role as (typeof ROLES)[number])) fail(`Role must be one of: ${ROLES.join(", ")}`);

if (await db.query.user.findFirst({ where: eq(user.username, normalized) })) {
  console.log(`User "${normalized}" already exists — nothing to do.`);
  process.exit(0);
}

await auth.api.createUser({
  body: {
    email: `${normalized}@staff.gt`,
    password,
    name: normalized,
    role: role as (typeof ROLES)[number],
    data: { username: normalized, displayUsername: username },
  },
});

console.log(`Created ${role} user "${normalized}" — log in at /admin/login.`);
process.exit(0);
