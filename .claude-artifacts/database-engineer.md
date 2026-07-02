# database-engineer — DB-1: schema, auth roles, seed

status: done
task: DB-1
depends_on_read: .claude-artifacts/plan.md, .claude-artifacts/findings.md, .task/CodeSprintMT-2026-GiveTap-BUILD-SPEC.md (§4, §5.2, §9), .claude/skills/database/SKILL.md

## What was done

- Added the Better Auth **admin plugin** to `src/auth.ts` with a custom
  access-control statement set (spec §5.2 resources: `campaign`, `donation`,
  `reconciliation`, `audit`) merged with the plugin's own `defaultStatements`
  (`user`, `session`) — the plugin's built-in routes (`setRole`, `banUser`,
  `listUsers`, etc.) internally check permissions against those actions, so
  they had to be preserved even though the spec's RBAC table simplifies
  "user" to `read`/`manage`. Three roles defined: `viewer`, `manager`,
  `admin` (exported as `admin_` to avoid shadowing the plugin import name).
  `auth.ts` remains free of Elysia imports.
- Regenerated `src/db/auth-schema.ts` via the CLI (`user` gained `role`,
  `banned`, `banReason`, `banExpires`; `session` gained `impersonatedBy`).
- Added four domain tables in new files under `src/db/`: `campaigns.ts`,
  `donations.ts`, `processor-settlements.ts`, `audit-logs.ts`, plus
  `relations.ts` (cross-table relations live here, not inside the table
  files, to avoid a circular import between `campaigns.ts` and
  `donations.ts`). All re-exported from `schema.ts`.
- Generated migration `migrations/0001_curvy_junta.sql` and proved a fresh
  DB (`data/local.db` deleted, `bun run db:migrate`) applies both migrations
  (0000 auth tables + 0001 domain tables) cleanly from scratch.
- Wrote an idempotent `src/db/seed.ts` (guarded by `db.$count(campaigns)`):
  3 demo users via `auth.api.createUser` (roles set directly, no session
  headers so admin-plugin permission checks are bypassed as a trusted
  server call), 12 campaigns across EUR/USD/GBP with varied
  status/branding/presets/frequencies, 260 donations over ~90 days, and
  processor settlements mirroring completed donations except 3 documented
  discrepancy classes. Verified twice: migrate-from-scratch → seed → seed
  again → no duplicates (second run logs "Already seeded... skipping").
- Ran `bun run format && bun run lint && bun run typecheck` — all clean.

**Deviation / environment note:** `bunx @better-auth/cli generate` fails on
this Windows box because its transitive dependency `better-sqlite3` can't
build natively (no Python/VS toolchain, and Bun explicitly skips
`prebuild-install` for it). Worked around by installing the CLI locally with
`bun add -d @better-auth/cli --ignore-scripts` (skips the failing native
build) and invoking it directly: `bun run node_modules/@better-auth/cli/dist/index.mjs generate --config ./src/auth.ts --output ./src/db/auth-schema.ts -y`.
The CLI never touches better-sqlite3 at runtime for `generate` against our
libsql config, so this is safe and reproducible; documented here in case
CI/other machines hit the same node-gyp failure. `@better-auth/cli` is now a
devDependency in `package.json`/`bun.lock`.
Also created `project/backend/.env` (gitignored) with a generated
`BETTER_AUTH_SECRET` and the existing `.env.example` defaults — needed to run
migrate/seed locally; `.env.example` already documented the shape and needed
no changes.

## Public interface

### Tables (all in `src/db/schema.ts` via re-exports)

