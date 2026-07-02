# frontend-engineer — FE-2A: independent frontend fixes

status: done
task: FE-2A
depends_on_read: .claude-artifacts/plan.md, .claude-artifacts/findings.md, .claude-artifacts/frontend-engineer.md (run-1 artifact), .claude/skills/frontend/SKILL.md, .claude/skills/frontend-design/SKILL.md

## What was done

1. **Charts (#1)** - `shared/ui/chart/register.ts` now registers `LineController`, `BarController`,
   `DoughnutController` alongside the existing elements/scales/plugins (was only registering
   elements, never the controllers - the root cause of "not a registered controller"). Added
   `shared/ui/chart/theme.ts::chartTheme()`, a plain function that reads `prefs.theme()` /
   `prefs.contrast()` (for reactive tracking) plus the live CSS custom properties (`--brand`,
   `--fg-muted`, `--border`, etc.) off `<html>` via `getComputedStyle`, returning a `ChartTheme`
   (colours + a 5-entry `series` palette) and exposing `hexToRgba()` for translucent fills.
   `Chart.tsx`'s `createEffect` now calls `chartTheme()` before every (re)build - this both forces
   a full destroy/rebuild on any theme/contrast flip (Chart.js doesn't re-theme an existing
   instance) and sets `ChartJS.defaults.color`/`borderColor` + per-axis grid/tick colours from the
   live theme, so gridlines/ticks/legend stay legible in all 4 theme combos. `DashboardPage`'s
   three chart-data memos now read `chartTheme()` too and use `theme.brand`/`theme.series` instead
   of hardcoded hex, so dataset colours also track the theme.
2. **Select value bug (#2, #10)** - `shared/ui/select/Select.tsx` now sets `selected={option.value
   === props.value}` on every `<For>`-rendered `<option>` (previously only `value` was spread onto
   the `<select>` itself, which the browser resolves against whatever option is in the DOM at that
   instant - always the first one, since `<For>` mounts options after the initial render). This is
   the root cause of the Users role dropdown always showing "viewer"; verified via `bun run build`
   + code path (no backend change needed - the bug was purely in the shared component, not
   per-page usage).
3. **Admin campaigns -> public page (#3)** - `CampaignsListPage` row actions gained an icon-only
   `<a href="/c/:slug" target="_blank" rel="noopener">` (external-link icon, `aria-label`/`title`
   "Open public page") before Edit/Delete. `CampaignDetailPage` gained the same action as a
   labelled pill next to the status badge (kept as a plain styled `<a>`, not `<Button>`, to avoid
   nesting an interactive `<button>` inside an interactive `<a>`). The existing "Public link"/
   "Kiosk link" text block on the detail page is unchanged.
4. **Header layout shift (#4, D3)** - new `shared/prefs/PrefsPopover.tsx`: a fixed-size (`size-10`)
   icon trigger button (`aria-expanded`, `aria-haspopup`) that toggles a `w-64` panel, absolutely
   positioned below the trigger (out of document flow) and containing `<PrefsControls stacked />`.
   Because the panel is `position: absolute`, its content width (which changes with locale/text
   size) can never affect the header's flex layout - only the always-same-size trigger button sits
   in flow. Closes on outside `pointerdown` and `Escape` (listeners added on mount, removed on
   cleanup). `PublicLayout` and `DonorLayout` now render `<PrefsPopover />` instead of inline
   `<PrefsControls />`. `AdminLayout`'s sidebar keeps `<PrefsControls stacked />` (same component,
   vertical layout via the new `stacked` prop) since the sidebar never had a shifting-layout
   problem.
5. **Dark theme + high contrast (#5, D1)** - `shared/prefs/store.ts`: `theme` is now `"light" |
   "dark"` and a new independent `contrast: boolean` signal was added (separately persisted +
   reflected as `data-contrast="high"`/absent on `<html>`). A legacy stored `"contrast"` theme
   value (run-1's `Theme = "light" | "contrast"`) migrates on read to `theme: "light"` +
   `contrast: true`; a legacy `"light"` value carries over. With **no** stored value at all,
   `theme` defaults from `prefers-color-scheme`. `index.css` gained a `[data-theme="dark"]` base
   palette (same brand identity, brightened for a near-black surface) plus
   `[data-theme="light"][data-contrast="high"]` (run-1's old contrast palette, renamed/re-scoped)
   and `[data-theme="dark"][data-contrast="high"]` (new pure-black AAA palette) - 4 combinations
   total, composed via attribute-selector specificity so declaration order doesn't matter. Also
   added dark-mode-specific `--e1/e2/e3` shadow overrides (light shadows read as elevation on a
   dark surface; the light-theme's dark shadows are invisible there). `PrefsControls` gained a
   theme segmented control with sun/moon icons (light/dark) and a `Toggle`-based "High contrast"
   switch, in both the popover and the admin sidebar (via the shared `stacked` prop).
6. **Em-dash sweep (#6, D8)** - replaced every U+2013/U+2014 in `frontend/src` (26 files: both i18n
   dictionaries, `ImpactPage`/`LedgerPage`/`ReconciliationPage`/`DashboardPage` `"-"` fallbacks and
   copy, plus every code comment across the app) with plain `-`, via a scripted sweep + one manual
   follow-up fix (a dash I introduced in a comment while writing `chart/theme.ts`).
   `grep -rP '[\x{2013}\x{2014}]' frontend/src` -> 0 hits.
7. **Audit page polish (#7, D5)** - `AuditPage` gained a `Record<AuditAction, ...>` mapping (same
   pattern as `ReconciliationPage`'s `tabLabelKey`) from each raw action code to a new
   `admin.auditActionLabels.*` i18n key. The action column now renders the friendly label as
   primary text with the raw code as a secondary `font-mono` line and a `title` attribute (both,
   per the plan's "or"); the action filter `<Select>` also shows friendly labels now. The target
   column renders `"type: id"` only when both `targetType` and `targetId` are present, `"-"`
   otherwise (was `{targetType}:{targetId}` unconditionally, which rendered as a bare `":"` for
   client-recorded events that have neither).

## Public interface

### `shared/prefs` (barrel: `~/shared/prefs`) - **breaking change from FE-1/FE-2**
- `prefs: { theme: Accessor<"light"|"dark">; contrast: Accessor<boolean>; textSize:
  Accessor<"100"|"112"|"125">; locale: Accessor<"en"|"mt"> }` - **`theme` is no longer
  `"light"|"contrast"`; high contrast is now the separate `contrast` boolean.**
- `setPrefs: { setTheme(v); setContrast(v); setTextSize(v); setLocale(v) }` - each persists to
  `localStorage` (`givetap:theme` = `"light"|"dark"`, `givetap:contrast` = `"true"|"false"`,
  `givetap:textsize`, `givetap:locale`) and updates the matching `<html>` attribute via an
  internal effect.
- `PrefsControls: Component<{ class?: string; stacked?: boolean }>` (new `stacked` prop - vertical
  full-width layout for the sidebar/popover; omit for the old horizontal segmented-bar look, still
  available if anything needs it).
- `PrefsPopover: Component<{ class?: string }>` - **new**. Compact fixed-size trigger + fixed-width
  (`w-64`) absolutely-positioned panel wrapping `<PrefsControls stacked />`. Use this (not
  `PrefsControls` directly) in any header/nav where layout must not shift on locale/text-size
  change.
- Types: `Theme = "light" | "dark"` (was `"light" | "contrast"`), `TextSize`, `Locale`,
  `PrefsControlsProps`.

### Theme/contrast attribute contract (consumed by every page/component)
- `<html data-theme="light" | "dark">` - base palette (was `"light"|"contrast"`).
- `<html data-contrast="high">` - present only when high contrast is on; **absent** (not
  `"normal"` or similar) when off. Independent of `data-theme`, giving 4 combinations:
  `light`, `dark`, `light`+`high`, `dark`+`high`.
- All 4 combinations define the same CSS custom property set (`--surface`, `--surface-raised`,
  `--surface-sunken`, `--border`, `--border-strong`, `--fg`, `--fg-muted`, `--brand`, `--brand-fg`,
  `--accent`, `--positive`, `--warning`, `--danger`, `--live`, `--focus`) plus theme-scoped
  `--e1/e2/e3` shadow overrides for dark. Every existing Tailwind utility mapping (`bg-surface`,
  `text-fg-muted`, `bg-brand`, etc., from FE-1) is unchanged and automatically re-themes.
- `<html data-textsize>` and `<html lang>` contracts are unchanged from FE-1.

### `shared/ui/chart` (barrel additions: `~/shared/ui` still exports `Chart`/`ChartProps` only;
`theme.ts` is imported directly, not re-exported through the barrel)
- `shared/ui/chart/theme.ts::chartTheme(): ChartTheme` - call from inside a reactive scope
  (`createEffect`/`createMemo`) to read live CSS custom properties **and** track
  `prefs.theme()`/`prefs.contrast()`, so the caller reruns on every theme flip. Returns `{ fg,
  fgMuted, border, brand, accent, positive, warning, danger, series: string[] }` (`series` is a
  5-colour ordered palette for multi-dataset bar/doughnut charts).
- `shared/ui/chart/theme.ts::hexToRgba(hex, alpha): string` - for translucent fill colours
  (Chart.js needs an alpha channel; CSS custom properties here are plain hex).
- `Chart` component itself has the same props as before (`ChartProps` unchanged) - it now
  internally re-renders on theme change; no caller changes required beyond feeding it
  theme-derived colours if you want dataset (not just gridline) colours to re-theme too (see
  `DashboardPage` for the pattern).

### `shared/ui/select/Select` - no prop/type changes, behavior fix only
Same `SelectProps` as before. Fixed: `value` now actually controls which option is selected on
initial render and on every re-render (previously always showed the first option). No caller
changes needed anywhere in the app.

### `shared/icons` (barrel: `~/shared/icons`) - additions
`SettingsIcon`, `SunIcon`, `MoonIcon`, `ExternalLinkIcon` (all `lucide-solid` re-exports, same
pattern as existing icons).

### i18n - new keys (both `en` + `mt`)
- `prefs.dark`, `prefs.settings` (new); `prefs.contrast` copy changed from "High-contrast" to
  "High contrast" (cosmetic, now used as a `Toggle` label rather than a segmented-button label).
- `admin.openPublicPage`.
- `admin.auditActionLabels.{campaignCreate,campaignUpdate,campaignDelete,userRoleChange,
  reconciliationRun,ledgerExportCsv,ledgerExportPdf,authLogin}` - friendly labels for each
  `AuditAction` raw code, keyed by camelCase (not the raw dotted action string) so the mapping in
  `AuditPage` is a fully-typed `Record<AuditAction, ...>`, same pattern as
  `ReconciliationPage`'s existing `tabLabelKey`.

No routes were added or removed in FE-2A (out of scope - this subtask only fixed/restyled existing
screens). No backend endpoints were touched or newly consumed; every change here is frontend-only.

## Files changed
- `project/frontend/src/shared/ui/chart/register.ts` - registers `LineController`/
  `BarController`/`DoughnutController` (the actual bug fix for #1).
- `project/frontend/src/shared/ui/chart/theme.ts` - **new**: `chartTheme()`, `hexToRgba()`.
- `project/frontend/src/shared/ui/chart/Chart.tsx` - reads `chartTheme()` reactively, sets
  `ChartJS.defaults` + per-axis grid/tick colours before each (re)build.
- `project/frontend/src/pages/admin/DashboardPage.tsx` - chart-data memos use `chartTheme()`
  instead of hardcoded hex colours.
- `project/frontend/src/shared/ui/select/Select.tsx` - `selected` set per-option (the fix for #2/#10).
- `project/frontend/src/pages/admin/CampaignsListPage.tsx` - external-link "open public page" row
  action.
- `project/frontend/src/pages/admin/CampaignDetailPage.tsx` - "open public page" pill next to the
  status badge.
- `project/frontend/src/shared/prefs/store.ts` - `theme`/`contrast` split, legacy migration,
  `prefers-color-scheme` default.
- `project/frontend/src/shared/prefs/PrefsControls.tsx` - `stacked` prop, dark theme toggle
  (sun/moon), high-contrast `Toggle`.
- `project/frontend/src/shared/prefs/PrefsPopover.tsx` - **new**: the fixed-width settings popover.
- `project/frontend/src/shared/prefs/index.ts` - exports `PrefsPopover` + `PrefsControlsProps`.
- `project/frontend/src/app/layouts/PublicLayout.tsx`, `DonorLayout.tsx` - `PrefsControls` ->
  `PrefsPopover`.
- `project/frontend/src/app/layouts/AdminLayout.tsx` - `<PrefsControls stacked />`.
- `project/frontend/src/index.css` - dark base palette, light-contrast/dark-contrast composed
  overrides, dark shadow tokens, updated header comment.
- `project/frontend/src/shared/icons/index.ts` - `SettingsIcon`, `SunIcon`, `MoonIcon`,
  `ExternalLinkIcon`.
- `project/frontend/src/pages/admin/AuditPage.tsx` - friendly action labels, fixed target-cell
  rendering.
- `project/frontend/src/shared/i18n/dictionaries/en.ts`, `mt.ts` - new keys (see Public interface)
  + em-dash sweep.
- 26 files across `frontend/src` swept for U+2013/U+2014 -> `-` (dictionaries, `ImpactPage`,
  `LedgerPage`, `ReconciliationPage`, `DashboardPage`, and comments in ~20 other files - see `git
  diff --stat` for the full list; every change outside the files listed above in this section is
  this dash-only sweep, no logic changes).

## How to verify
```
cd project/frontend
bun install
bun run format && bun run lint && bun run typecheck && bun run build   # all exit 0 (verified this session)
grep -rP '[\x{2013}\x{2014}]' src   # 0 hits (verified this session)
```
Manual/dev-server checks (not run this session - no backend dependency, but recommended for the
reviewer):
- `bun run dev`, open `/`, `/admin` (after logging in) - use the new settings popover (public/donor
  headers) and the sidebar's `PrefsControls` (admin) to cycle light/dark x on/off contrast x EN/MT
  x 100/112/125% - confirm no layout shift in the public/donor header at any combination, and that
  all 4 theme combos remain legible (focus rings, borders, `Toast`/`Modal`/`Banner`/`Badge`,
  `Skeleton` shimmer, chart gridlines/legend/dataset colours).
- `/admin` dashboard: confirm all 3 charts (line/bar/doughnut) render with no console
  "not a registered controller" error, and that switching theme rebuilds them with matching colours.
- `/admin/users`: confirm the role `<Select>` shows each user's actual current role, not always
  "viewer" (fixed by the `Select` change).
- `/admin/campaigns`: confirm the new external-link icon button opens `/c/:slug` in a new tab; same
  on `/admin/campaigns/:id`.
- `/admin/audit`: confirm action cells show a friendly label (with raw code as secondary text/
  `title`) and the target column shows `"type: id"` or `"-"`, never a bare `":"`.

## Notes / gotchas
- **Reused `chartTheme()` is a plain function, not a `createMemo`** - it's meant to be called
  directly inside another reactive scope (a `createEffect`/`createMemo`) so its `prefs.theme()`/
  `prefs.contrast()` reads register as dependencies of *that* scope. Calling it outside a reactive
  scope (e.g. in a module-level `const`) will not track theme changes - same gotcha class as the
  i18n `t()` function documented in the FE-1 artifact.
- **`Chart.tsx` sets `ChartJS.defaults` as a side effect of rendering any chart instance** - since
  Chart.js defaults are global (not per-instance), the *last* chart to render on a page "wins" the
  default colours for that page's paint cycle. This is harmless in practice (all charts on a page
  share the same theme at any given moment, so they all set the same defaults), but it's worth
  knowing if a future page renders charts is asynchronously staggered across very different
  effective palettes (doesn't happen anywhere in this app today).
- **`PrefsPopover` uses `pointerdown` (not `click`) for outside-close** - avoids a click-through
  race where clicking the trigger button itself would immediately re-close the panel it just
  opened (the document listener firing on the same event that opened it). `Escape` closes via a
  `keydown` listener on `document`, not scoped to the panel, so it works regardless of focus.
- **High contrast is now orthogonal to theme** - a user can have dark + high-contrast
  simultaneously, which run-1 couldn't express at all (`"contrast"` was a third theme value, always
  implying light-ish white surfaces). The `[data-theme="dark"][data-contrast="high"]` palette is a
  new design (pure black, not a straight run-1-contrast recolour) - flagging for design review if
  the studio wants to iterate on the exact hex values; the ratios are AAA-oriented but not
  formally computed/tested against WCAG here.
- **Legacy localStorage migration is read-only at boot, write-normalizing after** - the first
  `createEffect` run after load writes the *new* key format back to `localStorage`
  (`givetap:theme` becomes `"light"|"dark"` only), so the migration logic in
  `readInitialThemeAndContrast()` only ever needs to handle the one-time legacy shape; it's not
  something that needs to keep being re-checked on every load once a user has opened the app once
  post-upgrade.
- **No open questions for the orchestrator** - FE-2A's scope was entirely frontend-only per
  plan.md (explicitly "do NOT touch backend"), and everything in scope was achievable without any
  backend contract change. FE-2B's items (Discover progress consumption, export dialog, impact
  page, users-page role-guard UX, profile/settings) are unaffected by anything done here except
  that they should now build on `PrefsControls`/`PrefsPopover`/the new `prefs.contrast` signal
  rather than the old two-value `theme`.
