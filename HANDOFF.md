# GiveTap — Project Handoff

Last updated: 2026-07-04. Read this first when picking the project up in a
fresh session; the README covers local dev, this covers everything around it.

## What this is

GiveTap is a contactless charitable-giving prototype, originally built for the
CodeSprintMT 2026 practice task and since upgraded to the **real Open Category
brief** (`.task/CodeSprintMT-2026-Open-Category-Challenge.md`; the user's notes
from the reference video are in `.task/Tap for Good.txt`). Three deliverables
in one repo:

1. **Donor app / donation terminal** (public, no login): `/discover` campaign
   list, `/c/:slug` branded donation flow with a live supporters wall,
   `/kiosk/:slug` full-screen terminal (campaign header + progress / flow /
   live supporters strip) with Approved/Declined/Cancelled/Offline tap
   simulation.
2. **Admin console** (`/admin/*`, session + RBAC Auditor < Volunteer <
   Charity Admin): live dashboard (SSE, incl. progress-vs-goal), campaign CRUD
   (with start/end dates), donation ledger (status/method/amount filters,
   CSV/PDF export), reconciliation with persisted match state (auto-match all
   + per-row reconcile), audit log, user/role management.
3. **Kiosk shell**: Capacitor Android app wrapping the web kiosk route,
   with a Stripe Terminal Tap-to-Pay integration (`kiosk/src/tap-to-pay.ts`).

## Repo layout

```
backend/                Bun + Elysia REST API
  src/app.ts            Elysia app: error handler → CORS → openapi → auth → routes
  src/server.ts         entrypoint (systemd runs `bun src/server.ts`)
  src/env.ts            all env parsing; FRONTEND_URL + FRONTEND_ORIGINS → CORS/trusted origins
  src/auth.ts           Better Auth: username + admin plugins, RBAC roles, login audit hook;
                        SameSite=None cookies auto-enabled when NODE_ENV=production
  src/modules/          campaigns, donations, dashboard, reconciliation, audit, users, config, health
  src/plugins/          auth macro (permissions checks), SSE events, error handler
  src/db/               Drizzle schema + seed; migrations/ at backend root
  mastercard/           (gitignored) .p12 signing key + encryption certs for Mastercard sandbox
  data/                 (gitignored) local SQLite file
frontend/               SolidJS + Vite + Tailwind v4 SPA
  src/pages/            route components (donor + admin)
  src/shared/           api client, auth client, config/env, i18n, ui kit, icons, motion, prefs
  wrangler.toml         Cloudflare Worker config — static assets from ./dist
  .env                  dev API URL (LAN IP so phones can reach it)
  .env.production       prod API URL (https://api.awgsh.ru), baked in by `vite build`
kiosk/                  Capacitor shell (Android configured; www/ is the bundled web dir)
.github/workflows/deploy-backend.yml   backend CI deploy (see Deployment)
.task/                  original task brief
```

Conventions: response envelope `{ data }` / `{ error: { code, message,
details? } }` everywhere; money is integer minor units + ISO-4217 code, static
FX through EUR; server-side permission checks are authoritative (UI gating is
cosmetic); Bun-native APIs preferred over node:fs.

## Deployment topology

```
Browser ── https://codesprint2026.awgsh.workers.dev ──> Cloudflare Worker (static SPA assets)
        (also https://givetap.awgsh.ru — second custom domain on the same Worker)
   │
   └── fetch(credentials: include) ──> https://api.awgsh.ru ──> VPS
                                        (TLS terminated before the app;
                                         Bun/Elysia listens on :3001)
                                        systemd unit: `backend`
                                        app dir: /opt/backend
                                        DB: SQLite file under /opt/backend/data/
```

- **Frontend**: Cloudflare Worker with static assets (`frontend/wrangler.toml`).
  Redeploys automatically on push via the Cloudflare git integration
  (manual fallback: `cd frontend && bun run deploy`). `VITE_API_BASE_URL` is a
  **build-time** value — changing it means rebuilding, not reconfiguring.
