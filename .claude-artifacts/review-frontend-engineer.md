# review-frontend-engineer — FE-1 (round 2, post-fix)

verdict: pass

## Commands run (all green)
```
cd project/frontend
bun run format:check   # "All matched files use Prettier code style!"
bun run lint            # "Checked 53 files in 56ms. No fixes applied."
bun run typecheck       # tsc -p tsconfig.json && tsc -p tsconfig.node.json — no output, exit 0
bun run build           # vite build — 201 modules transformed, dist/ emitted, exit 0
```
Mechanical gate remains clean.

## Fail item from round 1 — verified fixed
```
grep -rn '\bt(' src --include="*.tsx" --include="*.ts" | grep -v "/i18n/"
```
Now returns 17 real call sites (previously 0):
- `AppLayout.tsx` — `t(item.labelKey)` for nav (`nav.home`/`nav.dashboard`), `t("nav.signOut")`.
- `PublicLayout.tsx` — `t("nav.dashboard")`.
- `PrefsControls.tsx` — `t("prefs.theme")`, `t("prefs.textSize")`, `t("prefs.language")`,
  `t(item.labelKey)` for theme options (`prefs.light`/`prefs.contrast`).
- `LoginPage.tsx` — `t("auth.genericError")`, `t("auth.createAccount")`, `t("nav.signIn")`,
  `t("auth.usernameLabel")`, `t("auth.passwordLabel")`, `t("nav.signUp")`,
  `t("auth.haveAccount")`, `t("auth.needAccount")`.

All keys referenced above exist in `en.ts`. Cross-checked against `mt.ts`:
- `nav.home`, `nav.dashboard`, `nav.signOut`, `nav.signIn`, `nav.signUp` — present in both `en`
  and `mt` (nav claimed fully translated — confirmed).
- `prefs.theme`, `prefs.light`, `prefs.contrast`, `prefs.textSize`, `prefs.language` — present in
  both `en` and `mt` (prefs claimed fully translated — confirmed).
- `auth.*` — `en` only, as the artifact documents ("not called out by the review, kept
  English-only"); no `mt` regression since nothing here was claimed translated.
- Numeric text-size labels (`100%`/`112%`/`125%`) and locale codes (`EN`/`MT`) remain literal in
  `PrefsControls.tsx` — this was an explicit carve-out in round 1's fix list, not a gap.

No stale/unused dictionary entries reintroduced; the `labelKey`-in-render-callback pattern
(avoiding the module-scope-freeze bug) is applied consistently in both `AppLayout` and
`PrefsControls`.

## Regression / scope check
- `ErrorState.tsx` `../button/Button` fix from round 1 still in place — untouched by this fix.
- No new routes, pages, or backend calls introduced by the i18n wiring — scope stayed exactly to
  the four named files (`AppLayout`, `PublicLayout`, `PrefsControls`, `LoginPage`) plus dictionary
  additions.
- `grep -rn "TODO|FIXME|console.log|debugger" src` — no hits.
- No secrets/hardcoded env introduced.

## Artifact check
`.claude-artifacts/frontend-engineer.md` documents the fix accurately: call-site count (17),
which files were touched, the `prefs.*`/`auth.*` dictionary additions, and the reactivity gotcha
that motivated the `labelKey` pattern. Public interface section for `shared/i18n` reflects the new
`prefs.*`/`auth.*` sections and matches the dictionaries read directly. `shared/ui`, `shared/prefs`
core exports, and `shared/lib/money` were spot-checked against round-1's byte-for-byte pass — no
changes since, still consistent.

## Conclusion
The single round-1 fail item (dictionary authored but never called) is now fixed with real,
verifiable call sites, correct key resolution in both locales for the claimed sections, and no
regressions elsewhere. FE-1 passes.
