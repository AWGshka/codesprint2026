[OUTDATED] TO BE UPDATED

# GiveTap -

Contactless charitable giving prototype — a public **donor app** (branded
per-campaign donation flow) and a role-based **admin console** (campaigns,
live dashboard, ledger, exports, reconciliation, audit), built for the
GiveTap practice task (see `.task/CodeSprintMT-2026-Practice-Task-GiveTap.md`).

## Architecture

```
project/
  backend/   Bun + Elysia API, Drizzle ORM over libSQL (local file / Turso),
             Better Auth (username+password, RBAC via the admin plugin).
  frontend/  SolidJS + Vite + Tailwind v4 SPA. Donor routes (/c/:slug, /kiosk/:slug,
             /discover) are public; admin routes (/admin/*) are session +
             role-gated. Talks to the backend only over the REST API
             (VITE_API_BASE_URL), no server-side rendering.
```

- **Separation of concerns**: the frontend never touches the database — every
  read/write goes through the backend's `/api/*` REST surface, wrapped in a
  single response envelope (`{ data }` on success, `{ error: { code,
message, details? } }` on failure).
- **Auth/RBAC**: Better Auth `username` + `admin` plugins. Three roles —
  `viewer` (read-only), `manager` (campaigns + exports + reconciliation),
  `admin` (everything + user/role management). Enforced both in the UI
  (buttons/routes hidden) and on the server (a `permissions` macro checks
  every mutating route — the UI hiding is cosmetic only).
- **Real-time**: an in-memory pub/sub + Server-Sent-Events endpoint
  (`GET /api/admin/events`) pushes `donation.created` to the admin dashboard,
  which merges live events into its charts/feed without a manual refresh.
- **Money**: always integer minor units + ISO-4217 currency codes end to
  end; static conversion rates (`EUR:1, USD:1.08, GBP:0.85`) bridge
  everything through EUR for aggregation. Formatting is `Intl.NumberFormat`,
  frontend-only.

## Run it (two terminals)

Requires [Bun](https://bun.sh) (no Node/npm needed).

```bash
# Terminal 1 — backend, http://localhost:3001
cd project/backend
bun install
cp .env.example .env         # then set BETTER_AUTH_SECRET, e.g. `openssl rand -base64 32`
bun run db:migrate           # applies all migrations to a fresh local SQLite file
bun run db:seed              # idempotent — 3 users, 12 campaigns, 260 donations, settlements
bun run dev                  # watch mode

# Terminal 2 — frontend, http://localhost:3000
cd project/frontend
bun install
bun run dev
```

Open `http://localhost:3000`. The donor app needs no login
(`/discover`, `/c/:slug`, `/kiosk/:slug`); the admin console is at
`/admin/login`.

To start over from a clean database: stop the backend, delete
`project/backend/data/local.db*`, then re-run `db:migrate` + `db:seed`.

## Demo credentials

Username + password login (email is only an account key, not used to log in).

| Username  | Password   | Role    | Can do                                                     |
| --------- | ---------- | ------- | ---------------------------------------------------------- |
| `viewer`  | `demo1234` | viewer  | Read-only: dashboard, ledger, reconciliation, audit log    |
| `manager` | `demo1234` | manager | + create/edit campaigns, export ledger, run reconciliation |
| `admin`   | `demo1234` | admin   | + delete campaigns, manage users/roles                     |

**Simulated payment decline**: on the donor "pay" step, enter card last-4
digit `0002` to trigger a deterministic `402 PAYMENT_DECLINED` (any other
last-4 succeeds — no real card validation, this is a mock processor).

## What's built (rubric coverage)

Full Must/Should/Could scope was attempted — see
`.claude-artifacts/final-report.md` for the detailed, criterion-by-criterion
rubric walk, known gaps, and a suggested demo-video script order.

## Tests / checks

```bash
cd project/backend  && bun run format && bun run lint && bun run typecheck && bun test
cd project/frontend && bun run format && bun run lint && bun run typecheck && bun run build
```