**`user`** (`src/db/auth-schema.ts`, generated — do not hand-edit)
- `id` text pk · `name` text · `email` text unique · `emailVerified` bool
- `image` text nullable · `createdAt`/`updatedAt` integer timestamp_ms
- `username` text unique · `displayUsername` text nullable
- `role` text nullable (`"viewer" | "manager" | "admin"`, set by the admin
  plugin — not enforced at the DB type level, it's a plain `text` column)
- `banned` bool nullable · `banReason` text nullable · `banExpires` timestamp_ms nullable
- Types: `typeof user.$inferSelect`

**`session`**, **`account`**, **`verification`** — unchanged shape plus
`session.impersonatedBy` (text, nullable) added by the admin plugin.

**`campaigns`** (`src/db/campaigns.ts`)
- `id` text pk (uuid) · `slug` text unique · `name` text · `cause` text
- `description` text · `story` text nullable
- `targetMinor` integer (minor units, in `currency`)
- `currency` text (ISO-4217, e.g. `"EUR"`)
- `status` text `$type<CampaignStatus>()` = `"draft" | "active" | "paused" | "ended"`
- `brandColor` text (hex) · `logoUrl` text nullable · `heroImageUrl` text nullable
- `presetsMinor` json `$type<number[]>()`
- `allowCustom` bool default `true`
- `frequencies` json `$type<Frequency[]>()`, `Frequency = "one_time" | "monthly" | "roundup"`
- `createdBy` text -> `user.id`
- `createdAt`/`updatedAt` integer timestamp (seconds)
- Indexes: `campaigns_status_idx (status)`, `campaigns_slug_idx (slug)`
- Types: `Campaign = typeof campaigns.$inferSelect`, `NewCampaign = typeof campaigns.$inferInsert`
- Also exports `CampaignStatus`, `Frequency` (both used by `donations.ts`)

**`donations`** (`src/db/donations.ts`)
- `id` text pk (uuid) · `reference` text unique (`<CAMP>-<base36x4>`, e.g. `GRF-7QX3`)
- `campaignId` text -> `campaigns.id`
- `donorName` text nullable (null = "Guest") · `donorEmail` text nullable
- `amountMinor` integer · `currency` text (ISO-4217; may differ from the
  campaign's base currency — donor can switch)
- `frequency` text `$type<Frequency>()` (from `campaigns.ts`)
- `status` text `$type<DonationStatus>()` = `"completed" | "pending" | "failed"`
- `source` text `$type<DonationSource>()` = `"web" | "kiosk"`
- `paymentRef` text **unique** (uuid — logical join key to
  `processor_settlements.paymentRef`; NOT a DB foreign key by design, see
  Notes)
- `createdAt` integer timestamp (seconds)
- Indexes: `donations_campaign_id_idx`, `donations_status_idx`,
  `donations_currency_idx`, `donations_created_at_idx`,
  `donations_payment_ref_idx`
- Types: `Donation = typeof donations.$inferSelect`, `NewDonation = typeof donations.$inferInsert`
- Also exports `DonationStatus`, `DonationSource`

**`processor_settlements`** (`src/db/processor-settlements.ts`)
- `id` text pk (uuid) · `paymentRef` text (not unique/not FK — see Notes)
- `amountMinor` integer · `currency` text
- `status` text `$type<SettlementStatus>()` = `"settled" | "failed"`
- `processedAt` integer timestamp (seconds)
- Index: `processor_settlements_payment_ref_idx (paymentRef)`
- Types: `ProcessorSettlement = typeof processorSettlements.$inferSelect`,
  `NewProcessorSettlement = typeof processorSettlements.$inferInsert`
- Also exports `SettlementStatus`

**`audit_logs`** (`src/db/audit-logs.ts`)
- `id` text pk (uuid) · `actorId` text -> `user.id`
- `actorEmail` text · `action` text `$type<AuditAction>()` = enum:
  `"campaign.create" | "campaign.update" | "campaign.delete" | "user.role_change" | "reconciliation.run" | "ledger.export.csv" | "ledger.export.pdf" | "auth.login"`
- `targetType` text nullable `$type<AuditTargetType>()` = `"campaign" | "user" | "ledger" | "reconciliation" | "auth"`
- `targetId` text nullable · `metadata` json nullable `$type<Record<string, unknown>>()`
- `createdAt` integer timestamp (seconds)
- Indexes: `audit_logs_created_at_idx`, `audit_logs_actor_id_idx`, `audit_logs_action_idx`
- Types: `AuditLog = typeof auditLogs.$inferSelect`, `NewAuditLog = typeof auditLogs.$inferInsert`
- Also exports `AuditAction`, `AuditTargetType`

### Relations (`src/db/relations.ts`)
- `campaignsRelations`: `createdByUser` (one -> `user`), `donations` (many -> `donations`)
- `donationsRelations`: `campaign` (one -> `campaigns`)
- `auditLogsRelations`: `actor` (one -> `user`)

### Auth / RBAC (`src/auth.ts`)
- Exports: `ac` (access-control instance), `viewer`, `manager`, `admin_`
  (role objects — note the trailing underscore to avoid clashing with the
  `admin` plugin import), `auth` (the Better Auth instance).
- Statement shape: `{ ...defaultStatements /* user, session */, campaign: ["read","create","update","delete"], donation: ["read","export"], reconciliation: ["read","run"], audit: ["read"] }`.
- Role grants:
  | Role | campaign | donation | reconciliation | audit | user | session |
  |---|---|---|---|---|---|---|
  | viewer | read | read | read | read | — | — |
  | manager | read, create, update | read, export | read, run | read | — | — |
  | admin | read, create, update, delete | read, export | read, run | read | full defaultStatements.user set (create, list, set-role, ban, impersonate, impersonate-admins, delete, set-password, set-email, get, update) | list, revoke, delete |
- `admin({ ac, roles: { viewer, manager, admin: admin_ }, defaultRole: "viewer", adminRoles: ["admin"] })`.
- Backend must build its `permissions` macro (BE-1 scope) using this `ac`
  and role set via `auth.api.hasPermission`.

### Demo credentials (seeded)
- Login is **username + password** (Better Auth `username` plugin).
- `viewer` / `demo1234` — role `viewer`, email `viewer@demo.gt`
- `manager` / `demo1234` — role `manager`, email `manager@demo.gt`
- `admin` / `demo1234` — role `admin`, email `admin@demo.gt`

### Seed data shape (`src/db/seed.ts`, idempotent — guarded on `campaigns` count)
- 12 campaigns: 5 EUR, 4 USD, 3 GBP; statuses 8 active / 2 paused / 1 ended /
  1 draft; brand colours include `#0E8C7A`, `#1E6FB8`, `#B23A6B` (kit
  colours) plus 6 others; presets/frequencies vary per campaign.
- 260 donations over the last ~90 days, mixed currency (donor sometimes
  gives in a non-campaign currency), frequency, status
  (~90% completed / ~6% pending / ~4% failed weighting), source (~70% web /
  ~30% kiosk), ~35% guest (`donorName`/`donorEmail` null).
- **Exact reconciliation counts on a fresh seed (verified by a manual
  full-join check after seeding):**
  - `matched` = 235
  - `mismatched` = 3 (settlement amount differs from the donation)
  - `missingInProcessor` = 3 (completed donation, no settlement row)
  - `missingInApp` = 3 (settlement row, no matching donation)
  - Total `processor_settlements` rows = 241 (= 241 completed donations − 3
    missingInProcessor + 3 missingInApp; 241 completed donations total out
    of 260).
  - These counts are also documented as a comment at the top of `seed.ts`
    and are deterministic (seeded PRNG `mulberry32(20260702)`) — re-running
    the seed against a fresh DB reproduces the same counts.
- 2 illustrative audit log rows (a `campaign.create` and an `auth.login`)
  so `/admin/audit` has content immediately; the real audit trail is
  BE-1's responsibility (writes in service layer for every mutation).

## Files changed
- `project/backend/src/auth.ts` — admin plugin, access control, roles.
- `project/backend/src/db/auth-schema.ts` — regenerated (role/ban fields, impersonatedBy).
- `project/backend/src/db/campaigns.ts` — new: campaigns table + types.
- `project/backend/src/db/donations.ts` — new: donations table + types.
- `project/backend/src/db/processor-settlements.ts` — new: processor_settlements table + types.
- `project/backend/src/db/audit-logs.ts` — new: audit_logs table + types.
- `project/backend/src/db/relations.ts` — new: cross-table Drizzle relations.
- `project/backend/src/db/schema.ts` — re-exports the new files.
- `project/backend/src/db/seed.ts` — full idempotent seed (was a stub).
- `project/backend/migrations/0001_curvy_junta.sql` + `migrations/meta/*` — generated migration for the domain tables.
- `project/backend/package.json`, `project/backend/bun.lock` — added `@better-auth/cli` devDependency (installed with `--ignore-scripts`, see Notes).
- `project/backend/.env` — local-only (gitignored), created with a generated `BETTER_AUTH_SECRET` so migrate/seed/dev can run; matches `.env.example` shape (no changes needed to `.env.example`).

## How to verify
```
cd project/backend
rm -f data/local.db data/local.db-*      # start from a clean DB file
bun run db:migrate                        # applies 0000 (auth) + 0001 (domain) from scratch
bun run db:seed                            # inserts users/campaigns/donations/settlements
bun run db:seed                            # run again -> logs "Already seeded... skipping", no duplicates
bun run typecheck && bun run lint && bun run format:check
```
Expected: both `db:migrate` runs report success; second `db:seed` is a no-op;
typecheck/lint/format all pass clean. `bun run db:seed` output on a fresh DB
prints `Seed complete: 3 users, 12 campaigns, 260 donations, 241 settlements
(missingInProcessor=3, missingInApp=3, mismatched=3).`

## Notes / gotchas
- **`processor_settlements.paymentRef` has no FK / uniqueness constraint to
  `donations.paymentRef`.** This is intentional — the reconciliation
  algorithm (BE-1, spec §7.2) is a logical full-join in the service layer,
  and the seed's discrepancies (missing rows on both sides, mismatched
  amounts) would be impossible to seed under a real FK/unique constraint.
  Flagging this as the one non-obvious portability-relevant design choice;
  it's plain `sqlite-core` types either way so it migrates to Turso
  mechanically.
- `user.role` is a plain nullable `text` column (Better Auth's own
  convention) — it is **not** a DB-level enum. Backend should treat
  `"viewer" | "manager" | "admin"` as the closed set via its own types/`t.Enum`,
  not rely on a DB constraint.
- The admin plugin's role objects grant full `defaultStatements.user`/`session`
  actions only to `admin` — `viewer`/`manager` have no `user`/`session` grants
  at all, so any attempt to hit Better Auth's built-in user-management
  endpoints (list/ban/set-role/etc.) as those roles will 403 via
  `hasPermission`, matching spec §5.2's "–" cells.
- **Windows dev-environment gotcha (document for other agents):** don't run
  `bunx @better-auth/cli ...` directly — it will try to build
  `better-sqlite3` from source and fail without a Python/MSVC toolchain (and
  the user has asked that Python never be used to work around this). Use the
  local devDependency installed with `--ignore-scripts` instead, as done
  here; the CLI's `generate` command doesn't need the native binding for a
  libsql-backed config.
- `.env` is gitignored (per `.gitignore`) — this artifact created it locally
  with a random `BETTER_AUTH_SECRET`; whoever runs this fresh (backend
  reviewer, other agents, CI) needs to create their own from
  `.env.example` (or reuse the committed `.env.example` defaults +
  `openssl rand -base64 32` for the secret).
- Money is `amountMinor` integer end-to-end, currencies are plain ISO-4217
  `text` — no floats anywhere in the new tables, per the DB skill's locked
  conventions.
