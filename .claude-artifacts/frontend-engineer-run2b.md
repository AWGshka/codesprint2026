# frontend-engineer — FE-2B: contract-dependent frontend (run 2)

status: done
task: FE-2B
depends_on_read: .claude-artifacts/plan.md ("FE-2B" section), .claude-artifacts/findings.md (D2/D4/D5/D6/D7), .claude-artifacts/backend-engineer-run2.md, .claude-artifacts/frontend-engineer-run2a.md, .claude/skills/frontend/SKILL.md, .claude/skills/frontend-design/SKILL.md

## What was done

All 6 plan items landed under `project/frontend`. Nothing under `project/backend` was touched.

1. **Discover defensive read.** `DiscoverPage.tsx` now reads `c.progress?.raisedMinor ?? 0` /
   `c.progress?.targetMinor ?? 0` instead of `c.progress.raisedMinor`/`targetMinor` directly - the
   backend fix (BE-2) guarantees `progress` on every list row now, but the card grid still never
   crashes if one malformed/missing entry slips through.

2. **Ledger export dialog (D4).** Replaced the bare "Export CSV"/"Export PDF" buttons with a single
   "Export" button opening a `Modal` (`LedgerPage.tsx`): format (CSV/PDF segmented control), scope
   (current page / all filtered results / custom pages, radio group), a `pages` text input
   (`"1-3,5"`) shown only for custom scope, validated **client-side with the exact same grammar the
   server validates** (`^\d+(-\d+)?(,\d+(-\d+)?)*$`, no inverted ranges, no page `0`) with an inline
   i18n error, and a live row-count estimate (`admin.exportRowEstimate`) computed from the current
   page's row count / the list resource's `total` / an upper-bound estimate for custom ranges
   (capped at `total`, since the last page in a range may hold fewer than `pageSize` rows).
   - **CSV** navigates to `GET /api/admin/donations/export.csv` via `window.open` with the filters
     + a translated `pages` param: "current page" sends `pages=<the on-screen page number>` (the
     export route's default `pageSize` of 20 matches the ledger table's on-screen `PAGE_SIZE`, so
     page numbers line up 1:1), "custom" sends the validated user string, "all" omits `pages`
     entirely (full filtered set, unchanged server behavior).
   - **PDF** fetches `GET /api/admin/donations/export.json` with the same query, builds the
     multi-page jsPDF/`autotable` document from the returned rows (extracted the existing PDF
     styling into a reusable `buildLedgerPdf()` helper - unchanged visual output from run 1), then
     records the client event `ledger.export.pdf` with `targetType: "ledger"`, `targetId:
     campaignId() || "all-campaigns"` (a stable, human-legible target - the active campaign filter
     when one is set, else a fixed generic id), and `metadata: { rowCount, scope, pages }`. Per
     BE-2's note, `export.json` itself is never audited - only the client event, fired only after
     the PDF is actually generated (not if the user closes the dialog first).
   - `shared/api/endpoints.ts` gained `LedgerExportQuery` (`LedgerQuery` minus `page`, plus
     `pages?: string`), `adminExportDonationsJson()`, and `recordClientEvent()`'s signature changed
     from `(action, metadata?)` to `(action, opts?: { targetType?, targetId?, metadata? })` to carry
     the new fields (only call site was `LedgerPage`, updated in the same change).

3. **Impact page (D6).** Fully rewritten to consume `GET /api/admin/impact` via `createResource`
   (`getImpactStats`, new in `endpoints.ts`): loading skeletons (4 stat-card placeholders + one
   block), an `ErrorState` on failure, then 4 `StatCard`s (total raised in EUR, donations, donors,
   active campaigns) and a per-campaign list with a `ProgressBar` + donor count per campaign.
   Removed the "(preview)" nav/page-title suffix and the `admin.previewBadge` `Badge` + "Static
   wireframe..." copy entirely (both `en`/`mt`); the page title is now plain "Donor impact"
   (`en`) / "Impatt tad-donaturi" (`mt`), with a rewritten, honest subtitle describing where the
   numbers come from.

4. **Users page (D2).** The role `<Select>` already shows the real current role (FE-2A's fix,
   unaffected by this task). Added: the dropdown is `disabled` on the signed-in user's own row
   (`u.id === auth.state.user?.id`) with a `title`/`aria-label` hint explaining why
   (`admin.cannotChangeOwnRoleHint`); `changeRole`'s catch branch reads `apiErrorCode(err)` and
   shows a friendly toast for `cannot_change_own_role` / `last_admin` (falls back to the generic
   error toast for anything else). The row's `Select value` is always the server-truth role from
   `users()` (never set optimistically), so a rejected change simply leaves the dropdown showing
   the unchanged value - no manual revert needed.

