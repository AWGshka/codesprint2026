# plan.md — GiveTap execution plan

Derived from `findings.md`. Waves are sequential; tasks within a wave run in parallel.
Every task ends with the agent writing `.claude-artifacts/<agent>.md` per the template in
`[agent].md`, followed by a reviewer gate (`review-<agent>.md`).

## Dependency graph

```
DB-1 ──> BE-1 ──┐
     └──────────┼──> FE-2 ──> FR-1
FE-1 ───────────┘
```

Waves: **W1** = DB-1 ∥ FE-1 · **W2** = BE-1 · **W3** = FE-2 · **W4** = FR-1 (final report).
(FE-1 is pure design-system work with no API dependency, so it runs alongside DB-1.)

---

## DB-1 — schema, auth roles, seed  · agent: `database-engineer` · depends_on: —

Scope (backend repo `project/backend`):
1. Add Better Auth **admin plugin** to `src/auth.ts` with access-control statements + roles per
   spec §5.2 (viewer/manager/admin; resources campaign/donation/reconciliation/audit/user) —
   keep the file free of Elysia imports. Regenerate `src/db/auth-schema.ts` via the CLI.
2. Domain tables in new files under `src/db/`, re-exported from `schema.ts` (skill conventions:
   snake_case, plural, text UUID PKs, timestamp-seconds, minor-unit money, JSON columns for
   `presets_minor`/`frequencies`/`metadata`): `campaigns`, `donations`,
   `processor_settlements`, `audit_logs`. **No organization table / org columns** (assumption A2).
   Fields, enums and indexes per spec §4.2. Export inferred types.
3. Generate migrations (`db:generate`), verify they apply from scratch (`db:migrate` on a fresh
   file DB).
4. Idempotent `src/db/seed.ts` per findings "Seed requirements": 3 demo users with roles
   (username login: `viewer`/`manager`/`admin`, password `demo1234`, emails `<name>@demo.gt`),
   10–12 campaigns (EUR/USD/GBP, varied status/branding — use kit brand colours `#0E8C7A`,
   `#1E6FB8`, `#B23A6B` among others), 200–300 donations over ~90 days, settlements with
   **documented discrepancy counts** in a comment.

Acceptance: migrations apply from scratch; `bun run db:seed` twice → no duplicates; user table
has `role`; artifact lists every table/column/type/relation + demo credentials + discrepancy counts.

## FE-1 — design system & app shell  · agent: `frontend-engineer` · depends_on: —

Scope (`project/frontend`; visual source of truth = `.task/GiveTap Kit.dc.html` — read it):
1. `src/index.css` (or an imported `tokens.css`): all kit tokens as CSS variables, **light +
   high-contrast** themes via `[data-theme]`, text scaling via `[data-textsize="100|112|125"]`
   on `<html>` (rem-based), Tailwind v4 `@theme` mapping so utilities use the tokens. Load
   Geist / Geist Mono / Hanken Grotesk (Google Fonts as in the kit). `--brand`/`--brand-fg`
   defaulting to GiveTap teal, overridable on the donor root.
2. Preference controls + persistence (`localStorage`): theme, text size, locale — a compact
   control cluster component (kit control bar shows the pattern).
3. i18n: `@solid-primitives/i18n` (install), `en` full + `mt` partial dictionaries (nav, donor
   flow, dashboard labels), locale signal + persistence. All new UI strings via the dictionary.
4. UI kit components in `shared/ui/` following existing conventions (named exports, barrel):
   restyle Button to tokens; add Card, StatCard (+ live pulse dot), Input/Field (label, hint,
   error with icon), Select, Toggle/Checkbox, Badge (status = icon + label + colour), Tabs,
   ProgressBar, Toast, Banner, EmptyState, Skeleton, Modal/ConfirmDialog, Stepper. Money
   display helper using `Intl.NumberFormat` + tabular-nums (`shared/lib/money.ts`, static rates
   per spec §7.3).
5. A demo/dev route or storybook-ish page is NOT required — components are proven in FE-2.

Acceptance: `bun run typecheck && bun run build` pass; theme/text-size toggles work and persist;
tokens match the kit hexes; artifact lists exported components + their props (public interface).

## BE-1 — full GiveTap API  · agent: `backend-engineer` · depends_on: DB-1

Scope (`project/backend`; consume `.claude-artifacts/database-engineer.md` for shapes):
1. `permissions` macro in `src/plugins/auth.ts` (spec §5.3, via `auth.api.hasPermission`);
   `PaymentDeclined` 402 factory in `src/lib/errors.ts`.
2. `src/lib/`: `currency.ts` (supported list, static rates, `toEURMinor`), `reference.ts`
   (`<CAMP>-<base36×4>` + uuid paymentRef), `csv.ts` (escape + stream helper — Bun built-ins only).
