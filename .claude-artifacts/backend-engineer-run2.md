# backend-engineer — BE-2: backend fixes + new endpoints (run 2)

status: done
task: BE-2
depends_on_read: .claude-artifacts/findings.md, .claude-artifacts/plan.md ("BE-2" section), .claude-artifacts/database-engineer-run2.md, .claude-artifacts/backend-engineer.md (run-1 artifact, route inventory + envelope conventions), .claude/skills/backend/SKILL.md

## What was done

All 7 plan items landed under `project/backend`. Nothing under `project/frontend` or `backend/src/db/**` schema/seed was touched (read-only, per instructions).

1. **Discover crash fix.** `CampaignService.listPublicActive()` (`src/modules/campaigns/service.ts`) now returns the exact same `progress: { raisedMinor, targetMinor, donorCount }` shape as `getPublicBySlug()`, computed with **one grouped aggregate query** (`groupBy(donations.campaignId, donations.currency)` using `sum()`/`count()` from drizzle-orm, filtered with `inArray(campaignIds)` + `status = 'completed'`) — no N+1, one extra query total regardless of how many active campaigns exist. Per-campaign currency conversion (via the existing `convertMinor` EUR-bridge) happens in JS on the small aggregated result set, same methodology as `progressFor` uses for the single-campaign case. `GET /api/campaigns`'s response schema changed from `t.Array(CampaignPublicSchema)` to `t.Array(CampaignWithProgressSchema)` in `src/modules/campaigns/index.ts`. Verified: `listPublicActive()`'s `progress` for each active campaign now matches `getPublicBySlug()`'s independently-computed `progress` exactly (test asserts `toEqual`).

