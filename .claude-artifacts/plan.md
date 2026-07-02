# Plan — Run 2 (bug-fix + UX batch)

Working root: `P:\@github\codesprint2026\.claude\worktrees\run2-bugfix-ux`.
All paths below are relative to it. Read `findings.md` (root causes D1–D8) first.

## Waves

- **Wave 1 (parallel):** DB-2 || FE-2A
- **Wave 2:** BE-2 (depends on DB-2)
- **Wave 3:** FE-2B (depends on BE-2, FE-2A)
- After each agent: reviewer. End: final-report.

---

## DB-2 — user name fields + seed cleanup (database-engineer)

depends_on: —
artifact: `database-engineer-run2.md`

Scope:
1. Add nullable `first_name` / `last_name` text columns to the Better Auth
   `user` table (`backend/src/db/auth-schema.ts`) and register them as
   Better Auth `additionalFields` on the `user` config in `backend/src/auth.ts`
   (`user.additionalFields: { firstName: { type: "string", required: false, input: true }, lastName: ... }`)
   so `auth.api.updateUser` accepts them.
2. Generate the migration (drizzle-kit) and apply it locally.
3. Seed: give the demo users sensible first/last names (e.g. Vera Vella /
   Mario Muscat / Anna Attard); replace the U+2014 in `seed.ts:99` story and
   any other U+2014/U+2013 in seed **data strings** with `-`; sweep backend
   `src/db/**` comments too.

Acceptance:
- `bun run db:migrate && bun run db:seed` clean on a fresh DB.
- Existing DBs migrate without data loss (additive columns only).
- Typecheck passes; user DTO shapes documented in artifact.

## FE-2A — independent frontend fixes (frontend-engineer)

depends_on: — (do NOT touch backend)
artifact: `frontend-engineer-run2a.md`

Scope (issues 1, 3, 4, 5, 6-frontend, 8-frontend, 10-frontend-component):
1. **Charts:** register `LineController`, `BarController`, `DoughnutController`
   in `frontend/src/shared/ui/chart/register.ts`. Chart colors must read from
   CSS custom properties so they stay legible in dark theme (re-render chart on
   theme change if needed).
2. **Select bug:** fix `frontend/src/shared/ui/select/Select.tsx` so the value
   binds correctly with `<For>`-rendered options (e.g. `selected={opt.value === props.value}`
   on each option). This fixes the Users role dropdown showing "viewer".
3. **Admin campaigns → public page:** add an "open public page" action
   (new tab, `target="_blank" rel="noopener"`, external-link icon) on each
   campaigns-list row and on the campaign detail page (`/c/:slug`; keep the
   kiosk link too).
4. **Header layout shift (D3):** build a compact settings popover (gear/globe
   trigger button, fixed width, `aria-expanded`, closes on outside click/Esc)
   containing the theme/contrast/text-size/locale controls; use it in
   `PublicLayout` and `DonorLayout` headers instead of inline `PrefsControls`.
   Nothing in the header may move when locale or text size changes. Admin
   sidebar keeps the stacked block (restyle to match new controls).
5. **Dark theme + high contrast (D1):**
   - `prefs/store.ts`: `theme: "light" | "dark"` + new `contrast: boolean`
     (persisted; migrate legacy stored `"contrast"` → light + high; default
     theme from `prefers-color-scheme`). Reflect as `data-theme` +
     `data-contrast="high"` on `<html>`.
   - `index.css`: 4 palettes via `[data-theme="dark"]`,
     `[data-contrast="high"]` overrides composing with either theme. Keep
     WCAG AA (AAA-ish for high contrast) for text tokens; check focus rings,
     borders, chart tokens, toasts, modals in dark.
   - Controls: theme toggle (sun/moon) + "High contrast" switch in the new
     popover and admin sidebar.
6. **Em-dash (D8):** replace U+2014/U+2013 with `-` in all frontend
   user-facing strings (both dictionaries, `ImpactPage`, `LedgerPage`,
   `ReconciliationPage` fallbacks) AND frontend comments.
7. **Audit page polish (D5):** friendly action labels via i18n map (raw code
   in a `title`/secondary line), target cell renders `type: id` only when
   present, `-` otherwise. Keep raw codes in data.

Acceptance:
- Dashboard renders all 3 charts, no console errors, legible in all 4
  theme combos.
- No layout shift in public/donor header when switching EN↔MT or text size.
- `grep -rP '[–—]' frontend/src backend/src` → 0 hits (frontend
  scope; DB/BE agents own their files).
- Lint + typecheck pass.

