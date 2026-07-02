# frontend-engineer — FE-1: design system & app shell

status: done
task: FE-1
depends_on_read: .claude-artifacts/plan.md, .claude-artifacts/findings.md, .claude/skills/frontend/SKILL.md, .claude/skills/frontend-design/SKILL.md, .task/GiveTap Kit.dc.html

## What was done

- Ported every token from `.task/GiveTap Kit.dc.html` (root div ~line 25 for light, the
  high-contrast block ~line 715–718 plus the colour-role section ~line 135–150 for contrast) into
  `src/index.css` as CSS custom properties, switched by `[data-theme="light"|"contrast"]` on
  `<html>`. Text scaling via `[data-textsize="100"|"112"|"125"]` sets the root font-size to
  16/18/20px so every `rem` in the app scales.
- Added a Tailwind v4 `@theme` block mapping tokens to utility names: colours
  (`bg-brand`, `text-fg-muted`, `bg-surface-raised`, …), radii reuse Tailwind's native
  `rounded-sm/md/lg/full` names, shadows as `shadow-e1/e2/e3`, fonts as `font-sans/display/mono`,
  and a small custom type scale (`text-display/h1/h2/h3/body/label/fs-sm/mono`) that deliberately
  avoids colliding with Tailwind's built-in `text-sm` etc. (kept those default utilities intact
  for anything not using the kit scale).
- `--brand`/`--brand-fg` default to GiveTap teal (`#0E8C7A`/`#fff`) and are ordinary CSS custom
  properties, not baked into `@theme` values directly by hex — so FE-2 can override them on any
  subtree via inline `style="--brand:#1E6FB8;--brand-fg:#fff"` (or a class) on the donor root,
  and every component that reads `bg-brand`/`text-brand` re-skins automatically.
  `prefers-reduced-motion: reduce` is respected globally (kills all animation/transition
  durations). Focus rings use `--focus` and are never suppressed (`:focus-visible` is a global
  base rule).
