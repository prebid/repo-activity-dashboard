# Dashboard redesign plan

Bring every dashboard page onto one Prebid visual system, make navigation respond immediately, replace the long state-carrying URLs with short explicit ones, and split the contribution area into Contributors and Reviewers. The plan is grounded in the 2026-10-31 visual review of `8119ede`, which covered 29 report views and the sign-in pages in both themes at 390–2560px. Finding IDs such as `TBL-02` refer to that review; Appendix A assigns every finding to a phase, and each phase plan restates the findings it implements with their file anchors.

Status: decisions approved 2026-10-31. P0 plan proposed 2026-11-01 (see `## P0 plan`); P0 not started.

## Scope and preservation

- Changes: design tokens and typography, controls and states, the table system, the application shell and page header, in-page navigation, loading behavior, URL state and preference storage, and the Contributors/Reviewers navigation.
- Preserved: metric definitions, the known-zero/missing/partial distinction, 50-row pagination with full-result counts and exports, authentication and account boundaries, the presentation/server separation enforced by `npm run check:boundaries`, typed display models, the 18-repository catalog and stable repository IDs, Dark default with Light/Dark/System, and prepared data until the real-data milestone.
- Real data is next. The design contains no sample-data notice; the "Sample reporting data" frame row is removed rather than restyled.
- No new npm dependencies unless a phase plan justifies one. Fonts load through the installed `next/font`.

## Approved decisions

| Area | Decision | Documents amended (phase) |
| --- | --- | --- |
| PR base | Redesign pull requests branch from and target `main`. `codex/frontend-rebuild` (`d5a7020`) is contained in `main` and receives no new work. | `docs/product/README.md:36`, `:101` (this change) |
| Masthead | Navy `#17232e` in both themes with a 3px Prebid-blue top rule; logo only, no product name beside it. | — (P4) |
| Typography | Mona Sans at 112% width for every header-level element: page titles 800, panel titles 700, top navigation, tabs and section chips 14px/600 (tabs 700 when active). Inter for text and numbers. | `foundation-contracts.md` visual-readiness section (P1) |
| Colour roles | Orange `#ffad32` means act and "you are here" (primary action; nav, tab and sort underline). Blue means links, selection, group rules, the row-hover bar and charts. The amber "Data as of" chip is the one other warm accent. | `login.md:50` already requires orange primary actions (P1, P2) |
| Page header | Title flush left on every page with one meta line beneath; amber "Data as of" chip on the right; tabs and "On this page" section chips centred in a sticky view bar. Contribution pages drop the eyebrow and subtitle. | `all-repositories.md:232`, `repository-detail.md:32`, `all-repositories-plan.md:55` (its "new navigation system" clause only) (P4) |
| Sample-data notice | Removed with the frame row. | `all-repositories-plan.md:38`, `acceptance-matrix.md:26` (P4) |
| Headline totals | Not added now; the `all-repositories-plan.md:55` clause "Do not add charts, headline KPI cards" stands. | — |
| URLs | A URL records only fields that differ from fixed, versioned product defaults; an absent field never means a saved preference. A bare entry URL such as `/repos` redirects to the viewer's saved view only when that view differs from the defaults. Return context travels as a short `back=` frame only when the parent is not the derived default. Old links are decoded by the frozen current readers and answered with a 307 to the new form. | `foundation-contracts.md:21`, `:124`; `all-repositories-plan.md:78`, `:81`; `timeline-reporting-plan.md:85`, `:89`; `contributors.md:332`, `:372`, `:380`. `contributors.md:373` and `foundation-contracts.md:130` stay and govern the `back=` limit (P5) |
| Preferences | Per-viewer preferences move from localStorage to validated cookies the server reads, so the first render is final. No new AWS storage; named server-stored views are a later milestone. | `foundation-contracts.md:18`, `:36`, `:128`; `all-repositories-plan.md:80`, `:82`, `:83`; `repository-detail.md:240`; `contributors.md:371` (P5) |
| Contributions IA | Top navigation reads Contributors and Reviewers: two lenses over one report with shared filters and a Companies tab in each, each lens showing three default credit columns. Merges performed belongs to the Reviewer set. Reviewer-only row eligibility ships as a later step. | `contributors.md:29`, `:40`, `:70`, `:76`, `:274`, `:276`, `:324`–`:332`, `:377` (P6) |
| Deferred | Per-visit panel collapse; a condensed title with Back to top inside the stuck view bar; server-stored named views. | — |

## Architecture rules

These apply to every phase. Each is enforced mechanically by the phase named in brackets; until then it is a review rule.

1. **Tokens are the only source of visual values.** Colours, shadows, radii, font families and font sizes are defined once in `src/styles/prebid.css` and mapped for Tailwind in `src/app/globals.css`. [P1: `scripts/check-design-tokens.mjs`, see P1.]
2. **Semantic tokens are mapped at `:root` and `.dark`.** The `--prebid-*` palette is already root-level; the semantic mapping moves from `.surface` (`dashboard.module.css:1-18`) and the `--auth-*` aliases (`authentication.module.css:1-24`) into `globals.css`, replacing the stock oklch values, so the 404 page, error pages, authentication and Storybook render the same system. `global-error.tsx`, which replaces the root layout, imports `globals.css` and the font classes. [P1]
3. **Primitives own appearance; features own composition.** Feature code may set layout (grid, gap, width, order) on a wrapper but never a primitive's height, colour, background, border or shadow; a needed difference becomes a variant or prop. [P2: `no-restricted-syntax` in `eslint.config.mjs` rejects a `className` attribute on `Button`, `Input`, `SelectTrigger`, `DropdownMenuContent`, `DialogContent` and `Card` in `src/features/**` and `src/app/**`.]
4. **One component per pattern.** The phase that introduces a component retires the variants it replaces in the same change (see Component ownership). [P2: `no-restricted-imports` of `lucide-react` outside the icon-map module. P4: `no-restricted-syntax` rejects `h1` outside `PageHeader`, authentication and edge pages.]
5. **Every primitive has Storybook stories** for each variant and state. A story is covered by the browser suite only when a spec opens its iframe; each phase adds its story IDs to a source-controlled list under `tests/e2e/`, and one spec visits every listed story in Light and Dark (`&globals=theme:light|dark`) with axe on `#storybook-root`. Test titles come from that list, not from `storybook-static/index.json`, because CI lists browser cases before Storybook is built. [P1]
6. **One URL codec.** From Phase 5, links and history writes go through one parameter registry and serializer: a pure module in `src/lib/presentation/` and its hook in `src/lib/navigation/`. `no-restricted-syntax` rejects `NewExpression[callee.name='URLSearchParams']`, `history.pushState`/`replaceState` and `router.push`/`replace` elsewhere; exceptions are named in the P5 plan and removed by P5e. A unit test runs ESLint on a fixture and expects the error. [P5c]
7. **Typed props in, presentation out.** New primitives take typed props, never raw samples or route parameters, keeping the boundary that `check:boundaries` enforces.
8. **Accessibility is part of the spec.** WCAG AA text contrast (4.5:1, 3:1 for large text) and non-text contrast (3:1, WCAG 1.4.11) for control boundaries, focus rings, selected indicators and chart marks, in both themes. axe checks text contrast only, so each phase adds computed-style contrast assertions for the non-text pairs it introduces. The orange underline on light surfaces is paired with a weight or ink change. Visible focus, keyboard reach for new navigation, `prefers-reduced-motion`, and no information carried by colour alone.
9. **No post-load rewrites.** New code from P0 renders its final state on the server. Existing client restoration (`use-table-controller.ts`, `use-overview-settings.ts`, `use-timeline-controls.ts`, `use-contribution-controls.ts`, `use-repository-page-controls.ts`) is removed in P5b; P5b's one-time localStorage migration is the only permitted post-load write and makes no history write.
10. **Status codes are decided before streaming.** No `loading.tsx` sits above code that calls `notFound()` or `redirect()`; existence and access checks for a segment run in its `layout.tsx`, above its loading boundary.

## Component ownership

Shared components live where the dependency-cruiser rules allow a component used by two features (`shared-no-features`, `feature-isolation-*`).

| New | Replaces or extends | Location | Phase |
| --- | --- | --- | --- |
| Icon map | direct `lucide-react` imports (35 files) | `src/components/ui/icons.ts` | P2 |
| `Callout` | `src/components/ui/alert.tsx` and ad-hoc notices | `src/components/feedback/` | P2 |
| `EmptyState` | extends `PageState` (`src/components/feedback/page-state.tsx`); `PageError` renders through it | `src/components/feedback/` | P2 |
| `Avatar` | the generic identity glyph tile | `src/components/github/` | P2 |
| `ReportToolbar` | `timeline-controls.tsx`, `repository-scope-controls.tsx`, `activity-period-controls.tsx`, `contribution-controls.tsx` layouts | `src/components/reporting/` (distinct from the masthead `Toolbar` in `src/components/layout/toolbar.tsx`) | P2 |
| `SortIcon` | the typed sort glyph (`data-table.tsx:244`) | `src/components/tables/` | P3 |
| `PageHeader` | `AllRepositoriesHeading`, `RepositoryHeader`, `ContributionHeading`, the header in `timeline-support-frame.tsx` | `src/components/navigation/` | P4 |
| `ViewBar`, `SectionNav` | extend `ViewTabs`/`DisabledTab` (`src/components/navigation/view-tabs.tsx`) | `src/components/navigation/` | P4 |
| Account menu | the bare "Sign out" button and account name text | `src/components/layout/` | P4 |

## Visual specification

Starting values approved on 2026-10-31. Light value first, dark second. A phase plan may refine a value at its checkpoint and records the change here.

**Surfaces.** Canvas `#eef2f6` / `#0d161f`; card `#ffffff` / `#17232e`; sunken well `#f5f8fa` / `#111c26` (in-card wells that use `--background` move to it); overlay `#ffffff` / `#1c2a37`; table header band `#e8eef4` / `#253947`; header-band hover `#dfe7ee` / `#2c4253`; row hover `#f1f6fb` / `#1d3040`.

**Text.** Ink `#1c3445` / `#e6eef4`; muted `#526473` / `#a1b2bf`; table header ink `#3d5262` / `#b8c7d3`; link `#2a6a9b` / `#6cb0e3`.

