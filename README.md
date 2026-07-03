# GiveTap

Contactless charitable giving prototype — a public **donor app** (branded
per-campaign donation flow), a role-based **admin console** (campaigns,
live dashboard, ledger, exports, reconciliation, audit), and a native
**kiosk shell** (Capacitor + Tap to Pay), built for the GiveTap practice
task (see `.task/CodeSprintMT-2026-Practice-Task-GiveTap.md`).

## Architecture

```
backend/    Bun + Elysia API, Drizzle ORM over libSQL (local file / Turso),
            Better Auth (username+password, RBAC via the admin plugin).
frontend/   SolidJS + Vite + Tailwind v4 SPA, served as a Cloudflare Worker
            with static assets. Donor routes (/c/:slug, /kiosk/:slug,
            /discover) are public; admin routes (/admin/*) are session +
            role-gated. Talks to the backend only over the REST API
            (VITE_API_BASE_URL), no server-side rendering.
kiosk/      Capacitor (Android/iOS) shell that wraps the web kiosk route and
            hosts the Stripe Terminal Tap-to-Pay integration (src/tap-to-pay.ts).
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
- **Payments**: Mastercard Donate sandbox when the `MASTERCARD_*` env vars +
  key material (`backend/mastercard/`, gitignored) are present; otherwise a
  deterministic mock processor (card last-4 `0002` declines, anything else
  succeeds).

## Deployment

| Piece    | Where                                              | How                                                                                                          |
| -------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Frontend | Cloudflare Workers (static assets), `frontend/wrangler.toml` | Auto-deploys on push (Cloudflare git integration). Manual: `cd frontend && bun run deploy`.                    |
| Backend  | Private VPS (`https://api.awgsh.ru`), systemd unit `backend` | `.github/workflows/deploy-backend.yml` — rsync to `/opt/backend`, `bun install`, `db:migrate`, restart.       |
| Kiosk    | Side-loaded Android build                          | Manual: `cd kiosk && bun run sync && bun run android`.                                                         |

Production wiring:

- `frontend/.env.production` bakes `VITE_API_BASE_URL=https://api.awgsh.ru`
  into the production bundle at build time (dev keeps using `frontend/.env`).
- The VPS `.env` at `/opt/backend/.env` (never touched by the deploy) must set
  `NODE_ENV=production`, `BETTER_AUTH_URL=https://api.awgsh.ru`, and
  `FRONTEND_URL=<the Worker's public URL>` — `FRONTEND_URL`/`FRONTEND_ORIGINS`
  drive both CORS and Better Auth trusted origins.
- Cross-site cookies (Worker origin ↔ api.awgsh.ru) are enabled automatically
  when `NODE_ENV=production` (`SameSite=None; Secure` in `backend/src/auth.ts`).
- The deploy rsync excludes `data/` (SQLite) and `mastercard/` (key material):
  both live only on the VPS and would otherwise be deleted by `--delete`.

## Run it locally (two terminals)

Requires [Bun](https://bun.sh) (no Node/npm needed).

```bash
# Terminal 1 — backend, http://localhost:3001
cd backend
bun install
cp .env.example .env         # then set BETTER_AUTH_SECRET, e.g. `openssl rand -base64 32`
bun run db:migrate           # applies all migrations to a fresh local SQLite file
bun run db:seed              # idempotent — 3 users, 12 campaigns, 260 donations, settlements
bun run dev                  # watch mode

# Terminal 2 — frontend, http://localhost:3000
cd frontend
bun install
bun run dev
```

Open `http://localhost:3000`. The donor app needs no login
(`/discover`, `/c/:slug`, `/kiosk/:slug`); the admin console is at
`/admin/login`.

To test from phones/kiosks on the LAN, set `VITE_API_BASE_URL` in
`frontend/.env` to the PC's LAN IP and add that origin to the backend's
`FRONTEND_ORIGINS`.

To start over from a clean database: stop the backend, delete
`backend/data/local.db*`, then re-run `db:migrate` + `db:seed`.

## Demo credentials

Username + password login (email is only an account key, not used to log in).

| Username  | Password   | Role    | Can do                                                     |
| --------- | ---------- | ------- | ---------------------------------------------------------- |
| `viewer`  | `demo1234` | viewer  | Read-only: dashboard, ledger, reconciliation, audit log    |
| `manager` | `demo1234` | manager | + create/edit campaigns, export ledger, run reconciliation |
| `admin`   | `demo1234` | admin   | + delete campaigns, manage users/roles                     |

**Simulated payment decline**: on the donor "pay" step, enter card last-4
digit `0002` to trigger a deterministic `402 PAYMENT_DECLINED` (any other
last-4 succeeds when the mock processor is active).

## Tests / checks

```bash
cd backend  && bun run format && bun run lint && bun run typecheck && bun test
cd frontend && bun run format && bun run lint && bun run typecheck && bun run build
```

## More docs

- `HANDOFF.md` — full project handoff: structure, deployment topology, env
  matrix, known issues, and where to pick up.
- `.task/` — the original practice-task brief.
