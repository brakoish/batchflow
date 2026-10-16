# Design audit repairs — 2026-10-16

Base: `70828b2c23e457ec0e6a6a61805f512db6bdc232`, freshly cloned into `/tmp/batchflow-design-repairs-20261016`. Original contaminated product workspace untouched. Three disjoint implementation tracks integrated and reviewed. No new dependencies, API/auth logic changes, schema changes, migrations or production-record writes. PIN files changed only accessible names/status presentation.

## Verification

- Production build passes with temporary `experimental.cpus: 2`; build-only config restored before commit. Generated PWA files excluded from commits.
- TypeScript passes. Node test suite: 47 tests pass, including compiled CSS/layer tests, real contrast calculations, executable recipe validation cases, stock sequence and finished-unit fixtures, and query-isolation rules. Source-contract tests are not claimed as browser tests.
- Actual Chromium rendered CSS regression: `scripts/design-harness.cjs` compiles current real globals.css through Tailwind/PostCSS. `scripts/design-render.cjs` verifies eight combinations (manual light/dark × OS light/dark × 390/1440px), selected/unselected Open/priority/deadline/worker colors, selected hover, utility sizing/alignment, disabled opacity, manual theme independence and exactly one visible Create Batch CTA. Screenshots and computed JSON preserved alongside this report in the operator workspace `media/audits/2026-10-16/rendered/`. Anonymous synthetic markup, not authenticated route certification. UTF-8 screenshots visually inspected.
- `scripts/design-dialog-fixture.tsx` bundles the actual shared useDialogFocus hook. Chromium keyboard test passes initial focus, Tab/reverse trap, nested Escape affecting only top dialog, trigger focus restoration, background inertness and scroll-lock cleanup.
- `git diff --check` passes. Reviewed changes preserve inventory/progress ledger records and server authorization. Canonical produced totals use final non-skipped converted COUNT output; no fabricated production.

## Per-finding disposition

“Fixed” means implementation and listed bounded verification complete, not universal device/accessibility sign-off. “Partial” identifies remaining acceptance or deliberately limited coverage.

