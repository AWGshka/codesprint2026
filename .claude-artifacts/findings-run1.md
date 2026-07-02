# findings.md — GiveTap build context

Produced by the orchestrator (Phase 1). Sources: `.task/CodeSprintMT-2026-Practice-Task-GiveTap.md`
(rubric), `.task/CodeSprintMT-2026-GiveTap-BUILD-SPEC.md` (behaviour/data spec),
`.task/GiveTap Kit.dc.html` (UI kit), plus a read-only exploration of the scaffolds.

> **Precedence rule for this build:** `.claude/` conventions (CLAUDE.md + skills + existing
> scaffolds) **override** the `.task` documents wherever they conflict. The spec governs
> *data model, API behaviour, and rubric coverage only*. The UI kit governs *visual design*.

## What we're building

**GiveTap** — contactless charitable giving prototype. Two surfaces joined by the `campaign`
object: a public **donor flow** (branded per campaign, simulated payment) and a role-based
**admin console** (campaign CRUD, live dashboard, ledger, exports, reconciliation, audit).
Target: the full 345-pt rubric including Should/Could-haves (kiosk, /discover, partial
Maltese i18n, SSE real-time dashboard).

## Decisions & assumptions (user AFK — recommended defaults applied; override any of these)

| # | Decision | Rationale |
|---|----------|-----------|
| A1 | **Full rubric scope** — all M1/M2 + S1.1–S1.3 + C1.1 (responsive/kiosk PWA-ish) + C2.1 (partial `mt`) + C3.1 (SSE) | Practice goal is the whole grid |
| A2 | **Single organization** — no `organization` table, no `organizationId` anywhere | Nothing in the rubric requires multi-tenancy; large complexity cut |
| A3 | **`.claude` layout wins** — build into `project/backend` + `project/frontend`; no monorepo/`packages/shared` | Scaffolds already exist and are wired |
| A4 | **Username + password login** (Better Auth `username` plugin, already configured) — demo users `viewer` / `manager` / `admin`, password `demo1234`; email kept as account key (`<name>@demo.gt`) | CLAUDE.md mandates it; spec's email login is overridden |
| A5 | **Typed fetch client** (`shared/api/client.ts`) — no Eden treaty | Existing convention; spec's Eden pick overridden |
| A6 | **Scaffold env/ports win**: backend `:3001` (`FRONTEND_URL`, `VITE_API_BASE_URL`), frontend `:3000` | Spec's `WEB_ORIGIN`/`:3000` naming overridden |
| A7 | **New frontend deps**: `chart.js` (thin canvas wrapper, no Recharts), `@tanstack/solid-table`, `jspdf` + `jspdf-autotable`, `@solid-primitives/i18n` | Spec picks; skills are silent → no conflict |
| A8 | **No valibot** — client-side validation is small hand-rolled helpers; Elysia `t` on the server is the source of truth | Keeps deps minimal; forms are few and simple |
| A9 | **RBAC via Better Auth admin plugin** with access-control statements per spec §5.2 (viewer/manager/admin), minus org scoping | Spec's model is good; requires auth-schema regeneration |
| A10 | **CSV export hand-rolled** on the server (no dep); **PDF client-side** via jsPDF | Per spec §7.5 |

## Detected stack & conventions (binding)

### Backend — `project/backend` (Bun + Elysia 1.4 + Drizzle 0.45 + Better Auth 1.6)
- **Envelope**: success `{ data }` via `ok()`/`data()` (`src/lib/response.ts`); failure
  `{ error: { code, message, details? } }` rendered by the global error handler from thrown
  `AppError` (`src/lib/errors.ts` — factories BadRequest/Unauthorized/Forbidden/NotFound/Conflict;
  **no 402 factory yet**). Never hand-build error bodies. Exceptions: `/health/*`, `/api/auth/*`.
- **Module pattern**: `src/modules/<name>/` = `index.ts` (Elysia controller) + `service.ts`
  (`static abstract class`, sole Drizzle touchpoint, throws AppErrors) + `model.ts` (Elysia `t`
  schemas; types via `typeof schema.static`). Health module is a probe, not the pattern reference.
- **Auth**: `src/auth.ts` (keep free of Elysia imports), `username()` plugin configured.
  `src/plugins/auth.ts` exposes an `auth` macro (session gate → `user`/`session`). **No
  `permissions` macro yet.** Auth tables generated:
  `bunx @better-auth/cli generate --config ./src/auth.ts --output ./src/db/auth-schema.ts`.
- **Bun built-ins only — never `node:*`, no `Buffer`** (reviewer greps for it).
- Composition order in `app.ts`: errorHandler → cors (credentials + explicit origin) → openapi →
  authPlugin → routes/modules. `export type App = typeof app`.
- SSE: `src/examples/stream.ts` shows async-generator streaming — adapt to real
  `text/event-stream` framing (event/data lines, ~20s heartbeat, cleanup on close) + an
  in-memory pub/sub plugin.
- OpenAPI: annotate routes with `detail: { summary, tags }`.

### Database — Drizzle over libSQL (`dialect: "turso"`, local `file:` in dev)
- Hand-authored tables: **snake_case columns, plural names**, PK `text` via
  `.$defaultFn(() => crypto.randomUUID())`, timestamps `integer({ mode: "timestamp" })`
  (epoch **seconds**), booleans `integer({ mode: "boolean" })`, JSON via
  `text({ mode: "json" }).$type<…>()`. New tables in new files under `src/db/`, re-exported
  from `schema.ts`. Never hand-edit `auth-schema.ts` (it legitimately uses `timestamp_ms`).