- **Backend**: `.github/workflows/deploy-backend.yml` runs on push to `main`
  touching `backend/**`. It rsyncs `backend/` → `root@VPS:/opt/backend/`
  (excluding `node_modules`, `.env`, `data/`, `mastercard/`), then
  `bun install --production --frozen-lockfile` and `systemctl restart backend`.
  Migrations apply automatically at app startup (`src/server.ts` runs the
  drizzle-orm migrator), so no dev deps are needed on the VPS. GitHub
  secrets: `VPS_SSH_KEY`, `VPS_HOST`, `VPS_PORT`.
- **Kiosk**: not deployed anywhere; built/side-loaded manually with Capacitor
  (`cd kiosk && bun run sync && bun run android`).

### Environment matrix

| Variable | Local dev | VPS production |
| --- | --- | --- |
| `NODE_ENV` | unset (development) | `production` (**required** — enables SameSite=None; Secure cookies) |
| `PORT` | 3001 | 3001 |
| `DATABASE_URL` | `file:./data/local.db` | `file:./data/local.db` (under /opt/backend; excluded from deploy rsync) |
| `BETTER_AUTH_SECRET` | any | strong secret |
| `BETTER_AUTH_URL` | `http://localhost:3001` | `https://api.awgsh.ru` |
| `FRONTEND_URL` | `http://localhost:3000` | `https://codesprint2026.awgsh.workers.dev` |
| `FRONTEND_ORIGINS` | extra LAN origins, comma-separated | `https://givetap.awgsh.ru` (second custom domain on the same Worker; add any further origins comma-separated) |
| `MASTERCARD_*` | optional (mock processor when unset) | optional; key files must be placed in `/opt/backend/mastercard/` by hand |

Frontend: `VITE_API_BASE_URL` — `frontend/.env` for dev (LAN IP),
`frontend/.env.production` for prod builds (`https://api.awgsh.ru`).

## Open-category upgrade (2026-07-04)

The codebase was reworked from the practice brief to the real Open Category
brief. Summary of what changed (all verified by an end-to-end smoke test
against a scratch DB — donor outcomes, wall, receipt send, RBAC ladder,
reconciliation actions, schedule validation):

- **RBAC**: roles renamed/remapped `viewer/manager/admin` →
  `auditor/volunteer/admin` (Auditor < Volunteer < Charity Admin). Campaign
  CRUD and reconciliation actions are admin-only now; volunteer = auditor +
  terminal donations (`donation.record` gates the console's "Take donations"
  nav item) + exports. Demo usernames are now `auditor`/`volunteer`/`admin`.
- **Donation model**: statuses `completed|declined|refunded|offline`
  (declined/offline attempts persist as ledger rows; no settlement rows for
  them), frequency reduced to `one_time|monthly`, new flags `roundedUp`
  (round up to the nearest €10 — changes the charged amount), `giftAid`
  (+25% demo declaration), `showOnWall`, `method` (`card|tap`), plus
  simulated-receipt columns (`receiptChannel/receiptTo/receiptSentAt`).
- **New public endpoints**: `POST …/donations/:reference/receipt` (simulated
  email/SMS receipt, validated), `GET /api/campaigns/:slug/supporters` and the
  SSE stream `GET /api/campaigns/:slug/events` (live supporters wall).
- **Reconciliation**: new `reconciliation_matches` table persists confirmed
  pairs; `GET /admin/reconciliation` is now a read (auditor+),
  `POST …/automatch` and `POST …/match` are admin-only and audited
  (`reconciliation.automatch` / `reconciliation.match`). Seed leaves 6 exact
  pairs + 9 discrepancies awaiting so both demo actions do something.
