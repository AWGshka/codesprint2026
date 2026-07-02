# review-backend-engineer-run2

verdict: pass
task_reviewed: BE-2
artifact: .claude-artifacts/backend-engineer-run2.md

## Commands run (project/backend)

```
bun run format:check   -> "All matched files use Prettier code style!" (clean)
bun run lint           -> 7 warnings, all noStaticOnlyClass (audit/campaigns/dashboard/donations/reconciliation/users/impact
                           service.ts), exit code 0 -- matches artifact's documented baseline (6 pre-existing +1 for new impact module)
bun run typecheck      -> clean, no output
bun test               -> 38 pass / 0 fail, 227 expect() calls, 9 files, ~9.7s
grep -rP '[\x{2013}\x{2014}]' src   -> 0 hits (em-dash/en-dash sweep confirmed)
grep -rn "from \"node:" src          -> 0 hits (Bun built-ins only, confirmed)
```

All mechanical checks pass exactly as documented in the artifact's "How to verify" section.

## Inspection findings

1. **listPublicActive progress via grouped aggregate** -- confirmed in
   `src/modules/campaigns/service.ts:41-67`: one `db.select(...).groupBy(donations.campaignId, donations.currency)`
   query with `inArray(campaignIds)` + `status = "completed"`, no per-campaign loop query. `GET /api/campaigns`
   response schema is `t.Array(CampaignWithProgressSchema)` in `src/modules/campaigns/index.ts:13`. Matches contract.

2. **Role guards** -- `src/modules/users/service.ts:42-55`: `actor.id === userId` throws `CannotChangeOwnRole()`
   before any DB/Better-Auth call; last-admin check queries current admins and throws `LastAdmin()` only when
   target is currently admin and count <= 1. `src/lib/errors.ts:24-25` defines both as `400` with codes
   `cannot_change_own_role` / `last_admin`. `src/modules/users/service.test.ts` has both cases covered plus an
   unknown-user case, all passing.

3. **Exports** -- `export.csv` accepts `ExportListQuery` (`pages: t.Optional(t.String())`, no TypeBox pattern);
   malformed `pages` is validated in `DonationService.parsePagesSpec`/`listForExport` (`src/modules/donations/service.ts:148-159`)
   which throws `BadRequest` -> 400, not Elysia 422 -- confirmed intentional (documented gotcha, correctly implemented).
   `export.json` exists (`src/modules/donations/index.ts:91-108`), same query schema, same 50k cap (`listForExport(filters, 50_000)`
   default), and does **not** call `recordExportAudit` (only `export.csv`'s handler calls it, line 60) -- confirmed no
   duplicate audit row.

4. **Audit client-event** -- `ClientEventBody` (`src/modules/audit/model.ts:45-50`) has optional `targetType`
   (allowlisted via `ClientEventTargetTypeSchema` = ledger/campaign/user/auth) and `targetId`; handler forwards both
   to `AuditService.record` (`src/modules/audit/index.ts:20-28`). Confirmed.

5. **GET /api/admin/impact** -- mounted in `src/app.ts:13,40` (`.use(impact)` inside the `/api` group). Auth-gated
   with `permissions: { donation: ["read"] }`, which viewer/manager/admin all hold per `src/auth.ts:27-38` -- viewer
   is allowed. Response shape (`src/modules/impact/model.ts`) matches plan.md D6/BE-2 item 5 exactly:
   `{ totalRaisedMinor, donorCount, donationCount, activeCampaignCount, perCampaign: [{ id, title, slug,
   raisedMinor, targetMinor, donorCount }] }`. Confirmed.

6. **Users list DTO** -- `UserSchema` (`src/modules/users/model.ts:5-16`) includes `firstName`, `lastName`, `image`
   (all nullable), populated in `UserService.list`/`setRole` via the `stringFieldOf` helper. Confirmed.

7. **Em-dash sweep** -- `grep -rP '[\x{2013}\x{2014}]' backend/src` -> 0 hits (ran against the whole `src/`, `db/`
   included). Confirmed.

8. **Artifact template / contract accuracy** -- artifact follows the `[agent].md` template (status, what was done,
   public interface, files changed, how to verify, notes/gotchas). Spot-checked route contracts against source:
   - Impact: contract table and `ImpactStats` shape match `src/modules/impact/{index,model,service}.ts` exactly.
   - export.json: contract (`{ rows: (Donation & {paymentRef, campaignName})[] }`, no audit) matches
     `src/modules/donations/index.ts` + `service.ts` exactly.
   - Role-guard contract (400 codes, audit-only-on-success) matches `src/modules/users/service.ts` and
     `src/lib/errors.ts` exactly.
   No contract mismatches found.

## Scope

- Only `project/backend` was touched; no changes found under `backend/src/db/**` (schema/seed untouched, DB-2's
  domain) or `project/frontend`.
- All 7 plan.md BE-2 scope items are present and match the acceptance criteria (tests pass incl. new role-guard +
  pages-param tests; contracts documented exactly; lint/typecheck clean; no `node:*` imports).

## Hygiene

- No `TODO`/`FIXME`/`console.log` found in the changed modules (impact, users/service.ts, donations/service.ts,
  campaigns/service.ts, audit).
- No secrets or hardcoded env values introduced.

## Verdict

**pass** -- mechanical checks clean, all inspected contracts match code exactly, scope respected (backend-only,
no db/** or frontend touched), no hygiene issues.