5. **Profile & settings (D7).**
   - New `Avatar` component (`shared/ui/avatar/Avatar.tsx`, exported from the `shared/ui` barrel):
     shows `image` when set, otherwise a circle with initials (first+last, or just first, or the
     username's first letter, or `"?"`) on a deterministic-hue background computed from `userId` (a
     simple string hash -> `hsl(hue, 55%, 40%)` - independent of the theme palette by design, so it
     stays legible and distinct across all 4 theme combos with no per-theme tuning). Sizes `sm`/`md`.
     Decorative by contract (`aria-hidden` + empty `alt`) - always paired with visible name text.
   - `AdminLayout` sidebar bottom-left now renders an `<A href="/admin/settings">` profile block
     (`Avatar` size `sm` + display name (first+last, falls back to username) + a role `Badge`)
     instead of the old plain `"username · role"` text line; sign-out stays a separate, always-
     visible button below it. **Moved `PrefsControls` out of the sidebar into the new settings
     page's "Preferences" card** (see plan.md's "your call" on decluttering) - the sidebar is now
     just nav + profile block + sign-out, no layout regression (same `mt-auto` footer structure,
     just one less stacked block).
   - New `/admin/settings` route (`SettingsPage.tsx`, all roles, not permission-gated - registered
     in `routes.tsx` under the existing `/admin` layout, no `RequireRole` wrapper): a "Profile" card
     (avatar + display name + role badge header; `firstName`/`lastName` `Input`s; read-only
     `username`/`email` `Input`s with `disabled`) and a "Preferences" card wrapping the existing
     (FE-2A) `PrefsControls` (non-`stacked`, since the settings page has room for the horizontal
     layout). Saving calls the new `useAuth().updateProfile(firstName, lastName)` (see below),
     shows a success/error toast, and the sidebar's profile block reflects the new name immediately
     because `updateProfile` refreshes the shared auth store on success.
   - `shared/auth/client.ts`: registered Better Auth's `inferAdditionalFields()` client plugin
     (manually mirroring the server's `firstName`/`lastName` `additionalFields` schema, since the
     frontend can't import the backend's `auth` instance to infer them directly) so
     `authClient.$Infer.Session.user` - and therefore the app-wide `User` type derived from it in
     `context.tsx` - gains `firstName`/`lastName` with real types, and `authClient.updateUser(...)`
     accepts them as typed input.
   - `shared/auth/context.tsx`: `AuthApi` gained `refresh()` (re-fetches the session into the
     store - the existing `onMount` hydration logic extracted so other flows can call it too) and
     `updateProfile(firstName, lastName)` (calls `authClient.updateUser({ firstName, lastName })`,
     throws on error, then `refresh()`s on success). **Always sends both fields together** per
     BE-2's documented name-sync caveat - `SettingsPage`'s save handler does this unconditionally,
     even if only one field changed in the form.

6. **i18n.** Every new string added to both `en.ts` and `mt.ts` (`mt` stays intentionally partial
   per its existing convention - added the primary/most-visible new keys, left a few secondary ones
   e.g. `exportCustomPagesHint`, `impactEmpty` to the existing `en` fallback). No em-dash/en-dash
   introduced anywhere (`grep -rP '[\x{2013}\x{2014}]' src` still 0 hits after this task).

**No deviations from plan.md.**

## Public interface

### Routes added
- `/admin/settings` (`SettingsPage`) - all roles, no `RequireRole` gate. Reachable via the admin
  sidebar's profile block (avatar + name + role badge, links here) or by direct navigation.

### `shared/ui` barrel additions
- `Avatar: Component<AvatarProps>` - `AvatarProps = { firstName?, lastName?, username?, image?,
  userId: string, size?: "sm" | "md", class? }`. See "What was done" §5 for behavior.

### `shared/auth` (barrel: `~/shared/auth`) - additive change to `AuthApi`
- `useAuth()` now also returns:
  - `refresh: () => Promise<void>` - re-fetches the session and updates the store.
  - `updateProfile: (firstName: string, lastName: string) => Promise<void>` - calls Better Auth's
    `updateUser`, throws on failure, refreshes the session on success.
- The `User` type (`typeof authClient.$Infer.Session)["user"]`) now includes `firstName: string |
  null`, `lastName: string | null` (via the new `inferAdditionalFields()` client plugin) - readable
  anywhere as `auth.state.user?.firstName`.

### `shared/api` (barrel: `~/shared/api`) - additions/changes
- `types.ts`: `AdminUser` gained `firstName?: string | null`, `lastName?: string | null`, `image?:
  string | null`. New `ImpactStats` type (mirrors `GET /api/admin/impact`'s response exactly - see
  backend-engineer-run2.md). New `ClientEventTargetType = "ledger" | "campaign" | "user" | "auth"`.