- **Audit**: new actions `donation.recorded` (only when a signed-in
  volunteer/admin takes the donation — public donors aren't admin actions),
  `reconciliation.match`, `reconciliation.automatch`.
- **Migration `0003`** carries both the schema changes and the data
  migration (role renames incl. the demo users' usernames/emails, status +
  frequency backfills, kiosk rows → method `tap`, campaigns' frequencies JSON
  cleanup). It applies automatically on VPS restart; the seeded prod DB's
  demo logins change from `viewer`/`manager` to `auditor`/`volunteer`.
- **Frontend**: home page → two half/half cards (terminal vs console); login
  page → one-click demo-profile buttons; give flow → One-time/Monthly +
  round-up/Gift Aid/wall checkboxes; tap screen → 4 simulation buttons +
  "Contacting Mastercard sandbox…" beat (real NFC still auto-approves);
  thanks page → full receipt fields (charity, campaign, date, reference,
  sandbox txn, method, amount) + email/SMS send; ledger → new status set,
  min/max € filters (EUR-normalised server-side), method column, flags;
  reconciliation page → 3 stat cards + awaiting/matched tables; dashboard →
  progress-vs-goal stat + per-campaign progress bars; locales now
  EN/MT/FR/NL/IT/ES with flags (FR/NL new, full translations).
- `backend/.env` on **this dev machine** has an empty `BETTER_AUTH_SECRET` —
  set one before running the backend locally.

## Current state / known issues (as of 2026-07-03)

- `https://api.awgsh.ru/` responds ok, but `GET /api/campaigns` returns 500
  `INTERNAL` — almost certainly the VPS database is missing/empty, because
  earlier deploys ran `rsync --delete` **without** excluding `data/` and
  `mastercard/`, wiping both on every push. The workflow now excludes them,
  but the VPS needs a one-time repair (see checklist below).
- Cross-site auth (Worker ↔ api.awgsh.ru) requires `NODE_ENV=production` in
  the VPS `.env` — without it session cookies default to SameSite=Lax and the
  admin login will not stick from the Cloudflare origin.
- Mastercard sandbox: local `backend/.env` has working sandbox credentials;
  the VPS needs the `MASTERCARD_*` vars and the key files re-uploaded (they
  were likely deleted by the old rsync). Mind the `\$` escaping note in
  `.env.example` — Bun expands `$VAR` even inside quotes.
- Kiosk app is untouched by any deploy pipeline; Stripe Terminal integration
  status is per `kiosk/README.md`.
- Assumptions A1–A10 from the build (see `.claude-artifacts/final-report.md`
  if present) were never explicitly confirmed by the user.

### One-time VPS repair checklist (manual, over SSH)

```bash
ssh -p <port> root@<vps>
cd /opt/backend
# 1. Fix .env (see matrix above): NODE_ENV, BETTER_AUTH_URL, FRONTEND_URL
# 2. Restart (migrations apply on startup), then seed:
systemctl restart backend
/root/.bun/bin/bun run db:seed
# 3. (Optional) personal admin account — password must be 8+ chars:
/root/.bun/bin/bun run user:create awgsh <password>
# 4. (Optional) re-upload mastercard/ key files + MASTERCARD_* env vars, restart again
curl -s https://api.awgsh.ru/api/campaigns | head -c 200   # expect { "data": ... }
```

Then verify from the deployed frontend: open the Worker URL, `/discover`
should list campaigns, `/admin/login` with `admin`/`demo1234` should hold a
session across reloads.

## How to verify a full deployment

1. Push to `main` (backend changes trigger the Action; any push triggers the
   Cloudflare frontend build).
2. `curl https://api.awgsh.ru/` → `{"data":{"name":"api","status":"ok"}}`.
3. Worker URL → network tab: API calls go to `https://api.awgsh.ru`, not
   localhost. If they still hit localhost, the deployed bundle predates
   `.env.production` — trigger a frontend rebuild.
4. Admin login persists; dashboard receives live SSE events when a donation
   is made through `/c/:slug`.

## Where to pick up

- Fix the VPS state per the checklist above (blocked on SSH access — only
  the repo owner has the key).
- Decide whether the kiosk should point at the deployed frontend
  (`kiosk/capacitor.config.ts` `server.url`) or keep the bundled `www/`.
- Mastercard sandbox on production: upload key material or accept the mock
  processor for the demo.