## BE-2 — backend fixes + new endpoints (backend-engineer)

depends_on: DB-2 (`database-engineer-run2.md`)
artifact: `backend-engineer-run2.md`

Scope (issues 2, 7, 8, 9, 10-server, 11-server):
1. **Discover (fix crash root cause):** `listPublicActive()` must return the
   same `progress: { raisedMinor, targetMinor, donorCount }` object as
   `getPublicBySlug()` (efficient aggregate, one grouped query — not N+1).
2. **Role guards (D2):** in `PATCH /api/admin/users/:id/role`:
   reject changing your own role (`400`, code `cannot_change_own_role`) and
   demoting/removing the last remaining admin (`400`, code `last_admin`).
   Audit both attempts and successes as today. Add tests.
3. **Export (D4):** add optional `pages` query param (format `1-3,5`,
   validated, relative to `pageSize` param defaulting 20) to the existing
   `GET /api/admin/donations/export.csv`, and add
   `GET /api/admin/donations/export.json` with identical filter/pages
   semantics returning `{ rows: [...] }` (same row shape the CSV uses, cap
   50k) for client-side PDF generation. Both audit (`ledger.export.csv` /
   `ledger.export.pdf` stays a client event for PDF).
4. **Audit target (D5):** client-event route accepts optional
   `targetType`/`targetId` (validated against a small allowlist) and stores
   them; keep action codes as stored today.
5. **Impact stats (D6):** `GET /api/admin/impact` (auth: any admin-console
   role) returning real aggregates: `totalRaisedMinor`, `donorCount`,
   `donationCount`, `activeCampaignCount`, and `perCampaign: [{ id, title,
   slug, raisedMinor, targetMinor, donorCount }]` (completed donations only,
   consistent with dashboard numbers).
6. **Profile (D7):** ensure Better Auth `updateUser` works for
   `firstName`/`lastName` (+ `name` derived as `firstName + " " + lastName`
   fallback username). Users list DTO gains `firstName`, `lastName`, `image`.
7. **Em-dash (D8):** sweep backend files (except `src/db/**`, owned by DB-2)
   for U+2014/U+2013 → `-`.

Acceptance:
- Tests pass (`bun test`), incl. new role-guard + pages-param tests.
- Response contracts documented exactly in artifact (FE-2B consumes them).
- Lint + typecheck pass. No `node:*` imports.

## FE-2B — contract-dependent frontend (frontend-engineer)

depends_on: BE-2 (`backend-engineer-run2.md`), FE-2A (`frontend-engineer-run2a.md`)
artifact: `frontend-engineer-run2b.md`

Scope (issues 2-consume, 7-UX, 9, 10-UX, 11-UI):
1. **Discover:** consume `progress` from the list endpoint; defensive
   optional-chaining fallback (no crash even if progress missing).
2. **Export dialog (D4):** replace the two bare buttons with an "Export"
   button opening a dialog: format CSV/PDF; scope current page / all filtered
   results / custom pages input (`1-3,5`, validated with inline error); shows
   the row-count implication where known. CSV → server URL with params; PDF →
   fetch `export.json` then jsPDF (multi-page). Record the PDF client event
   with a proper target.
3. **Impact page (D6):** live data from `GET /api/admin/impact` (loading +
   error states, StatCards + per-campaign progress list); remove
   "preview"/"static wireframe" copy in both locales.
4. **Users page (D2):** dropdown shows the real role (fixed Select from
   FE-2A); disabled on your own row (tooltip/hint why); friendly toasts for
   `cannot_change_own_role` / `last_admin` server errors.
5. **Profile & settings (D7):**
   - Initials `Avatar` component (uses `image` when set; deterministic bg
     color from user id; sizes sm/md).
   - Sidebar bottom-left profile block: avatar + display name (first/last,
     fallback username) + role badge; clicking it opens `/admin/settings`;
     sign-out stays accessible.
   - `/admin/settings` page (all roles): Profile section (first/last name
     via Better Auth updateUser, username + email + role read-only) and
     Preferences section (theme, high contrast, text size, locale — reusing
     FE-2A controls).
6. i18n: every new string in `en` + `mt`.

Acceptance:
- /discover renders cards with progress bars, no console errors.
- Export dialog validates page ranges; CSV/PDF respect scope + filters.
- Settings page updates names; sidebar reflects immediately.
- Lint + typecheck pass; all 4 theme combos legible on new UI.

---

## Failure policy

Per CLAUDE.md: transient error → re-run same agent with the error; wrong
approach → re-plan; 3 attempts max per subtask before escalating.