- `endpoints.ts`:
  - `getImpactStats(): Promise<ImpactStats>` -> `GET /api/admin/impact`.
  - `LedgerExportQuery` (new) = `Omit<LedgerQuery, "page"> & { pages?: string }`.
  - `ledgerExportUrl(query: LedgerExportQuery, apiBaseUrl): string` - **signature widened** (was
    `LedgerQuery`, now `LedgerExportQuery`) but backward compatible (all new fields optional).
  - `adminExportDonationsJson(query: LedgerExportQuery): Promise<{ rows: DonationLedgerRow[] }>`
    (new) -> `GET /api/admin/donations/export.json`.
  - `recordClientEvent(action, opts?: { targetType?: ClientEventTargetType; targetId?: string;
    metadata?: unknown })` - **breaking signature change** from run 1's `(action, metadata?)`. Only
    call site (`LedgerPage`) was updated in this same task; grep for `recordClientEvent(` before
    reusing it elsewhere.

### Endpoints consumed (new in this task)
- `GET /api/admin/impact` (`ImpactPage`).
- `GET /api/admin/donations/export.json` (`LedgerPage`'s PDF export path).
- `GET /api/admin/donations/export.csv?...&pages=...` (`LedgerPage`'s CSV export path - existing
  route, now called with the new `pages` param).
- `POST /api/admin/audit/client-event` with `targetType`/`targetId` (`LedgerPage`'s PDF export -
  existing route, now sends the two new optional fields).
- `POST /api/auth/update-user` with `{ firstName, lastName }` (`SettingsPage` via
  `auth.updateProfile`).
- `GET /api/campaigns` - unchanged call, now defensively read (`DiscoverPage`).
- `PATCH /api/admin/users/:id/role` - unchanged call, now branches on the two new error codes
  (`UsersPage`).

## Files changed

- `project/frontend/src/pages/donor/DiscoverPage.tsx` - defensive `progress?.` reads.
- `project/frontend/src/shared/api/types.ts` - `AdminUser` fields, `ImpactStats`,
  `ClientEventTargetType`.
- `project/frontend/src/shared/api/endpoints.ts` - `LedgerExportQuery`, `adminExportDonationsJson`,
  `getImpactStats`, `recordClientEvent` signature change, `ledgerExportUrl` widened.
- `project/frontend/src/shared/ui/avatar/Avatar.tsx` - **new**.
- `project/frontend/src/shared/ui/index.ts` - exports `Avatar`/`AvatarProps`.
- `project/frontend/src/shared/auth/client.ts` - `inferAdditionalFields()` plugin.
- `project/frontend/src/shared/auth/context.tsx` - `refresh`, `updateProfile` on `AuthApi`.
- `project/frontend/src/pages/admin/LedgerPage.tsx` - export dialog (format/scope/custom-pages
  validation/row estimate), `buildLedgerPdf()` extracted helper, PDF client-event now carries
  `targetType`/`targetId`.
- `project/frontend/src/pages/admin/ImpactPage.tsx` - rewritten, live data.
- `project/frontend/src/pages/admin/UsersPage.tsx` - own-row disable + hint, friendly role-guard
  toasts.
- `project/frontend/src/pages/admin/SettingsPage.tsx` - **new**: Profile + Preferences cards.
- `project/frontend/src/app/layouts/AdminLayout.tsx` - sidebar profile block (`Avatar` + name +
  role badge, links to `/admin/settings`), `PrefsControls` removed from the sidebar (moved to the
  settings page).
- `project/frontend/src/app/routes.tsx` - `/admin/settings` route.
- `project/frontend/src/shared/i18n/dictionaries/en.ts`, `mt.ts` - new keys (export dialog, impact,
  role-guard toasts, profile/settings, `admin.impact`/`admin.previewBadge` copy changes - preview
  badge key removed entirely).

## How to verify

```
cd project/frontend
bun run format && bun run lint && bun run typecheck && bun run build   # all exit 0 (verified this session)
grep -rP '[\x{2013}\x{2014}]' src   # 0 hits (verified this session)
```

Manual/live verification performed this session (backend `bun run dev` on :3001, seeded DB,
`curl` against real routes with a signed-in `admin` session cookie):
- `GET /api/campaigns` returns `progress` on every row (matches `CampaignWithProgress` exactly);
  `GET /api/admin/impact` returns the exact `ImpactStats` shape (`totalRaisedMinor`, `donorCount`,
  `donationCount`, `activeCampaignCount`, `perCampaign[]` with no `currency` field - confirmed the
  gap noted below).
- `GET /api/admin/donations/export.json?pages=1-2&pageSize=5` returns `{ rows: [...] }` with the
  same row shape the CSV export uses.
- `PATCH /api/admin/users/:id/role` on the signed-in admin's own id returns `400
  {"code":"cannot_change_own_role", ...}` - confirms `UsersPage`'s toast branch matches the real
  error code.
- `POST /api/admin/audit/client-event` with `targetType: "ledger", targetId: "all-campaigns"`
  returns `{"recorded":true}`.
- `POST /api/auth/update-user` correctly rejects a bare `curl` call (missing `Origin` header -
  Better Auth's CSRF protection) - expected and correct; the browser's `fetch` (via
  `credentials: "include"` cross-origin from the configured `FRONTEND_URL`) sends `Origin`
  automatically, so this only fails outside a real browser context. Not exercised via a full
  browser session this run (no browser automation available in this environment) - **recommend the
  reviewer manually click through `/admin/settings`'s Profile save once** to confirm the end-to-end
  Better Auth flow (session cookie -> `updateUser` -> refreshed session -> sidebar name update).
- Dev server processes were stopped after verification; no DB state was left mutated (the role-
  change attempt above was rejected before any write; the `update-user` calls were rejected before
  any write; the one client-event write is normal, harmless audit-log data, same as any other
  manual QA pass).

Not run this session (recommended for the reviewer/final-report, needs a real browser):
- `/admin/ledger`: open the Export dialog, try each scope (current/all/custom), confirm the inline
  page-range validation error appears for `"abc"`/`"5-1"`/empty, confirm CSV opens a new tab and PDF
  downloads with a matching row count to the shown estimate, confirm an audit row appears
  (`/admin/audit`) with `targetType: "ledger"` (not a bare `":"`).
- `/admin/impact`: confirm the loading skeleton -> live stat cards -> per-campaign list render, no
  console errors, legible in all 4 theme combos.
- `/admin/users`: confirm your own row's role dropdown is disabled with a tooltip, and that another
  admin/manager/viewer's row still works normally.
- `/admin/settings`: change first/last name, save, confirm the sidebar's profile block updates
  immediately without a full page reload; confirm the Preferences card's controls (theme/contrast/
  text-size/locale) behave identically to the old sidebar `PrefsControls`.

## Notes / gotchas

- **Open question for the orchestrator/backend: `ImpactStats.perCampaign` has no `currency`
  field.** Per backend-engineer-run2.md, `perCampaign[].raisedMinor`/`targetMinor` are each in
  "that campaign's own currency" but the response doesn't expose which currency that is. I did
  **not** work around this by assuming EUR or any other fixed currency (would silently mislabel
  amounts for USD/GBP campaigns) - instead, the per-campaign list shows a currency-agnostic
  percentage (`raisedMinor / targetMinor * 100`, which is valid regardless of currency since both
  values share the same one) plus donor count, and omits absolute currency amounts per campaign.
  The top-level `totalRaisedMinor` **is** explicitly documented as EUR-equivalent, so that one is
  formatted with `formatMoney(..., "EUR")` safely. If a future pass wants per-campaign amounts
  shown (e.g. "EUR 1,451 / EUR 3,500"), the impact endpoint needs a `currency` field added to each
  `perCampaign` entry - a small backend addition, not a frontend workaround.
- **`recordClientEvent`'s signature changed** (positional `metadata` -> an `opts` object with
  `targetType`/`targetId`/`metadata`). Only one call site existed (`LedgerPage`), updated here - if
  another page starts recording client events later, use the new object-shaped second argument.
- **Export "current page" scope relies on the coincidence that the export routes' default
  `pageSize` (20) equals `LedgerPage`'s on-screen `PAGE_SIZE` (20)** - both are separately defined
  constants (server default, client constant) that happen to match today. If either changes
  independently in the future, "current page" would export a differently-sized chunk than what's
  on screen; the dialog always sends `pageSize: PAGE_SIZE` explicitly for the current/custom
  scopes precisely to keep this pinned rather than relying on server defaults silently agreeing.
- **`Avatar`'s hue-from-id palette is intentionally theme-independent** (a raw `hsl()` computed
  from a hash, not a Tailwind/CSS-variable token) - this means it doesn't get any lighter/darker
  automatically between light/dark/high-contrast; it was picked at a fixed lightness (40%) with
  white text specifically to hold reasonable contrast in all 4 combos without per-theme tuning, but
  wasn't formally contrast-ratio-tested (same caveat FE-2A flagged for the dark+high-contrast
  palette) - worth a design pass if the studio wants to verify AA/AAA on every possible hue.
- **`SettingsPage` is unauthenticated-role-agnostic by design** (no `RequireRole` wrapper, unlike
  `/admin/users`) - every signed-in admin-console user (viewer/manager/admin) can reach it and edit
  their own name/preferences, per D7's "all roles" instruction in plan.md.
- **`updateProfile`'s browser-only CSRF dependency** - verified the route rejects requests without
  a proper `Origin` header (expected Better Auth behavior for cross-site protection), but couldn't
  fully exercise the success path from this environment (no browser automation available) - see
  "How to verify" for the one manual click-through recommended before sign-off.