- Fonts: Geist / Geist Mono / Hanken Grotesk loaded via Google Fonts `<link>`s in `index.html`
  (matching the kit's `helmet` block), plus updated `<title>`/`theme-color`.
- `shared/prefs/` — `store.ts` holds three signals (`theme`, `textSize`, `locale`) inside a single
  `createRoot` (module-scoped singleton, same pattern as the auth store), persisted to
  `localStorage` under `givetap:theme|textsize|locale`, and reflected onto `<html>` attributes
  (+ `lang`) via `createEffect`. `PrefsControls.tsx` is the kit's segmented control-bar pattern
  (three `<fieldset>` groups — theme / text size / language) and is mounted in both
  `PublicLayout` and `AppLayout` so the toggles are reachable, not hidden settings.
- i18n: installed `@solid-primitives/i18n`. `shared/i18n/dictionaries/en.ts` is the full
  dictionary (`nav`, `donor`, `dashboard` sections); `mt.ts` is a deliberately partial subset
  (~30%, per the kit) of the same three sections. `context.ts` flattens both, merges `mt` over
  `en` (so missing Maltese keys fall back to English rather than rendering `undefined`), and
  exposes a single reactive `t()` built with `translator()` + `resolveTemplate()` keyed off the
  `prefs.locale()` signal — no React-style context needed since prefs is already a global store.
- Full UI kit built in `shared/ui/` per the kit's "Components" section (04), "Dashboard & charts"
  (05), "Data table" (06), "Reconciliation" (07), and "Donor flow" (10) references. Button was
  restyled onto tokens (kept its existing `variant`/`splitProps` shape, added `danger` variant,
  `size`, and `loading`). All new components are named exports, minimal typed props, no
  destructuring of `props` (per the Solid rules in the frontend skill).
- `shared/lib/money.ts`: `formatMoney` (`Intl.NumberFormat` + minor units), static
  `RATES_TO_EUR` (`{ EUR: 1, USD: 1.08, GBP: 0.85 }` — matches spec §7.3 exactly), `toEURMinor`,
  and a `tabularNumsClass` hook (`"font-mono tabular-nums"`) for money/reference display.
- Fixed a pre-existing scaffold bug while restyling: `shared/ui/error/ErrorState.tsx` imported
  `./Button` (a file that doesn't exist in `error/`) instead of `../button/Button` — this would
  have thrown at build/resolve time the moment anything exercised that path. Also swapped its
  `{props.reset && …}` for `<Show>` per the Solid rules.
- Updated `AppLayout`/`PublicLayout`/`App.tsx`/`HomePage`/`LoginPage`/`NotFoundPage`/
  `DashboardPage` to consume the new tokens and components (`PrefsControls` in both layout
  headers, `ToastViewport` mounted once in `App.tsx`, `LoginPage` now uses `Field`/`Input`/
  `Button loading`). This is a light-touch pass only — FE-2 rebuilds these pages properly; the
  goal here was "no visual regression + tokens actually wired," not final donor/admin UI.
- `biome.json`: enabled `css.parser.tailwindDirectives` (the `@theme` at-rule was otherwise a
  parse error) and turned off `complexity.noImportantStyles` (needed for the
  `prefers-reduced-motion` override, which must reverse the cascade by design).
- **Review fix (post-review-1)**: the first pass authored the `en`/`mt` dictionaries and `t()` but
  never called `t()` anywhere — `PrefsControls`, `AppLayout`'s nav/sign-out, `PublicLayout`'s
  "Dashboard →" link, and `LoginPage`'s copy were all hardcoded English, so switching locale had
  no visible effect. Fixed by wiring `t()` into all four; added a `prefs.*` dictionary section
  (`theme`/`light`/`contrast`/`textSize`/`language`, `en` full + `mt` translated — reviewer named
  `nav.*` and `prefs.*` explicitly) and an `auth.*` section (`en` only — login copy not called out
  by the review, kept English-only rather than half-translating) for `LoginPage`. One correctness
  gotcha caught while fixing: option arrays for `PrefsControls`/`AppLayout` are `const` at module
  scope, so resolving `t()` *there* would have frozen the label at whatever locale was active on
  first import — fixed by storing a `labelKey` in the array and calling `t(item.labelKey)` inside
  the `<For>` render callback (a JSX expression position), which Solid's compiler tracks reactively
  against `prefs.locale()`. Verified with
  `grep -rn '\bt(' src --include="*.tsx" --include="*.ts" | grep -v "/i18n/"` — now has 17 call
  sites across `AppLayout`, `PublicLayout`, `LoginPage`, and `PrefsControls` (previously 0).

## Public interface

### Token / theme contract (consumed by every future page)
- `<html data-theme="light" | "contrast">` — toggles the full palette (surface/border/fg/brand/
  accent/positive/warning/danger/live/focus). Default `light`.
- `<html data-textsize="100" | "112" | "125">` — root font-size 16/18/20px. Default `100`.
  Everything else must stay in `rem` to scale with it.
- `<html lang="en" | "mt">` — kept in sync with `prefs.locale()`.
- Per-subtree brand override: set `--brand` / `--brand-fg` (hex) via inline `style` or a class on
  any ancestor element — every `bg-brand`/`text-brand`/`border-brand` utility below it re-skins.
  Donor pages (FE-2) should set this on their root using the campaign's brand colour.
- Tailwind utility → token map: `bg-surface`, `bg-surface-raised`, `bg-surface-sunken`,
  `border-border`, `border-border-strong`, `text-fg`, `text-fg-muted`, `bg-brand`/`text-brand`,
  `text-brand-fg`/`bg-brand-fg`, `text-accent`, `text-positive`/`bg-positive`,
  `text-warning`/`bg-warning`, `text-danger`/`bg-danger`, `bg-live`, `ring-focus`/`border-focus`.
  Radius: `rounded-sm|md|lg|full` (native Tailwind names, values overridden). Shadow:
  `shadow-e1|e2|e3`. Font: `font-sans` (Hanken Grotesk), `font-display` (Geist),
  `font-mono` (Geist Mono). Type scale: `text-display|h1|h2|h3|body|label|fs-sm|mono` (note:
  kit's "sm" is `text-fs-sm`, not Tailwind's default `text-sm`, to avoid clobbering the default
  scale's line-heights).
- Global CSS classes: `.gt-skeleton` (shimmer background, used by `Skeleton`), `.sr-only` (Tailwind
  built-in, used by `PrefsControls`' `<legend>`s). Keyframes `gt-pulse` (StatCard live dot) and
  `gt-shimmer` are defined once in `index.css`.

### `shared/prefs` (barrel: `~/shared/prefs`)
- `prefs: { theme: Accessor<"light"|"contrast">; textSize: Accessor<"100"|"112"|"125">; locale: Accessor<"en"|"mt"> }`
- `setPrefs: { setTheme(v); setTextSize(v); setLocale(v) }` — each persists to `localStorage` and
  updates the matching `<html>` attribute (and `lang` for locale) via an internal effect.
- `PrefsControls: Component<{ class?: string }>` — renders the three segmented `<fieldset>` groups.
- Types: `Theme`, `TextSize`, `Locale`.

### `shared/i18n` (barrel: `~/shared/i18n`)
- `t: Translator<Flatten<typeof en>>` — call as `t("nav.home")`, `t("donor.give", { amount: "€25" })`
  for template keys (`{{amount}}` placeholders resolved via `resolveTemplate`). Reactive: re-runs
  whenever `prefs.locale()` changes. `mt` keys not present fall back to the `en` value at merge
  time, so `t(...)` never returns `undefined`.
- Dictionary sections so far: `nav.*` (home, dashboard, campaigns, ledger, reconcile, auditLog,
  users, signIn, signOut, signUp — `mt` translates all of these), `donor.*` (full give-flow copy,
  `mt` partial), `dashboard.*` (stat labels, `mt` partial), `prefs.*` (theme/light/contrast/
  textSize/language — `mt` full), `auth.*` (login-page copy — `en` only, not yet in `mt`). FE-2
  should add new keys to `en.ts` first; only mirror the subset that matters to `mt.ts`.
- **Reactivity gotcha**: `t()` reads the `prefs.locale()` signal, so it only re-resolves when
  called from inside a reactive scope (a JSX expression, `createMemo`, etc.). Don't resolve `t()`
  once into a plain `const` array/object at module scope and reuse that value in JSX — it'll
  freeze at the locale active on first import. Store a key (e.g. `labelKey: "nav.home"`) in the
  static array/config and call `t(item.labelKey)` inside the render callback instead (see
  `AppLayout`'s `navItems` or `PrefsControls`' `themeOptions` for the pattern).

### `shared/lib/money.ts`
- `type CurrencyCode = "EUR" | "USD" | "GBP"`
- `RATES_TO_EUR: Record<CurrencyCode, number>` = `{ EUR: 1, USD: 1.08, GBP: 0.85 }` (static, per
  spec §7.3 — matches BE-1's expected rates exactly).
- `formatMoney(minorUnits: number, currency: CurrencyCode, locale = "en"): string` —
  `Intl.NumberFormat(locale, { style: "currency", currency }).format(minorUnits / 100)`.
- `toEURMinor(minorUnits: number, currency: CurrencyCode): number` — EUR-equivalent minor units
  (`Math.round(minorUnits / RATES_TO_EUR[currency])`).
- `tabularNumsClass = "font-mono tabular-nums"` — apply to any money/reference display.

### `shared/ui` (barrel: `~/shared/ui`) — every exported component + props
- `Button({ variant?: "primary"|"secondary"|"ghost"|"danger", size?: "sm"|"md"|"lg", loading?: boolean, ...ButtonHTMLAttributes })`
- `Spinner({ class? })`
- `ErrorState({ error: unknown, reset?: () => void })`
- `Card({ padding?: "none"|"sm"|"md"|"lg", ...HTMLAttributes<div> })`
- `StatCard({ label: string, value: JSX.Element, hint?: string, live?: boolean, class? })` — `live`
  shows the kit's pulsing dot (`gt-pulse` keyframe).
- `Field({ label?, hint?, error?, required?, class?, children })` — label/hint/error wrapper;
  wraps `children` in a native `<label>` (works with `Input`/`Select`/`Toggle`/`Checkbox`).
- `Input({ invalid?: boolean, ...InputHTMLAttributes })`
- `Select({ options: { value, label }[], invalid?: boolean, ...SelectHTMLAttributes (minus children) })`
- `Toggle({ checked: boolean, onChange: (v: boolean) => void, label?, disabled?, class? })`
- `Checkbox({ checked: boolean, onChange: (v: boolean) => void, label?, disabled?, class? })`
- `Badge({ variant?: "positive"|"warning"|"danger"|"neutral", icon?: boolean, class?, children })`
  — icon defaults on for positive/warning/danger (status = icon + label, never colour alone).
- `Tabs({ items: { value, label }[], value: string, onChange: (v: string) => void, class? })`
- `ProgressBar({ value: number /* 0–100 */, class? })`
- `showToast(message: string, variant?: "default"|"success"|"warning"|"danger", durationMs = 4000)`
  + `ToastViewport` (mount once — already mounted in `App.tsx`).
- `Banner({ variant?: "warning"|"danger"|"neutral", class?, children })`
- `EmptyState({ title: string, description?: string, action?: JSX.Element, class? })`
- `Skeleton({ variant?: "text"|"circle"|"block", class? })`
- `Modal({ open: boolean, onClose: () => void, title?: string, class?, children })` — backdrop
  click and Escape both close; portal-rendered.
- `ConfirmDialog({ open, title, description?, confirmLabel?, danger?, busy?, onConfirm, onCancel })`
- `Stepper({ steps: string[], current: number /* 0-based */, class? })`
- Types re-exported: `ButtonProps`, `CardProps`, `StatCardProps`, `FieldProps`, `InputProps`,
  `SelectOption`/`SelectProps`, `ToggleProps`, `CheckboxProps`, `BadgeProps`/`BadgeVariant`,
  `TabItem`/`TabsProps`, `ProgressBarProps`, `ToastVariant`, `BannerProps`, `EmptyStateProps`,
  `SkeletonProps`, `ModalProps`, `ConfirmDialogProps`, `StepperProps`.

No new routes were added in FE-1 (out of scope per plan.md — pages/routes come in FE-2). Existing
routes (`/`, `/login`, `/app/dashboard`, `*404`) are unchanged and consume no backend endpoints
(HomePage/DashboardPage/LoginPage/NotFoundPage only touch `useAuth`, same as before).

## Files changed
- `project/frontend/index.html` — Google Fonts links, title, theme-color.
- `project/frontend/src/index.css` — full token set (light + contrast), `@theme` mapping,
  keyframes, `.gt-skeleton`, focus-visible, reduced-motion.
- `project/frontend/src/shared/prefs/store.ts` — theme/textSize/locale signals + persistence.
- `project/frontend/src/shared/prefs/PrefsControls.tsx` — segmented control-bar component.
- `project/frontend/src/shared/prefs/index.ts` — barrel.
- `project/frontend/src/shared/i18n/dictionaries/en.ts` — full English dictionary (+ `prefs.*`,
  `auth.*` sections added in the review fix).
- `project/frontend/src/shared/i18n/dictionaries/mt.ts` — partial Maltese dictionary (+ `prefs.*`
  fully translated in the review fix).
- `project/frontend/src/shared/i18n/context.ts` — reactive `t()` translator.
- `project/frontend/src/shared/i18n/index.ts` — barrel.
- `project/frontend/src/shared/lib/money.ts` — currency/money helpers.
- `project/frontend/src/shared/icons/index.ts` — added Check/X/AlertTriangle/AlertCircle/
  XCircle/ChevronDown/Left/Right/Search/Info/Plus/Circle icon re-exports.
- `project/frontend/src/shared/ui/button/Button.tsx` — restyled onto tokens, added danger
  variant, size, loading.
- `project/frontend/src/shared/ui/loading/Spinner.tsx`, `.../error/ErrorState.tsx` — restyled
  onto tokens; fixed the `./Button` → `../button/Button` import bug in `ErrorState`.
- `project/frontend/src/shared/ui/{card,stat-card,field,input,select,toggle,checkbox,badge,
  tabs,progress,toast,banner,empty-state,skeleton,modal,stepper}/*` — new components (listed
  above under Public interface).
- `project/frontend/src/shared/ui/index.ts` — barrel with every export above.
- `project/frontend/src/app/App.tsx` — mounts `<ToastViewport />`.
- `project/frontend/src/app/layouts/{AppLayout,PublicLayout}.tsx` — token classes + mounted
  `PrefsControls`; nav labels/sign-out/"Dashboard →" now go through `t()` (review fix).
- `project/frontend/src/shared/prefs/PrefsControls.tsx` — legends/labels now go through `t()`
  (review fix; theme/text-size numeric labels stay literal per the review's own carve-out).
- `project/frontend/src/pages/{HomePage,LoginPage,NotFoundPage,dashboard/DashboardPage}.tsx` —
  light-touch restyle onto tokens; `LoginPage` now uses `Field`/`Input`/`Button loading` and its
  copy goes through `t()` (review fix).
- `project/frontend/biome.json` — `css.parser.tailwindDirectives: true`,
  `complexity.noImportantStyles: "off"`.
- `project/frontend/package.json` / `bun.lock` — added `@solid-primitives/i18n`.

## How to verify
```
cd project/frontend
bun install
bun run format && bun run lint && bun run typecheck && bun run build
```
Expected: all four commands exit 0 (format reports files as already formatted on a second run;
lint reports "Checked N files … No fixes applied" with no errors; typecheck prints nothing;
build emits `dist/` with an `index-*.css` that contains the token values, e.g.
`grep -c 0e8c7a dist/assets/*.css` → 1).

Manual check (dev server): `bun run dev`, open the app, use the theme/text-size/language
segmented controls in the header — theme switches instantly (surface/border/fg swap to the
high-contrast set), text size changes the root font-size (rem-based layout grows), and both
persist across a reload (`localStorage` keys `givetap:theme`/`givetap:textsize`/`givetap:locale`).

## Notes / gotchas
- **Tailwind v4 `@theme` + Biome**: the CSS parser needs `tailwindDirectives: true` in
  `biome.json`'s `css.parser`, or `@theme { … }` is a parse error. Already set — if a future
  `biome.json` rewrite drops it, `@theme` will start failing lint again.
- **Type-scale name collision avoided on purpose**: the kit's `--fs-sm` (0.8125rem) is exposed as
  Tailwind's `text-fs-sm`, *not* `text-sm` — overriding Tailwind's built-in `sm` key would have
  dropped its paired line-height for every other use of `text-sm` in the app. Use `text-fs-sm`
  when you specifically want the kit's small size; `text-sm` still works as vanilla Tailwind.
- **Brand override is a plain CSS custom property, not a Tailwind theme value** — set it with
  inline `style` (or a scoped class) on a subtree root, e.g.
  `<div style={{ "--brand": "#1E6FB8", "--brand-fg": "#fff" }}>`. Every `bg-brand`/`text-brand`
  utility beneath it will pick up the override because `@theme`'s `--color-brand` is itself just
  `var(--brand)`.
- **i18n has no `<I18nProvider>`** — `t` is a plain reactive export off the global `prefs` store
  (consistent with how `prefs` itself has no context/provider). If FE-2 needs per-request/test
  isolation of locale state, that would require introducing `@solid-primitives/i18n`'s context
  API instead; flagging as a possible future refactor, not needed for this build.
- **`Field` wraps children in `<label>`** with a lint suppression
  (`noLabelWithoutControl`) since Biome can't see that `children` will eventually contain a form
  control — this is intentional and safe (native label-wraps-control is a valid a11y pattern),
  but don't wrap non-form content in `Field`.
- **Fixed pre-existing bug**: `ErrorState.tsx`'s `import { Button } from "./Button"` pointed at a
  non-existent file (`shared/ui/error/Button.tsx`). Not introduced by FE-1, but must be verified
  fixed (`../button/Button`) since it would have broken the first render of any error boundary.
- **No demo/storybook route** — per plan.md, components are proven directly in FE-2's donor/admin
  pages, not a dedicated kit page.
- **Open question for the orchestrator**: none — FE-1 needed no backend data, so there's nothing
  to route back to backend-engineer.

---

# frontend-engineer — FE-2: donor app + admin console

status: done
task: FE-2
depends_on_read: .claude-artifacts/plan.md, .claude-artifacts/findings.md, .claude-artifacts/backend-engineer.md, .claude-artifacts/frontend-engineer.md (own FE-1 section above), .task/GiveTap Kit.dc.html

## What was done

- **API layer** (`shared/api/`): `client.ts` now parses the real nested envelope
  (`{ error: { code, message, details? } }`) instead of a flat `message`, and unwraps
  `{ data }` on success so every caller works with the payload directly. Added `api.patch`
  (needed for `PATCH /api/admin/users/:id/role`) and `apiErrorCode(err)` (reads `error.code`
  off a caught `ApiError`, used to branch on `PAYMENT_DECLINED`/`CONFLICT`). `types.ts` mirrors
  every DTO in the backend artifact (`CampaignPublic/Admin/WithProgress`, `Donation*`,
  `DashboardStats`, `ReconciliationResult`, `AuditLog`, `AdminUser`, `CurrencyConfig`,
  `DonationCreatedEvent`, plus the `Paged<T>` envelope). `endpoints.ts` is one function per
  backend route (public + `/admin/*`), grouped by resource; `ledgerExportUrl()` builds the
  CSV export link (a plain `<a href>`, not fetched — the browser handles the download/
  `Content-Disposition`). All re-exported through a new `shared/api/index.ts` barrel.
- **Auth/roles**: `authClient` gained `adminClient()` (alongside the existing
  `usernameClient()`) so the session's `user` carries a typed `role`. `useAuth()` exposes
  `role: () => UserRole | undefined`. `RequireAuth` gained a `redirectTo` prop (the donor
  app never touches auth; the admin console redirects to `/admin/login`, not the unused
  `/login`). Added `RequireRole` (nests inside `RequireAuth` — renders an in-app `ErrorState`
  rather than redirecting, since the user *is* signed in, just lacks the role) and
  `shared/auth/permissions.ts` (`can.{createCampaign,updateCampaign,deleteCampaign,
  exportLedger,runReconciliation,manageUsers}`) — a client-side mirror of the backend's RBAC
  table used only to hide/disable controls; the server's `permissions` macro is the actual
  enforcement (verified live — see "How to verify").
- **New deps**: `chart.js`, `@tanstack/solid-table`, `jspdf`, `jspdf-autotable`.
- **Chart wrapper** (`shared/ui/chart/`): `register.ts` calls `Chart.register(...)` on only
  the controllers/elements actually used (`CategoryScale, LinearScale, PointElement,
  LineElement, BarElement, ArcElement, Tooltip, Filler`) — not `chart.js/auto`. `Chart.tsx` is
  a thin canvas component: one `createEffect` reads `props.data/type/options`, destroys the
  previous instance and rebuilds (so a new data reference re-renders), `onCleanup` destroys on
  unmount, and `animation: false` is forced when `prefers-reduced-motion: reduce` matches.
  Exported through the `shared/ui` barrel like every other kit component.
- **SSE consumer** (`shared/lib/useSSE.ts`): `createDonationEvents(onEvent)` opens
  `new EventSource(`${apiBaseUrl}/api/admin/events`, { withCredentials: true })`, listens for
  `donation.created`, and auto-reconnects 3s after any `onerror` (browser already retries article
  `EventSource` natively, but this adds a visible `connected` signal for the dashboard's live-pulse
  indicator and survives the connection being killed server-side). Cleaned up via `onCleanup`.
- **Money/colour helpers**: `shared/lib/money.ts` gained `convertMinor(minor, from, to)`
  (bridges through EUR, mirrors the backend's `convertMinor` — used for the donor currency
  switcher and campaign progress bars). New `shared/lib/color.ts::readableForeground(hex)`
  (luminance heuristic) picks black/white `--brand-fg` for the donor brand-injection root so
  arbitrary campaign brand colours stay readable.
- **Donor surface** (`app/donor/` + `pages/donor/`): `DonorCampaignContext` fetches the
  `:slug` campaign once per `/c/:slug/*` sub-tree and shares it (+ a selected display
  `CurrencyCode` signal, defaulted to the campaign's own currency on first load) with
  landing/give/thanks via context — avoids re-fetching the same campaign three times.
  `DonorLayout` (router layout for `/c/:slug/*`) sets `--brand`/`--brand-fg` on its root from
  `campaign.brandColor` + `readableForeground`, and renders the donor top bar (logo, currency
  select, `PrefsControls` for language/text-size/contrast — all ≥44px touch targets).
  `GiveFlow` (shared component, used by both `/c/:slug/give` and the kiosk) is the 3-step
  `Stepper` (amount+frequency → mock card → review): preset amounts are converted from the
  campaign's currency into the selected display currency via `convertMinor`; the review step
  calls `createDonation` and branches on `apiErrorCode(err) === "PAYMENT_DECLINED"` (shows the
  decline banner + "try another card" back-nav, nothing charged) vs `ApiError.status === 0`
  (network banner) vs anything else (generic banner) — all recoverable, no dead-end. Pages:
  `CampaignLandingPage` (hero, description/story, progress bar in the selected currency, Donate
  CTA), `GivePage` (wraps `GiveFlow`, navigates to `/c/:slug/thanks/:reference` on success),
  `ThanksPage` (receipt fetched by reference, jsPDF download, Web Share API with a
  clipboard-copy fallback, "make it monthly" — S1.1 — re-submits the same amount/currency as a
  `monthly` donation), `KioskPage` (standalone, **not** wrapped in `DonorLayout` — no
  currency/language chrome per the kit's locked-kiosk brief; `start → give → thanks` phase
  machine, `source: "kiosk"`, `big` prop on `GiveFlow` for oversized ≥52px/64px targets,
  6-second `setTimeout` auto-reset back to `start` after a completed gift), `DiscoverPage`
  (client-side search/filter over `GET /api/campaigns`, cause/name/description match — S1.3).
- **Admin surface** (`app/layouts/AdminLayout.tsx` + `pages/admin/`): sidebar layout wrapped
  in `RequireAuth redirectTo="/admin/login"`; nav items conditionally shown via `can.*`
  (`/admin/users` hidden from non-admins in the sidebar *and* the route itself is wrapped in
  `RequireRole roles={["admin"]}` in `routes.tsx` for direct-URL access). `AdminLoginPage`
  (kit auth-screen style, username+password only, demo credentials hint).
  `DashboardPage`: stat cards (EUR-equivalent total, donation count, avg gift, active
  campaigns with the live-pulse `StatCard`), a `Chart` line for the 90-day trend, bar for
  top-campaigns-by-EUR, doughnut for by-currency split, and a recent-donations feed that
  merges live SSE events (deduped by reference, prepended) with the server's `recentDonations`
  — `createDonationEvents` also triggers a `refetch()` of the whole dashboard resource so the
  stat cards/charts update, not just the feed (C3.1). `CampaignsListPage`/`CampaignFormPage`
  (shared for new+edit)/`CampaignDetailPage`: full CRUD, brand-colour picker, comma-separated
  presets editor (major units in the UI, converted to `presetsMinor` on submit), frequency
  checkboxes, delete gated `can.deleteCampaign` + `ConfirmDialog`, and a `CONFLICT`
  (`apiErrorCode(err) === "CONFLICT"`) catch on delete that toasts the "archive instead"
  guidance from the backend artifact's Notes rather than a generic error. `LedgerPage`:
  `@tanstack/solid-table` (`createSolidTable` + `flexRender`, manual/server-side
  sort+pagination bridged to the `?sort&dir&page&pageSize` query params) with campaign/
  currency/status/source/date-range/search filters; CSV export is a plain link to
  `ledgerExportUrl()` (server streams + audits `ledger.export.csv` itself); PDF export builds
  from the currently-loaded page's rows via `jspdf` + `jspdf-autotable`, then
  `POST /api/admin/audit/client-event` with `action: "ledger.export.pdf"` (best-effort — a
  failed audit write doesn't block the download the user already received).
  `ReconciliationPage`: summary stat cards + `Tabs` (all/matched/mismatched/
  missingInProcessor/missingInApp) with a drill-in table showing both `donation` and
  `settlement` sides per `paymentRef`; client-side sorted by `paymentRef` within a tab per the
  backend artifact's "rows are unsorted" note. `AuditPage`: action-filtered table.
  `UsersPage`: role badges + a `Select` to `PATCH` a user's role (admin-only route).
  `ImpactPage`: the required **S1.2 static mockup** — a clearly-labelled "preview" badge,
  static stat cards, no live data, no API calls.
- **i18n**: `en.ts` extended with `donor.*` (full give-flow + kiosk + discover copy),
  `dashboard.*`, `admin.*` (every admin-surface label), and `common.*` sections; `mt.ts`
  extended with a coherent partial subset (nav, core donor-flow labels, a few dashboard/admin
  labels) — same "missing key falls back to `en`" merge behaviour as FE-1, verified by
  switching locale on the donor flow and admin sidebar.
- **Routing** (`app/routes.tsx`): replaced the FE-1 placeholder `/app/dashboard` demo route
  entirely (deleted `AppLayout.tsx`, `pages/dashboard/DashboardPage.tsx`, `pages/LoginPage.tsx`
  — the generic sign-up-capable `/login` was superseded by `/admin/login`, which is the only
  auth entry point FE-2 needed). `HomePage`/`PublicLayout` now link to `/discover` and
  `/admin/login` instead of the removed demo dashboard.
- **A11y/responsive**: donor touch targets are ≥44px (`min-h-[44px]`/`min-h-[52px]`) and
  ≥52–64px on the kiosk (`big` prop); status is always icon+label via the existing `Badge`
  component (reconciliation/ledger/campaign status badges); focus rings and reduced-motion are
  inherited from FE-1's global CSS (untouched); layouts use Tailwind's responsive prefixes
  (`sm:`/`lg:`) for the donor card grid, admin table overflow-x, and stat-card grid columns.

## Public interface (routes + endpoints consumed)

**Donor** (public, no auth):
- `/discover` → `GET /api/campaigns`
- `/c/:slug` → `GET /api/campaigns/:slug`
- `/c/:slug/give` → `GET /api/campaigns/:slug` (via context) + `POST /api/campaigns/:slug/donations`
- `/c/:slug/thanks/:reference` → `GET /api/campaigns/:slug/donations/:reference` +
  `POST /api/campaigns/:slug/donations` (make-it-monthly)
- `/kiosk/:slug` → `GET /api/campaigns/:slug` + `POST /api/campaigns/:slug/donations`

**Admin** (session + permission-gated server-side; `/admin/login` is public):
- `/admin/login` → Better Auth `signIn.username`
- `/admin` → `GET /api/admin/dashboard`, `GET /api/admin/events` (SSE)
- `/admin/campaigns` → `GET /api/admin/campaigns`, `DELETE /api/admin/campaigns/:id`
- `/admin/campaigns/new`, `/admin/campaigns/:id/edit` → `GET/POST/PUT /api/admin/campaigns[/:id]`
- `/admin/campaigns/:id` → `GET /api/admin/campaigns/:id`
- `/admin/ledger` → `GET /api/admin/donations`, `GET /api/admin/donations/export.csv` (link),
  `POST /api/admin/audit/client-event`
- `/admin/reconciliation` → `GET /api/admin/reconciliation`
- `/admin/audit` → `GET /api/admin/audit`
- `/admin/users` (admin-only, `RequireRole`) → `GET /api/admin/users`, `PATCH /api/admin/users/:id/role`
- `/admin/impact` → static, no endpoints (S1.2 mockup)

## Components added/changed
- New: `shared/ui/chart/{Chart.tsx,register.ts}` (barrel: `Chart`, `ChartProps`).
- New: `shared/lib/{useSSE.ts,color.ts}`; `shared/lib/money.ts` gained `convertMinor`.
- New: `shared/auth/permissions.ts` (`can`); `RequireAuth` gained `redirectTo`; new `RequireRole`.
- New: `shared/api/{endpoints.ts,index.ts}`; `client.ts`/`types.ts` rewritten per above.
- New: `app/donor/{DonorCampaignContext.tsx,GiveFlow.tsx}`; `app/layouts/{DonorLayout.tsx,AdminLayout.tsx}`.
- New pages: `pages/donor/{DiscoverPage,CampaignLandingPage,GivePage,ThanksPage,KioskPage}.tsx`;
  `pages/admin/{AdminLoginPage,DashboardPage,CampaignsListPage,CampaignFormPage,
  CampaignDetailPage,LedgerPage,ReconciliationPage,AuditPage,UsersPage,ImpactPage}.tsx`.
- Removed (superseded by the above): `app/layouts/AppLayout.tsx`, `pages/dashboard/
  DashboardPage.tsx`, `pages/LoginPage.tsx`.
- Changed: `HomePage.tsx`, `PublicLayout.tsx` (links updated), `app/routes.tsx` (full rewrite),
  `shared/i18n/dictionaries/{en,mt}.ts` (extended, FE-1's keys untouched).

## How to verify
```
# two terminals
cd project/backend && bun run dev     # :3001, seeded (viewer/manager/admin, demo1234)
cd project/frontend && bun run dev    # :3000

cd project/frontend
bun run format && bun run lint && bun run typecheck && bun run build   # all exit 0
```
Manual/scripted checks performed this session (documented so they're reproducible):
- Donor happy path: `POST /api/campaigns/global-relief/donations` with a normal last4 → `200`,
  receipt fetchable by reference with the exact shape `ThanksPage` expects (`campaignName`/
  `campaignSlug` included).
- Donor decline path: same route with `card.last4: "0002"` → `402 PAYMENT_DECLINED`, matches
  `GiveFlow`'s `apiErrorCode(err) === "PAYMENT_DECLINED"` branch.
- Role differences: signed in as `viewer`/`manager`/`admin` via cookie jars — `viewer` POST
  `/api/admin/campaigns` → `403` (matches `can.createCampaign` hiding the button), `manager`
  same → `200`; `viewer` GET `/api/admin/users` → `403`, `admin` → `200` (matches
  `RequireRole` gating `/admin/users`).
  `DELETE /api/admin/campaigns/:id` on the test campaign created above → `200` (cleaned up).
- Live dashboard: opened an SSE connection to `/api/admin/events`, POSTed a donation
  concurrently, got exactly one `donation.created` frame with the shape `DonationCreatedEvent`
  expects — `DashboardPage`'s `createDonationEvents` consumes this identically and also
  triggers `refetch()`.
- Exports: `GET /api/admin/donations/export.csv` → `200`,
  `Content-Disposition: attachment; filename="donations-export.csv"`, non-empty body (263
  lines on the seeded DB) — matches `ledgerExportUrl()`'s link target. PDF export path
  (`jspdf`+`jspdf-autotable`+`recordClientEvent`) exercised via `bun run build` (no runtime
  errors in the bundle) and code review against the backend's
  `POST /api/admin/audit/client-event` contract (`{ action: "ledger.export.pdf", metadata? }`).
- After manual curl verification, reset the dev DB to the clean seed baseline
  (`rm data/local.db*` + `bun run db:migrate` + `bun run db:seed` in `project/backend`) so the
  next agent/reviewer sees the documented fresh-seed counts
  (`matched:237,mismatched:3,missingInProcessor:3,missingInApp:3` — the 237 vs BE-1's
  documented 235 reflects the two extra completed test donations made during this
  verification pass before the reset; post-reset the DB matches BE-1's baseline exactly).
- `bun run format && bun run lint && bun run typecheck && bun run build` — all exit 0
  (verified twice, before and after the manual curl pass, both clean).

## Notes / gotchas
- **Kiosk is intentionally not nested under `DonorLayout`** — the kit's locked-kiosk brief has
  no currency/language chrome, and sharing the layout would have pulled those controls in.
  `KioskPage` fetches its own campaign and manages its own brand-injection + phase machine.
- **`GiveFlow`'s card input never actually validates a real card** — it's the spec's simulated
  processor; only the last 4 digits matter (`0002` → deterministic decline). The UI hints this
  in the card field's `hint` text.
- **`make-it-monthly` on the receipt page re-submits with a hardcoded `card: { last4: "4242" }`**
  since the backend doesn't persist/return card details on the original donation (correctly —
  it's not stored) and there's no real saved-card concept in this prototype. Flagged as a
  known simplification, not a gap against the spec (spec only requires the action to exist —
  S1.1).
- **Ledger sort/pagination is fully server-side** (`?sort&dir&page&pageSize`) — the TanStack
  table instance only renders `getCoreRowModel()`; sorting/pagination state lives in plain
  signals that feed the query, not TanStack's built-in sorting/pagination row models, since the
  backend is the source of truth for both.
- **No open questions for the orchestrator** — the backend artifact's contract was sufficient
  for every screen in scope; no route was missing or shaped differently than needed.