3. `src/plugins/events.ts`: in-memory pub/sub; SSE endpoint `GET /admin/events`
   (`text/event-stream`, `donation.created` events, ~20s heartbeat, cleanup on close) gated by
   `donation:read`.
4. Modules per the skill pattern (model/service/index), routes + behaviour per spec §6–§7 minus
   org scoping, all inside the `{ data }`/`{ error }` envelope, OpenAPI `detail` on every route:
   - `campaigns`: public GET list (active) + GET `:slug` (with progress); admin CRUD with
     validation + audit writes.
   - `donations`: public POST (simulated payment: validation → `0002` decline → persist +
     settlement + emit) + GET receipt by reference; admin ledger (filters campaignId/currency/
     status/source/dateFrom/dateTo/q, sort, paginate `{ rows, total, page, pageSize }` inside
     `data`); `GET export.csv` (filtered, capped, `Content-Disposition`, audited).
   - `dashboard`: totals per currency + EUR-equivalent, counts, top campaigns, recent
     donations, 90-day trend series.
   - `reconciliation`: diff per spec §7.2 against `processor_settlements` (expose the
     mock-processor feed route too); audited.
   - `audit`: list with filters + `POST client-event` (restricted enum, e.g. `ledger.export.pdf`).
   - `users`: list + `PATCH :id/role` via Better Auth admin API (admin only); audited.
   - `config`: `GET /config/currencies`.
5. Audit writes live in services (enum per findings); record `auth.login` via a Better Auth hook.
6. Tests (`bun test`) for the pure logic: currency conversion, reference format, reconciliation
   classification, CSV escaping.

Acceptance: typecheck/lint/format/tests pass; `grep -rn "node:" src` empty; a scripted curl
pass works (login as each role → viewer gets 403 on POST /admin/campaigns; donation with last4
0002 → 402; export.csv streams; SSE emits on a new donation). Artifact lists every route with
method/path/permission/response shape.

## FE-2 — donor app + admin console  · agent: `frontend-engineer` · depends_on: BE-1, FE-1

Scope (`project/frontend`; consume `backend-engineer.md` + `frontend-engineer.md` (FE-1) artifacts):
1. API layer: fix `client.ts` error parsing to the nested `{ error: { … } }` envelope; DTO
   types in `shared/api/types.ts` mirroring BE-1's artifact.
2. Auth/roles: extend `useAuth` with the user's `role`; `RequireAuth` gains role/permission
   gating; admin login page (username + password) at `/admin/login`; capability-hide UI per role.
3. Install `chart.js`, `@tanstack/solid-table`, `jspdf`, `jspdf-autotable`.
4. Donor surface (brand injection: set `--brand`/`--brand-fg` from campaign on the donor root):
   `/c/:slug` landing (branding, progress, currency/language/text-size/contrast controls),
   `/c/:slug/give` stepper (amount+frequency → mock card → review → submit; validation, 402
   decline path, network-error recovery, back nav), `/c/:slug/thanks/:reference` receipt
   (details, PDF download, share, make-it-monthly — S1.1), `/kiosk/:slug` (big targets,
   `source:'kiosk'`, auto-reset ~6s), `/discover` (grid + real search/filter — S1.3).
5. Admin surface under `/admin` (role-gated layout): live dashboard (stat cards, line trend,
   bar by-campaign, donut currency split, recent feed + SSE `EventSource` with reconnect —
   C3.1), campaigns list/form/detail (validation, brand colour, presets, frequencies, public
   link), ledger (TanStack table: filters/sort/pagination, CSV via server link, PDF via jsPDF +
   client-event audit), reconciliation (summary + matched/mismatch/missing tabs, drill-in),
   audit log, users & roles (admin only). Include one **static** extra-feature mockup (S1.2 —
   e.g. donor impact panel).
6. Responsive to mobile throughout; a11y floor per kit (44px targets on donor app, focus
   visible, reduced motion, status = icon + label).

Acceptance: typecheck (both tsconfigs)/lint/format/build pass; full donor happy-path + decline
path work against the running backend; role differences visible (viewer read-only); dashboard
updates live on a new donation; both exports produce files; artifact lists routes + endpoints
consumed.

## FR-1 — final validation & report  · agent: `final-report` · depends_on: all

Cross-domain checks: fresh clone-style run (`bun install`, migrate, seed, both dev servers),
rubric walk (every M/S/C item → where it lives), RBAC probe, reconciliation counts vs seed
comment, envelope consistency. Write `final-report.md` including run instructions + demo
credentials + a suggested demo-video script order.

---

## Failure policy
Per CLAUDE.md: shallow error → re-run same agent with the error; wrong approach → re-plan here;
max 3 attempts per subtask before escalating to the user.
