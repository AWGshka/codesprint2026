# review-frontend-engineer-run2b

verdict: pass

## Commands run (project/frontend)

- `bun run format:check` → "All matched files use Prettier code style!" (pass)
- `bun run lint` (biome) → "Checked 80 files in 367ms. No fixes applied." (pass)
- `bun run typecheck` (`tsc -p tsconfig.json && tsc -p tsconfig.node.json`) → exit 0, no output (pass)
- `bun run build` (vite build) → "✓ built in 7.70s", exit 0 (pass)
- `grep -rP '[\x{2013}\x{2014}]' project/frontend/src` → 0 hits (matches artifact's claim)

## Contract / inspection checks

1. **DiscoverPage optional chaining** — confirmed `c.progress?.raisedMinor ?? 0` / `c.progress?.targetMinor ?? 0`
   in `project/frontend/src/pages/donor/DiscoverPage.tsx:46-47`. No unguarded `c.progress.x` access.

2. **LedgerPage export dialog** — `project/frontend/src/pages/admin/LedgerPage.tsx`:
   - Format (CSV/PDF) segmented control and scope (current/all/custom) radio group present (lines 325-369).
   - Client-side `PAGES_PATTERN = /^\d+(-\d+)?(,\d+(-\d+)?)*$/` with `from < 1` / `to < from` rejection
     (lines 23, 33-36) matches the server's `DonationService.parsePagesSpec` in
     `project/backend/src/modules/donations/service.ts:148-159` exactly (same regex, same `from < 1`
     and `to < from` throws).
   - CSV path: `ledgerExportUrl(exportQuery(), env.apiBaseUrl)` builds `GET /api/admin/donations/export.csv`
     with filters + `pages` via `qs(query)` (`endpoints.ts:76`) — confirmed filters+pages both flow through
     `exportQuery()`.
   - PDF path: fetches `adminExportDonationsJson` (→ `GET /api/admin/donations/export.json`), builds the
     PDF via `buildLedgerPdf()`, then calls `recordClientEvent("ledger.export.pdf", { targetType: "ledger",
     targetId: campaignId() || "all-campaigns", metadata: {...} })` — confirmed at
     `LedgerPage.tsx:192-201`, only fired after a successful PDF build (inside the try block after
     `buildLedgerPdf(rows)`), matching the artifact's description.

3. **ImpactPage** — `project/frontend/src/pages/admin/ImpactPage.tsx` consumes `GET /api/admin/impact` via
   `createResource(getImpactStats)` with loading skeletons (`Show when={!stats.loading}` fallback) and an
   `ErrorState` on `stats.error`. Grepped `en.ts`/`mt.ts`/whole `admin` module for "preview"/"static
   wireframe" — no hits; `admin.previewBadge` key is gone from both dictionaries.

4. **UsersPage** — `project/frontend/src/pages/admin/UsersPage.tsx`: role `<Select>` is `disabled={updating() === u.id || isSelf()}`
   where `isSelf = () => u.id === auth.state.user?.id` (lines 56, 68), with a `title`/`aria-label` hint.
   `changeRole`'s catch reads `apiErrorCode(err)` and branches on `cannot_change_own_role` / `last_admin`
   to friendly toasts, falling back to a generic error toast otherwise (lines 25-29).

5. **Avatar / AdminLayout / SettingsPage / routing**:
   - `Avatar` component exists at `project/frontend/src/shared/ui/avatar/Avatar.tsx`, exported from the
     `shared/ui` barrel.
   - `AdminLayout.tsx` sidebar has an `<A href="/admin/settings">` profile block (`Avatar` size `sm` + name
     + role `Badge`), sign-out remains a separate button (lines 64-90).
   - `routes.tsx` registers `{ path: "/settings", component: SettingsPage }` nested under the `/admin`
     parent (`AdminLayout`) — resolves to `/admin/settings` (line 66).
   - `SettingsPage.tsx` has a Profile card (`firstName`/`lastName` editable inputs, read-only
     `username`/`email`) calling `auth.updateProfile(...)` on submit, and a Preferences card wrapping
     `PrefsControls`.

6. **i18n parity** — spot-checked the new `admin.*` keys (export dialog, impact, role-guard toasts,
   profile/settings) in `en.ts`; present in `mt.ts` for the primary/most-visible keys
   (`exportCustomPagesHint` and `impactEmpty` are intentionally left to the `en` fallback, consistent with
   `mt.ts`'s pre-existing documented "~30%, deliberately partial" convention stated in its header comment).
   This is consistent with the existing dictionary's partial-coverage design, not a gap introduced by this
   task. No orphaned `admin.previewBadge` in either file.

7. **Scope** — `git status --porcelain --untracked-files=all` shows no `project/backend` files were
   touched/added by this run; the artifact's "Files changed" list is entirely under `project/frontend/src`
   and matches what's on disk.

8. **Artifact template** — `frontend-engineer-run2b.md` follows `.claude-artifacts/[agent].md`'s required
   headings exactly (`status`, `task`, `depends_on_read`, `What was done`, `Public interface`, `Files
   changed`, `How to verify`, `Notes / gotchas`).

## Notes (non-blocking)

- The artifact flags that `ImpactStats.perCampaign` has no `currency` field, so per-campaign progress is
  shown as a currency-agnostic percentage instead of absolute amounts — a reasonable, explicitly-justified
  workaround, not a defect in this subtask; flagged as a possible small backend follow-up.
- Live browser click-through (Settings save round-trip, Export dialog end-to-end, 4-theme legibility) was
  not exercised in this environment per the artifact's own "Not run this session" list — mechanical checks
  (format/lint/typecheck/build) and static inspection all pass; recommend a manual click-through pass before
  final sign-off, as the artifact itself suggests, but this does not block the review gate.