- Migrations committed, must apply from scratch. Seed idempotent (`db.$count` guard).
- **All money = integer minor units** (`amount_minor`); currency ISO-4217 text. Never floats.

### Frontend — `project/frontend` (SolidJS 1.9 + Vite 8 + Tailwind v4 + @solidjs/router 0.16)
- Structure: `app/` (shell, layouts, routes), `pages/` (lazy default exports),
  `shared/{api,auth,config,icons,lib,motion,ui}` (named exports via `~`). TS strict +
  `noUncheckedIndexedAccess`.
- Solid rules: no props destructuring, `<For>/<Show>/<Switch>`, `createResource` with loading +
  error rendered, signals as calls.
- Auth: `better-auth/solid` client with `usernameClient()`; `AuthProvider` store + `useAuth()`;
  `RequireAuth` is currently binary — needs role gating. `signUp` synthesizes an email.
- API: `shared/api/client.ts` typed fetch (`credentials: "include"`, throws `ApiError`). NOTE:
  it reads a top-level `message` on errors but the backend envelope nests it at
  `error.message` — fix while wiring. `shared/api/types.ts` needs the `{ data }` envelope
  generic + DTO mirrors.
- Theming: `src/index.css` is bare `@import "tailwindcss"` — the kit's tokens must become CSS
  variables (light + high-contrast themes) consumed by Tailwind; `data-theme` / `data-textsize`
  on `<html>`, everything rem-based; `--brand`/`--brand-fg` injected per campaign on the donor
  root only.
- Existing UI primitives: Button / Spinner / ErrorState only. Motion presets via solid-motionone.

### UI kit — `.task/GiveTap Kit.dc.html` (visual source of truth; read it before building UI)
- Tokens (light): `--surface #FBFBFC · --surface-raised #FFFFFF · --surface-sunken #F4F4F6 ·
  --border #E6E6E9 · --border-strong #CFCFD4 · --fg #1A1A1C · --fg-muted #6B6B72 ·
  --brand #0E8C7A · --brand-fg #FFFFFF · --accent #0B6857 · --positive #188A5E ·
  --warning #B4780F · --danger #C43D3D · --live #0E8C7A · --focus #0E8C7A`.
  High-contrast set on the kit's HC section (~line 715): black fg/borders, `#0A5E52` brand,
  `#0A34C8` focus, AAA text, white surfaces.
- Fonts: display **Geist 600**, body **Hanken Grotesk**, mono **Geist Mono** (money/refs use
  `font-variant-numeric: tabular-nums`). Type scale + spacing (4-based) + radii (6/9/12/full) +
  elevations e1–e3 defined at the kit root (line 25).
- Component vocabulary (all demonstrated in the kit): buttons (5 variants + loading/disabled),
  inputs + validation states, badges/chips/tabs, toast/banner/tooltip, empty state, skeleton
  shimmer, stat cards + live pulse dot, line/bar/donut chart styling, data table + export bar,
  reconciliation badges (Matched/Pending/Mismatch — icon + label, never colour alone),
  currency/i18n/a11y controls, auth & role screens, full mobile donor flow, admin console
  layout, high-contrast proof, brand re-skin proof (Blue Cross `#1E6FB8`, Hope `#B23A6B`).
- Status colours always pair with icon + label. Reduced motion respected.

## Domain model (from spec §4, minus org; adapt naming to DB skill)

Tables to create: `campaigns`, `donations`, `processor_settlements`, `audit_logs`
(snake_case/plural per skill; fields per spec §4.2 minus `organizationId`). Auth `user` table
gains `role` via the admin plugin (regenerate). Key behaviours: simulated payment with
deterministic decline on `card.last4 === '0002'` → 402; reference format `<CAMP>-<base36×4>`;
reconciliation full-join on `payment_ref` → matched / mismatched / missingInProcessor /
missingInApp; static rates `{ EUR: 1, USD: 1.08, GBP: 0.85 }`, EUR-equivalent aggregation,
`Intl.NumberFormat` formatting frontend-only; audit enum
`campaign.create|campaign.update|campaign.delete|user.role_change|reconciliation.run|ledger.export.csv|ledger.export.pdf|auth.login`;
SSE events `donation.created` (+ heartbeat).

## Seed requirements (spec §9, single org)

Demo users viewer/manager/admin (`demo1234`); 10–12 campaigns across EUR/USD/GBP (EUR primary),
varied status/branding/presets/frequencies; 200–300 donations over ~90 days (mixed currency,
frequency, status, web/kiosk source); settlements mirroring donations **except** documented
discrepancies (≥2 missingInProcessor, ≥2 missingInApp, ≥2 amount mismatches — count them in a
seed comment so the demo is scriptable).

## Gaps (what must be built — everything domain-level)

Backend: permissions macro, 402 factory, currency/money/reference/csv libs, modules
(campaigns public+admin, donations+ledger+export, dashboard, reconciliation, mock-processor
feed, audit +client-event, users/role), events pub/sub + SSE endpoint, audit writes in
services. Database: all domain tables, admin-plugin regen, migrations, full seed. Frontend:
tokens/theming/a11y/text-size, i18n (en + partial mt), UI kit components, donor routes
(`/c/:slug`, `/give`, `/thanks/:reference`, `/kiosk/:slug`, `/discover`), admin routes
(`/admin`, campaigns CRUD, ledger, reconciliation, audit, users), charts, tables, CSV/PDF
export UX, SSE consumer, role-gated UI, envelope-aware client fix.

## Skill needs

None — installed skills cover all domains. No `find-skill` run required.
