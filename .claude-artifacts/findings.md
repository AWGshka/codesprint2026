# Findings — Run 2 (bug-fix + UX batch, 2026-07-02)

> Run-1 findings archived at `findings-run1.md`. Source: read-only Explore pass
> over `project/` + the user's bug report. Run 1 shipped the full GiveTap build
> (donor app + admin console); this run fixes 11 reported issues.
>
> **Working root for this run:**
> `P:\@github\codesprint2026\.claude\worktrees\run2-bugfix-ux`
> (a worktree; the untracked app was copied here — do NOT edit the original
> checkout at `P:\@github\codesprint2026\project`).

## How to run

- Frontend: `cd project/frontend && bun run dev` → Vite, port **3000**.
- Backend: `cd project/backend && bun run dev` → Elysia, port **3001**.
- DB: `bun run db:migrate && bun run db:seed` (libSQL local file).
- Demo logins: `viewer` / `manager` / `admin`, password `demo1234`.
- Checks: `bun run lint`, `bun run format`, typecheck on both packages.

## Stack facts relevant to this run

- i18n: `@solid-primitives/i18n`, locales `en` + `mt` in
  `frontend/src/shared/i18n/dictionaries/{en,mt}.ts`; `mt` falls back to `en`.
- Prefs store: `frontend/src/shared/prefs/store.ts` — signals `theme`
  (`"light" | "contrast"`), `textSize`, `locale`; persisted to localStorage,
  reflected as `<html data-theme data-textsize lang>`.
- All theming tokens in one file: `frontend/src/index.css` (CSS custom props +
  Tailwind v4 `@theme` mapping). No dark mode, no `prefers-color-scheme`.
- Roles: Better Auth admin plugin; `role` is a column on the `user` table
  (`backend/src/db/auth-schema.ts:18`). RBAC via `createAccessControl` in
  `backend/src/auth.ts:17-38`; only `admin` has `user: ["set-role", ...]`.
- User table has `name` (display), `username` (login handle), `image`
  (nullable, unused). **No firstName/lastName.**
- Admin tables are fully server-paginated/filtered (query params
  `page/sort/dir/pageSize` + filters).
- Shared UI barrel `frontend/src/shared/ui/index.ts`: Select, Modal,
  ConfirmDialog, Badge, Card, StatCard, Field, Input, Toggle, Checkbox, Tabs,
  ProgressBar, Banner, EmptyState, Skeleton, Stepper, Chart, showToast.

## Root causes per issue

| # | Issue | Root cause | Key files |
|---|-------|-----------|-----------|
| 1 | Charts "not a registered controller" | `Chart.register()` registers elements but not `LineController`/`BarController`/`DoughnutController` | `frontend/src/shared/ui/chart/register.ts` |
| 2 | /discover crash `targetMinor` | `listPublicActive()` DTO has no `progress` object; only `getPublicBySlug()` adds it; DiscoverPage reads `c.progress.targetMinor` | `backend/src/modules/campaigns/service.ts:39-66`, `frontend/src/pages/donor/DiscoverPage.tsx:43,54` |
| 3 | No link to public campaign page | Admin list/detail link only in-app; public route is `/c/:slug`, kiosk `/kiosk/:slug` | `frontend/src/pages/admin/CampaignsListPage.tsx:87-107`, `CampaignDetailPage.tsx:62-70` |
| 4 | Header buttons shift on locale/size | `PrefsControls` (3 segmented fieldsets, label widths vary) sits inline in a `flex flex-wrap justify-between` nav; admin sidebar stacks it vertically so it doesn't shift | `frontend/src/app/layouts/PublicLayout.tsx:15-27`, `DonorLayout.tsx:30-47`, `shared/prefs/PrefsControls.tsx` |
| 5 | No dark theme | Only `light` + `contrast` palettes exist in `index.css`; `Theme` union is 2-valued | `frontend/src/index.css:9-45`, `shared/prefs/store.ts` |
| 6 | Em-dashes | U+2014 in user-facing strings: `en.ts` lines 48,67,88,137,176,177; `ImpactPage.tsx:24` + `"—"` fallback; `LedgerPage.tsx:54,90`; `ReconciliationPage.tsx` ×2; `seed.ts:99` story. Rest are code comments (~35 files) | see list |
| 7 | Export UX | CSV route exports full filtered set (fine); PDF built client-side from the current 20-row page resource; no scope choice (current page / all / page range) | `frontend/src/pages/admin/LedgerPage.tsx:81-115`, backend export.csv route |
| 8 | Audit target shows `":"` | Client events (`ledger.export.pdf`) recorded without `targetType`/`targetId`; FE renders `{targetType}:{targetId}` unguarded; raw action codes shown | `backend/src/modules/audit/index.ts`, `frontend/src/pages/admin/AuditPage.tsx:61-63` |
| 9 | Impact page pointless | Fully static S1.2 wireframe, hardcoded stats, no API call | `frontend/src/pages/admin/ImpactPage.tsx` |
| 10 | Role dropdown always "viewer" | Shared `Select` sets `value` via spread before `<For>` options mount → browser falls back to first option; also no server guards for own-role change or last-admin demotion | `frontend/src/shared/ui/select/Select.tsx:16-29`, `backend/src/modules/users/service.ts:31-52` |
| 11 | No profile/settings | No settings route/page; sidebar footer shows `username · role` text only; `image` field unused; no first/last name | `frontend/src/app/layouts/AdminLayout.tsx:62-73`, `backend/src/db/auth-schema.ts` |

## Decisions taken (user delegated these in the bug report)

- **D1 Themes:** 2 color themes (light/dark) x an independent high-contrast
  toggle = 4 palettes. `data-theme="light|dark"` + `data-contrast="high"` on
  `<html>`. Default follows `prefers-color-scheme` until the user picks.
  Existing persisted `"contrast"` value migrates to `light` + `high`.
- **D2 Role hierarchy:** admin > manager > viewer. Only admins change roles
  (already perm-gated); server additionally rejects changing **own** role and
  demoting the **last admin**. UI disables the dropdown on your own row and
  shows the real current role.
- **D3 Header:** public/donor headers get a compact fixed-width "settings"
  dropdown (popover) holding theme/contrast/text-size/locale controls — no
  inline segmented groups, no layout shift. Admin sidebar keeps stacked layout.
- **D4 Export:** export dialog with format (CSV/PDF) + scope: current page /
  all filtered / custom pages (`1-3,5`). Server honors filters + optional
  `pages` param; PDF data comes from a JSON export fetch, not the page
  resource.
- **D5 Audit:** keep storing raw action codes; FE maps them to friendly labels
  via i18n and renders target friendly (hidden/`-` when null).
- **D6 Impact page:** wire to real aggregates via a new stats endpoint; drop
  the "preview/static" framing.
- **D7 Profile:** add nullable `firstName`/`lastName` (Better Auth
  additionalFields); initials avatar (uses `image` if ever set); profile block
  at sidebar bottom-left; new `/admin/settings` page (profile + preferences).
  `username` stays the immutable login handle.
- **D8 Em-dash:** replace U+2014/U+2013 with `-` in ALL user-facing strings and
  seeds; sweep code comments too (harmless).

## Skill needs

None — installed skills cover all domains.
