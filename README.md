# GiveTap

Contactless charitable giving prototype — a public **donor app / donation
terminal** (branded per-campaign flow with simulated tap-to-pay, Gift Aid,
round-up and a live supporters wall), a role-based **admin console**
(campaigns, live dashboard, ledger, exports, reconciliation, audit), and a
native **kiosk shell** (Capacitor + Tap to Pay), built for the CodeSprintMT 2026.

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
- **Auth/RBAC**: Better Auth `username` + `admin` plugins. Role ladder per
  the brief — `auditor` (read-only: dashboards, ledger, reconciliation,
  audit), `volunteer` (auditor + take donations at the terminal + ledger
  exports), `admin` / Charity Admin (everything: campaign CRUD,
  reconciliation actions, user/role management). Enforced both in the UI
  (buttons/routes hidden) and on the server (a `permissions` macro checks
  every mutating route — the UI hiding is cosmetic only). Donations recorded
  while a volunteer/admin is signed in land in the audit trail
  (`donation.recorded`).
- **Real-time**: an in-memory pub/sub + Server-Sent-Events endpoints —
  `GET /api/admin/events` (auth) pushes `donation.created` to the admin
  dashboard, and the public `GET /api/campaigns/:slug/events` streams
  wall-safe completed donations to the supporters wall on the campaign page
  and the terminal's bottom strip.
- **Donor options**: One-time/Monthly cadence, "round up to the nearest €10"
  (bumps the charged amount; flagged on the ledger/receipt), a Gift Aid-style
  declaration (+25% demo, no charge change), and a supporters-wall opt-in —
  opted-in names actually appear (live) on the campaign page and terminal.
- **Outcomes (M1.6)**: the terminal simulates Approved / Declined / Cancelled
  / Offline taps. Declined and offline attempts persist as ledger rows
  (`declined` / `offline` statuses, alongside `completed` and `refunded`);
  cancelled never reaches the server. Receipts can be sent by email or SMS
  (simulated delivery, validated + recorded) as well as downloaded as PDF.
- **Money**: always integer minor units + ISO-4217 currency codes end to
  end; static conversion rates (`EUR:1, USD:1.08, GBP:0.85`) bridge
  everything through EUR for aggregation. Formatting is `Intl.NumberFormat`,
  frontend-only.
- **Payments**: Mastercard Donate sandbox when the `MASTERCARD_*` env vars +
  key material (`backend/mastercard/`, gitignored) are present; otherwise a
  deterministic mock processor (card last-4 `0002` declines, anything else
  succeeds).
- **i18n & accessibility**: six locales with flag picker — EN / MT / FR / NL
  (the brief's set) plus IT / ES — with English fallback per key; text-size
  control, light/dark theme, and a high-contrast toggle.

## Deployment

| Piece    | Where                                                        | How                                                                                                                                 |
| -------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Frontend | Cloudflare Workers (static assets), `frontend/wrangler.toml` | Auto-deploys on push (Cloudflare git integration). Manual: `cd frontend && bun run deploy`.                                         |
| Backend  | Private VPS (`https://api.awgsh.ru`), systemd unit `backend` | `.github/workflows/deploy-backend.yml` — rsync to `/opt/backend`, prod-only `bun install`, restart (migrations run at app startup). |
| Kiosk    | Side-loaded Android build                                    | Manual: `cd kiosk && bun run sync && bun run android`.                                                                              |

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
The login page also has one-click buttons for each profile.

| Username    | Password   | Role      | Can do                                                      |
| ----------- | ---------- | --------- | ----------------------------------------------------------- |
| `auditor`   | `demo1234` | auditor   | Read-only: dashboard, ledger, reconciliation, audit log     |
| `volunteer` | `demo1234` | volunteer | + take donations at the terminal, export ledger (CSV/PDF)   |
| `admin`     | `demo1234` | admin     | + campaign CRUD, reconciliation actions, manage users/roles |

**Simulated payment decline**: on the donor "pay" step, enter card last-4
digit `0002` to trigger a deterministic `402 PAYMENT_DECLINED` (any other
last-4 succeeds when the mock processor is active). On the terminal's tap
screen, use the **Approved / Declined / Cancelled / Offline** simulation
buttons instead.

## Tests / checks

```bash
cd backend  && bun run format && bun run lint && bun run typecheck
cd frontend && bun run format && bun run lint && bun run typecheck && bun run build
```

## More docs

- `HANDOFF.md` — full project handoff: structure, deployment topology, env
  matrix, known issues, and where to pick up.
- `.task/` — the original practice-task brief.