2. **Role guards (D2).** `src/lib/errors.ts` gained two new factories with **lowercase snake codes** per plan.md (deliberately distinct from the rest of the API's `UPPER_SNAKE` codes, so the frontend can branch on them precisely): `CannotChangeOwnRole()` → `400 { code: "cannot_change_own_role" }`, `LastAdmin()` → `400 { code: "last_admin" }`. `UserService.setRole` (`src/modules/users/service.ts`) now:
   - throws `CannotChangeOwnRole` if `actor.id === userId`, **before** any DB/Better-Auth call;
   - otherwise looks up the target's *current* role directly from the `user` table (Drizzle, not Better Auth) and, only if the target is currently `admin` **and** the new role isn't `admin`, counts current admins; if that count is `<= 1` (i.e. the target is the only admin), throws `LastAdmin`.
   - Both guards short-circuit before `auth.api.setRole` and before the `user.role_change` audit write, so **blocked attempts are not audited** — same behavior as any other failed call to `auth.api.setRole` today (audit only happens on success). Successful changes are audited exactly as before.
   - Both guards are unreachable via HTTP in the *self-only-admin* edge case (an admin can never be a different actor than themselves when they're the sole admin, since only admins hold `user:set-role`), but the `last_admin` guard is real defensive code for races/future multi-admin scenarios and is exercised directly at the service layer in tests (bypassing the reachability constraint by injecting a distinct `actor`).

3. **Exports (D4).** `src/modules/donations/model.ts` adds `ExportListQuery` (`DonationListQuery` fields + optional `pages: string`) and `ExportJsonResponse` (`{ rows: DonationAdminSchema[] }`). `DonationService` (`src/modules/donations/service.ts`) gained `parsePagesSpec(spec)` (pure, regex-validated `^\d+(-\d+)?(,\d+(-\d+)?)*$`, throws `BadRequest` — **400**, not Elysia's 422 — on anything malformed, an inverted range, or page `0`) and `listForExport` now accepts `ExportListFilters` (adds `pages`): with no `pages`, behavior is unchanged (full filtered set, capped at 50k); with `pages`, it clamps `pageSize` to `[1,100]` (default **20**, independent of the admin-list default of 25) and fetches only the requested pageSize-sized chunks via per-range `offset`/`limit` queries (same `ORDER BY createdAt DESC` as the unfiltered path), still capped at 50k total rows. `GET /api/admin/donations/export.csv` now declares `query: ExportListQuery` (adds `pages`) — CSV audit behavior (`ledger.export.csv`, written by `DonationService.recordExportAudit`) is unchanged. New `GET /api/admin/donations/export.json` shares the exact same filter/pages semantics and calls `listForExport` directly but **does not call `recordExportAudit`** — PDF generation stays a client-reported event per D4/D5.

4. **Audit client-event target (D5).** `src/modules/audit/model.ts` adds `ClientEventTargetTypeSchema` (allowlist `"ledger" | "campaign" | "user" | "auth"` — a subset of the DB's full `AuditTargetType`, since only these are reachable from a client today) and `ClientEventBody` gained optional `targetType`/`targetId`. `POST /api/admin/audit/client-event` (`src/modules/audit/index.ts`) now forwards both through to `AuditService.record`, fixing the `":"` target rendering for `ledger.export.pdf` rows once the frontend passes them. Omitting both fields still works (backward compatible) and an out-of-allowlist `targetType` is rejected by Elysia's own validation (**422**, not 400 — it's a body-schema check, matching the skill's convention that malformed input is `VALIDATION`/422 unless a service-layer check explicitly throws a 400).

5. **Impact stats (D6).** New module `src/modules/impact/` (`model.ts`, `service.ts`, `index.ts`), mounted in `src/app.ts`. `GET /api/admin/impact` — `permissions: { donation: ["read"] }` (the same grant `viewer`/`manager`/`admin` all hold, matching the dashboard's gating, so any admin-console role including viewer can read it). `ImpactService.stats()` aggregates **completed donations only** in JS over the whole (seed-sized) dataset, same methodology as `DashboardService.stats()`: `totalRaisedMinor` is **EUR-equivalent** (campaigns can be in different currencies, so a single grand total has to pick one — mirrors the dashboard's `totalEURMinor`); each `perCampaign[].raisedMinor`/`targetMinor` stay in the **campaign's own currency** (like `CampaignProgressSchema`) so they're directly comparable for a progress bar. `donorCount` counts completed donations, not unique donors (no donor identity is tracked anywhere in this schema) — same convention `CampaignProgressSchema.donorCount` already uses; `donationCount` is therefore always equal to `donorCount` today, both included per the plan's exact shape. `perCampaign` excludes `draft` campaigns (never surface unpublished campaigns on an impact view). Verified against `DashboardService.stats()`: `donationCount` and `activeCampaignCount` match exactly on the seeded DB.

6. **Profile (D7).**
   - `src/auth.ts` gained a `hooks.before` on `/update-user` (alongside the existing `auth.login` `hooks.after`) that derives Better Auth's display `name` as `${firstName} ${lastName}`.trim() **in the same DB write** as the `firstName`/`lastName` update, but **only when the request includes both fields and doesn't already set `name` explicitly** (an explicit `name` in the body always wins). This is a deliberate limitation, not an oversight: Better Auth's global `before` hooks run **before** the endpoint's own `sessionMiddleware` resolves `ctx.context.session` (confirmed by reading `node_modules/better-auth/dist/api/dispatch.mjs`'s `runBeforeHooks`/`dispatchAuthEndpoint`), so there's no reliable way to read the user's *existing* first/last name inside the hook to fill in a partial update without an extra query. **Contract for the frontend (FE-2B):** the settings-page profile form must submit `firstName` **and** `lastName` together on every save (even if only one changed) for `name` to stay in sync; submitting only one of the two updates that field but leaves `name` untouched.
   - `POST /api/auth/update-user` itself is unchanged Better Auth surface (not a route BE-2 owns) — accepts `firstName`/`lastName` as top-level body fields per DB-2's registered `additionalFields`, returns the updated user (with `firstName`/`lastName`/`image` present) and refreshes the session cookie.
   - Users admin list DTO (`UserSchema` in `src/modules/users/model.ts`, populated in `UserService.list`/`setRole`) gained `firstName`, `lastName`, `image` (all nullable strings), read defensively off the Better Auth admin-plugin user object via an index cast (same pattern already used for `username`), since the admin plugin's own TS types don't know about custom `additionalFields`.

7. **Em-dash sweep.** Replaced every U+2014 (—) / U+2013 (–) with `-` across `backend/src/**` **except** `src/db/**` (already zero per DB-2). Ran via a `perl -CSD -pi -e 's/\x{2014}|\x{2013}/-/g'` pass over every `.ts` file outside `src/db`, then hand-verified with `grep -rP '[—–]' src` → 0 hits. 20 files touched, all comment-only changes (no string literals, no behavior change) — confirmed by re-running `bun test`/`typecheck` clean afterward.

**No deviations from plan.md.**

## Public interface

Base path for everything below (except `/`, `/me`, `/health/*`, `/examples/*`, `/api/auth/*`) is **`/api`**. Envelope unchanged: success → `{ "data": <payload> }`, failure → `{ "error": { "code", "message", "details"? } }`. Error codes in play (unchanged set + 2 new): `BAD_REQUEST` (400), `UNAUTHORIZED` (401), `PAYMENT_DECLINED` (402), `FORBIDDEN` (403), `NOT_FOUND` (404), `CONFLICT` (409), `cannot_change_own_role` (400, **new**), `last_admin` (400, **new**), `VALIDATION` (422, Elysia schema validation), `INTERNAL` (500).

This section documents **only what changed or is new** in run 2. Everything else (donations create/receipt, dashboard, reconciliation, config, SSE, auth) is **unchanged** from `backend-engineer.md` (run 1) — see that file for the full untouched route list.

### Campaigns — changed

| Method | Path | Auth/permission | Request | Response (`data`) |
|---|---|---|---|---|
| GET | `/api/campaigns` | none | — | `(CampaignPublic & { progress: { raisedMinor, targetMinor, donorCount } })[]` — **was** `CampaignPublic[]` without progress; this is the /discover crash fix |

`GET /api/campaigns/:slug` is unchanged (already had `progress`).

### Donations — changed / new

| Method | Path | Auth/permission | Request | Response (`data`) |
|---|---|---|---|---|
| GET | `/api/admin/donations/export.csv` | `donation:export` | query = `DonationListQuery` filters **+ optional `pages`** (string, e.g. `"1-3,5"`) | `text/csv` (unchanged); **400** `BAD_REQUEST` if `pages` is malformed (bad format, page `< 1`, or an inverted range `a-b` with `b < a`); audits `ledger.export.csv` (unchanged) |
| GET | `/api/admin/donations/export.json` | `donation:export` | same query as CSV (filters + optional `pages`) | `{ rows: (Donation & { paymentRef, campaignName })[] }` — same row shape the CSV source uses, capped at 50k; **400** `BAD_REQUEST` on malformed `pages` (same validation as CSV); **does NOT write an audit row** (PDF export stays a client-reported event via `POST /api/admin/audit/client-event`) |

`pages` semantics (both routes, identical): comma-separated list of 1-indexed page numbers/ranges (`"1-3,5"` = pages 1, 2, 3, and 5), relative to `pageSize` (**default 20** for exports — independent of the admin-list default of 25; still clamped to `[1, 100]`). Omitting `pages` returns the full filtered set (unchanged existing behavior, capped at 50k). Query filter fields (`campaignId`, `currency`, `status`, `source`, `dateFrom`, `dateTo`, `q`, `sort`, `dir`) are unchanged from `DonationListQuery` (run 1); `page`/`pageSize` on the export routes are **not** used for admin-list-style single-page pagination — `pageSize` only sizes the `pages` chunks, `page` is ignored on export routes.

`POST /api/campaigns/:slug/donations`, `GET /api/campaigns/:slug/donations/:reference`, `GET /api/admin/donations` are unchanged from run 1.

### Users — changed

| Method | Path | Auth/permission | Request | Response (`data`) |
|---|---|---|---|---|
| GET | `/api/admin/users` | `user:list` | — | `{ rows: User[], total }` — `User` gained `firstName`, `lastName`, `image` (all `string \| null`) |
| PATCH | `/api/admin/users/:id/role` | `user:set-role` | `{ role: 'viewer'\|'manager'\|'admin' }` | updated `User` (same new fields); **400** `{ code: "cannot_change_own_role" }` if `:id` is the caller's own id; **400** `{ code: "last_admin" }` if `:id` is currently the only `admin` and `role !== "admin"`; audits `user.role_change` on success only (guard rejections are not audited, matching existing failure-path behavior) |

`User` (updated) = `{ id, name, email, username, firstName, lastName, image, role, banned, createdAt }`.

### Audit — changed

| Method | Path | Auth/permission | Request | Response (`data`) |
|---|---|---|---|---|
| POST | `/api/admin/audit/client-event` | `donation:read` | `{ action: 'ledger.export.pdf', targetType?: 'ledger'\|'campaign'\|'user'\|'auth', targetId?: string, metadata?: unknown }` | `{ recorded: true }`; **422** if `targetType` is present but outside the 4-value allowlist (Elysia body validation, not a service-level 400) |

`GET /api/admin/audit` is unchanged; `AuditLog.targetType`/`targetId` are now populated by client events that send them (previously always `null` for `ledger.export.pdf`, which is the root cause of the `":"` render bug — fixed on the frontend side by FE-2B once this data is present).

### Impact — new module

| Method | Path | Auth/permission | Response (`data`) |
|---|---|---|---|
| GET | `/api/admin/impact` | `donation: ["read"]` (viewer, manager, and admin all hold this — any admin-console role) | `ImpactStats` |

`ImpactStats` = `{ totalRaisedMinor: int, donorCount: int, donationCount: int, activeCampaignCount: int, perCampaign: { id, title, slug, raisedMinor, targetMinor, donorCount }[] }`.
- `totalRaisedMinor` is **EUR-equivalent** across all campaigns/currencies (same convention as the dashboard's `totalEURMinor`) — display it labeled as EUR or convert client-side if you need another display currency.
- `perCampaign[].raisedMinor`/`targetMinor` are in **that campaign's own currency** (directly comparable, like a progress bar) — do **not** sum these across campaigns, they may be mixed currencies.
- `donorCount === donationCount` always today (both count completed donations; no unique-donor identity exists in this schema) — both are exposed because the plan's contract names them separately; treat them as the same number.
- `perCampaign` includes every non-`draft` campaign (`active`, `paused`, `ended`), sorted in DB insertion order (no explicit `ORDER BY` — sort client-side if you need a specific order, e.g. by `raisedMinor` desc).
- Completed donations only, same methodology as `GET /api/admin/dashboard` — `donationCount`/`activeCampaignCount` will always match between the two endpoints on the same data.

### Auth (Better Auth, unchanged surface — behavior note for FE-2B)

`POST /api/auth/update-user` — accepts `{ firstName?, lastName?, name?, image?, ... }`. **Send `firstName` and `lastName` together on every profile save** (even if only one field changed in the UI) so the backend can derive and persist a matching `name` in the same write; sending only one of the two updates that field but leaves `name` stale. Sending an explicit `name` bypasses the derivation entirely (respected as-is). Response/session-cookie behavior is all stock Better Auth (unchanged).

## Files changed

- `src/modules/campaigns/service.ts` — `listPublicActive()` rewritten to compute `progress` via one grouped aggregate query; `progressFor`'s local `reduce` param renamed `acc` to avoid shadowing the new `sum` import.
- `src/modules/campaigns/index.ts` — `/api/campaigns` response schema `CampaignPublicSchema` → `CampaignWithProgressSchema`.
- `src/lib/errors.ts` — added `CannotChangeOwnRole`, `LastAdmin` (400, lowercase-snake codes).
- `src/modules/users/service.ts` — `setRole` gained both guards (self-change, last-admin); `list`/`setRole` DTOs gained `firstName`/`lastName`/`image` via a new `stringFieldOf` helper.
- `src/modules/users/model.ts` — `UserSchema` gained `firstName`, `lastName`, `image`.
- `src/modules/users/service.test.ts` — new, guard tests (self-change, last-admin, unknown user).
- `src/modules/donations/model.ts` — added `ExportListQuery`, `ExportJsonResponse`, `ExportListFilters` type.
- `src/modules/donations/service.ts` — added `parsePagesSpec`; `listForExport` reworked to accept `pages`/`pageSize`, chunked per-range queries when `pages` is present.
- `src/modules/donations/index.ts` — CSV route's `query` → `ExportListQuery`; new `GET /admin/donations/export.json` route.
- `src/modules/donations/pages.test.ts` — new, pure `parsePagesSpec` validation tests.
- `src/modules/audit/model.ts` — added `ClientEventTargetTypeSchema`; `ClientEventBody` gained `targetType`/`targetId`.
- `src/modules/audit/index.ts` — client-event handler forwards `targetType`/`targetId` to `AuditService.record`.
- `src/modules/audit/client-event.test.ts` — new, HTTP-level (`app.handle`) tests for the client-event route (allowlist accept/reject, backward compatibility) and `GET /api/campaigns` (progress present, no crash).
- `src/modules/impact/model.ts`, `src/modules/impact/service.ts`, `src/modules/impact/index.ts` — new module.
- `src/modules/impact/service.test.ts` — new, aggregate-shape + dashboard-consistency tests.
- `src/modules/campaigns/service.test.ts` — new, verifies `listPublicActive`'s `progress` matches `getPublicBySlug`'s per campaign.
- `src/app.ts` — mounted the new `impact` module under `.group("/api", ...)`.
- `src/auth.ts` — added `hooks.before` on `/update-user` to derive `name` from `firstName`+`lastName` when both are present and `name` isn't explicitly set.
- 20 files across `src/{auth.ts, plugins/**, modules/**, lib/**, examples/**, env.ts}` — em-dash/en-dash → `-` sweep (comments only, no behavior change; `src/db/**` untouched, already clean per DB-2).

## How to verify

```
cd project/backend
bun run format && bun run lint && bun run typecheck && bun test
grep -rP '[—–]' src            # expect 0 hits (whole src/, db included - already clean)
grep -rn "from \"node:" src     # expect 0 hits
```

Expected: format clean (no diffs); lint clean except **7 pre-existing/consistent `noStaticOnlyClass` warnings** (`modules/{audit,campaigns,dashboard,donations,reconciliation,users,impact}/service.ts` — `impact` is new but follows the exact same static-abstract-class pattern the skill mandates for every other service; exit code 0, not failures — same as run 1's documented baseline of 6, +1 for the new module); typecheck clean; `bun test` → **38 pass / 0 fail** across 9 files, 227 `expect()` calls, ~5-10s (21 from run 1's 4 files + 17 new across 5 new test files: `campaigns/service.test.ts`, `users/service.test.ts`, `donations/pages.test.ts`, `impact/service.test.ts`, `audit/client-event.test.ts`).

Manual/live verification performed this session (against the seeded dev DB, `bun test` driving `app.handle`, plus direct service calls):
- `GET /api/campaigns` returns every active campaign with a non-null `progress` object; each campaign's `listPublicActive()` progress matches an independent `getPublicBySlug()` call for the same slug exactly.
- `UserService.setRole` with `actor.id === userId` → throws `AppError(400, "cannot_change_own_role")` before touching `auth.api.setRole`.
- `UserService.setRole` on the seeded DB's sole admin (`admin`), called with a distinct fake actor id → throws `AppError(400, "last_admin")`.
- `DonationService.parsePagesSpec` accepts `"5"`, `"1-3"`, `"1-3,5"`; rejects `"abc"`, `"1;3"`, `"1-"`, `""`, `"5-1"` (inverted), `"0"` (below 1) — all with `AppError(400, "BAD_REQUEST")`.
- `POST /api/admin/audit/client-event` with `{ action: "ledger.export.pdf", targetType: "ledger", targetId: "export-scope-all" }` (logged in as `admin`) → `200`, and the row appears in `GET /api/admin/audit` with `targetType: "ledger"`, `targetId: "export-scope-all"` (not `null`); the same call with `targetType: "not-a-real-type"` → `422`; the same call with neither field → still `200` (backward compatible).
- `ImpactService.stats()` on the seeded DB: `donationCount`/`activeCampaignCount` match `DashboardService.stats()` exactly; every `perCampaign` entry has `targetMinor > 0`, `raisedMinor >= 0`.
- After manual/test runs, the dev DB was reset (`rm data/local.db*` + `db:migrate` + `db:seed`) so the repo's local DB is back at the documented fresh-seed baseline (`3 users, 12 campaigns, 260 donations, 241 settlements (missingInProcessor=3, missingInApp=3, mismatched=3)`) for the next agent/reviewer.

## Notes / gotchas

- **`export.json` is intentionally unaudited.** Per plan.md D4/D5, only the client-reported `ledger.export.pdf` event (via `POST /api/admin/audit/client-event`, now carrying `targetType`/`targetId`) should represent a PDF export in the audit trail — fetching `export.json` itself is just data retrieval for client-side PDF rendering, not the "export" action from the user's point of view. If FE-2B fetches `export.json` but the user cancels before generating a PDF, no audit row should exist; only record the client event once the PDF is actually produced/downloaded.
- **`pages` validation is intentionally NOT a TypeBox `pattern`.** A `t.String({ pattern })` failure would surface as Elysia's `VALIDATION` (422), but the plan explicitly asks for **400**. `pages` is typed as a plain `t.Optional(t.String())` in the schema and validated inside `DonationService.parsePagesSpec`, which throws `BadRequest` (400) — this is why the export routes' `query` schema doesn't itself constrain the format.
- **`last_admin` is defensive, not currently reachable via a normal HTTP call.** Because only `admin`-role users hold `user:set-role`, if there's exactly one admin, that admin *is* the only possible caller — so `actor.id === userId` is always true in that state, and the `cannot_change_own_role` guard fires first. `last_admin` only matters if that invariant is ever broken (e.g. a future permission change, direct DB edit, or a race between two concurrent role-change requests). It's tested directly at the service layer (bypassing the HTTP-level unreachability) rather than skipped, since the plan explicitly asked for it and it's still correct, cheap insurance.
- **`name`-sync on profile update is best-effort, not authoritative.** See "What was done" §6 — Better Auth's `before` hooks run ahead of the endpoint's own session middleware, so there's no cheap way to backfill a partial `firstName`-or-`lastName`-only update with the user's existing other field inside the hook without an extra DB round-trip (which I deliberately avoided to keep this a zero-extra-query hook). **FE-2B's settings form must always submit both `firstName` and `lastName`** on save. If FE-2B wants server-side authoritative sync regardless of what the client sends, the fix would be a small `before`-hook DB lookup (`db.select().from(user).where(eq(user.id, ...))` — but note there's no session/user id available in a `before` hook either without decoding the session cookie manually) or, more simply, moving this logic into a dedicated `PATCH /api/admin/me` route BE-2 doesn't currently own — flagging as a possible follow-up if the settings page ever needs partial-field saves.
- **`ImpactService.stats()` loads the full completed-donations table into memory**, same as `DashboardService.stats()` (documented gotcha in run 1's artifact) — fine at seed scale (~250 rows), would need to move to SQL aggregation if donation volume grows significantly. `CampaignService.listPublicActive()`'s new aggregate, by contrast, **is** a real SQL `GROUP BY` (per the plan's explicit "no N+1" requirement for that one) — the two services intentionally use different strategies; `impact`/`dashboard` mirror each other's existing JS-aggregation convention rather than introducing yet another pattern.
- **Users list/role routes still require `user:list`/`user:set-role`** (admin-only per DB-1's RBAC) — unchanged. The new `firstName`/`lastName`/`image` fields are simply additional columns on the same admin-only response; they don't loosen access.
- `bun run lint` reports 7 `noStaticOnlyClass` warnings (up from run 1's 6, +1 for the new `ImpactService`) — expected per the skill's mandated static-abstract-class service pattern; exit code 0, not a failure.