| ID | Result | Repair / evidence / remaining boundary |
|---|---|---|
| D01 | Fixed | Complete shared button family in components layer; semantic pressed/selected styling, hover/disabled, meaningful New Batch checkmarks; real computed-style matrix and one responsive CTA pass. |
| D02 | Fixed | Active owner/supervisor detail exposes Finish even at 60/100; report states actual/target/short, keeps target/work unchanged. Existing material reconciliation/server guards retained. Authenticated submit test pending authorized fixture account. |
| D03 | Fixed | Open header uses same canonical producedBaseUnits as inventory. Leading ENTRY/CHECK/upstream/skipped/converted COUNT fixture passes. |
| D04 | Fixed | Query-bound hours results and request generations suppress stale totals; panel errors/retries; no zero-state for failed reads. Rule tests pass; full mocked authenticated transport acceptance pending. |
| D05 | Fixed | Shared stack-aware stable modal hook, inert/scroll lock/focus restoration; wired active operational sheets and ConfirmModal. Actual hook nested keyboard fixture passes; individual authenticated sheets need account. |
| D06 | Partial | Persistent associated native labels across principal setup/editor forms; operational edit/count/date fields named. Some grouped controls retain group headings/aria names rather than every field hint/error linkage. Exhaustive accessibility-tree route census pending authorized account. |
| D07 | Fixed | Search container keeps results during keyboard traversal; Arrow navigation, Escape and native Enter; blur timeout removed. Source contract verified; live search network fixture acceptance pending. |
| D08 | Fixed | Class-based Tailwind dark variant; all eight rendered manual/OS combinations agree. |
| D09 | Fixed | Contrast-safe success/destructive tokens and success button; independent WCAG calculations pass both themes. Existing assorted hardcoded status utilities not blanket redesigned. |
| D10 | Fixed | Historically batched zero-stock items stay recountable; physical correction retains separately labelled historical batch links. Sum ledger deltas before one clamp; 10→8→0→5 fixture passes. Never-batched catalog items are not stock records. |
| D11 | Partial | Broad pressed/disclosure semantics, meaningful operational/icon names, alerts/status; Hours uses ordinary valid toggle group. Recipe reorder names and PIN presentation improved. Universal screen-reader/tree certification remains pending. |
| D12 | Fixed | Shared disabled selector state, whole New/Manage/recipe mutable fieldsets, team/announcement/log draft locks; typed feedback. Delayed-response device acceptance pending. |
| D13 | Fixed | Team error inside editor; recipe readiness and submit share exact rules. Executable blank-step/brand/ratio/weight validation cases pass. |
| D14 | Fixed | Counts reflect current filters; recovery links/clear actions; explicit Newest comparator; global chosen sort no longer overridden by brand regrouping/activity. Source regressions pass. |
| D15 | Fixed | CHECK summary actually completes; quantity presets fill draft and require final Log, retain note; one custom keypad (`inputMode=none`), locked during save. Real phone keyboard fit pending. |
| D16 | Partial | Shift checking/error/retry and shared update subscriptions, elapsed reset, My Day organization-zone dates/times and failed-total suppression. Some noncritical Shift statistics fetches still quietly unavailable; no fabricated hours claim. Cross-device/midnight acceptance pending. |
| D17 | Partial | Explicit immediate workflow-save explanation, internal-link discard/stay confirmation, beforeunload and lifecycle dirty guard. Native confirmation offers discard/stay (save using existing Save Changes), not custom three-action Save/discard/stay; browser history navigation remains an acceptance limitation. |
| D18 | Fixed | Skip-content target, named nav, desktop More semantics; no four-second expiry, default Cancel focus; active product option scroll/clamp and distinct active vs committed styles. Actual nested hook regression passes; full 30-option route test pending. |
| D19 | Partial | Removed zoom cap, theme/calendar/edit-history 44px targets, readable full-contrast recipe conversions/help/history text. Synthetic 390/1440 rendering verified; real 320px glare/200–400% zoom/device review pending. |
| D20 | Fixed | Catalog setup/active recovery, empty vs search no-results distinction, glossary, Apply team replacement explanation/status. No product/team identity schema changes. |
| D21 | Fixed | Needed font/safe-area/slide extensions migrated into v4 CSS theme; stale unwired config deleted; compile tests pass. Dormant legacy UI intentionally not destructively removed. |

## Remaining real acceptance blockers

No authorized isolated owner/supervisor/worker test account was supplied. Do not bypass authentication or use real production transactions for fixtures. Full authenticated route/dialog, rejected/delayed/offline writes, payroll queries, camera/iOS/Android/PWA, screen reader, OS switching/reload, and 200/400% zoom acceptance remains unverified. Synthetic browser success is not represented as full authenticated end-to-end success. No security assessment was performed.

## Operator testing invitation

Will: please test (1) New Batch Open/priority/deadline/people in light and dark on your phone—only one Create button; (2) an authorized disposable short run at 60/100—Finish report retains actual and target; (3) Hours changing ranges with an offline/rejected request—unavailable message and no stale totals, then Retry.

Three next improvements: provide isolated role-based fixture accounts for repeatable route tests; complete physical iOS/Android + screen-reader/zoom acceptance; replace native Manage discard confirmation with explicit Save/discard/stay if operators prefer it.

Commit, push and deployment verification recorded by completion report after release.

## Release proof

Implementation commit `a8a79562e478d316dbf86a22281267eb6079ed1f` pushed to main; remote main verified equal. Vercel build logs identify Branch main / Commit a8a7956; deployment `dpl_C6wffKXv1ze7FfrZoYtAvtLi2hY7`, URL `https://batchflow-864bx6jh7-brakoishs-projects.vercel.app`, Ready. Auto-deploy initially left canonical alias on the old build; explicitly promoted `batchflow-two.vercel.app` to this Ready deployment. Alias inspection confirms same deployment ID/Ready; live HTML serves `/_next/static/css/d1b3da717024f2e0.css?dpl=dpl_C6wffKXv1ze7FfrZoYtAvtLi2hY7`. No authenticated submissions performed. Only unstaged leftovers are local build-generated PWA artifacts, intentionally excluded.