**Lines.** Subtle `#e3e9ee` / `#26394a` (between columns and rows); default `#d3dde5` / `#304352` (card edges); strong `#b8c6d1` / `#4a6274` (column groups, pinned edge, header base). Form-field and secondary-control edges use an input-border token of at least 3:1 against card and canvas; the P2 plan records it (candidates `#8696a5` / `#5b7387`, `#7d8f9d` / `#6a8396`).

**Brand and state.** Prebid blue `#3887c2`; orange `#ffad32` (hover `#ffba56`, pressed `#f29d1f`, border `#e8a03a`, ink `#1c3445` at 6.93:1, both themes). Selection: one tint for selected controls, pressed bars and avatars, `#e8f1f8` / `#1e3a50` with ink `#1f5f8f` / `#9ed3f2`. Warning and "Data as of": `#fff6e6` / `#f5c46b` / ink `#8a5300` / icon `#b86e00`; dark `#3a2a10` / `#8a6a2a` / ink `#ffd08a`, dark icon value set in the P1 plan. Masthead `#17232e` in both themes. A Prebid chart palette replaces the stock `--chart-*` values and is checked for contrast and colour-blind separation in both themes.

**Elevation and radius.** Level 1 (panels, buttons, masthead): `0 1px 2px rgb(16 42 67 / .06), 0 1px 3px rgb(16 42 67 / .08)`; dark `0 1px 2px rgb(0 0 0 / .4), inset 0 1px 0 rgb(255 255 255 / .03)`. Level 2 (menus) and level 3 (dialogs) are defined in the P1 plan. Pinned-column edge: `6px 0 8px -6px` shadow while scrolled sideways. Radius 8px for controls and menus, 12px for panels, callouts and dialogs.

**Type.** Display 30/34 Mona Sans 800; title 18/26 Mona Sans 700; KPI 28/36 Inter 600; heading 14/20 Inter 600; body 13/20 Inter 400 (controls 500); small 12/18; caption 11/16 Inter 500; overline 11/16 Inter 600, uppercase, +0.06em. Numbers use `font-variant-numeric: tabular-nums lining-nums` and one weight (500, KPI 600), so a known zero never renders bolder than a real value. Inter 700 only for table group headings, the sign-in submit and avatar initials. Nothing below 11px.

**Controls.** Heights 28 / 34 / 40px; every in-page control 34px (40px on coarse pointers); header icon buttons 36×36. Primary: orange, at most one per surface. Secondary: overlay fill, 1px strong edge, level-1 shadow, hover fill `--prebid-hover` with a `#3887c2` edge. Selected/pressed: selection tint with a `#2d72a6` / `#5aa5dc` edge. Ghost for every reset, with `RotateCcw` and sentence-case labels. Native selects share one wrapper with `appearance: none` and a 14px `ChevronDown`.

**Tables.** Group headings centred, 11px/700 uppercase, +0.07em, with a 2px `#3887c2` spanner rule; 2px strong lines between groups and at the pinned column (one line at the junction); 1px subtle lines between columns; `SortIcon` in a 14px slot with 12px icons at stroke 2: idle `ChevronsUpDown` in `#6f8292` / `#7e93a4`, sorted `ArrowUp`/`ArrowDown` in the link colour, before the label in numeric columns and after it in text columns, with an orange underline on the sorted header; row hover adds a 3px `#3887c2` inset bar on the first cell.

**Icons.** lucide-react through the icon map, stroke 1.5 with `absoluteStrokeWidth`, sizes 14 and 16 (12px direction glyphs at stroke 2). Columns `Columns3`; PR age `Hourglass`; Metrics `ListChecks`; Filters `SlidersHorizontal`; Account type `Shapes`; Timeline and Over time `CalendarDays`; Custom range `CalendarRange`; Export `Download`; Reset `RotateCcw`; Search `Search`; width toggle `ChevronsLeftRight`; external link `ArrowUpRight`; back `ArrowLeft`. PR open `GitPullRequestArrow` (success), draft `GitPullRequestDraft` (muted), merged `GitMerge` (link blue), closed `GitPullRequestClosed` (error); issue open `CircleDot` (success), closed `CircleCheckBig` (muted). Accounts: human `UserRound`, agent `Cpu` (current; `Sparkles` is the alternative reviewed at P2 Checkpoint A), bot `Bot`, unknown `CircleQuestionMark`. No arrows typed as text.

**Identity.** People: 32px circular initials avatar (Inter 600 12px) in the selection tint with a 14px account-type badge; companies: rounded-square monogram (8px radius); detail-page headers use a 48px version.

## Phases

| Phase | Goal | Depends on | Findings | Effort |
| --- | --- | --- | --- | --- |
| P0 | Quick wins: click feedback, brand assets, page titles, durations, capture tooling | — | 5 | S |
| P0b | Loading skeletons and prefetch, after a measured premise check | P0 | — | M |
| P1 | Foundation: tokens, fonts, type scale, elevation, chart palette, token check | P0 | 22 | M |
| P2 | Controls, states, icons and identity | P1 | 41 | M |
| P3 | Table system | P2 | 31 | M |
| P4 | Shell, page header and in-page navigation | P2, P3 | 26 | M |
| P5 | URL state and server-read preferences (five pull requests) | P4; P5a any time | — | L |
| P6 | Contributors and Reviewers (three pull requests) | P4, P5c, P5d | — | M–L |

The phases run in this order. P2 and P3 both edit `src/components/tables/data-table.tsx` and its CSS (search field, empty state, pager, sort header), so controls land first and the table system builds on them. P5b–P5e rewrite the headers, `src/app/_screens/*` and the control hooks that P2–P4 rebuild, so they follow P4; P5a has no behaviour change and may run at any time. P5c freezes the v1 defaults only after the P6 lens defaults are recorded in its defaults table.

### P0 — Quick wins

- Loading skeletons and prefetch moved to P0b. Placing `loading.tsx` directly under `repos/`, `contributors/` or `companies/` wraps the child layouts that would hold the existence checks, so production 404s would become 200s; see `## P0 plan`.
- Show a pending state on the clicked tab or navigation item: `useLinkStatus` for plain links, and an optimistic pending key for links that navigate through `followCaptured`.
- Replace `public/images/prebid-logo.svg`, which contains the text "404: Not Found", with the real vector logo and use it in the header; add a favicon and app icons; give each route its own document title.
- One duration formatter: one decimal, `<0.1 d` between 0 and 0.05, `0 d` for a known zero, `—` for missing.
- One view inventory, `tests/support/views.ts` (the 29 review views, the 12,345-record issues list and the four sign-in pages), drives `scripts/capture-views.mjs`, `tests/e2e/visual-review.spec.ts`, `tests/e2e/layout-width.spec.ts` and the P5a golden URL set.
- Add `scripts/capture-views.mjs` (ES module, JSDoc-typed, imports `chromium` from `@playwright/test`) and a `capture:views` package script that is not part of `check` or `check:all`. It signs in with the preview identity, takes `--base <origin>`, `--out <dir>` and `--measure`, captures the view inventory at 1440, 1366 and 390px (2560 for layout changes) in Light and Dark, exits non-zero on a non-2xx status or unexpected path, and writes outside the repository or under the ignored `/test-results/`. Its view list and viewport/theme matrix are covered by a unit test. Captures are inspection artifacts, not approved baselines (`foundation-contracts.md:64`).

Exit: on `build:preview`, a browser test holds the destination's `_rsc` response and asserts that the clicked tab or navigation item shows its pending state, for a search-parameter-only click (Summary→Timeline, Report→Over time) and a pathname-changing click (main navigation); every page group in the inventory has a distinct `document.title`; the header logo is an SVG at 1× and 2× device scale.

Tests most likely affected: frame identity and the large-list view in `visual-review.spec.ts`; the view lists in `visual-review.spec.ts` and `layout-width.spec.ts`; duration text in `repository-insights.spec.ts`, `timeline-matrix.spec.ts` and the `repository-timeline-matrix` and `timeline-support` component tests; the brand link in `layout-width.spec.ts`. Component tests mock `next/link` to cover the `useLinkStatus` pending branch.

### P1 — Foundation

- The surface, text, line, brand, state, elevation and radius tokens from the Visual specification, at `:root` and `.dark` (rule 2), and the Prebid chart palette.
- Fonts in `src/styles/fonts.ts`: `Mona_Sans({ subsets: ['latin', 'latin-ext'], axes: ['wdth'], variable: '--font-mona' })` with no fixed weight, and `Inter({ subsets: ['latin', 'latin-ext'], variable: '--font-inter' })`. `globals.css` maps `--font-display` and `--font-sans` to them; the variable classes go on `<html>` in `src/app/layout.tsx` and `src/app/global-error.tsx` and in `.storybook/preview.tsx`; component tests mock `next/font/google`. Remove the Arial hard-coding in `globals.css` and `theme-menu.module.css`.
- `scripts/check-design-tokens.mjs`, exporting `inspectDesignTokens(root)` and appended to `check:boundaries`. It parses every CSS file under `src/` with the installed `postcss` and scans `className` strings and `style` objects in `src/**/*.tsx` and `.storybook/*.tsx`. It fails on hex, `rgb()`, `hsl()`, `oklch()` and `color-mix()` literals; literal `font-size`, `font` shorthand, `font-family`, `box-shadow` (except `none`) and `border-radius` values; Tailwind arbitrary values with a literal (`text-[13px]`, `bg-[#fff]`, `shadow-[…]`, `rounded-[5px]`) and default-scale colour and shadow utilities not mapped to a token — all outside `src/styles/prebid.css` and `src/app/globals.css`. It prints the files it scanned and fails on zero inputs. Allowlist entries are keyed by file, selector and property, each with a reason, and the list only shrinks. `tests/unit/design-tokens.test.ts` holds one failing fixture per pattern. The P1 plan states which of today's roughly 150 raw `font-size` and 12 `box-shadow` declarations P1 converts and which are allowlisted for P2–P4.
- The story-coverage spec (rule 5) and a Storybook foundation page showing every token in both themes.

