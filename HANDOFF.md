# GiveTap — Project Handoff

Last updated: 2026-07-03. Read this first when picking the project up in a
fresh session; the README covers local dev, this covers everything around it.

## What this is

GiveTap is a contactless charitable-giving prototype for the CodeSprintMT 2026
practice task (brief in `.task/`). Three deliverables in one repo:

1. **Donor app** (public, no login): `/discover` campaign list, `/c/:slug`
   branded donation flow, `/kiosk/:slug` full-screen kiosk mode.
2. **Admin console** (`/admin/*`, session + RBAC): live dashboard (SSE),
   campaign CRUD, donation ledger with CSV/PDF export, reconciliation runs,
   audit log, user/role management.
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
  `bun install --frozen-lockfile`, `bun run db:migrate`, and
  `systemctl restart backend`. GitHub secrets: `VPS_SSH_KEY`, `VPS_HOST`,
  `VPS_PORT`.
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
| `FRONTEND_ORIGINS` | extra LAN origins, comma-separated | any extra origins (kiosk, custom domain) |
| `MASTERCARD_*` | optional (mock processor when unset) | optional; key files must be placed in `/opt/backend/mastercard/` by hand |

Frontend: `VITE_API_BASE_URL` — `frontend/.env` for dev (LAN IP),
`frontend/.env.production` for prod builds (`https://api.awgsh.ru`).

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
# 2. Recreate + seed the DB:
/root/.bun/bin/bun run db:migrate
/root/.bun/bin/bun run db:seed
# 3. (Optional) re-upload mastercard/ key files + MASTERCARD_* env vars
systemctl restart backend
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
