# backend-engineer — BE-1: full GiveTap API

status: done
task: BE-1
depends_on_read: .claude-artifacts/plan.md, .claude-artifacts/findings.md, .claude-artifacts/database-engineer.md, .task/CodeSprintMT-2026-GiveTap-BUILD-SPEC.md (§5.3, §6, §7), .claude/skills/backend/SKILL.md

## What was done

- **`permissions` macro** (`src/plugins/auth.ts`): added alongside the existing
  `auth` macro. `permissions: { resource: ["action"] }` first requires a
  session (401 if none), then calls `auth.api.userHasPermission({ body: {
  userId, permissions } })` (the admin plugin's actual endpoint name —
  `hasPermission` doesn't exist on `auth.api`; `userHasPermission` does) and
  403s on `!result.success`. Every module that uses `auth`/`permissions` also
  does `.use(authPlugin)` itself (Elysia plugin-dedup pattern: it only
  actually registers `/api/auth/*` once at runtime, but each module needs the
  `.use()` for TypeScript to see the macro types).
- **`PaymentDeclined` factory** added to `src/lib/errors.ts` (402,
  `PAYMENT_DECLINED`).
- **`src/lib/currency.ts`**: `SUPPORTED_CURRENCIES`/`BASE_CURRENCY`/`RATES`
  (`{EUR:1,USD:1.08,GBP:0.85}`), `isSupportedCurrency`, `toEURMinor`,
  `fromEURMinor`, `convertMinor` (cross-currency via the EUR bridge — used by
  campaign progress and the dashboard), `CurrencySchema` (shared TypeBox enum).
- **`src/lib/reference.ts`**: `generateReference(campaignName)` →
  `<CAMP>-<base36x4>` (initials from campaign name words, uppercased, capped
  at 3 letters, falls back to `GT`); `generatePaymentRef()` → `crypto.randomUUID()`.
- **`src/lib/csv.ts`**: hand-rolled RFC-4180-ish escaping (`csvEscape`,
  `toCsvRow`, `toCsv`) — quotes/doubles only when a field has a comma, quote,
  or newline. No dependency, no `node:*`.
- **`src/lib/pagination.ts`**: `paginate(page, pageSize)` → clamps to
  `[1, 100]` pageSize, returns `{ page, pageSize, offset, limit }`.
- **`src/lib/reconcile.ts`**: pure `classify(donationSide, settlementSide)` →
  `matched|mismatched|missingInProcessor|missingInApp`, factored out of the
  reconciliation service so it's unit-testable without a database.
- **`src/plugins/events.ts`**: in-memory `Set<Subscriber>` pub/sub
  (`subscribe`/`emit`), `GET /api/admin/events` as a real
  `text/event-stream` response via an async generator (adapted from
  `src/examples/stream.ts`) — proper `event:`/`data:` framing, a `: comment`
  heartbeat every 20s, unsubscribes in a `finally` block keyed off
  `request.signal.aborted`. Gated with `auth: true` + `permissions: {
  donation: ["read"] }`.
- **7 resource modules** under `src/modules/` (model.ts/service.ts/index.ts
  each): `campaigns`, `donations`, `dashboard`, `reconciliation`, `audit`,
  `users`, `config` — see Public interface below for every route.
- **Audit writes live in services**, never routes, per spec §7.6: campaign
  create/update/delete write from `CampaignService`; ledger CSV export from
  `DonationService.recordExportAudit` (called by the controller after
  streaming, so it's audited even if invoked from the export route); role
  changes from `UserService.setRole`; reconciliation runs from
  `ReconciliationService.run`; the restricted client-event enum
  (`ledger.export.pdf` only) from the audit controller's own handler (it *is*
  the mutation, so writing at the route/service boundary there is correct).
  `auth.login` is written via a Better Auth `hooks.after` middleware in
  `src/auth.ts` (matches `ctx.path.startsWith("/sign-in")`, reads
  `ctx.context.newSession`) — `auth.ts` stays free of Elysia imports as
  required.
- **App wiring** (`src/app.ts`): new modules mounted under `.group("/api",
  ...)`, alongside the pre-existing `health`/`examples`/root routes which stay
  unprefixed. `/api/auth/*` (Better Auth) and `/` `/me` are unaffected.
- **Deviation from the plan's macro name**: plan.md said "via
  `auth.api.hasPermission`"; the installed Better Auth admin plugin's actual
  endpoint is `auth.api.userHasPermission` (confirmed by reading
  `node_modules/better-auth/dist/plugins/admin/admin.d.mts`) — used that
  instead, no functional difference to the route-facing macro contract.
- **Deviation added, not in plan**: campaign delete now checks for existing
  donations first and throws `409 Conflict` ("Campaign has donations and
  cannot be deleted") instead of letting the DB's FK constraint bubble up as
  an uncaught 500 — found this via the manual curl pass (see Notes).
- Tests (`bun test`, 21 tests / 4 files, no DB needed): `lib/currency.test.ts`,
  `lib/reference.test.ts`, `lib/csv.test.ts`, `lib/reconcile.test.ts`.
- Ran the full verification loop end-to-end against the seeded dev DB (see
  "How to verify") — every behaviour in the acceptance criteria confirmed
  live, not just by reading the code.

## Public interface

Base path for everything below (except `/`, `/me`, `/health/*`,
`/examples/*`, `/api/auth/*`) is **`/api`**. Every success response is `{
"data": <payload> }`; every failure is `{ "error": { "code", "message",
"details"? } }` (never hand-built — thrown `AppError`s render through the
existing global error handler). Error codes in play: `BAD_REQUEST` (400),
`UNAUTHORIZED` (401), `PAYMENT_DECLINED` (402), `FORBIDDEN` (403), `NOT_FOUND`
(404), `CONFLICT` (409), `VALIDATION` (422, from Elysia's own schema
validation), `INTERNAL` (500).

### Campaigns (`src/modules/campaigns`)
| Method | Path | Auth/permission | Request | Response (`data`) |
|---|---|---|---|---|
| GET | `/api/campaigns` | none | — | `CampaignPublic[]` (active only) |
| GET | `/api/campaigns/:slug` | none | — | `CampaignPublic & { progress: { raisedMinor, targetMinor, donorCount } }`; 404 for missing/`draft` |
| GET | `/api/admin/campaigns` | `campaign:read` | query `?status&q&page&pageSize` | `{ rows: CampaignAdmin[], total, page, pageSize }` |
| POST | `/api/admin/campaigns` | `campaign:create` | `CreateCampaignBody` (see below) | `CampaignAdmin`; audits `campaign.create`; 400 on duplicate slug |
| GET | `/api/admin/campaigns/:id` | `campaign:read` | — | `CampaignAdmin`; 404 |
| PUT | `/api/admin/campaigns/:id` | `campaign:update` | `Partial<CreateCampaignBody>` | `CampaignAdmin`; audits `campaign.update`; 400 on duplicate slug |
| DELETE | `/api/admin/campaigns/:id` | `campaign:delete` | — | `{ deleted: true }`; audits `campaign.delete`; **409** if the campaign has any donations |

`CampaignPublic` = `{ id, slug, name, cause, description, story, targetMinor,
currency, status, brandColor, logoUrl, heroImageUrl, presetsMinor,
allowCustom, frequencies }`. `CampaignAdmin` = `CampaignPublic & { createdBy,
createdAt, updatedAt }` (timestamps as ISO strings).
`CreateCampaignBody` = `{ slug (lowercase/hyphen), name, cause, description,
story?, targetMinor:int>0, currency: 'EUR'|'USD'|'GBP', status:
'draft'|'active'|'paused'|'ended', brandColor, logoUrl?, heroImageUrl?,
presetsMinor: int[] (>=1 item), allowCustom?:bool, frequencies:
('one_time'|'monthly'|'roundup')[] (>=1 item) }`.

### Donations (`src/modules/donations`)
| Method | Path | Auth/permission | Request | Response (`data`) |
|---|---|---|---|---|
| POST | `/api/campaigns/:slug/donations` | none | `CreateDonationBody` | `{ reference, status: 'completed', donation: Donation }`; **402 PAYMENT_DECLINED** if `card.last4 === '0002'`; 400 if campaign not active / frequency not offered by the campaign / not found |
| GET | `/api/campaigns/:slug/donations/:reference` | none | — | `Donation & { campaignName, campaignSlug }`; 404 |
| GET | `/api/admin/donations` | `donation:read` | query `?campaignId&currency&status&source&dateFrom&dateTo&q&sort&dir&page&pageSize` | `{ rows: (Donation & { paymentRef, campaignName })[], total, page, pageSize }` |
| GET | `/api/admin/donations/export.csv` | `donation:export` | same query filters (no pagination, capped at 50k rows) | `text/csv` body, `Content-Disposition: attachment; filename="donations-export.csv"`; audits `ledger.export.csv` |

`CreateDonationBody` = `{ amountMinor:int>0, currency: 'EUR'|'USD'|'GBP',
frequency: 'one_time'|'monthly'|'roundup', donorName?, donorEmail?, source:
'web'|'kiosk', card?: { last4: 4-char string } }`. `Donation` = `{ id,
reference, campaignId, donorName, donorEmail, amountMinor, currency,
frequency, status: 'completed'|'pending'|'failed', source: 'web'|'kiosk',
createdAt }`. On success a donation is always persisted `status: 'completed'`
(the simulated processor never leaves a `pending` state) and a matching
`processor_settlements` row (`status:'settled'`) is inserted in the same
call, then `donation.created` is emitted over SSE (see below).

### Dashboard (`src/modules/dashboard`)
| Method | Path | Auth/permission | Response (`data`) |
|---|---|---|---|
| GET | `/api/admin/dashboard` | `donation:read` | `DashboardStats` |

`DashboardStats` = `{ totalsByCurrency: {currency, totalMinor, count}[],
totalEURMinor, donationCount, activeCampaignCount, topCampaigns:
{campaignId, name, raisedEURMinor, donationCount}[] (top 5), recentDonations:
{reference, campaignName, amountMinor, currency, source, createdAt}[] (last
10), trend: {date:'YYYY-MM-DD', totalEURMinor, count}[] (last 90 days,
completed donations only, EUR-equivalent) }`.

### Reconciliation (`src/modules/reconciliation`)
| Method | Path | Auth/permission | Response (`data`) |
|---|---|---|---|
| GET | `/api/admin/reconciliation` | `reconciliation:run` | `ReconciliationResult`; audits `reconciliation.run` |
| GET | `/api/mock-processor/settlements` | none (internal/public feed) | `Settlement[]` |

`ReconciliationResult` = `{ summary: { matched, mismatched,
missingInProcessor, missingInApp }, rows: { paymentRef, status, reference,
donation: {amountMinor, currency, status}|null, settlement:
{amountMinor, currency, status}|null }[] }`. Classification is a full-join on
`paymentRef` between **completed** donations and all `processor_settlements`
rows (pure logic in `src/lib/reconcile.ts::classify`). On a freshly-seeded DB
this returns `{matched:235, mismatched:3, missingInProcessor:3,
missingInApp:3}` (verified live). `Settlement` = `{ id, paymentRef,
amountMinor, currency, status: 'settled'|'failed', processedAt }`.

### Audit (`src/modules/audit`)
| Method | Path | Auth/permission | Request | Response (`data`) |
|---|---|---|---|---|
| GET | `/api/admin/audit` | `audit:read` | query `?action&actorId&dateFrom&dateTo&page&pageSize` | `{ rows: AuditLog[], total, page, pageSize }` |
| POST | `/api/admin/audit/client-event` | `donation:read` | `{ action: 'ledger.export.pdf', metadata? }` (enum restricted to this one value on purpose) | `{ recorded: true }` |

`AuditLog` = `{ id, actorId, actorEmail, action, targetType, targetId,
metadata, createdAt }`. `action` full enum (server-written values only):
`campaign.create|campaign.update|campaign.delete|user.role_change|reconciliation.run|ledger.export.csv|ledger.export.pdf|auth.login`.

### Users (`src/modules/users`)
| Method | Path | Auth/permission | Request | Response (`data`) |
|---|---|---|---|---|
| GET | `/api/admin/users` | `user:list` | — | `{ rows: User[], total }` |
| PATCH | `/api/admin/users/:id/role` | `user:set-role` | `{ role: 'viewer'\|'manager'\|'admin' }` | updated `User`; audits `user.role_change` |

`User` = `{ id, name, email, username, role, banned, createdAt }`. Both
routes proxy to the Better Auth admin API (`auth.api.listUsers` /
`auth.api.setRole`) using the caller's request headers, so Better Auth's own
internal permission check also applies (belt-and-braces with our macro).
Only `role: "admin"` carries the `user:list`/`user:set-role` grants (per
DB-1's RBAC table) — viewer/manager get 403.

### Config (`src/modules/config`)
| Method | Path | Auth/permission | Response (`data`) |
|---|---|---|---|
| GET | `/api/config/currencies` | none | `{ base: 'EUR', currencies: ['EUR','USD','GBP'], rates: {EUR:1,USD:1.08,GBP:0.85} }` |

### Real-time (`src/plugins/events.ts`)
| Method | Path | Auth/permission | Contract |
|---|---|---|---|
| GET | `/api/admin/events` | `donation:read` | `text/event-stream` |

Frames: `: connected\n\n` on open, then `event: donation.created\ndata:
{"reference","campaignId","campaignName","amountMinor","currency","source","createdAt"}\n\n`
per new donation, `: heartbeat\n\n` comment every 20s. Client:
`new EventSource(`${API}/api/admin/events`, { withCredentials: true })`,
listen with `addEventListener("donation.created", ...)`. Verified live: a
donation created while an SSE connection was open produced exactly one
`donation.created` frame with the correct payload.

### Auth (unchanged, Better Auth — not part of this task's routes list but
consumed by the frontend)
`ALL /api/auth/*` — `signIn.username`, `signOut`, `getSession`, admin ops.
Demo credentials (seeded by DB-1): `viewer`/`manager`/`admin`, password
`demo1234`. `auth.login` is recorded to the audit log automatically on every
successful sign-in.

## Files changed
- `src/lib/errors.ts` — added `PaymentDeclined` (402).
- `src/lib/currency.ts`, `src/lib/reference.ts`, `src/lib/csv.ts`,
  `src/lib/pagination.ts`, `src/lib/reconcile.ts` — new.
- `src/lib/currency.test.ts`, `src/lib/reference.test.ts`,
  `src/lib/csv.test.ts`, `src/lib/reconcile.test.ts` — new, pure-logic tests.
- `src/plugins/auth.ts` — added the `permissions` macro.
- `src/plugins/events.ts` — new: in-memory pub/sub + SSE endpoint.
- `src/auth.ts` — added `hooks.after` (records `auth.login`); imports
  `AuditService` (no Elysia import added, still CLI-safe).
- `src/modules/{campaigns,donations,dashboard,reconciliation,audit,users,config}/{model,service,index}.ts`
  — new, 7 modules (config has no service.ts, it's pure config).
- `src/app.ts` — mounts the 7 new modules + `eventsPlugin` under `.group("/api", ...)`.

## How to verify
```
cd project/backend
bun run format && bun run lint && bun run typecheck && bun test
grep -rn "node:" src   # expect no matches (the one hit is a comment, not an import)
```
Expected: format/lint clean (lint shows 6 pre-existing-pattern
`noStaticOnlyClass` **warnings**, exit code 0 — the skill mandates the
static-abstract-class service pattern, so these are expected, not failures);
typecheck clean; `bun test` → 21 pass / 0 fail across 4 files.

Live/manual verification performed this session (fresh `db:migrate` +
`db:seed`, then `bun run src/server.ts`, then a scripted curl pass with a
cookie jar per role) — all confirmed:
- `viewer`/`manager`/`admin` sign in via `POST /api/auth/sign-in/username`.
- `viewer` → `POST /api/admin/campaigns` → **403**.
- `manager` → same → **200**, campaign created.
- `viewer` → `GET /api/admin/users` → **403**; `admin` → **200**.
- `manager` → `PATCH /api/admin/users/:id/role` → **403**; `admin` → **200**
  (round-tripped a role change and reverted it).
- Donation with `card.last4:"0002"` → **402** `{"error":{"code":"PAYMENT_DECLINED",...}}`.
- Successful donation → `{ reference, status:'completed', donation }`;
  receipt fetchable by reference; a matching `processor_settlements` row
  exists (confirmed via reconciliation staying `matched`).
- `GET /api/admin/donations/export.csv` → `200`, `Content-Disposition:
  attachment; filename="donations-export.csv"`, correct CSV body, audit row
  written.
- `GET /api/admin/reconciliation` on the untouched seed → `{matched:235,
  mismatched:3, missingInProcessor:3, missingInApp:3}` — matches DB-1's
  documented counts exactly.
- `GET /api/admin/events` (SSE): opened a connection, created a donation
  concurrently, got exactly one `event: donation.created` frame with the
  right payload, connection cleaned up on client disconnect (no server error/leak).
- `DELETE /api/admin/campaigns/:id` on a campaign with donations → **409
  CONFLICT** (found and fixed this — see Notes); on an empty campaign → **200**.
- After manual testing, the dev DB was reset (`rm data/local.db*` +
  `db:migrate` + `db:seed`) so the repo's local DB is back at the documented
  fresh-seed baseline for the next agent/reviewer.

## Notes / gotchas
- **`auth.api.userHasPermission`, not `hasPermission`.** plan.md/spec §5.3
  reference `auth.api.hasPermission`; the actual admin-plugin API surface (in
  this `better-auth` version) is `userHasPermission`, taking `{ userId,
  permissions }` in the body and returning `{ success: boolean }`. Frontend
  should not call this directly — it's server-side-only, used by the
  `permissions` macro.
- **Plugin-dedup for macros**: any *new* module that needs `auth`/`permissions`
  must `.use(authPlugin)` itself (not just rely on it being mounted earlier in
  `app.ts`) so Elysia's type inference sees the macro. This is safe at runtime
  — Elysia dedups plugins by `name`, so `/api/auth/*` is still only mounted
  once.
- **Campaign delete is blocked (409) if the campaign has any donations**,
  because `donations.campaignId` has a real FK to `campaigns.id` (per DB-1's
  schema) and an unconditional delete would otherwise 500 on the SQLite
  constraint violation. Frontend should treat 409 on this route as "archive
  instead of delete" (e.g. suggest setting `status: 'ended'` via `PUT`
  instead) — there is no cascade/soft-delete built in.
- **Users list/role routes require the `user:list`/`user:set-role`
  Better-Auth admin-plugin permissions**, which per DB-1's RBAC only `admin`
  has (viewer/manager get no `user`/`session` grants at all) — this is
  intentional, matching spec §5.2's "–" cells for those roles.
- **CSV export is capped at 50,000 rows** (`DonationService.listForExport`'s
  `cap` param) and ignores pagination — it always returns the full filtered
  set (up to the cap), per spec §7.5.
- **Reconciliation `rows` array is unsorted** (JS `Set` insertion order over
  the union of donation/settlement payment refs) — if the frontend wants a
  stable order for the drill-in table it should sort client-side (e.g. by
  `status` then `paymentRef`).
- **Dashboard aggregation is done in JS**, not SQL `GROUP BY` (loads all
  completed donations into memory once per request) — correct and fine at
  seed-data scale (~250 rows); flagging in case donation volume grows a lot
  and this needs to move to SQL aggregation.
- `src/examples/` was left in place (still mounted, unprefixed, deletable) —
  not part of this task's scope and doesn't collide with anything under `/api`.
- The frontend must send `credentials: "include"` on every call (already the
  existing `shared/api/client.ts` convention) for both the session cookie and
  the SSE `EventSource` (`{ withCredentials: true }`).