Exit: the token check passes; a browser spec over the view inventory (split across files so CI's two shards per engine divide it) asserts no axe violations on `main` in both themes and that no rendered element's computed `font-family` resolves to Arial; a chart-palette test covers both themes.

Tests most likely affected: Light `main` background in `theme.spec.ts`; the style-token checks in `foundation.spec.ts`; pinned-divider contrast in `repository-overview.spec.ts`; every axe-checking spec re-evaluates contrast.

### P2 — Controls, states, icons and identity

- `Button` owns every button with the sizes and variants in the Visual specification; local overrides of height, fill and shadow are removed (`overview-controls.module.css`, `data-table.module.css`, `contribution-controls.module.css`, `contributions.module.css`), and rule 3 becomes a lint error.
- `ReportToolbar` for Summary, Timeline and Contributions scope controls; one 34px search field with the `Search` icon; one select, menu (with collision padding), dialog and pager specification; one reset pattern.
- `Callout` (info, warning, error) and `EmptyState` (empty, no match, error, loading); a table's empty state keeps its header row.
- The icon map module and the identity `Avatar`; coloured PR and issue status icons; the `lucide-react` import restriction (rule 4).

Exit: no feature code sets a control's height, fill or shadow; every reset uses the same pattern; every icon comes from the map; non-text contrast assertions cover control edges and selected states.

Tests most likely affected: menu and dialog geometry in `column-selection.spec.ts`; select, dialog, menu, switch and focus checks in `foundation.spec.ts`; the record-scope select in `repository-page-layout.spec.ts`; empty, missing, loading and error headings in `visual-review.spec.ts`, `timeline-layouts.spec.ts` and `contribution-layout.spec.ts` and their stories; reset and clear labels used as selectors; pager text in browser specs; the `filter-choices`, `contribution-choices`, `repository-filter-controls`, `timeline-controls` and `csv-download` component tests.

### P3 — Table system

- Header, line and sort specification from the Visual specification; `SortIcon` replaces the typed glyph, and `aria-sort` remains the state.
- Alignment rules: text left, numbers right with tabular figures, headers aligned with their cells, top-aligned two-line rows, the partial-data asterisk in its own slot, Unicode minus for negatives.
- Core contribution metrics get display-only group headings that keep today's column order and CSV headers: Authoring (PRs authored, Authored PRs merged), Reviewing (Reviewer contributions, Approval contributions, Merges performed), Issues (Issues authored).
- Sticky header rows: each table's `.scroll` container (`data-table.module.css:58-60`, `overflow: auto`) is the sticky reference, so the P3 plan chooses one mechanism — a bounded-height scroll area per table or a header row mirrored outside the scroller with synchronised horizontal scroll — and keeps horizontal scrolling inside each table (`all-repositories-plan.md:55`). The sticky offset is a token, `--sticky-offset`, that P4 sets.
- One record-row style across record lists, insights and author records; one drillable-number style (ink at rest, dotted brand underline, link colour on hover).
- The administrator Users table moves onto the shared table.

Exit: one header implementation for every table; geometry and computed-style assertions updated in the same change; `src/components/tables/**` keeps its per-file coverage floor.

Tests most likely affected: accessible names that include the typed sort glyph (31 lines in 10 browser specs; 13 in the `data-table`, `repository-overview`, `repository-timeline-matrix` and `timeline-layouts` component tests); link names with `←`/`↗` in `repository-page-layout`, `repository-insights`, `repository-drilldowns` and `timeline-support` specs; pinned-column and cell geometry in `repository-overview.spec.ts`, `timeline-matrix.spec.ts`, `contribution-layout.spec.ts` and `repository-page-layout.spec.ts`; `/admin/users` in `tests/production/browser.test.ts` and `recovery.test.ts`.

### P4 — Shell, page header and in-page navigation

- Masthead: `--shell-height` 64px, sticky at the top (at 1000px and below, a 56px row plus a 44px navigation row); navigation labels in Mona Sans; header icon buttons 36×36 with a visible pressed state; an account menu (28px avatar, name, email, role, Change password outside preview builds, Sign out).
- `PageHeader`: back link and title flush left, one meta line, the "Data as of" chip on the right inside `aside aria-label="Data source"`. Header rows have fixed heights so sibling tabs never move the toolbar; existing h1, region, tab-navigation and button accessible names are kept; the `ReportToolbar` summary row is the one place each page states its scope.
- `ViewBar`: a fixed 44px bar holding the tabs and, on pages with two or more sections, `SectionNav` chips with scroll-spy; sticky at `top: var(--shell-height)`; `scroll-padding-top` equals the masthead height plus 44px plus 12px; a jump moves focus to the section heading and updates the fragment with `history.replaceState`, adding no Back entry. At 600px and below a "Sections" menu replaces the chips. P4 sets `--sticky-offset` for P3's sticky table headers.
- Remove the frame's sample-data row. Merge the two contribution tab rows into the view bar.
- Branded edge pages (404, error, setup) and a footer, using the same tokens.
- Amend the documents in the Page header and Sample-data rows of Approved decisions.

Exit: one header implementation on every page; Period activity reachable in one action from the first screen, with keyboard reach measured against the 186-Tab baseline; at 390px the four navigation labels fit on one row, measured in the browser suite; the shell files keep their 100% per-file coverage floor.

Tests most likely affected: `layout-width.spec.ts` (Sign out, the `Data source` aside, brand link, gutters, administration spacing); the `Sign out` selector in `foundation`, `overview-preferences`, `theme` and `timeline-controls` specs, `account-recovery.test.tsx` and the production browser and recovery suites; heading level, `Company breakdown` and `Back to report` in `contribution-layout.spec.ts` and `contribution-navigation.spec.ts`; `Repository lists` navigation in `repository-page-layout.spec.ts` and `timeline-layouts.spec.ts`; the skip-link frame check in `visual-review.spec.ts`; the `dashboard-header`, `dashboard-layout`, `layout-width` and `contribution-header` component tests.

### P5 — URL state and preferences

Five pull requests in order: P5a, then P5b and P5c, then P5d, then P5e.

1. **P5a Golden URL set.** Record today's links, resolved states and address bars for every view in the inventory as fixtures; no behaviour change. The fixtures become the legacy decoder's tests.
2. **P5b Server-read preferences.** One versioned cookie per report area. Its value carries the account ID and credential revision and is ignored when they do not match the session (account isolation, `foundation-contracts.md:18`, `:128`); a previous account's preferences on a shared browser are therefore not kept. Each cookie's `Path` covers every route that reads it (the contribution cookie uses `Path=/`, because `/contributors`, `/reviewers` and `/companies` share its filters), following `src/lib/presentation/layout-width.ts`. Values stay under 3,072 bytes with least-recently-updated section eviction and a visible notice; each section is validated on the server, and an invalid section renders defaults with the existing recovery notice and is compare-and-deleted (`contributors.md:380`). Only deliberate changes write a cookie, field by field; opening a link never writes it. Relative presets are stored as presets, never as resolved dates. CSV exports receive the complete explicit view and never read a cookie. A one-time migration copies valid localStorage preferences into the cookie and takes effect from the next request, with no history write. The client restoration effects and the second Timeline render are removed.
3. **P5c Canonical short URLs.** Parameter registry (including `lens`, absent meaning contributors, and the `/reviewers` route) and the URL codec (rule 6); frozen versioned v1 defaults that include both lens defaults; compact encodings (comma-separated slugs with all repositories omitted, `-column` for a descending sort, period plus snapshot instead of exact instants); the Timeline allowlist in `src/server/timeline-preview.ts` and the contribution return scope keys accept every registry name. Unknown parameters are rejected with the existing invalid-view page. Legacy translation runs in `src/middleware.ts` (pure, no viewer) and answers with a 307; the bare-entry redirect runs in the segment `layout.tsx`, which has the viewer, above any loading boundary. A rendered bare entry is replaced by its explicit form before the first in-app navigation, so Back never depends on later preference changes. Detail and drilldown routes never apply saved scope. Every history writer preserves `location.hash`.
4. **P5d Return context.** Flat `back=` frames only when the parent is not derivable; at most eight frames within a 1,000-character href budget, dropping the farthest frames first; the immediate parent is never partially reconstructed — when it cannot fit, the link is disabled with the existing limit explanation (`contributors.md:373`, `foundation-contracts.md:130`). An unresolvable `back` frame, snapshot pin or cookie section shows a notice or the unavailable state and never renders a broader report. When the parent is the immediately previous history entry, the back link uses `history.go(-1)`. `returnTo`, `summary`, `timelineParent` and the base64 `nav` trail are retired.
5. **P5e Cleanup and gate.** Remove the retired writers and the base64 codec; keep the 7,500-byte URL cap and the existing limit message. A browser assertion over the view inventory: no in-app href exceeds 300 characters or contains `%25`, plus one assertion per URL row of the Baseline table.

Open choices settled in the P5c and P5d plans before code: column visibility in URLs (a `cols=` diff against v1 defaults on record, contribution and timeline tables with Summary columns viewer-only, or viewer-only everywhere, `all-repositories-plan.md:81`); preference keys per view kind and table kind, or per repository as today (`timeline-reporting-plan.md:85`); the Timeline tab as a bare `?timeline` flag that also accepts `timeline=1`, or a path segment; return-to-section (a Period activity drilldown's `back` frame carrying `#activity`), adopted or excluded.

Exit: the address bar after one scope change on All repositories drops from 598 characters of path and query to under 60, and the Summary→Timeline link from 1,208 to under 25; no history write after load. P5 has no Checkpoint A; each pull request records the golden-URL diff (old link → resolved state → canonical URL) for review.

Tests most likely affected: 82 `toHaveURL` assertions in browser specs; login helpers that assert a bare `/repos` (31 in 27 files) and `waitForURL('**/repos')` in the production suites; legacy parameters in test inputs (`timeline=1` on 342 lines; `returnTo`, `timelineParent`, `summary`, `nav`); localStorage preference tests (`overview-preferences.spec.ts`, `contribution-saved-editing.spec.ts`, `overview-settings.test.tsx`, `report-controls-hydration.test.tsx`, `contribution-scope-storage.test.ts`). The P5c plan names which specs keep legacy URLs as redirect cases.

### P6 — Contributors and Reviewers

1. **P6a Fixture.** Add reviewer and approval credits to the large sample (self-merges carry no reviewer evidence) and row counts for the partial and coverage-gap samples, so the lens checkpoints review real sorting and paging.
2. **P6b Lenses.** `/reviewers` route and navigation; default column sets (Contributor: PRs authored, Authored PRs merged, Issues authored, sorted by Authored PRs merged; Reviewer: Reviewer contributions, Approval contributions, Merges performed, sorted by Reviewer contributions); a Column set choice (Contributor, Reviewer, All credits, All columns) at the top of the Columns menu, the CSV dialog and Over time, with the button reading "Columns · Reviewer" or "Custom"; a set that would hide the current sort column applies its own lead sort; filters shared and columns and sort saved per lens; one canonical person and company URL carrying `lens` through entity links, drilldowns, Over time and exports, with the CSV context recording the lens; lens-aware Back labels ("Back to Reviewers"); person and company reports show totals in two labelled clusters (Contributor activity, Reviewer activity), active lens first; a report opened in the Reviewers lens with no reviewer evidence shows a neutral "No reviewer activity in this scope" callout; a unit test assigns each of the 39 report metric IDs exactly one population role or none. The P6b plan states the header's lens cue and whether the core picker groups change (`contributors.md:377`). No change to row eligibility.
3. **P6c Lens populations.** Reviewers lists accounts with a review, approval or merge credit, with a "Show all N accounts" switch; company rosters use role-aware Hide zero labels.

Exit: both lenses reproduce today's six-column view through "All credits"; every metric remains addable in both; the four navigation labels fit at 390px.

Tests most likely affected: the `Contributions` navigation link in `contribution-layout`, `contribution-navigation`, `contribution-saved-editing` and `foundation` specs, `dashboard-header.test.tsx` and `tests/production/browser.test.ts`; Columns menu and CSV dialog structure in `column-selection.spec.ts` and `contribution-details-exports.spec.ts`; row eligibility in `contribution-eligibility.spec.ts` (P6c); the `column-selection`, `contribution-samples`, `contribution-scaling`, `contribution-reporting` and `contributions` unit tests. `/reviewers` joins the view inventory.

## Process for each phase

This applies the [five-step frontend delivery process](../product/README.md#five-step-frontend-delivery-process) to redesign phases: README Step 1 (typed models and samples with contract tests first) applies to P6a and any phase that adds a display model; README Step 2 is Checkpoints A and B; the Step 3–4 interaction checks apply to P4, P5 and P6; README Step 5 is steps 5–7 below.

1. **Phase plan.** Append `## Pn plan` to this document: components and files, exact values, the findings it implements with their anchors, the shared files and merge order with any concurrent pull request, test and document changes, the coverage group in `vitest.config.ts` for each new module, and any open choice. Approved before code.
2. **Branch** `feature/<phase-slug>` from `origin/main` with `--no-track`; one pull request per phase (per sub-step for P5 and P6).
3. **Primitives first. Checkpoint A:** the maintainer reviews the changed stories in `npm run storybook` (port 6006) on the branch, switching the `theme` toolbar global; for changed existing primitives the base worktree serves the same stories with `npx storybook dev -p 6008`. The pull request lists the story IDs under review. Stop any `preview:storybook` server before `test:e2e`, which needs port 6007.
4. **Apply to pages. Checkpoint B:** build both sides with `npm run build:preview` — the branch in the working checkout and the base (`git merge-base origin/main HEAD`) in a separate `git worktree` with its own `npm ci`, because `.next` and its build mode belong to one checkout. Serve the branch on port 3200 and the base on 3201 (`npm run start:preview -- --port …`; ports 3100 and 6007 belong to `test:e2e`), then run `npm run capture:views -- --base http://127.0.0.1:3201 --out <dir>/before` and the same against 3200 into `<dir>/after`. Captures are attached to the review, not committed.
5. **Gates.** `npm run check:all` (Java 17+ and `npx playwright install chromium webkit`): `check`, `test:accounts`, `audit:dependencies`, `build:production:fixture`, `test:production`, `build:preview`, `build:storybook` and `test:e2e` in Chromium and WebKit with axe in both themes. The production and preview builds share `.next`, so individual steps run in that order. Geometry and computed-style assertions change in the same commit as the behaviour they cover; each phase adds assertions for its new tokens, dimensions and non-text contrast pairs.
6. **Self-review and adversarial pass** against the architecture rules, then the pull request: findings implemented, documents amended, tests changed, captures, and what was not run.
7. **Merge after visual sign-off.** The Amplify app builds from `main` (`foundation-contracts.md:74`: control automatic builds before merging into a production-tracked branch), so each merge is a release decision. The phase's status row and `## Pn evidence` (merged head, `quality` run, checkpoint dates, what was not run) are committed as the first change of the next phase's pull request, and the merged pull request carries the same evidence as a comment.

## Definition of done for a phase

- Every finding assigned to the phase is implemented, or moved with a stated reason.
- The token check and the phase's lint restrictions pass; no feature code overrides a primitive's appearance.
- New and changed primitives have stories, listed in the story-coverage spec.
- The `quality` check run concluded `success` for the pull request's head SHA, and its coverage-verification step reported a non-zero case count across the Chromium and WebKit shards. `main` has no branch protection, so this is confirmed per pull request. No test is skipped or marked `fixme`; `scripts/check-test-results.mjs` rejects skipped, pending and flaky results.
- Product and implementation documents changed by the phase's decisions are amended in the same pull request.
- Both visual checkpoints are signed off for phases that change rendering; P5 pull requests record the golden-URL diff instead.

## Unverified premises

Each is checked in the phase that first depends on it, and the result is recorded in `## Pn evidence`.

- P0b: with existence checks in segment layouts above leaf loading boundaries, production 404 and 307 statuses are unchanged; document responses still carry report rows in server HTML (no streamed fallback), or the affected route gets no boundary.
- P1: CI, Amplify and Storybook builds can download Google Fonts. If not, use `next/font/local` with committed OFL woff2 files (same package, no new dependency). Inter serves `tnum` and `lnum` through Google Fonts. Storybook's Next.js framework handles `next/font/google`.
- P4: the sticky masthead and view bar do not intercept clicks in existing browser specs; hash-only `history.replaceState` under the App Router notifies the router.
- P5b: Amplify and CloudFront forward the preference cookies to server rendering within header limits.
- P5c: Next 15.5.28 `Link` and the router keep literal `,` `:` `@` in query values; a 307 on an RSC request lands on the canonical URL; the router cache serves the right view for a bare URL after a cookie changes.
- P6b: reading `lens` in the layout-level toolbar works under the force-dynamic layout.

## Baseline measurements

Recorded on `build:preview` / `start:preview` of `8119ede` at 1440×900 and the live site's public endpoints. P0 adds `npm run capture:views -- --measure`, which regenerates every row except the contrast ratios (computed from token values) and the timings (diagnostics, not thresholds).

| Measurement | Baseline |
| --- | --- |
| All repositories: site header to first control | 220px; first table at y=450; Period activity at y=1363 |
| Repository page / Contributors: first table | y=767 / y=626 |
| Keyboard reach to Period activity | 186 Tab presses |
| Light contrast: page vs card / header band vs card / line vs card | 1.06:1 / 1.11:1 / 1.21:1 |
| Distinct rendered font size/weight pairs | 25 (27 when uppercase tracking is counted separately) |
| Summary→Timeline tab href | 1,208 characters; 302 of 307 links on All repositories over 500 |
| Address bar after one scope change on All repositories | 598 characters of path and query (640 with the live origin) |
| Tab click (`build:preview`) | one server request, 70–180 ms |
| Live server time for `/api/health` | 130–200 ms warm; CloudFront miss, `no-store` |
| All repositories page data | 257 KB server-component payload, 678 KB HTML (uncompressed) |

## Status

| Phase | Status | Pull request | Checkpoint A | Checkpoint B |
| --- | --- | --- | --- | --- |
| P0 | Checkpoints approved; pull request not opened | — | Approved 2026-11-01 | Approved 2026-11-01 |
| P0b | Not started | — | — | — |
| P1 | Not started | — | — | — |
| P2 | Not started | — | — | — |
| P3 | Not started | — | — | — |
| P4 | Not started | — | — | — |
| P5 | Not started | — | — | — |
| P6 | Not started | — | — | — |

## P0 plan

Proposed 2026-11-01 against `bfe53f9`. Framework statements cite the installed Next.js 15.5.28 source under `node_modules/next/dist/`; none were exercised at runtime before this plan.

### Scope correction and split

The master P0 text placed `loading.tsx` under `repos/`, `contributors/` and `companies/` and removed `prefetch={false}` broadly. Reading the installed router and renderer shows four problems:

- **Boundary placement.** A segment's `loading.tsx` wraps its child segments including their layouts (`client/components/layout-router.js:465-510`; `server/app-render/create-component-tree.js:714-722`). A `notFound()` or `redirect()` thrown below a boundary only adds `<meta name="robots">` or a meta refresh to a 200 response (`server/app-render/app-render.js:1402-1417`; `make-get-server-inserted-html.js:38-60`). `/repos/no-such-repository`, `/repos/not-in-catalog` and the unknown contributor and company routes asserted at `tests/production/recovery.test.ts:174`, `browser.test.ts:132-133` and `auth.test.ts:203-209` would return 200.
- **Search-parameter clicks never show a skeleton.** The layout router's React state key for a page segment drops search parameters (`layout-router.js:398-411`; `create-router-cache-key.js:12-25`), so a search-parameter-only navigation reuses the mounted boundary and Summary→Timeline, PRs→Issues and Report→Over time keep the current page until the response arrives. Only a pending state on the clicked control gives feedback there, and these tabs are the reported slow clicks.
- **Prefetch helps only with a boundary.** With no `loading.tsx`, every prefetch is router state only (`walk-tree-with-flight-router-state.js:60-64`). With a boundary under a `requireViewer` layout, each prefetch is a server render with an account read in production (`src/lib/auth/viewer.ts:33-44`); the preview build skips that read, so local measurement cannot show the cost.
- **Streaming and the no-JavaScript contract.** A route whose content suspends behind a boundary streams the fallback first and the rows inside `<div hidden>` swapped in by script. That would affect `contribution-navigation.spec.ts:46-70` (rows without JavaScript), the `renderedMain` canaries in `tests/production/auth.test.ts:141-145`, and `contributors.md:371` ("Server-rendered reports include actual rows"). Whether a route actually streams its fallback in the initial HTML must be measured.

P0 therefore ships click feedback, brand assets, page titles, duration formatting and capture tooling. Skeletons and prefetch move to **P0b**, a separate pull request that starts with a measured premise check.

### Items

**1. Click feedback.**

- `src/components/navigation/link-pending.tsx` (client): `LinkPending({ pending? })` renders `<span aria-hidden="true" data-link-pending data-pending=…>` from `useLinkStatus()` (`client/app-dir/link.js:363-377`; the hook reads a context provided around the Link's children, so the indicator is a child of the link) or from an explicit `pending` prop. Style: a 2px Prebid-blue bar at the link's bottom edge, absolutely positioned inside the link so sibling tabs never move; the indicator stylesheet sets `position: relative` on its host through `a:has(> [data-link-pending])`, because `.breadcrumbs a` (`repository-page.module.css:9-14`, `contributions.module.css:42-47`) and `.breakdowns a` (`contributions.module.css:218-225`) are not positioned today. Static under `prefers-reduced-motion`; `cursor: progress` through `a:has(> [data-pending='true'])`. The span has no text, so accessible names and `dashboard-header.test.tsx:36-40` are unchanged.
- Placed as the last child of: the header brand link and main navigation Overview and Contributions (`dashboard-header.tsx:39-55, 78-88`) and the Administration Accounts link (`:92-101`); Summary/Timeline (`all-repositories-header.tsx:41-57`); PRs/Issues (`repository-header.tsx:88-116`); back links (`repository-header.tsx:46, 53`; `contribution-header.tsx:92`; `timeline-support-frame.tsx:25-31`); Report (`contribution-header.tsx:56-63`); the Over time view's tabs (`contribution-timeline-view.tsx:89`); the in-scope "All open PRs/issues" link (`repository-page-view.tsx:170-178`).
- `src/lib/navigation/use-pending-navigation.ts`: `useOptimistic<string | null>` plus `startTransition(() => { setPendingKey(key); router.push(href) })`, passed as `followCaptured`'s navigate argument for the links whose `onClick` calls `preventDefault()` (so `useLinkStatus` never sees them, `link.js:310-313`): the repository Timeline tab (`repository-page-screen.tsx:106-130`, `repository-insights-screen.tsx:65-75`) and, through the shared `navigate` helper (`contributions-screen.tsx:82-91`), which gains a pending-key argument, Over time (`:127-133`, key `timeline`), Contributors/Companies (`:134-135`, key = the area) and the company breakdown (`:156-160`, key = the view). `onMetric` (`:114-124`) and `onFollow` (`:136-144`) pass no key and show no indicator.
- The key reaches `<LinkPending pending={…} />` through new optional props: `ContributionLinks.pendingTarget` (`contribution-columns.tsx:39-54`), read by `ContributionHeader` for the area tabs and passed to `ContributionReportViewTabs` as `timelinePending` (`contribution-header.tsx:43-53, 159-164`); and `RepositoryHeader.timelinePending`, forwarded by `RepositoryPageControls`/`RepositoryPageView` (`repository-page-view.tsx:23-31, 114-121`), `RepositoryInsightsView` (`repository-insights-view.tsx:129-141, 164-168`) and `RepositoryDrilldownFrame` (`repository-drilldown-frame.tsx:11-31, 37-45`).
- Not given an indicator in P0: the Repositories menu items (the menu closes on click; P4 covers them); state-page and not-found back links (`repos/[slug]/page.tsx:40-46`, `repos/[slug]/authors/[account]/page.tsx:20-22`, `_screens/contribution-route.tsx:29`, `_screens/timeline-route.tsx:23`, both `not-found.tsx`); authentication links (`auth/error/page.tsx:9`, `auth/setup/page.tsx:7`, `change-password-view.tsx:222-232`); the contributor header's company link (`contribution-header.tsx:122-127`); row and cell drilldowns (`contribution-columns.tsx`, `overview-columns.tsx`, `overview-metric.tsx`, `repository-insights-view.tsx:78`, `repository-timeline-support.tsx:46`, `repository-timeline-matrix-view.tsx:163`, `timeline-value.tsx:72`); and Timeline chart point clicks (`timeline-screens.tsx:179-182`).
- No `prefetch` changes in P0.

**2. Brand assets.**

- Source: the official vector lockup `assets/images/prebid-logo-knockout.svg` from `prebid/prebid.github.io` (Apache-2.0; last changed in `79571d7`), `viewBox="0 0 140 25"`: five orange bars (`#ff6f00`) and a white wordmark (`#fff`), with no script, event-handler, `foreignObject` or external reference. The repository's own `public/images/prebid-logo.svg` contains the text "404: Not Found", and no commit ever held a real SVG.
- `public/images/prebid-logo-knockout.svg` is the official file unchanged, for dark surfaces (the P4 navy masthead). `public/images/prebid-logo.svg` is the same vector with the wordmark filled Prebid blue `#3887c2`, matching today's PNG lockup, for light surfaces. The light version keeps the official `#ff6f00` bars (decision 6).
- `src/components/layout/brand-logo.tsx` wraps `next/image` with the light version; with the default image configuration an `.svg` source is served unoptimized with no `srcset` (`shared/lib/get-img-props.js:268-272`), so no `dangerouslyAllowSVG` change is needed. Display sizes keep today's widths with the 140:25 ratio: header 143×26 (114px wide at ≤600px through the existing CSS) and sign-in frame 171×31, replacing the PNG in `dashboard-header.tsx:45` and `auth-frame.tsx:16`. The brand link keeps `aria-label="Repository activity"` in P0, so `layout-width.spec.ts:61,191` are unchanged. `public/prebid-logo.png` is deleted and `prebid-logo` leaves the `src/middleware.ts:9` matcher. P4 switches the masthead to the knockout file.
- Icons from the official bars (the published `favicon.ico` is a single 16×16 frame and the published `apple-touch-icon.png` runs the bars into its right edge): `src/app/icon.svg` (the five bar paths in a square, padded `viewBox`), `src/app/favicon.ico` (16, 32 and 48px frames) and `src/app/apple-icon.png` (180×180, bars on an opaque `#17232e` background), rasterized once with the installed Playwright Chromium and committed as outputs. At 16px the bars are 0.75px thick on a 2.07px pitch, so the 16px frame is drawn by hand as five opaque one-pixel bars on whole pixel rows, each bar's ends rounded from `icon.svg`. These are root metadata routes outside `(dashboard)/layout.tsx`, so they stay public (`lib/metadata/is-metadata-route.js:47-75`; `build/webpack/loaders/next-metadata-route-loader.js:70-107`).

**3. Page titles.**

- Titles name the page and nothing else: no suffix or template. `src/app/layout.tsx` keeps a single default title, `Prebid`, used only where a page sets none (for example a redirect body).
- `src/lib/presentation/page-title.ts` (pure) builds titles from existing text sources: `recordListTitle` (`repository-records.ts:45-50`), `insightTitles` (`repository-insights.ts:13-21`), `repositoryMetricName` (`repository-metric-text.ts:204`), `reportMetricLabel` (`contribution-metrics.ts:42`), and one `contributionSubjectTitle(area, subject)` replacing the logic in `contribution-header.tsx:17-25` and its copy in `contribution-timeline-view.tsx:45-50`; the header, the Over time view and `page-metadata.ts` all call it.
- `src/server/page-metadata.ts` (`server-only`) returns titles only for an authenticated viewer who is not required to change their password, and `{}` otherwise. Metadata is rendered into the 307 body sent to anonymous requests (`app-render.js:1406-1424`; `lib/metadata/metadata.js:200`), and the anonymous canaries in `tests/production/auth.test.ts:92-123,137-157` include `'PRs by sample-author-2'`, `'Example Acme'` and `'Unmapped company'`. It never calls `notFound()`, `redirect()` or `requireViewer()` (rule 10), and references `getViewer` only inside function bodies, so `tests/unit/contribution-identity-routes.test.ts` (which mocks only `requireViewer`) keeps loading the pages. A redirect or shell error renders the RSC payload a second time (`app-render.js:670-698, 1406-1424`) in a new React request where `getViewer`'s `cache()` does not apply, so `page-metadata.ts` memoizes the viewer per request on the object returned by `await headers()` (`server/request/headers.js:155-161`) to avoid a second account read. Contributor and company names come from `contributionDirectorySample(sample)` for the URL's `sample` scenario, read as `loadContributionData` reads it (`contribution-data.ts:28`).
- Each dashboard report `page.tsx` exports `generateMetadata` that passes its search parameters the same way the page does; authentication pages, `foundation`, `admin/users` (`Accounts`) and both `not-found.tsx` files export static `metadata`; the root `src/app/page.tsx`, which only redirects, exports none.
- One title per page group (repeat views of one page, such as the three Timeline groupings, share a title). A view or entity is named only where it distinguishes the page: `All repositories`, `Timeline · All repositories`, `Prebid.js`, `Open issues · Prebid.js`, `PRs by sample-author-2 · Prebid.js`, `Contributors`, `Alice · Contributors`, `Over time · Alice`, `Sign in`.

**4. Duration formatting.**

- `src/lib/presentation/format.ts` gains `formatDayNumber` (`null` → `—`; `0` and `-0` → `0`; 0 < |x| < 0.05 → `<0.1` with the sign kept, so `-0.01` → `-<0.1`; otherwise one decimal with en-US grouping: `0.05` → `0.1`, `4` → `4.0`, `4.853` → `4.9`, `5.999` → `6.0`, `1234.56` → `1,234.6`, `-0.5` → `-0.5`), `formatDays` (adds ` d`) and `formatMeasure(value, unit)`. Today `formatCount` prints up to three decimals (`format.ts:2`).
- Call sites: `measurement-value.tsx:27-29, 56, 76, 83, 86-88`; `timeline-value.tsx:44-49`; `overview-metric.tsx:34-41`; `repository-records-view.tsx:69`. Callers keep adding `+` only for positive values; the Unicode minus is P3 (TBL-05). The Timeline chart's day-valued Y-axis ticks (`timeline-chart.tsx:208-215`) keep Recharts' default tick text in P0.
- Age columns are unchanged in P0. "Age at cutoff (days)" on Timeline snapshot supporting views prints unrounded sample values; how ages are calculated and shown is settled with real data.
- CSV exports keep full precision (`csv-export.ts:38`; `timeline-csv.ts:140,155-157`); only cells and accessible names change.

**5. View inventory and capture tooling.**

- `tests/support/views.ts`: no imports, erasable TypeScript only, so Playwright specs, Vitest and a Node 24 script (native type stripping, explicit `.ts` import) can all load it. Entries `{ id, path, access, page, uses }`: the four sign-in pages, the 29 report views of the review, and `/repos/prebiddocs?scope=current&metric=openIssues` (the 12,345-record list that `visual-review.spec.ts` uses today). `viewsFor(use)` selects the `visual-review`, `reflow`, `layout-width` and `activity-region` sets and throws on an empty selection; `layout-width.spec.ts:14-32` and `visual-review.spec.ts:6-24, 199-201` import them. In `visual-review.spec.ts`, the test titles and screenshot names (`:39`, `:61`) take the inventory id, the Period activity capture (`:63`, today `name === 'comparison'`) takes the `activity-region` set, and the large-list test (`:87`) takes the prebiddocs entry. Views carrying `sample=` are sample-state variants in every build and are pinned by the unit test so the real-data milestone removes them deliberately.
- `scripts/capture-views.mjs` (ES module, JSDoc-typed, `chromium` from `@playwright/test`) and the package script `capture:views`, outside `check`, `check:all` and `quality.yml` (`tests/unit/quality-workflow.test.ts:13-24` fails if CI runs a script `check:all` does not). Arguments: `--base` (loopback origin only), `--out` (outside the repository or under `test-results/`, but not `test-results/browser-artifacts/`, which Playwright clears, or `test-results/shards/`, which `browser-shards.mjs verify` validates strictly; default `test-results/captures/<UTC timestamp>`), `--measure`, `--views`, `--widths` (1440, 1366, 390; 2560 on request) and `--themes`. It signs in with the preview identity and refuses a build without the preview accounts notice; it fails a cell on a non-2xx status, a redirect, or a final pathname that differs from the inventory. Output: `<id>.<theme>.<width>.png`, a full-page variant and `manifest.json`; `--measure` writes `measurements.json` with the Baseline table's rows.
- The capture script, run against the base and the branch, produces the Checkpoint B images for every later phase.

### Files

| Add | Change | Delete |
| --- | --- | --- |
| `src/components/navigation/link-pending.tsx`; `src/lib/navigation/use-pending-navigation.ts`; `src/components/layout/brand-logo.tsx`; `public/images/prebid-logo-knockout.svg`; `src/lib/presentation/page-title.ts`; `src/server/page-metadata.ts`; `src/app/icon.svg`, `favicon.ico`, `apple-icon.png`; `tests/support/views.ts`; `scripts/capture-views.mjs`; the tests below | `dashboard-header.tsx`; `all-repositories-header.tsx`; `repository-header.tsx`; `contribution-header.tsx`; `contribution-columns.tsx`; `repository-page-view.tsx`; `repository-insights-view.tsx`; `repository-drilldown-frame.tsx`; `contribution-timeline-view.tsx`; `timeline-support-frame.tsx`; `repository-page-screen.tsx`; `repository-insights-screen.tsx`; `contributions-screen.tsx`; `auth-frame.tsx`; `format.ts`; `measurement-value.tsx`; `timeline-value.tsx`; `overview-metric.tsx`; `repository-records-view.tsx`; `src/app/layout.tsx`; every `page.tsx` and both `not-found.tsx`; `src/middleware.ts`; `public/images/prebid-logo.svg`; `package.json`; `vitest.config.ts`; `visual-review.spec.ts`; `layout-width.spec.ts`; `.storybook` stories | `public/prebid-logo.png` |

### Tests

- New unit and component: `tests/components/link-pending.test.tsx` (mocks `next/link`'s `useLinkStatus`: both states and the explicit prop in both directions); `tests/unit/use-pending-navigation.test.ts`; `tests/unit/page-title.test.ts` (every branch); `tests/unit/page-metadata.test.ts` (anonymous, unavailable, must-change-password, authenticated, unknown subject); the duration cases of item 4 in `tests/unit/presentation.test.ts`; `tests/unit/brand-assets.test.ts` (for both logo files and `icon.svg`: SVG root element, `viewBox` matches the component constants, no `<script`, event-handler attributes, `<foreignObject` or external `href`; ICO header and 32px frame; apple-icon IHDR 180×180); `tests/unit/view-inventory.test.ts` (ids and paths unique and well formed, access values, page-group titles distinct, the sample-state set, the exact membership of every `viewsFor` set — visual-review: today's 8 entries, reflow: 3, layout-width: today's 15 paths, activity-region: 1 — the capture matrix and argument rejections, and one `spawnSync` of the script proving Node loads `views.ts`). `tests/unit/contribution-identity-routes.test.ts` needs no change.
- New browser: `tests/e2e/navigation-feedback.spec.ts` (hold `_rsc` requests without `next-router-prefetch`; each case asserts `data-pending="true"` on the clicked link while held, `"false"` after release, and the destination title: Summary→Timeline, main navigation, a breadcrumb back link, Report→Over time, the repository Timeline tab from a record list and from an insight view, Contributors→Companies, and a company breakdown link); `tests/e2e/document-titles.spec.ts` (one case per inventory view); `tests/e2e/brand-assets.spec.ts` (device scale 1 and 2: SVG `currentSrc`, no `srcset`, `decode()` resolves, served as `image/svg+xml`; icon links resolve).
- Production suite: anonymous `/favicon.ico` and the icon links from `/auth/login` return 200 (not 307); the permitted HTML for `/contributors/account-alice` and an author view carries its title, while the anonymous 307 body and flight payload carry only the default `Prebid` title (the permitted strings, such as `Alice · Contributors`, are absent); one authenticated `/` request and one must-change-password dashboard request add no more account operations than today (`fixture.accountOperations`).
- Changed literals: `'4.853 d'` → `'4.9 d'` (`repository-insights.spec.ts:299`, `timeline-matrix.spec.ts:150`); `'5 d'` → `'5.0 d'` and `'31 d'` → `'31.0 d'` (`repository-timeline-matrix.test.tsx:156-157`); `'31 d'` → `'31.0 d'` (`timeline-support.test.tsx:90`).
- Coverage: `link-pending.tsx` falls in `src/components/navigation/**`; `use-pending-navigation.ts` in `src/lib/navigation/**`; `page-title.ts` and `format.ts` in `src/lib/presentation/**`; `brand-logo.tsx` joins the 100% shell group (`vitest.config.ts:37-38`); `src/server/page-metadata.ts` gets a new 100% per-file group because it decides what anonymous responses contain. `tests/support/views.ts` and `scripts/capture-views.mjs` are outside coverage, like the existing gate scripts; their unit test is the gate.

### Exit

- `navigation-feedback.spec.ts` passes in Chromium and WebKit.
- Every page group in the inventory has its distinct title, and the anonymous production canaries stay clean.
- The logo renders as SVG at device scale 1 and 2 in the header and the sign-in frame; icons are public under production authentication.
- Duration cells and accessible names follow the formatter; CSV output is byte-identical to the base for the same views.
- `npm run capture:views` produces the Checkpoint B set against base and branch, and `--measure` reproduces the Baseline table under the definitions recorded there.
- `npm run check:all` passes.

Checkpoint A: a navigation-feedback story that sets the Storybook `next/link` mock's `useLinkStatus` to pending shows the indicator on a navigation item, a view tab, a breadcrumb back link and a company breakdown link beside their idle state, with the logo in the header and sign-in frame, in both themes. Checkpoint B: before/after captures of every inventory view at 1440, 1366 and 390px in Light and Dark.

### P0b outline

Planned in its own section after P0 merges. First, a premise check on a throwaway branch: `build:preview` plus `test:e2e` and `build:production:fixture` plus `test:production` with route-group boundaries in place, and inspection of each route's initial HTML for streamed fallbacks (`<template id="B:…">`, `<div hidden id="S:…">`). The candidate design moves each list page into a route group (`repos/(overview)/page.tsx` with its `loading.tsx`, likewise for contributors and companies), puts existence checks in `repos/[slug]/layout.tsx`, `contributors/[accountId]/layout.tsx` and `companies/[...identity]/layout.tsx` through `cache()`d guards in `src/server/route-access.ts` above leaf `loading.tsx` files, moves `repos/[slug]/not-found.tsx` to `repos/not-found.tsx` (a layout's `notFound()` is caught one level up, `create-component-tree.js:300`), and renders one shared `ReportSkeleton` (`role="status"`, no table or heading). Decisions settled then: how the contributor layout learns the `sample` scenario (layouts receive no search parameters; the middleware header `x-dashboard-return-path` is the candidate), whether routes that stream their fallback keep a boundary, and which links regain prefetch, measured as prefetch requests and account operations per page view on `build:production:fixture`.

### Decisions (2026-11-01)

1. Skeletons and prefetch move to P0b. Approved.
2. Titles name the page only, with no suffix; one title per page group. Approved.
3. Durations always show one decimal (`61.0 d`); `0 d` and `<0.1 d` are the exceptions. Approved.
4. Age columns stay as they are until real data. Approved.
5. The 12,345-record issues list joins the inventory as a 30th report view. Approved.
6. The official vector lockup replaces the PNG in the header and the sign-in frame; icons come from the official bars, with the navy `#17232e` background on the apple icon. The light version's bars use the official `#ff6f00`, not the PNG's `#eb9722`. Approved.

### Unverified premises (P0)

- Vitest's CommonJS interop supports a partial `vi.mock('next/link')` that keeps the default export; Storybook's `@storybook/nextjs-vite` renders `useLinkStatus` and an SVG `next/image` source.
- `useOptimistic` holds the pending key until the navigation commits (Next uses the same pattern in `client/components/links.js:70-76`).
- Node 24 ICU formats the duration cases as tested.
- WebKit decodes the SVG logo at device scale 2.
- Next 15.5 streams metadata for non-bot user agents (`server/lib/streaming-metadata.js:24-31`): the title renders inside `<div hidden><Suspense>` (`lib/metadata/metadata.js:155-166`), so the production title assertion reads the whole HTML text, and P0b's streamed-fallback check counts only `B:`/`S:` markers inside `<main>`.

## P0 evidence

Recorded 2026-11-01 against base `bfe53f9` on `build:preview`/`start:preview`, Node 24.22.1.

### Checks

- `npm run check:all` passed at `32c124d`: Vitest 2,099, account integration 34, production integration 13 and Playwright 540 (Chromium and WebKit), with no skipped, pending or flaky results.
- The commit that adds this section also adds one Playwright case, the click-feedback story check below; it passed in Chromium and WebKit.

### Checkpoints

Checkpoint A, approved 2026-11-01: `navigation-click-feedback--idle-and-pending` (main navigation, breadcrumb back links, view tabs and a company breakdown link, idle and pending, with the header logo) and `authentication-pages--sign-in`, in Light and Dark, plus the icon set.

Checkpoint B, approved 2026-11-01: `npm run capture:views -- --measure` against base and branch gives 408 pairs (34 inventory views × Light and Dark × 1440, 1366 and 390px × viewport and full page). A pixel counts as changed when its summed RGB difference exceeds 30.

| Pairs | Cause |
| --- | --- |
| 12 | Identical: `account-setup`, which renders no logo |
| 320 | Header logo only, inside x 16–178 and y 22–50 |
| 36 | `sign-in`, `sign-in-error`, `change-password`: the logo grows from 29.92 to 30.53px tall, and content below it moves down 0.3px (0.6px on `change-password` at 1366, where the page scrolls) |
| 20 | Duration cells on `repo-duration-metric` (8), `repos-overview`, `repos-comparison` and `repo-timeline` (4 each), for example 4.853 d → 4.9 d and 0.199 d → 0.2 d |
| 20 | `repo-author` and `repo-author-issues`: record rows 74 → 70px (74 → 68px at 390px); see below |

A DOM comparison of all 34 views at 1440px Light found the same text apart from durations, the same link targets, headings, table columns, controls and `aria-current`/`aria-sort` state, and HTTP 200 with no console errors on both builds. 26 in-app clicks across navigation, view tabs, breadcrumbs and report switches reach the same URL on both builds.

### Change outside the items

`repository-page.module.css` set `.records td { padding-top: 13px; padding-bottom: 13px }`, equal in specificity to the table's own `.table td` padding, so it applied only when its stylesheet loaded after the table's. On base that happened on a direct load of an author record list, but not on the same page reached by a link, and not on any other repository record list. Importing `link-pending.module.css` moved that stylesheet into an earlier chunk, so the override stopped applying. P0 removes it: record tables use the table's 11px (10px at ≤600px) on every path. `repository-insights.spec.ts` compares the first record cell's padding on the repository PR list with an author list reached by a link and then reloaded; it fails on base (13px against 11px). Record-row density is set in P3 (TBL-12).

### Baseline measurements

Base and branch measure the same values for every regenerated row: 220px from header to first control, first table at y=450, Period activity at y=1363, repository and Contributors first tables at y=767 and y=626, 186 Tab presses, 25 font pairs (27 with uppercase tracking), a 1,208-character Summary→Timeline href and 598 characters after one scope change. Each measurement's definition is in the `definitions` object of `measurements.json`. Three rows need a note:

- In-app links count same-origin `a[href]` values that are not fragment-only: 302 of 305 on All repositories are over 500 characters. The Baseline table's "302 of 307" predates a recorded definition.
- Page data counts the uncompressed `/repos` document and one RSC response: 693,846 and 263,614 bytes on base, 694,833 and 263,977 bytes on the branch (titles, pending spans and logo markup).
- "One server request" per tab click belongs to the timing row and is not regenerated by `--measure`; P0b measures requests per click.

### Unverified premises (P0): results

- Vitest: `tests/components/link-pending.test.tsx` mocks `next/link` by spreading `importOriginal()` and replacing `useLinkStatus`, and the default export keeps working. Storybook: `authentication.spec.ts` opens `authentication-pages--sign-in`, which renders the SVG through `next/image`, and `navigation-feedback.spec.ts` asserts the `useLinkStatus` mock's pending indicators in `navigation-click-feedback--idle-and-pending`.
- `useOptimistic` holds the key until the navigation commits: the handler-navigation cases in `navigation-feedback.spec.ts` (the repository Timeline tab, Contributors→Companies, the company breakdown) assert `data-pending="true"` while the response is held and `"false"` after release.
- Node 24 ICU: the duration cases in `tests/unit/presentation.test.ts` pass on Node 24.22.1.
- WebKit: `brand-assets.spec.ts` decodes the SVG logo at device scale 1 and 2 in the WebKit project.
- Streaming metadata did not occur where observed: on `build:preview`, `/contributors/account-alice` renders its `<title>` inside `<head>` for both a Chrome and a Googlebot user agent. The production title assertion reads the whole HTML, which holds for either placement, and P0b's streamed-fallback check still counts markers only inside `<main>`.

## Appendix A: findings by phase

| Phase | ID | Severity | Finding |
| --- | --- | --- | --- |
| P0 | SHELL-02 | high | Brand asset set: the raster logo is upscaled on HiDPI screens, the SVG logo file is a saved '404' body, and there is no favicon |
| P0 | TYPE-11 | high | Brand mark is an upscaled 200×35 PNG, the SVG asset is a '404: Not Found' text file, and there is no favicon |
| P0 | SHELL-03 | medium | Every route has the same document title, 'Repository activity' |
| P0 | TYPE-12 | medium | Duration values render with 0 to 3 decimals in right-aligned columns |
| P0 | REPO-14 | low | Day durations print with 0 to 3 decimals in one column: '61 d', '40.793 d', '5.58 d', '8.3 d' |
| P1 | COLOR-01 | high | Light-mode surfaces are almost the same white, so cards, header and table bands do not separate |
| P1 | COLOR-02 | high | No elevation system: data panels are flat, ten different shadow recipes elsewhere, and dark overlays share the card color |
| P1 | COLOR-03 | high | Charts use stock shadcn colors that change hue between themes (red-orange in light, indigo in dark) and a third color for the trend line |
| P1 | CONTRIB-11 | high | Light mode is near-white on white (1.06:1 page/card, 1.11:1 table header) and all dashboard cards are flat; the existing card-shadow token is used only by the sign-in card |
| P1 | CONTRIB-12 | high | Every heading, number and label is Arial; display text does not differ from body text |
| P1 | REPO-01 | high | Repository charts use the default shadcn chart-1 colour: orange-red in light, royal blue in dark, never Prebid blue. Dark bars fail 3:1 non-text contrast |
| P1 | REPO-11 | high | Every heading is Arial, and the repository family uses eight heading sizes from 32px to 12px plus 10px body text |
| P1 | REPO-12 | high | Panels have no depth and light mode is white-on-near-white: the shadow token exists but no data panel uses it, and borders are 1.21:1 |
| P1 | REPOS-02 | high | Headings use system Arial like body text, and the panel-title scale differs (17/15/13px) |
| P1 | REPOS-04 | high | Light mode is flat: page and card are 1.06:1 apart, borders 1.21:1, and no dashboard panel has a shadow |
| P1 | SHELL-11 | high | Arial everywhere: no display face, Arial hard-coded in the theme menu, and ad-hoc 9-11px sizes in the shell |
| P1 | TYPE-01 | high | Arial-only font stack: headings look like body text, and declared 500/600 weights collapse to two |
| P1 | TYPE-02 | high | No type tokens: 27 rendered size/weight pairs, four overline styles, four section-title sizes, and buttons at 12px vs 14px |
| P1 | TYPE-04 | high | Numbers: a zero KPI renders bolder than real values; declared value weight and tabular-nums have no effect |
| P1 | COLOR-06 | medium | Interaction colors are fragmented: row hover equals the header band, selection uses three colors, links use three styles |
| P1 | COLOR-07 | medium | All structural lines are one 1px token, so groups, columns and rows have no line hierarchy |
| P1 | COLOR-08 | medium | Brand accents are thin and overloaded: orange means location, action and caveat; blue is barely used; callouts have no type system |
| P1 | COLOR-09 | medium | The Prebid palette is mapped only inside .surface; root tokens are stock shadcn, so the 404 page, destructive red and charts fall back to it |
| P1 | REPOS-09 | medium | Prebid blue and orange appear only in underlines and links; there are no tinted brand surfaces |
| P1 | SHELL-04 | medium | Root tokens are shadcn neutral defaults, so anything outside .surface renders in grey, not the Prebid palette |
| P1 | CONTRIB-16 | low | /foundation and the Storybook foundation stories show off-brand shadcn defaults instead of the real Prebid components; the palette lives only on .surface |
| P1 | CTRL-13 | low | Prebid control tokens exist only inside .surface, so Storybook and global-error render stock shadcn controls |
| P2 | COLOR-04 | high | The primary button color changes by dialog: orange, navy, or near-white in dark, with three hand-written orange recipes |
| P2 | CONTRIB-05 | high | Five different button treatments in one toolbar; Export CSV and 'All accounts' are accidentally off-style; primary actions are navy, not Prebid blue |
| P2 | CTRL-01 | high | Two competing outline-button families; local overrides remove hover feedback on 7 core controls |
| P2 | CTRL-02 | high | Primary action is three different colours: orange, navy ink, and near-white in dark mode |
| P2 | CTRL-04 | high | Six select styles and three search-input styles; mixed radii, low-contrast borders and native OS arrows |
| P2 | REPO-08 | high | Buttons in one toolbar use three heights, two font sizes and two fills; most lack icons, and the primary action is navy instead of the login's orange |
| P2 | REPOS-03 | high | Local CSS overrides split one Button into 3 heights and 2 fills, and remove hover from the main filter buttons |
| P2 | COLOR-05 | medium | Controls in the same toolbar use different fill and border tokens, and field borders are below 3:1 |
| P2 | CONTRIB-04 | medium | Filter/scope area is one card on Report but three blocks with two reset buttons on Over time, and differs again from the Repos timeline card |
| P2 | CONTRIB-09 | medium | Identity presentation is generic: every human, agent, bot and company gets the same muted icon tile, including 'Unmapped company'; detail headers have no identity visual |
| P2 | CONTRIB-13 | medium | Icons are overloaded or missing: 'Users' means three things, CalendarDays two; search/export/reset have no icons; account-type options omit the actor icons |
| P2 | CONTRIB-14 | medium | Empty, error, loading and all-zero states are plain text with no icon or tone; the all-zero timeline has no notice while the missing one does |
| P2 | CTRL-03 | medium | Reset and clear actions use four labels, three sizes and inconsistent icons |
| P2 | CTRL-06 | medium | Icons repeat across unrelated controls, are missing on peers, and render at one size |
| P2 | CTRL-09 | medium | Overlay surfaces vary: dialog fill, radius and width differ, the overlay is 80% black, the close target is 16px, and menu shadows differ |
| P2 | CTRL-10 | medium | Four checkbox idioms, and the Account type filter's apply action is a plain menu row |
| P2 | GAP-03 | medium | Table footers: count wording varies by page, notes float between count and pager, and single-page tables show a disabled 'Previous / Page 1 of 1 / Next' pager everywhere except All repositories |
| P2 | GAP-04 | medium | Dropdown menus have no collision padding: the Columns menu sits flush against the viewport's top or bottom edge and gives no sign that it scrolls |
| P2 | REPO-05 | medium | Record status markers are uncoloured 10px text; Draft uses the same icon as Open, and a closed PR gets the closed-issue check icon |
| P2 | REPO-10 | medium | The two chart disclosures look different: 'At a glance' is a loose 13px band with a left chevron; 'Trend' is a 15px card with chart icon and right chevron |
| P2 | REPO-15 | medium | Partial-coverage notices are plain grey text on repository pages but an orange callout on timelines; empty states have no icon and nest a bordered box inside a bordered panel |
| P2 | REPO-19 | medium | Table search changes place, width and wording between record lists and supporting views, and has no search icon |
| P2 | REPOS-05 | medium | Summary, Timeline and Contributors use three toolbar layouts, three saved-settings wordings and four reset labels |
| P2 | REPOS-06 | medium | Timeline stacks four boxes with different radii and padding, and its scope box repeats the controls |
| P2 | REPOS-07 | medium | Data-quality notices and legends use three styles and two wordings, with no icon |
| P2 | REPOS-10 | medium | Icons are reused for different meanings, missing on some actions and drawn at 13–16px in one toolbar |
| P2 | SHELL-12 | medium | The approved orange primary action exists only as an auth CSS override; the shared Button default is an ink fill |
| P2 | TBL-14 | medium | Table toolbar and pagination controls come in four heights and two font sizes, and Export and paging have no icons |
| P2 | TYPE-06 | medium | One icon stands for several concepts, and some state icons mislead |
| P2 | TYPE-07 | medium | Icon sizes and stroke widths drift; Button silently overrides declared sizes; the external-link arrow detaches from names |
| P2 | TYPE-08 | medium | Equivalent actions carry icons inconsistently, and icons are missing where enterprise apps put them |
| P2 | TYPE-09 | medium | Empty, no-match, error and loading states share one icon-less card with 16px body text |
| P2 | TYPE-10 | medium | Contributor and company identities show a generic glyph styled as an avatar |
| P2 | CONTRIB-15 | low | Table toolbar placement drifts: top-right on overviews, wrapped under the description on supporting records/phone; company breakdown switch and 'Hide zero totals' sit outside the panel |
| P2 | CTRL-08 | low | Two pager implementations with different sizes and icons |
| P2 | CTRL-12 | low | Disclosure toggles use three patterns, including native ▶ markers |
| P2 | GAP-06 | low | Activity bar chart: value labels sit in one row far above the bars, there is no continuous baseline, and zero days vanish |
| P2 | GAP-07 | low | Date ranges carry the UTC zone in five notations, and Contributions omits it |
| P2 | REPO-18 | low | The filter dialog mixes native ▶ disclosure triangles and OS select chevrons with lucide chevrons used elsewhere |
| P2 | REPOS-15 | low | Loading, empty and error states are plain text cards with no icon, action, header or skeleton |
| P2 | TBL-13 | low | Empty tables drop their headers and nest a card inside the card, with no icon |
| P3 | CONTRIB-06 | high | Core metric columns have no group headers or column dividers; optional group headers are left-aligned and separated by the same 1px line as rows |
| P3 | REPO-09 | high | Table headers: group labels are left-aligned, sort arrows are text glyphs with no hover affordance, group dividers are 1px like row lines, and individual columns have no lines |
| P3 | REPOS-12 | high | Group headings are left-aligned over right-aligned numbers, group lines are as thin as row lines, and the sort indicator is a text arrow |
| P3 | TBL-01 | high | Tables borrow generic tokens: hover matches the header band, every line has the same weight, no column lines, light mode reads as white |
| P3 | TBL-02 | high | Group headings sit left over right-aligned columns, with no spanner rule; the pinned junction doubles the line |
| P3 | TBL-03 | high | Sort is a text glyph on the sorted column only; unsorted columns show no cue and labels shift when the sort changes |
| P3 | TYPE-05 | high | Arrow glyphs typed as text for sort state, back links and the scroll hint |
| P3 | CONTRIB-07 | medium | Header wrapping and cell typography are inconsistent: ragged 1-/2-line metric headers (58px vs 43px rows) and adjacent identity columns styled differently |
| P3 | CONTRIB-08 | medium | Sort state is a text arrow glyph on the active column only; unsorted columns give no affordance |
| P3 | CONTRIB-10 | medium | Drillable numbers look different on Report (plain ink) vs Over time (blue underlined); KPI tiles are flat text with no icon, accent or click affordance |
| P3 | CTRL-05 | medium | Column sort direction is a text glyph that wraps alone, and unsorted columns show no affordance |
| P3 | GAP-01 | medium | In two-line rows, body cells are vertically centred, so numbers sit between a record's title and its sub-line |
| P3 | GAP-02 | medium | The active sort is shown three different ways, or not at all, when the sorted column is hidden or outside the visible period window |
| P3 | REPO-06 | medium | In record lists the author's GitHub arrow sits about 120px from the name at the column edge; elsewhere it follows the name. Author type is text-only, while Contributors uses icons |
| P3 | REPO-07 | medium | Merge-duration and credit tables use raw record columns: separate Status/Labels columns, underlined titles, plain-text 'Merged', and a horizontal scroll at 1440 |
| P3 | REPOS-08 | medium | In two-period comparison the periods have no visual identity and the difference row shows no direction |
| P3 | REPOS-13 | medium | Numeric links and repository names are styled differently on Summary and Timeline |
| P3 | TBL-04 | medium | Header labels wrap unevenly, sit middle-aligned, and weekly or partial period headers waste space |
| P3 | TBL-05 | medium | Numeric columns misalign: the partial asterisk pushes digits left, durations show 0–3 decimals, negatives use a hyphen |
| P3 | TBL-06 | medium | The pinned identity column absorbs surplus width: 248px becomes 308–516px, and stacked tables misalign |
| P3 | TBL-07 | medium | The pinned edge has no depth when scrolled, overflow is cued by text alone, and the insights record table pins nothing |
| P3 | TBL-08 | medium | Headers scroll away on 50-row tables: no table has a sticky header |
| P3 | TBL-09 | medium | Three visual dialects for the same PR/issue records (pinning, title underline, status chip, label chip, alignment) |
| P3 | TBL-10 | medium | On record lists the author link's ↗ is pushed to the cell's right edge, about 230px from the name |
| P3 | TBL-11 | medium | Drilldown numbers look unlinked on Summary and Contributions but blue on Timeline; title links are underlined on some pages only |
| P3 | TYPE-13 | medium | Drillable numbers are styled two different ways |
| P3 | GAP-05 | low | A partial period is marked two ways: '(partial)' appended to matrix headers vs a bordered 10px 'Partial period' chip on a third row line |
| P3 | GAP-08 | low | Author-scoped record lists repeat the selected author in a full-width Author column on every row |
| P3 | REPO-17 | low | Weekly timeline rows print the same date range twice |
| P3 | TBL-12 | low | Row density and identity typography vary per feature through ad-hoc padding overrides |
| P3 | TBL-15 | low | The admin users list uses the generic shadcn table instead of the shared table design |
| P4 | CONTRIB-01 | high | Contribution pages use a third, divergent page-header pattern (left title + eyebrow) vs centered Repositories headers; snapshot emphasis also flips |
| P4 | CONTRIB-02 | high | Switching Report -> Over time rebuilds a different header: area tabs vanish (74px jump), detail pages lose 'Back to report' and the company link, subtitle copy changes |
| P4 | REPOS-01 | high | Three different page-header builds, and the 'Reporting snapshot' emphasis flips between pages |
| P4 | SHELL-01 | high | The header is a static, flat bar that almost disappears in light mode and has no product identity. One shell spec is proposed here. |
| P4 | TYPE-03 | high | Page headers: three layouts, four h1 sizes, and snapshot emphasis inverted between pages |
| P4 | CONTRIB-03 | medium | Two stacked tab rows (and a third breakdown style) look identical, so the Contributors/Companies -> Report/Over time hierarchy does not read |
| P4 | CONTRIB-17 | medium | On phones the filter card and header push the first table row below ~1.5 screens; the identity avatar disappears |
| P4 | CTRL-07 | medium | Tabs have no hierarchy: nested tab bars look identical, a third segmented pattern exists, and count pills are duplicated |
| P4 | REPO-02 | medium | The page header is implemented three times, so the snapshot block's emphasis is inverted between All repositories and repository pages, the link sizes differ, and the branch reads as one phrase |
| P4 | REPO-03 | medium | Record scope appears four times in four styles: an unlabelled select, an ink-accent callout, an unaccented strip on supporting views, and a repeated panel title |
| P4 | REPO-04 | medium | Supporting views (author lists, credits, durations, author records) have a <p> page title, mixed breadcrumb arrows, no author identity and no selected tab |
| P4 | REPO-13 | medium | At phone width the repository tab bar wraps: Timeline drops to a second row and the active underline floats between rows |
| P4 | SHELL-05 | medium | System and edge pages are unbranded: auth setup, root 404, repository 404 and global error |
| P4 | SHELL-06 | medium | Account identity is plain text that disappears on phones, 'Sign out' is a bare text button, and there is no way to change a password from the dashboard |
| P4 | SHELL-07 | medium | Header icon buttons are faint 40px circles, the width-toggle glyph does not say 'full width', and its pressed state is invisible |
| P4 | SHELL-08 | medium | Main navigation: small 13px labels, a full-height square hover block, an active underline at 1.86:1 in light mode, and no icons |
| P4 | SHELL-10 | medium | The sample-data notice is an 11px footnote in its own row instead of a clear environment badge |
| P4 | SHELL-16 | medium | The administrator Users page is built outside the design system (audited from source only) |
| P4 | SHELL-17 | medium | Two page-title patterns under one shell: centred with no eyebrow on repository pages, left-aligned with an eyebrow on contribution pages |
| P4 | CTRL-11 | low | Header controls are the only circles, the width toggle has no pressed state, and Sign out is bare text |
| P4 | REPO-16 | low | Tab count badges look identical on active and inactive tabs and mix 11px and 10px text; the CSS is duplicated with diverging rules |
| P4 | REPOS-14 | low | At 2560 the tables stretch (234px numeric columns) and contained mode is still 2176px wide; at 390 the Timeline toolbar breaks into four rows |
| P4 | SHELL-09 | low | The two header menus use different specs, the Repositories menu is a 590px single column, and on phones it touches the screen edge |
| P4 | SHELL-13 | low | Auth screens are inconsistent: Title Case vs sentence case, '...' vs '…', a left-aligned link on the error card, a 9px eyebrow, and a card style that differs from the dashboard |
| P4 | SHELL-14 | low | The dashboard has no footer, while the auth pages do |
| P4 | SHELL-15 | low | The skip link is an unstyled square that covers the logo |
| Deferred | REPOS-11 | medium | No headline numbers above the tables; KPI tiles or inline bars would conflict with the approved plan (decision needed) |
