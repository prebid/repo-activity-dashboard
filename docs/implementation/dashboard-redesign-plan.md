# Dashboard redesign plan

Bring every dashboard page onto one Prebid visual system, make navigation respond immediately, replace the long state-carrying URLs with short explicit ones, and split the contribution area into Contributors and Reviewers. The plan is grounded in the 2026-10-31 visual review of `8119ede`, which covered 29 report views and the sign-in pages in both themes at 390–2560px. Finding IDs such as `TBL-02` refer to that review; Appendix A assigns every finding to a phase, and each phase plan restates the findings it implements with their file anchors.

Status: decisions approved 2026-10-31. P0 checkpoints approved 2026-11-01 (see `## P0 evidence`). P1 checkpoints approved 2026-11-01 (see `## P1 evidence`); P1 and P2 land in the same pull request as P0.

## Scope and preservation

- Changes: design tokens and typography, controls and states, the table system, the application shell and page header, in-page navigation, loading behavior, URL state and preference storage, and the Contributors/Reviewers navigation.
- Preserved: metric definitions, the known-zero/missing/partial distinction, 50-row pagination with full-result counts and exports, authentication and account boundaries, the presentation/server separation enforced by `npm run check:boundaries`, typed display models, the 18-repository catalog and stable repository IDs, Dark default with Light/Dark/System, and prepared data until the real-data milestone.
- Real data is next. Until it lands, every page header labels its report with a "Sample data" chip beside the "Data as of" chip; the "Sample reporting data" frame row is not restored.
- No new npm dependencies unless a phase plan justifies one. Fonts load through the installed `next/font`.

## Approved decisions

| Area | Decision | Documents amended (phase) |
| --- | --- | --- |
| PR base | Redesign pull requests branch from and target `main`. `codex/frontend-rebuild` (`d5a7020`) is contained in `main` and receives no new work. | `docs/product/README.md:36`, `:101` (this change) |
| Masthead | Navy `#17232e` in both themes with a 3px Prebid-blue top rule; logo only, no product name beside it. | — (P4) |
| Typography | Mona Sans at 112% width for every header-level element: page titles 800, panel titles 700, top navigation, tabs and section chips 14px/600 (tabs 700 when active). Inter for text and numbers. At 600px and below the top navigation uses the 13px body size at 100% width, so its four destinations fit one row at 390px (P6). | `foundation-contracts.md` `## What visually locked means` (P1) |
| Colour roles | Orange `#ffad32` means act and "you are here" (primary action; nav, tab and sort underline). Blue means links, selection, group rules, the row-hover bar and charts. The amber "Data as of" chip is the one other warm accent. | `login.md:50` already requires orange primary actions (P1, P2) |
| Page header | Title flush left on every page with one meta line beneath; amber "Data as of" chip on the right; tabs and "On this page" section chips centred in a sticky view bar. Contribution pages drop the eyebrow and subtitle. | `all-repositories.md:232`, `repository-detail.md:32`, `all-repositories-plan.md:55` (its "new navigation system" clause only) (P4, amended) |
| Sample-data notice | A "Sample data" chip in each page header's Data source, beside "Data as of", while reports read prepared samples (`reportingDataIsSample` in `src/config/reporting.ts`); the frame row stays removed. Re-added 2026-11-02 at the maintainer's request. | `all-repositories-plan.md:38`, `acceptance-matrix.md:26` (amended) |
| Headline totals | Not added now; the `all-repositories-plan.md:55` clause "Do not add charts, headline KPI cards" stands. | — |
| URLs | A URL records only fields that differ from fixed, versioned product defaults; an absent field never means a saved preference. A bare entry URL such as `/repos` redirects to the viewer's saved view only when that view differs from the defaults. Return context travels as a short `back=` frame only when the parent is not the derived default. Old links are decoded by the frozen current readers and answered with a 307 to the new form. | `foundation-contracts.md:21`, `:124`; `all-repositories-plan.md:78`, `:81`; `timeline-reporting-plan.md:85`, `:89`; `contributors.md:332`, `:372`, `:380`. `contributors.md:373` and `foundation-contracts.md:130` stay and govern the `back=` limit (P5) |
| Preferences | Per-viewer preferences move from localStorage to validated cookies the server reads, so the first render is final. No new AWS storage; named server-stored views are a later milestone. | `foundation-contracts.md:18`, `:21` (its restoration and preference-identity sentences), `:36`, `:120`, `:126`, `:128`, `:130`, and a new `## Preference cookies` section; `all-repositories-plan.md:80`, `:82`, `:83`; `repository-detail.md:240`; `contributors.md:371`, `:372` (its scenario clause), `:380`; `timeline-reporting-plan.md:85` (P5b, amended) |
| Contributions IA | Top navigation reads Contributors and Reviewers: two lenses over one report with shared filters and a Companies tab in each, each lens showing three default credit columns. Merges performed belongs to the Reviewer set. Reviewer-only row eligibility ships as a later step. | `contributors.md:29`, `:40`, `:70`, `:76`, `:274`, `:276`, `:324`–`:332`, `:377` (P6) |
| Deferred | Per-visit panel collapse; a condensed title with Back to top inside the stuck view bar; server-stored named views. | — |

## Architecture rules

These apply to every phase. Each is enforced mechanically by the phase named in brackets; until then it is a review rule.

1. **Tokens are the only source of visual values.** Colours, shadows, radii, font families and font sizes are defined once in `src/styles/prebid.css` and mapped for Tailwind in `src/app/globals.css`. [P1: `scripts/check-design-tokens.mjs`, see P1.]
2. **Semantic tokens are mapped at `:root` and `.dark`.** The `--prebid-*` palette is already root-level; the semantic mapping moves from `.surface` (`dashboard.module.css:1-18`) and the `--auth-*` aliases (`authentication.module.css:1-24`) into `globals.css`, replacing the stock oklch values, so the 404 page, error pages, authentication and Storybook render the same system. `global-error.tsx`, which replaces the root layout, imports `globals.css` and the font classes. [P1]
3. **Primitives own appearance; features own composition.** Feature, route and shared component code may set layout (grid, gap, width, order) on a wrapper but never a primitive's height, colour, background, border or shadow; a needed difference becomes a variant or prop. [P2: `no-restricted-syntax` in `eslint.config.mjs` rejects a `className` attribute on `Button`, `Input`, `SearchField`, `NativeSelect`, `Checkbox`, `Radio`, `DropdownMenuContent`, `DialogContent` and `Card` in `src/features/**`, `src/app/**` and `src/components/**`, except the primitives in `src/components/ui/**` and, until P4 rebuilds the shell, `src/components/layout/**`. The design-token check rejects feature CSS that restyles a native control or primitive through a descendant selector.]
4. **One component per pattern.** New code uses the owning component (see Component ownership). From P3, a phase replaces existing call sites only where the old pattern is wrong, not to rename it; other sites move when they are next changed (Delivery rules). [P2: `no-restricted-imports` of `lucide-react` outside the icon-map module. P4: `no-restricted-syntax` rejects `h1` outside `PageHeader`, authentication and edge pages.]
5. **Every primitive has Storybook stories** for each variant and state. A story is covered by the browser suite only when a spec opens its iframe; each phase adds its story IDs to a source-controlled list under `tests/e2e/`, and one spec visits every listed story in Light and Dark (`&globals=theme:light|dark`) with axe on `#storybook-root`. Test titles come from that list, not from `storybook-static/index.json`, because CI lists browser cases before Storybook is built. [P1]
6. **One URL codec.** From Phase 5, links and history writes go through one parameter registry and serializer: a pure module in `src/lib/presentation/` and its hook in `src/lib/navigation/`. `no-restricted-syntax` rejects `NewExpression[callee.name='URLSearchParams']`, `history.pushState`/`replaceState` and `router.push`/`replace` elsewhere; exceptions are named in the P5 plan and removed by P5e. A unit test runs ESLint on a fixture and expects the error. [P5c]
7. **Typed props in, presentation out.** New primitives take typed props, never raw samples or route parameters, keeping the boundary that `check:boundaries` enforces.
8. **Accessibility is part of the spec.** WCAG AA text contrast (4.5:1, 3:1 for large text) and non-text contrast (3:1, WCAG 1.4.11) for control boundaries, focus rings, selected indicators and chart marks, in both themes. axe checks text contrast only, so each phase adds computed-style contrast assertions for the non-text pairs it introduces. The orange underline on light surfaces is paired with a weight or ink change. Visible focus, keyboard reach for new navigation, `prefers-reduced-motion`, and no information carried by colour alone.
9. **No post-load rewrites.** New code from P0 renders its final state on the server. Existing client restoration (`use-table-controller.ts`, `use-overview-settings.ts`, `use-timeline-controls.ts`, `use-contribution-controls.ts`, `use-repository-page-controls.ts`) is removed in P5b. Two post-load writes are permitted, both cookie-only with no history write: P5b's one-time localStorage migration, and deleting a preference section the server rejected while the cookie still holds that value (P5 decision 7).
10. **Status codes are decided before streaming.** No `loading.tsx` sits above code that calls `notFound()` or `redirect()`; existence and access checks for a segment run in its `layout.tsx`, above its loading boundary.

## Delivery rules

Adopted after P2 (about 300 files across P0–P2) and applied from P3. Each phase plan states how it meets them.

1. **Stable component APIs.** Change a component's internals rather than renaming its variants or props or replacing it. A call-site change needs a defect at that call site, not a naming preference.
2. **Behaviour tests only.** Tests assert what users and callers rely on: roles, accessible names, text, values, focus, URLs, and layout geometry where layout is the requirement. No test asserts that a utility or CSS-module class is present; Storybook axe, story coverage and the browser geometry specs cover appearance. Existing class-name assertions are removed when their file is next changed.
3. **No new custom tooling.** Use ESLint, stylelint and the existing scripts; the design-token check is maintained, not extended.
4. **Sweep only what is wrong.** A pattern that is merely old stays until its file is next changed; new code follows the new pattern.
5. **Cadence.** Steps that touch different files run in parallel; one independent review per phase; the full browser suite once per phase; CI on the pull request is the final gate.

## Component ownership

Shared components live where the dependency-cruiser rules allow a component used by two features (`shared-no-features`, `feature-isolation-*`).

| New | Replaces or extends | Location | Phase |
| --- | --- | --- | --- |
| Icon map | direct `lucide-react` imports (35 files) | `src/components/ui/icons.ts` | P2 |
| `SearchField`, `NativeSelect`, `Checkbox`, `Radio` | the table search inputs, the Radix `Select` and native selects, and native checkbox and radio inputs | `src/components/ui/` | P2 |
| `Callout` | `src/components/ui/alert.tsx` and ad-hoc notices | `src/components/feedback/` | P2 |
| `DataLegend` | the glyph-key strings in table and matrix footers and chart cards | `src/components/feedback/` | P2 |
| `EmptyState` | replaces `PageState` (`src/components/feedback/page-state.tsx`, deleted); `PageError` renders through it | `src/components/feedback/` | P2 |
| `Pager` | the table pager and the contribution choices pager; the timeline matrix period window uses it with its own labels | `src/components/tables/` | P2 |
| `ChartPanel` | the At a glance and Trend disclosures | `src/components/charts/` | P2 |
| `DisclosureChevron` | the per-disclosure chevron, rotation and native-marker CSS in ChartPanel, FilterChoices and the sign-in help | `src/components/ui/` | P2 |
| `Avatar` | the generic identity glyph tile | `src/components/github/` | P2 |
| `RecordStatus` | the uncoloured PR and issue status text | `src/components/github/` | P2 |
| `ReportToolbar` | the `timeline-controls.tsx`, `repository-scope-controls.tsx` and `contribution-controls.tsx` layouts, and the scope summaries beside them; those files now render fields only. The activity-period controls keep their own layout beside the Period activity table and use the same field primitives | `src/components/reporting/` (distinct from the masthead `Toolbar` in `src/components/layout/toolbar.tsx`) | P2 |
| `SortIcon` | the typed sort glyph (`data-table.tsx:244`) | `src/components/tables/` | P3 |
| `RecordIdentity`, `RecordNumber`, `RecordTitleLink` | the record pages' title, number, status and label cells (`.titleLink`, `.number`, `.recordMeta` and `.label` in `repository-page.module.css`) and their separate Status and Labels columns; the merge-duration list's " (Draft)" title suffix and its Status and Labels columns; the contribution supporting-record link's own `.recordLink` and `.recordNumber` rules | `src/components/github/record-identity.tsx` | P3 |
| `PartialPeriodMarker`, and `DataColumn.labelCaption` in a table header | the bordered 10px "Partial period" chip in Timeline rows, "Partial calendar period" in the Timeline supporting scope, and " (partial)" after matrix period headers | `src/components/reporting/timeline-value.tsx` | P3 |
| Drillable-number style | the per-feature number links: the Summary and Contributions `.metricLink`, the Timeline `.valueLink` and the insight "View N PRs" link's `.recordLink` | `src/components/metrics/drillable-number.module.css` | P3 |
| `PageHeader` | `AllRepositoriesHeading`, `RepositoryHeader`, `ContributionHeading`, the header in `timeline-support-frame.tsx` | `src/components/navigation/` | P4 |
| `ViewBar`, `SectionNav` | extend `ViewTabs`/`DisabledTab` (`src/components/navigation/view-tabs.tsx`) | `src/components/navigation/` | P4 |
| Account menu | the bare "Sign out" button and account name text | `src/components/layout/` | P4 |

## Visual specification

Starting values approved on 2026-10-31. Light value first, dark second. A phase plan may refine a value at its checkpoint and records the change here.

**Surfaces.** Canvas `#eef2f6` / `#0d161f`; card `#ffffff` / `#17232e`; sunken well `#f5f8fa` / `#111c26` (in-card wells that use `--background` move to it); overlay `#ffffff` / `#1c2a37`; table header band `#e8eef4` / `#253947`; header-band hover `#dfe7ee` / `#2c4253`; row hover `#f1f6fb` / `#1d3040`.

**Text.** Ink `#1c3445` / `#e6eef4`; muted `#526473` / `#a1b2bf`; table header ink `#3d5262` / `#b8c7d3`; link `#2a6a9b` / `#6cb0e3`.

**Lines.** Subtle `#e3e9ee` / `#26394a` (between columns and rows); default `#d3dde5` / `#304352` (card edges); strong `#b8c6d1` / `#4a6274` (column groups, pinned edge, header base). Form-field and secondary-control edges use the input border `#798b99` / `#6a8396`, at least 3:1 on card, canvas, sunken, overlay and header band in both themes (P2 item 8; decision 5 gives secondary buttons the same edge). Fields fill with `--prebid-input` (`#ffffff` / `#111d27`).

**Brand and state.** Prebid blue `#3887c2`; orange `#ffad32` (hover `#ffba56`, pressed `#f29d1f`, border `#e8a03a`, ink `#1c3445` at 6.93:1, both themes). Selection: one tint for selected controls, pressed bars and avatars, `#e8f1f8` / `#1e3a50` with ink `#1f5f8f` / `#9ed3f2`. Warning and "Data as of": `#fff6e6` / `#f5c46b` / ink `#8a5300` / icon `#b86e00`; dark `#3a2a10` / `#8a6a2a` / ink `#ffd08a`, dark icon `#ce8228` (P1). Dark link refined to `#6fb2e5` in P1 (the `#6cb0e3` below is 4.45:1 on the dark header-band hover). Info ink `#1f5f8f` / `#9ed3f2` completes the info set (P2). Placeholder `#66727e` / `#96a9b7` (4.91:1 on a Light input). Ghost hover `rgb(28 52 69 / .08)` / `#253947`, because `--prebid-hover` is 1.02:1 on the Light canvas. Scrim `rgb(13 22 31 / .5)` / `rgb(0 0 0 / .6)`; menu scroll cue `rgb(16 42 67 / .16)` / `rgb(0 0 0 / .55)`. Masthead `#17232e` in both themes. A Prebid chart palette replaces the stock `--chart-*` values and is checked for contrast and colour-blind separation in both themes. P1 defines one series colour, Prebid blue; further colours are added with the first two-series chart, checked pair by pair.

**Elevation and radius.** Level 1 (panels, buttons, masthead): `0 1px 2px rgb(16 42 67 / .06), 0 1px 3px rgb(16 42 67 / .08)`; dark `0 1px 2px rgb(0 0 0 / .4), inset 0 1px 0 rgb(255 255 255 / .03)`. Level 2 (menus) and level 3 (dialogs) are defined in the P1 plan. Pinned-column edge: `6px 0 8px -6px` shadow while scrolled sideways. Radius 8px for controls and menus, 12px for panels, callouts and dialogs, 4px small (`--prebid-radius-small`: checkbox boxes, menu items, filter chips, the password toggle and small focus outlines; `--radius-sm` maps to it) and 2px for chart bars and their tracks (`--prebid-radius-mark`).

**Type.** Display 30/34 Mona Sans 800; title 18/26 Mona Sans 700; KPI 28/36 Inter 600; heading 14/20 Inter 600; body 13/20 Inter 400 (controls 500); small 12/18; caption 11/16 Inter 500; overline 11/16 Inter 600, uppercase, +0.06em. Top navigation at 600px and below: 13px Mona Sans 600 at 100% width (P6; 14px at 112% above). Numbers use `font-variant-numeric: tabular-nums lining-nums` and one weight (500, KPI 600), so a known zero never renders bolder than a real value. Inter 700 only for table group headings and the sign-in submit. Nothing below 11px. Field text is 16px under `pointer: coarse` (`--prebid-text-input-coarse`), so iOS does not zoom into a focused field.

**Controls.** Heights 28 / 34 / 40px; every in-page control 34px (40px on coarse pointers); header icon buttons 36×36. Primary: orange, at most one per surface. Secondary: overlay fill, 1px input-border edge (P2 decision 5), level-1 shadow, hover fill `--prebid-hover` with a `#3887c2` edge. Selected/pressed: selection tint with a `#2d72a6` / `#5aa5dc` edge. Ghost for every reset, with `RotateCcw` and sentence-case labels: "Reset view" restores what a view saves and "Reset filters" the shared report filters (P2 decision 4). Native selects share one wrapper with `appearance: none` and a 14px `ChevronDown`. Disclosures use a trailing `ChevronDown` that turns 180° when open; `<details>` summaries hide their native marker. Removable filter chips are 28px in the selection tint with the selection edge. A menu's closing action, such as Apply, is a primary sm button in the menu footer.

**Overlays.** Dialogs take `size` `sm` 512px, `md` 640px or `lg` 680px, capped at 100vw − 32px; radius 12px, padding 24px (20px at 600px and below), titles at title 18/26 Mona Sans 700, and a 34×34 ghost close button with a 16px `X` at top 12, right 12. Menus take collision padding 16px, sizes `auto` (from 156px), `sm` 240px, `md` 320px and `lg` 360px, level 2, 32px rows (40px on coarse pointers) at 13/20 weight 500, and a scroll cue when their content scrolls.

**Tables.** Group headings centred, 11px/700 uppercase, +0.07em, with a 2px `#3887c2` spanner rule; 2px strong lines between groups and at the pinned column (one line at the junction); 1px subtle lines between columns; `SortIcon` in a 14px slot with 12px icons at stroke 2: idle `ChevronsUpDown` in `#6f8292` / `#7e93a4`, sorted `ArrowUp`/`ArrowDown` in the link colour, before the label in numeric columns and after it in text columns, with an orange underline on the sorted header; row hover adds a 3px `#3887c2` inset bar on the first cell.

**Icons.** lucide-react through the icon map, stroke 1.5 with `absoluteStrokeWidth`, sizes 14 and 16 (12px direction glyphs at stroke 2; 10px account glyphs in an identity badge at stroke 1, where a 1.5px line fills the gaps between `Cpu`'s pins). Columns `Columns3`; PR age `Hourglass`; Metrics `ListChecks`; Filters `SlidersHorizontal`; Account type `Shapes`; Population `UserRoundCheck`; Timeline and Over time `CalendarDays`; Custom range `CalendarRange`; Swap periods `ArrowLeftRight`; Add `Plus`; Export `Download`; Reset `RotateCcw`; Retry `RefreshCw`; Clear and Close `X`; Search `Search`; Help `CircleQuestionMark`; disclosure `ChevronDown`/`ChevronUp`; pager `ChevronLeft`/`ChevronRight`; At a glance `ChartColumnBig`; Trend `ChartNoAxesCombined`; width toggle `ChevronsLeftRight`; external link `ArrowUpRight`; back `ArrowLeft`; scroll hint `ArrowRight`. States: info `Info`, warning `TriangleAlert`, error `CircleAlert`, empty `Inbox`, no match `SearchX`, missing `CircleDashed`, loading `LoaderCircle`. PR open `GitPullRequestArrow` (success), draft `GitPullRequestDraft` (muted), merged `GitMerge` (link blue), closed `GitPullRequestClosed` (error); issue open `CircleDot` (success), closed `CircleCheckBig` (muted). Accounts: human `UserRound`, agent `Cpu`, bot `Bot`, unknown `CircleQuestionMark`. No arrows typed as text.

**Identity.** People: 32px circular initials avatar (Inter 600 12px) in the selection tint with a 14px account-type disc holding a 10px glyph at a 1px line, so the badge leaves the second initial readable; the 48px version takes an 18px disc with a 14px glyph at 1.5px. Companies: rounded-square monogram (8px radius) in the same tint; the unmapped-company bucket is a dashed tile with a muted `Building2` glyph. Detail-page headers use the 48px version, with a 1px default-line edge on the canvas. The Account type choices show the same glyphs at 16px.

## Phases

| Phase | Goal | Depends on | Findings | Effort |
| --- | --- | --- | --- | --- |
| P0 | Quick wins: click feedback, brand assets, page titles, durations, capture tooling | — | 5 | S |
| P0b | Loading skeletons and prefetch, after a measured premise check | P0 | — | M |
| P1 | Foundation: tokens, fonts, type scale, elevation, chart palette, token check | P0 | 22 | M |
| P2 | Controls, states, icons and identity | P1 | 41 | M |
| P3 | Table system | P2 | 31 | M |
| P4 | Shell, page header and in-page navigation | P2, P3 | 26 | M |
| P5 | URL state and server-read preferences (three pull requests: P5a, P5b, and P5c–P5e together) | P4; P5a any time | — | L |
| P6 | Contributors and Reviewers (one pull request: P6a, P6b and P6c together) | P4, P5c, P5d | — | M–L |

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
- Fonts in `src/styles/fonts.ts`: Mona Sans with its `wdth` axis and no fixed weight (`--font-mona`) and Inter (`--font-inter`), latin and latin-ext, through `next/font/local` with committed OFL files (see `## P1 plan`, item 3). `globals.css` maps `--font-display` and `--font-sans` to them; the variable classes go on `<html>` in `src/app/layout.tsx` and `src/app/global-error.tsx` and in `.storybook/preview.tsx`; Vitest aliases `next/font/local` to `tests/support/next-font.ts`. Remove the Arial hard-coding in `globals.css` and `theme-menu.module.css`.
- `scripts/check-design-tokens.mjs`, exporting `inspectDesignTokens(root)` and appended to `check:boundaries`. It parses every CSS file under `src/` with the installed `postcss` and scans `className` strings and `style` objects in `src/**/*.tsx` and `.storybook/*.tsx`. It fails on hex, `rgb()`, `hsl()`, `oklch()` and `color-mix()` literals; literal `font-size`, `font` shorthand, `font-family`, `box-shadow` (except `none`) and `border-radius` values; Tailwind arbitrary values with a literal (`text-[13px]`, `bg-[#fff]`, `shadow-[…]`, `rounded-[5px]`) and default-scale colour and shadow utilities not mapped to a token — all outside `src/styles/prebid.css` and `src/app/globals.css`. It prints the files it scanned and fails on zero inputs. Allowlist entries are keyed by file, selector and property, each with a reason, and the list only shrinks. `tests/unit/design-tokens.test.ts` holds one failing fixture per pattern. The P1 plan states which of today's roughly 150 raw `font-size` and 12 `box-shadow` declarations P1 converts and which are allowlisted for P2–P4.
- The story-coverage spec (rule 5) and a Storybook foundation page showing every token in both themes.

Exit: the token check passes; a browser spec over the view inventory (one spec in parallel mode, so CI's two shards per engine divide it) asserts no axe violations on `main` in both themes and that no rendered element's computed `font-family` resolves to Arial; a chart-colour test covers both themes.

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

- Masthead: `--shell-height` 64px, sticky at the top (at 1000px and below, a 56px row plus a 44px navigation row; 1120px and below from P6, when a fourth destination joined the row); navigation labels in Mona Sans; header icon buttons 36×36 with a visible pressed state; an account menu (28px avatar, name, email, role, Change password outside preview builds, Sign out).
- `PageHeader`: back link and title flush left, one meta line, the "Data as of" chip on the right inside `aside aria-label="Data source"`. Header rows have fixed heights so sibling tabs never move the toolbar; existing h1, region, tab-navigation and button accessible names are kept; the `ReportToolbar` summary row is the one place each page states its scope.
- `ViewBar`: a fixed 44px bar holding the tabs and, on pages with two or more sections, `SectionNav` chips with scroll-spy; sticky at `top: var(--shell-height)`; `scroll-padding-top` equals the masthead height plus 44px plus 12px; a jump moves focus to the section heading and updates the fragment with `history.replaceState`, adding no Back entry. A "Sections" menu replaces the chips at 600px and below, and above 600px wherever the chips do not fit beside the tabs, as `SectionNav` measures (from the final visual inspection; 600px alone before it). P4 sets `--sticky-offset` for P3's sticky table headers.
- Remove the frame's sample-data row. Merge the two contribution tab rows into the view bar.
- Branded edge pages (404, error, setup) and a footer, using the same tokens.
- Amend the documents in the Page header and Sample-data rows of Approved decisions.

Exit: one header implementation on every page; Period activity reachable in one action from the first screen, with keyboard reach measured against the 186-Tab baseline; at 390px the four navigation labels fit on one row, measured in the browser suite; the shell files keep their 100% per-file coverage floor.

Tests most likely affected: `layout-width.spec.ts` (Sign out, the `Data source` aside, brand link, gutters, administration spacing); the `Sign out` selector in `foundation`, `overview-preferences`, `theme` and `timeline-controls` specs, `account-recovery.test.tsx` and the production browser and recovery suites; heading level, `Company breakdown` and `Back to report` in `contribution-layout.spec.ts` and `contribution-navigation.spec.ts`; `Repository lists` navigation in `repository-page-layout.spec.ts` and `timeline-layouts.spec.ts`; the skip-link frame check in `visual-review.spec.ts`; the `dashboard-header`, `dashboard-layout`, `layout-width` and `contribution-header` component tests.

### P5 — URL state and preferences

Three pull requests in order: P5a, then P5b, then P5c, P5d and P5e as one pull request (maintainer decision, 2026-11-02).

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
2. **Branch** `feature/<phase-slug>` from `origin/main` with `--no-track`; one pull request per phase (three for P5: P5a, P5b and P5c–P5e; P6 is one).
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
  - Result (2026-11-02, on `c577b6f`, `build:preview` and `build:production:fixture`): does not hold.
  - Statuses hold: with leaf layouts that read `x-dashboard-return-path`, 92 of 92 statuses and `Location` headers matched the base.
  - Server HTML does not: 52 of 52 report documents streamed their fallback, with the rows outside `<main>`. React outlines a finished boundary once the page passes 12,800 bytes.
  - Skeletons never appeared on search-parameter tab clicks.
  - Prefetch cost 4–12 account reads per page view in production, against 1 without it.
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
| P0 | Merged; one pull request with P1 and P2 | #16 | Approved 2026-11-01 | Approved 2026-11-01 |
| P0b | Closed: premise does not hold (2026-11-02). `prefetch={false}` and Architecture rule 10 are unchanged. | — | — | — |
| P1 | Merged; same pull request as P0 | #16 | Approved 2026-11-01 | Approved 2026-11-01 |
| P2 | Merged; same pull request as P0 and P1 | #16 | Approved 2026-11-01 | Approved 2026-11-01 |
| P3 | Merged | #20 | — | — |
| P4 | Merged | #18 | — | — |
| P5 | Merged | #19, #21, #23 | — | — |
| P6 | Merged (see `## P6 evidence`); final visual inspection fixes merged in #25 | #24 | Not signed off (`## P6 evidence`, Not run) | Not signed off |
| P7 | Companies lens and company mapping: plan approved 2026-11-03 (see `## P7 plan`) | — | Pending | Pending |

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

## P1 plan

Proposed and approved 2026-11-01 against `abe9dd7`. P1 lands on the P0 branch and in the same pull request; Checkpoint B compares `abe9dd7` with the P1 head. Statements about installed software cite `node_modules`; counts come from `git grep -P` over `src/**/*.css` and the TSX under `src/` and `.storybook/`.

### Scope

The 22 P1 findings in Appendix A. P1 defines the tokens, fonts, type scale, elevation, radii and chart palette, maps them at `:root` and `.dark`, and moves existing styles onto them. Controls (P2), table structure (P3), and the shell, page header, navigation labels and tabs (P4) keep their structure; where a P1 token reaches those files, only the source of the value changes.

| Finding | Items | Part left to a later phase |
| --- | --- | --- |
| COLOR-01, CONTRIB-11, REPOS-04, REPO-12 | 1, 2, 5 | — |
| COLOR-02 | 2, 5 | — |
| COLOR-03, REPO-01 | 2, 6 | — |
| COLOR-06 | 1, 2 | Selected-control colour moves with P2 controls |
| COLOR-07 | 1 | P1 defines subtle, default and strong lines and keeps card edges on default; table rows, columns, groups and the pinned edge move onto them in P3 (TBL-01, TBL-02) |
| COLOR-08 | 2 | Orange as the primary action is P2 (COLOR-04, CTRL-02); callouts are P2 (`Callout`) |
| COLOR-09, SHELL-04, CTRL-13, CONTRIB-16 | 2, 7 | — |
| REPOS-09 | 2, 6 | Tinted brand surfaces on controls and headers are P2 and P4 |
| CONTRIB-12, TYPE-01, SHELL-11 | 3, 4 | Display face on navigation and tabs, and the shell's 9–10px sizes, are P4 (decision 2) |
| REPO-11, REPOS-02 | 4 | Page-title sizes are P4 (`PageHeader`, TYPE-03) |
| TYPE-02 | 4, 7 | Button sizes are P2 (CTRL-01); overline styles merge as each owner converts its allowlisted sizes |
| TYPE-04 | 4 | — |

### Items

**1. Tokens.** `src/styles/prebid.css` holds every Visual specification value as a primitive, light at `:root` and dark at `.dark` (next-themes sets the class on `<html>`): surfaces, text, lines, brand and state, selection, warning, masthead, elevation levels 1–3, radii 8px and 12px, the type scale, the number style and the chart palette. Values are hex or `rgb()` only, because `repository-overview.spec.ts:40` reads computed colours as three numbers. Refinements, recorded in the Visual specification:

- Dark link `#6fb2e5`: the specified `#6cb0e3` is 4.45:1 on the dark header-band hover.
- Dark warning icon `#ce8228`: 4.51:1 on the dark chip `#3a2a10`, 5.20:1 on the card.
- Level 2 (menus, select, tooltips): light `0 2px 4px rgb(16 42 67 / .06), 0 8px 20px rgb(16 42 67 / .12)`; dark `0 2px 4px rgb(0 0 0 / .4), 0 8px 20px rgb(0 0 0 / .45), inset 0 1px 0 rgb(255 255 255 / .04)`.
- Level 3 (dialogs, sheet): light `0 4px 8px rgb(16 42 67 / .08), 0 20px 48px rgb(16 42 67 / .2)`; dark `0 4px 8px rgb(0 0 0 / .45), 0 20px 48px rgb(0 0 0 / .6), inset 0 1px 0 rgb(255 255 255 / .05)`.

Kept: the info, success and error sets, `--prebid-placeholder`, `--prebid-secondary-hover` and `--prebid-accent`, which have no Visual specification counterpart yet. Retired: `--prebid-brand-text` (its two consumers move to the link token), `--prebid-card-shadow` (level 1), the eight `--sidebar-*` tokens and `--chart-2` to `--chart-5` (no consumers), with their `@theme inline` mappings (`globals.css:31-42`).

**2. Semantic mapping at `:root` and `.dark` (rule 2).** `globals.css` maps the shadcn names onto the primitives in place of the 62 stock `oklch()` values:

- `--background` canvas; `--foreground`, `--card-foreground`, `--popover-foreground`, `--secondary-foreground` and `--accent-foreground` ink; `--card` card; `--popover` overlay; `--muted-foreground` muted.
- `--primary` ink with `--primary-foreground` card, as today (P2 retargets it to orange with the one-primary rule); `--secondary`, `--muted` and `--accent` as today.
- `--border` default line; `--input` the input border and `--ring` the focus ring, as today.
- `--destructive` the error ink, which serves as text on the card and as a fill under `--destructive-foreground` (the card colour) in both themes.
- `--chart-1`, plus new Tailwind colours for sunken, overlay and selection.

The `.surface` mapping (`dashboard.module.css:2-18`) and the `--auth-*` aliases (`authentication.module.css:2-24`) are removed. Their consumers read the shared names, and the 13 `--auth-*` uses with no shadcn counterpart (info, success, error, placeholder, secondary hover and the orange submit) read the kept `--prebid-*` primitives directly. The 404 and error pages, `/auth/setup`, the portals that pass no container (`temporary-credential-dialog.tsx:44`, `users-view.tsx:173`) and the five Foundation stories that render without the dashboard frame then use the same system. Colour literals live only in `prebid.css`; `globals.css` holds `var()` mappings and font stacks, because it is the stylesheet that `components.json:8-10` points the shadcn CLI at. The colour literals left in feature CSS are converted: the overview apply button and the sign-in submit (`overview-controls.module.css:181`; `authentication.module.css:158, 160, 166`) take the ink and orange tokens. The orange sample-data dot (`dashboard.module.css:126`) is removed with the frame row in P4. `global-error.tsx` renders outside the root layout, so it imports `globals.css`, wraps its content in the shared theme provider (so a saved Light preference still applies) and carries the font classes.

Consumers repointed:

- In-card wells that read `--background` move to sunken: `overview-controls.module.css:16`, `timeline-controls.module.css:35`, `timeline-layout.module.css:126`, `column-selection.module.css:63`, `repository-controls.module.css:17` and the difference row at `overview.module.css:63`. Controls that fill with `bg-background` (the outline button, select trigger, switch thumb and alert in `src/components/ui/`) move to sunken, which keeps their current value within one step until P2 restyles them. The canvas itself (`dashboard.module.css:24`) stays, and so does the check-mark colour at `column-selection.module.css:99`, which uses `--background` as an ink.
- The review-distribution tooltip (`review-distribution.tsx:18`) and the sheet move to overlay.
- The table header band (`data-table.module.css:79`) moves to the header-band token with header ink, and row hover (`:101`) to the row-hover token; `--accent` keeps menu highlights (COLOR-06).
- Selectable-bar tracks move to sunken and pressed bars to the selection tint.
- The Trend line and markers (`timeline-chart.tsx:63-64, 235`) move from the link token to `--chart-1` (COLOR-03).
- The two orange notice stripes (`timeline-layout.module.css:69`, `contributions.module.css:103`) move to the warning colours, so orange keeps its act and "you are here" meanings (COLOR-08).
- Dialogs move to the overlay surface with level 3 (COLOR-02).

**3. Fonts.** `next/font/local` with unmodified Google Fonts woff2 files committed under `src/styles/fonts/`: Mona Sans (wdth 75–125, wght 200–900) and Inter (wght 100–900), each in latin and latin-ext, 264,552 bytes in total, all preloaded. Each family carries its `OFL.txt` and a provenance file with the source URL, version string and sha256. This takes the fallback named in the P1 premise: with `next/font/google`, a clean build without network fails and production builds have no fetch timeout (`next/dist/compiled/@next/font/dist/google/loader.js:96-129`, `fetch-resource.js:19`), CI restores no `.next/cache`, and Storybook's plugin keeps the `fonts.gstatic.com` sources and loads them at runtime (`vite-plugin-storybook-nextjs/dist/index.js:121-138`), which `foundation.spec.ts:4-11` rejects. Inter is requested without the `opsz` axis.

- `src/styles/fonts.ts` exports both faces with variables `--font-inter` and `--font-mona`; Mona Sans declares `font-stretch: 75% 125%`.
- The variable classes go on `<html>` in `layout.tsx` and `global-error.tsx`; `.storybook/preview.tsx` adds them to `document.documentElement`, so portals and the html font rule see them.
- `@theme inline` maps `--font-sans` to `var(--font-inter), ui-sans-serif, system-ui, sans-serif` and `--font-display` to `var(--font-mona), var(--font-inter), sans-serif`. Arial leaves `globals.css:122` and `theme-menu.module.css:45-48, 58-61`.
- Vitest aliases `next/font/local` to a typed stub in `tests/support/next-font.ts`; the package entry is an empty module and `tests/unit/inventory-titles.test.ts` imports the root layout. `src/styles/fonts.ts` joins the 100% shell coverage group (`vitest.config.ts:37-38`).
- Next names a local face after the binding in `fonts.ts` unless a `font-family` declaration is given, and Storybook names local faces `font-<hash>` behind the same variables (`next-font-loader` `local/loader.js:40`; `vite-plugin-storybook-nextjs/dist/index.js:152-167`). Components read only the `--font-inter` and `--font-mona` variables, never a family name.

**4. Type.** The eight roles (display, title, KPI, heading, body, small, caption, overline) become custom properties and named Tailwind utilities (`text-display` to `text-overline`). Tailwind's default `text-*` sizes stay defined so shadcn primitives keep their sizes until P2; the token check rejects them (item 7).

- P1 converts 130 of the 150 CSS `font-size` declarations. 124 are already on the scale and keep their size: 12px small ×55, 11px caption or overline ×43, 13px body ×24, 14px ×2. Four P1-owned sizes move onto the scale: the measurement marker and change 10→11px, the chart context line 10→11px, and the contribution totals 27→28px (KPI). The table title (17px) and the Trend heading (15px) become panel titles (below). The six on-scale sizes outside `font-size` declarations convert too: the `font` shorthands at `theme-menu.module.css:45, 58`, `text-[13px]` at `field-error.tsx:14` and `account-type-filter.tsx:109`, and the Recharts tick `fontSize: 11` at `timeline-chart.tsx:204, 212`.
- The other 20 `font-size` declarations are allowlisted to their owners. P2 (controls and status markers): `timeline-layout.module.css:142` (20px), `column-selection.module.css:49` (10px), `authentication.module.css:301` (16px, which stops iOS zooming into the input), `repository-page.module.css:98, 162, 169` (10px). P3 (tables): `timeline-layout.module.css:55, 61`, `data-table.module.css:105` and `repository-timeline-matrix.module.css:46` (10px), and `repository-records.module.css:57` (16px). P4 (shell and page headers): `authentication.module.css:82` (9px), `:89` (29px), `:285` (10px) and `:298` (27px); `contributions.module.css:10` (10px) and `:17`; `overview.module.css:5`; `repository-page.module.css:23` (the three page titles at `clamp(25px, 3vw, 32px)`) and `:76` (10px).
- Page titles (`h1`) take Mona Sans 800 at 112% width and keep today's sizes until P4's `PageHeader` sets display 30/34. Panel titles become title 18/26 in Mona Sans 700: the table title (17px today), the Trend heading (15px), the "At a glance" heading (13px) and `PageState` (REPOS-02, REPO-11). Navigation labels and tabs stay Inter until P4 rebuilds them.
- Numbers use the specified `tabular-nums lining-nums` at weight 500 (KPI 600) on table cells, measurement and KPI values, timeline values and chart labels, so a known zero never renders bolder than a real value (TYPE-04). Inter's default digits are proportional and Arial's were already tabular, which is why the declared `tabular-nums` had no visible effect until now.
- With variable faces, weights 500 and 600 render as declared; Arial collapsed them to 400 and 700. The Baseline font-pair count is re-measured.

**5. Elevation and radius.** Panels take radius 12px and level 1: the table panel, chart card, timeline section, contribution totals and the sign-in card (whose `--prebid-card-shadow` recipe retires). Tailwind's `shadow` and `shadow-sm` map to level 1, `shadow-md` to level 2 and `shadow-lg` to level 3; `rounded-md` is 8px and `rounded-lg`/`rounded-xl` are 12px. The literal menu and tooltip shadows (`theme-menu.module.css:38`, `timeline-layout.module.css:164`) take level 2, the sign-in submit's shadow (`authentication.module.css:163`) takes level 1, and the input shadow at `:119` (1.6% opacity) is removed. With the seven `box-shadow: none` resets exempt, no box-shadow literal remains. Radii of 2–7px stay until their owning phase (the allowlist names each), and `rounded-sm` stays 6px until P2; the specification defines only 8px and 12px.

**6. Chart palette.** One series colour, `--chart-1`, Prebid blue `#3887c2` in both themes. No chart draws more than one series today, and the stock `--chart-2` to `--chart-5` have no consumers. Blue reaches 3:1 on every surface a mark sits on: card, canvas, sunken track and selection tint (3.88, 3.45, 3.64 and 3.39 in Light; 4.11, 4.70, 4.44 and 3.05 in Dark). A candidate four-colour set (blue, aqua, violet, magenta) separated adjacent pairs under simulated colour-vision deficiency but not every pair (aqua and magenta are ΔE 1.6 apart under dark deuteranopia, OKLab ×100, Machado 2009 at full severity). Further series colours are added with the first chart that draws two series, checked pair by pair in both themes.

**7. Token check.** `scripts/check-design-tokens.mjs` exports `inspectDesignTokens(root)`, is appended to `check:boundaries`, and follows `check-architecture.mjs`: JSON output, exit code 1 on failure, failure on zero inputs, and it also prints the files it scanned.

- CSS under `src/` is parsed with the installed postcss 8.5.31. TSX under `src/` and `.storybook/` is parsed with the installed TypeScript: `className` strings, `cn`/`clsx`/`cva`/`twMerge` arguments, `style` objects, `fill`/`stroke`/`color` attributes, and object-literal attribute values carrying `fontSize`, `fontFamily`, `fill` or `stroke` (Recharts `tick` props; weights are not tokenized). Colour literals in `src/**/*.ts` are also checked.
- It fails on the patterns in the P1 section above and on Tailwind's default `text-*` sizes. `none`, `inherit`, `initial`, `unset`, `transparent`, `currentColor`, radius `0` and `50%`, and `var()` values pass. Colour literals are allowed only in `prebid.css`; generic family names in the `globals.css` font stacks pass.
- `scripts/design-token-allowlist.json` keys each entry by file, at-rule context, selector (or TSX symbol path), property and value, with an owning phase and a reason. A key of file, selector and property alone collides four times today (a base rule against its `@media` override in `dashboard.module.css` and `authentication.module.css`), and the value makes a changed literal count as new. Unused and duplicate entries fail, entries owned by a finished phase fail, and `tests/unit/design-tokens.test.ts` pins a ceiling on the entry count that each phase lowers; an added entry shows in the allowlist diff. Entries after P1: 104, none owned by P1. 63 are CSS (P2 29, including the `--radius-sm` theme key that keeps `rounded-sm` at 6px and the 14px sign-in input; P3 12; P4 22, including the 14px sign-in notice) and 41 are TSX class utilities (default `text-*` sizes, `rounded-[5px]` and the two `bg-black/80` scrims; P2 31, P4 10).
- The unit test has a failing fixture per pattern, pass fixtures that bound the grammar, and a violation in a second child node (a `ts.forEachChild` visitor that returns a value skips the remaining children).
- Sites the scanner cannot read statically (class values passed through as identifiers or calls, token names built at runtime) are listed as unmodelled; their count may not exceed a ceiling pinned in the unit test (86 after P1). A `completedPhases` list in the script fails any allowlist entry owned by a finished phase, and a `var(--prebid-*)` reference to a name that `prebid.css` does not define fails and cannot be allowlisted. In `prebid.css`, only custom properties directly in `:root` and `.dark` are exempt.

**8. Token stories.** `.storybook/design-tokens.stories.tsx` (`Foundation/Tokens`) renders every `prebid.css` primitive from the tokens themselves: surfaces, text, lines, brand and state, selection, warning, elevation levels, radii, the type scale with Mona Sans and Inter specimens, the number style and the chart colour. Its stories join the story-coverage list.

**9. Story coverage (rule 5).** `tests/e2e/covered-stories.ts` (no imports, like `tests/support/views.ts`) lists every story: the 82 that exist today, 64 of them opened by no spec, plus item 8's. `tests/e2e/story-coverage.spec.ts` opens each in Light and Dark, waits for `sb-show-main` and a non-empty `#storybook-root`, and runs axe there. Test titles come from the list, because the checks job lists browser cases before Storybook is built (`quality.yml:35-37`). `tests/unit/story-coverage.test.ts` checks the list against ids derived from `.storybook/*.stories.tsx` with Storybook's `toId`. The spec runs on the P0 head first. Violations that P1's tokens cause, or that a token can fix, are fixed in P1. Any other violation is recorded in the list against its story, theme and axe rule with the owning phase (controls P2, tables P3, shell P4), and the spec expects exactly those; an entry fails once its violation is gone.

**10. Inventory design spec.** One spec over every inventory view in Light and Dark, in `test.describe.configure({ mode: 'parallel' })`, so shards can divide it; without parallel mode Playwright assigns whole files to shards. Each case runs axe on `main` and checks fonts. No element's computed family list may name Arial or Helvetica, and its first family must be the Inter, Mona Sans or monospace token. `document.fonts` must hold a loaded face for each family used. In Chromium, the CDP `CSS.getPlatformFontsForNode` result for sampled nodes must never name Arial. next/font's fallback faces use `src: local("Arial")` under a `Fallback` family name, so a family-name check alone passes when the font failed; the spec reads the fallback names from the built CSS. A committed negative control injects an Arial element.

**11. Tests changed.** `theme.spec.ts:46` expects the Light canvas `rgb(238, 242, 246)`. `foundation.spec.ts:113-116` expects the dialog on the overlay surface. The chart colour gets a unit test on token values (3:1 against card, canvas, sunken and selection in both themes) and computed-colour checks in `repository-charts.spec.ts` in both themes. Specs that measure text geometry (`contribution-layout.spec.ts:37`, `repository-page-layout.spec.ts:38`, `column-selection.spec.ts:103`, `navigation-feedback.spec.ts`, and the `scrollWidth` checks) wait for `document.fonts.ready` before measuring; a limit changes only with its measured cause recorded.

**12. Documents.** `foundation-contracts.md` `## What visually locked means` (line 76) gains the design-token rule: visual values come from `prebid.css` and the token check enforces it; the approved-decisions table's reference to a "visual-readiness section" points there. The Visual specification records the refinements in item 1 and the single chart colour. The P1 section's Fonts bullet and exit wording follow items 3 and 10.

### Exit

- `npm run check:boundaries` runs the token check, which passes with the allowlist; its unit tests pass.
- The story coverage spec (including `Foundation/Tokens`) and the inventory design spec pass in Chromium and WebKit; the chart colour tests pass in both themes.
- `npm run check:all` passes.

Checkpoint A: `Foundation/Tokens` in Light and Dark, beside the sign-in page and a table, chart and dialog story in both themes. Checkpoint B: `capture:views` against `abe9dd7` and the P1 head at 1440, 1366 and 390px in Light and Dark.

### Decisions (2026-11-01)

1. Fonts are self-hosted from committed files through `next/font/local`, not fetched from Google at build time. Approved.
2. P1 changes page and panel titles to Mona Sans; navigation labels and tabs change with the P4 header rebuild. Approved.
3. Buttons keep the ink primary in P1; orange primary actions arrive in P2 with the one-primary-per-surface rule. Approved.
4. Dark link `#6fb2e5` and dark warning icon `#ce8228`, as in item 1. Approved.
5. One chart colour, Prebid blue; further series colours arrive with the first two-series chart, as in item 6. Approved.
6. Story coverage covers every story; P1 fixes the violations its tokens cause or can fix, and records the rest against their owning phase, as in item 9. Approved.
7. 130 font sizes become tokens now (124 at their current size); the other 20 are allowlisted to their owning phase, as in item 4. Approved.
8. The orange notice stripes become warning amber, and the sign-in card takes level 1 and a 12px radius. Approved.

### Unverified premises (P1)

- Chromium and WebKit render Mona Sans at `font-stretch: 112%` from the local variable face.
- `build:storybook` emits the local woff2 files and stories render with them offline.
- `next/font/local` preloads all four files, and faces have loaded by the time the inventory spec checks them.
- Text geometry with Inter stays inside the limits of the specs in item 11 or moves for a cause that can be named.
- The committed Inter and Mona Sans files carry `tnum` and no `lnum` (read from the Google-served files during planning; recorded with the committed files' sha256 in `## P1 evidence`).

### Carried to later phases

- Ghost buttons on the page canvas: `--prebid-hover` (`#eff4f7`) is 1.02:1 against the new Light canvas, so their hover gives no visible change. P2's ghost-button spec gives canvas hovers a darker fill or an edge.
- Light placeholder text `--prebid-placeholder` (`#74818d`) is 3.99:1 on an input and 3.74:1 on sunken, below 4.5:1, a value unchanged since before P1. P2 sets it with the input tokens; axe does not test placeholders.
- Text arrows (U+2190 and U+2192) in the back links and the table scroll hint (`repository-header.tsx:59`, `data-table.tsx:322`, `timeline-support-frame.tsx`) render from a system font, because the Google-served Latin subset of Inter has no arrows. They become icons with TYPE-05 (P2 icon map, P3 for the table hint).
- Inter sets text slightly wider than Arial, so fixed-width columns wrap more: GitHub handles break at the hyphen in the merge-duration Author column (150px; 19 rows grow from 49 to 63px at 1440, 4 before), "Unmapped company" takes two lines in the Contributors company column, and four repository names wrap in the 390px pinned column. Column widths are P3 (TBL-06, TBL-10, REPO-07).

## P1 evidence

Recorded 2026-11-01 against the P0 head `abe9dd7` on `build:preview`/`start:preview`, Node 24.22.1.

### Checks

- `npm run check:all` passed at the P1 head that was captured: Vitest 2,149, account integration 34, production integration 13 and Playwright 1,048 (Chromium and WebKit), with no skipped, pending or flaky results. Later P1 commits change only the `Foundation/Tokens` title specimen and this document.
- The design-token check passes with 104 allowlisted sites, none owned by P1, and 86 unmodelled sites under its ceiling. The story-coverage spec runs all 91 stories in Light and Dark with no recorded violations.

### Checkpoints

Checkpoint A, approved 2026-11-01: the eight `Foundation/Tokens` stories, the sign-in, All repositories and repository chart stories, in Light and Dark.

Checkpoint B, approved 2026-11-01: `capture:views` against `abe9dd7` and the P1 head, 204 cells each, none failed. Because the type change alters nearly every pixel, the pixel comparison was replaced by two checks:

- Structure: all 34 views in Light and Dark at 1440px, 72 pairs, have identical text, link targets and names, headings, table cells, controls, accessibility tree, status codes, final URLs and titles. The only differences are the font variable classes on `<html>` and four font preloads. Every `h1` computes Mona Sans at 112% and weight 800; no element's computed family names Arial (50,738 elements). No console errors on either build.
- Visual: at 390 and 1440px in both themes, no clipped text, no horizontal overflow and no lost separation; dialogs and menus sit on the overlay surface.

### Baseline measurements

Unchanged: header to first control 220px, 186 Tab presses, a 1,208-character Summary→Timeline href and 598 characters after one scope change. Changed: distinct font size and weight pairs 25 → 22 (27 → 24 with uppercase tracking); All repositories first table y=450 → 449 and Period activity y=1363 → 1362; repository first table y=767 → 772 (larger panel title); Contributors first table y=626 → 625; the `/repos` document 694,833 → 695,628 bytes and flight 263,977 → 264,067 bytes.

### Unverified premises (P1): results

- `font-stretch: 112%`: in Chromium the title "All repositories" measures 221.5, 233.2 and 245.9px at 100%, 112% and 125%, so the wdth axis applies. WebKit loads the face (the inventory design spec checks its loaded status) but its stretch rendering was not measured.
- `build:storybook` emits the local woff2 files: the story-coverage spec and `foundation.spec.ts`, whose request guard rejects any non-local host, pass in both engines.
- `next/font/local` preloads all four files (four `font/woff2` preload links on every page) and the faces report `loaded` when the inventory design spec checks them.
- Text geometry: the geometry specs pass after waiting for `document.fonts.ready`; the wraps the wider face causes are listed under "Carried to later phases".
- The committed font files have the sha256 values of the Google-served files whose GSUB lists `tnum` and no `lnum` (`src/styles/fonts/PROVENANCE.md`).

## P2 plan

Proposed 2026-11-01 against `e4ba804`. P2 lands on the same branch and pull request as P0 and P1. Checkpoint B compares `e4ba804` with the P2 head. Counts come from `git grep -P` and from parsing JSX with the installed TypeScript; rendered values come from `build:preview` at `e4ba804` in Chromium.

### Scope

The 41 P2 findings in Appendix A. P2 gives every control, notice, empty state, overlay, icon and identity one primitive, removes the feature overrides that restyle them, and turns rules 3 and 4 into lint errors. P2 is larger than the M estimate in the phase table: about 110–150 files. It is built in six ordered steps inside the pull request (see Order). Two parts of later-phase findings move into P2 and Appendix A is amended to match: TYPE-05's back-link and scroll-hint arrows (P3 keeps the sort glyphs) and CONTRIB-17's hidden phone avatar (P4 keeps the rest).

| Findings | Items |
| --- | --- |
| COLOR-04, CTRL-02, SHELL-12, CTRL-01, REPOS-03, CONTRIB-05, REPO-08, COLOR-05 | 2, 8 |
| CTRL-04, REPO-19, REPO-18, CTRL-10, CTRL-12 | 3 |
| CTRL-03, REPOS-05, REPOS-06, CONTRIB-04, CONTRIB-15, GAP-07 | 7 |
| CTRL-08, GAP-03, TBL-14, TBL-13 | 3, 5, 7 |
| CTRL-06, CONTRIB-13, REPOS-10, TYPE-06, TYPE-07, TYPE-08 | 1, 3 |
| CONTRIB-09, TYPE-10, REPO-05 | 6 |
| CTRL-09, GAP-04 | 4 |
| TYPE-09, CONTRIB-14, REPOS-15, REPO-15, REPOS-07, REPO-10, GAP-06 | 5 |

### Items

**1. Icon map.** `src/components/ui/icons.ts` exports one component per concept, built by a `createElement` factory around the installed `lucide-react` 1.61.0 glyph: stroke 1.5 with `absoluteStrokeWidth` (lucide's default is 2, about 1.33px at 16px), `aria-hidden`, `focusable="false"`, and a required `size` of 14 or 16 (the Avatar badge also takes 10, drawn with a 1px line). Every icon on the dashboard is decorative today; names belong to the control or the adjacent text. Of the 35 files that import `lucide-react`, 33 move to the map with sizes normalised and two (`ui/sheet.tsx`, `ui/select.tsx`) are deleted (items 3–4); the forced `[&_svg]:size-4` in `button.tsx:8` and the menu primitives goes. Concepts follow the Visual specification's Icons list, plus: population `UserRoundCheck`, swap periods `ArrowLeftRight`, pager `ChevronLeft`/`ChevronRight`, clear `X`, retry `RefreshCw` (reset keeps `RotateCcw`), the state icons `Info`, `TriangleAlert`, `CircleAlert`, `Inbox`, `SearchX`, `CircleDashed` and `LoaderCircle`, and the chart triggers `ChartColumnBig` and `ChartNoAxesCombined`. The external-link `ArrowUpRight` follows the name it belongs to; its placement in record cells is P3 (TBL-10). Back links and the table scroll hint swap their text arrows (U+2190, U+2192) for `ArrowLeft`/`ArrowRight`, which also clears the P1 carry-over; their visible text stays, so 28 test lines in 11 files that include "← " update. A source scan for U+2190–U+21FF in `src/` joins the design-token check, with one P3-owned allowlist entry for the sort glyph at `data-table.tsx:244`, which P3's `SortIcon` removes. The sort glyphs themselves (12px, stroke 2) are P3.

**2. Buttons.** `Button` variants are `primary`, `secondary`, `ghost` and `destructive`; `default`, `outline`, the grey `secondary` and the unused `link` retire, and every call site moves in the same step: `default` (15) to `primary`, `outline` (29, one in a story) to `secondary`, the grey `secondary` change-password Cancel to `secondary lg`. Sizes `sm` 28, `md` 34 (default), `lg` 40, `icon-sm` 28×28, `icon` 34×34; every size is 40px under `pointer: coarse`; radius 8px.

- `primary`: orange fill, `--prebid-accent-ink` label, `--prebid-accent-border` edge, level 1; hover and pressed use the orange hover and pressed tokens. At most one per surface. The 11 ink primaries (8 in `src`, 3 in stories; dialog footers, admin Create account, `PageState` Try again) and the two hand-written orange recipes (`overview-controls.module.css:179-186`, `authentication.module.css:131-151`, 4 sites) become this variant; the interactions story's second trigger becomes `secondary`. Report toolbars have none. `--primary` then maps to orange after its four non-action consumers move off it: the Active badge, the switch track, `filter-choices.module.css:32` and the scope stripe at `repository-page.module.css:86`.
- `secondary`: overlay fill, a 1px edge (decision 5), level 1; hover fills `--prebid-hover` with a `#3887c2` edge; `aria-pressed="true"` or `data-state="open"` uses the selection tint, selection ink and a 2px selection edge (the border plus a 1px inset ring), so the state is not carried by colour alone. The label keeps weight 500: a weight change widened the button and, at 640px on Linux, wrapped the table toolbar when the Columns menu opened.
- `ghost`: no fill, edge or shadow; hover uses a new `--prebid-ghost-hover`: ink at 8% in Light (a 1.15:1 step on the canvas, where `--prebid-hover` gives 1.02:1) and `#253947` in Dark (1.33:1 on card, 1.52:1 on canvas, today's value). Every reset is ghost with `RotateCcw` and a sentence-case label.
- The sign-in and change-password submits become `primary lg` (Inter 700, the one 700 use the Type paragraph names); their height follows decision 6.
- Feature overrides are deleted: six rules that remove hover from seven rendered controls because unlayered feature CSS beats the layered utilities (`overview-controls.module.css:72-77` and `:56-70`; `data-table.module.css:48-53`; `contributions.module.css:299-304`), and the height and shadow override at `contribution-controls.module.css:11-15`.

**3. Fields and patterns.** New primitives in `src/components/ui/`: `SearchField` (an `Input` with `Search`, `type="text"` so the 55 `textbox` queries named "Search…" keep their role), `NativeSelect` (one wrapper, `appearance: none`, a 14px `ChevronDown`, hover edge `#3887c2`), and `Checkbox`/`Radio` (16px, input-border edge, checked fill in the selection edge colour; menu checkbox items draw the same box). `Input` gets an opaque `--prebid-input` fill, the input-border edge and field text that is 16px under `pointer: coarse` through a token, which replaces the auth-only `@media (max-width: 480px)` rule. The Radix `Select` retires: the admin role picker (`users-view.tsx:170`) and the Interactive primitives story become `NativeSelect`, `foundation.spec.ts:35-76`'s listbox and bounds checks become native-select checks, and `@radix-ui/react-select` leaves `package.json`. One `Pager` (`src/components/tables/pager.tsx`, secondary buttons with chevrons, text kept as "Page N of M", "Previous", "Next") replaces the two pagers (`data-table.tsx:446-464`, `contribution-choices.tsx:160-181`) and is hidden on single-page tables (GAP-03), so `showSinglePageControls` goes; the timeline matrix's window control keeps its "Window N of M", "Earlier" and "Later" text and uses the same buttons. One disclosure pattern: a ghost trigger with a trailing `ChevronDown` that rotates; `<details>` summaries lose their native marker. Removable filter chips are 28px in the selection tint. In the Account type menu, options carry their account glyph at 16px and Apply becomes a `primary sm` button in the menu footer (CTRL-10, CONTRIB-13).

**4. Overlays.** `DialogContent` takes `size` `sm` 512, `md` 640 or `lg` 680 (capped at 100vw − 32px), radius 12px at every width, padding 24px (20px at ≤600px), and a ghost `icon` close button (34×34, `X` 16px) at top 12, right 12 that keeps its sr-only "Close"; titles use the display face at title 18/26 700. Width overrides on dialogs and menus in feature code become `size` props. A new `--prebid-scrim` (`rgb(13 22 31 / 0.5)` Light, `rgb(0 0 0 / 0.6)` Dark) replaces `bg-black/80`. `DropdownMenuContent` takes `collisionPadding` 16 (GAP-04: the Columns menu sits flush with the viewport today), sizes `auto`/`sm`/`md`/`lg`, level 2 and a `--prebid-scroll-shadow` cue when its content scrolls; items are 13/20 at weight 500, 32px rows (40 on coarse pointers), small radius; labels use the overline role. `sheet.tsx` has no importers and is removed, with the unused menu exports (`DropdownMenuShortcut`, `DropdownMenuSub*`).

**5. States.**

- `Callout` (`src/components/feedback/callout.tsx`): tones info, warning and error; a 16px icon column, 12px radius, 1px tone border, tone fill, body in ink and an optional lead in the tone ink; no left stripe (P1's interim amber stripe goes) and no live role by default, so every site keeps its own element, role and label. The five `ui/alert.tsx` sites pass `role="alert"` explicitly, since the role came from that primitive. A new `--prebid-info-ink` (`#1f5f8f` / `#9ed3f2`) completes the info set. Callout replaces `ui/alert.tsx` (deleted) and the ad-hoc notices: data-quality and coverage notices are warning, the link-limit and backlog-constraint notes are info, and validation and export errors are error.
- `DataLegend` (`src/components/feedback/data-legend.tsx`): one wording for glyph keys, caption 11/16 muted, rendered by the table and matrix footers and chart cards.
- `EmptyState` (`src/components/feedback/empty-state.tsx`) replaces `PageState`, which is deleted with its 18 importers (including 3 stories and `tests/components/data-table.test.tsx`); `PageError` renders through it. Kinds: empty, no match, missing, error and loading. "Missing" is a fifth kind beyond the four this phase originally named; it keeps "Sample records unavailable" and "No chart values available" apart from empty results, as the known-zero/missing distinction requires. Variants `page` (card, level 1, title 18/26 Mona Sans) and `embedded` (no frame, heading 14/20). A 32px tile holds the kind's 16px icon. The role rule is unchanged: `alert` with a retry, `status` otherwise. `DataTable`'s `emptyTitle` becomes `empty: { kind, title, description? }`, and an empty table keeps its header row with the state in a full-width row (TBL-13).
- `ChartPanel` (`src/components/charts/chart-panel.tsx`) gives At a glance and Trend one disclosure panel: 12px card, level 1, ghost trigger with a content icon and rotating chevron. Chart tiles become cells divided by subtle lines, totals use heading 14/20 at number weight. Vertical activity bars put each count above its bar, draw one continuous baseline, and show a known zero as "0" on the axis with no bar (GAP-06).
- Timelines whose every value is a recorded zero show an info Callout (decision 1).

**6. Identity.** `Avatar` (`src/components/github/avatar.tsx`): people get a 32px circle with initials at Inter 600 12px on the selection tint and a 14px account-type disc with a 10px glyph at a 1px line (48px avatar: 18px disc, 14px glyph at 1.5px) so the badge leaves the second initial readable; companies get a rounded-square monogram (8px radius) in the same tint; the unmapped bucket gets a dashed tile with a muted `Building2` glyph, because it is not a company (decision 2). Initials and monograms derive from the typed display models. The contribution heading gains an identity slot with the 48px Avatar, which P4's `PageHeader` keeps (CONTRIB-09). Avatars stay visible at ≤600px, where `contributions.module.css:291-293` hides them today, since the actor icon must stay beside identities (`foundation-contracts.md:105`). `RecordStatus` (`src/components/github/record-status.tsx`) renders the specified PR and issue glyphs in colour (open success, draft muted, merged link blue, closed error) beside the visible label at caption size; it keeps `data-state` and its text content (REPO-05). The agent glyph stays `Cpu` (decision 3).

**7. Report and table toolbars.** `ReportToolbar` (`src/components/reporting/report-toolbar.tsx`, layout only) frames every report's scope controls: a card panel with one or two labelled groups (each a `fieldset`), a ghost reset per group at the row end, one status line (the only `role="status"`, with an info notice) or an error `role="alert"`, and a summary row of facts the controls do not already show. Existing region names stay ("Timeline scope", "Contribution report scope", "Selected repository scope"). TimelineControls and ContributionControls become field components that render no frame. Over time keeps both resets, one per group, because its filter reset writes the scope the Report page shares. The Summary period controls stay with the Period activity table and use the same field primitives; "Add second period" becomes a 34px secondary button with `Plus`. The table toolbar orders search (240px), the feature's controls, Columns, then an `exportControl` slot so Export CSV is always last, with search on its own row at ≤600px; `searchable` becomes `search: 'local' | 'external' | 'none'`. The table footer has count, notes and pager slots, and "matching" appears in the count only when a query is set (GAP-03). The company breakdown switch and "Hide zero totals" move inside the table panel as header content (CONTRIB-15). Ranges read "range · UTC" through one `zonedRangeLabel` helper (GAP-07). Reset labels and the saved-state sentence follow decision 4.

**8. Tokens.** In `prebid.css`, recorded in the Visual specification: input border `#798b99` / `#6a8396` (at least 3:1 on card, canvas, sunken, overlay and header band in both themes; the earlier candidates fail on canvas or overlay), placeholder `#66727e` in Light (4.91:1 on input, 4.61 on sunken; Dark stays `#96a9b7`), `--prebid-ghost-hover` (item 2), `--prebid-radius-small` 4px (checkbox boxes, menu items, the password toggle, small focus outlines; `--radius-sm` maps to it), `--prebid-scrim`, `--prebid-info-ink`, `--prebid-scroll-shadow` and a 16px coarse-pointer field size. Avatar initials use Inter 600 (the Identity paragraph), so "avatar initials" leaves the Type paragraph's 700 list.

**9. Enforcement.**

- Rule 3 becomes `no-restricted-syntax` on a `className` attribute of `Button`, `Input`, `SearchField`, `NativeSelect`, `Checkbox`, `Radio`, `DropdownMenuContent`, `DialogContent` or `Card` (the retired `SelectTrigger` leaves the list), in `src/features/**`, `src/app/**` and `src/components/**` except `ui/` and, until P4, `layout/`. Widening it to shared components amends rule 3's text. Of today's 33 overrides, 16 are in feature and route code (resolved by variant or prop 11, by a wrapper 4, by `SearchField` 1), 12 in shared components (resolved in step 3: the table search by `SearchField`, the `PageState` button by a wrapper, the rest in `column-menu`, `column-definitions`, `repository-selector` and `timeframe-control` by variant or size) and 5 in `layout/`, which wait for P4.
- Rule 4 becomes `no-restricted-imports` of `lucide-react` (and its deep paths and dynamic imports) outside the icon map.
- ESLint flat config replaces a rule's options rather than merging them (`node_modules/eslint/lib/config/flat-config-schema.js:450-497`), so the selectors live in shared arrays with one config object per file scope; P4's `h1` rule and P5c's URL rules join those arrays.
- `tests/unit/lint-restrictions.test.ts` lints fixture text under tracked paths with the real config and asserts exact `[ruleId, line]` lists, including the forms the matchers do not model (spread props, aliases), which expect none.
- The design-token check gains a rule against feature CSS that restyles a native control or primitive through a descendant selector (`… button`, `… input`, `… select`, `… summary` setting height, background, border, shadow or font size), the mechanism that removed hover today.
- Every step deletes the allowlist entries its changes leave unused and lowers the ceiling; step 6 re-owns any remaining P2 entry with a reason, so none of the 60 stays owned by P2, and adds `P1` and `P2` to `completedPhases`.

**10. Tests and stories.** New stories for every variant and state (rule 5), listed in `tests/e2e/covered-stories.ts`: buttons, fields, pager, report and table toolbars, menus and dialogs, Callout, DataLegend, EmptyState, ChartPanel, Avatar, RecordStatus and a Foundation/Icons page of the map. Hover, focus and pressed states are checked by computed-style assertions, since Storybook shows no hover. Rule 8 checks: a unit test over token pairs (field and secondary edges, selected edge, focus ring, Callout and EmptyState icons on their fills, status glyphs on card and row hover, scrim separation) and computed-style checks per theme in a browser spec. A component test renders every report toolbar and asserts each reset is a ghost button with `RotateCcw` and a decision 4 label. Label changes update their selectors: the back-link arrows (28 lines), "Reset view preferences" (2), "Page 1 of 1" becomes the pager's absence (4), and the saved-state sentence. `overview-preferences.spec.ts:339`'s placeholder count becomes a role query so it cannot pass vacuously; `timeline-controls.spec.ts:75` is scoped to the period-window label once a toolbar status line exists. Coverage groups: `icons.ts`, `search-field.tsx` and `native-select.tsx` at 100% per file; `report-toolbar.tsx` joins the navigation and timeline group (`vitest.config.ts:105-106`); `pager.tsx` falls under `src/components/tables/**`; `src/components/feedback/**` and `src/components/github/**` get a 95/85 per-file group.

**11. Documents.** The Visual specification records item 8, the icon additions, the identity badge geometry and the dialog sizes. Component ownership adds `SearchField`, `NativeSelect`, `Pager`, `DataLegend`, `ChartPanel` and `RecordStatus`, and records that `EmptyState` replaces `PageState` and that `ReportToolbar` replaces the timeline, repository-scope and contribution control layouts while the activity-period controls keep their own layout with the field primitives. Rule 3's scope text changes. Appendix A moves TYPE-05's back-link and scroll-hint parts and CONTRIB-17's phone avatar to P2. `docs/product/repository-detail.md:271` follows decision 4's reset label.

### Order

Six commits, each passing `npm run check`, with the browser suite at steps 2 and 6. Each lint or check rule turns on only in the commit that clears all of its violations.

1. The icon map, 33 files migrated, rule 4 on with its lint tests. Pixel changes: icon sizes, stroke 1.5 and the arrow icons.
2. Primitives, tokens and their stories, including every Button call site renamed to the new variants and sizes: Button, fields, Pager, overlays, Callout, DataLegend, EmptyState, Avatar, RecordStatus, ChartPanel and ReportToolbar, with the contrast tests. Checkpoint A.
3. Remove the feature overrides, migrate the 28 rule 3 sites, rule 3 and the descendant-selector check on with their tests.
4. States and identity applied across pages, including `DataTable`'s empty row; `PageState` and `ui/alert.tsx` deleted with their importers and story entries.
5. The table toolbar, search modes, Pager and footer.
6. `ReportToolbar` on every page, the wording, `zonedRangeLabel`, the allowlist closure and the documents. Checkpoint B.

### Step notes

Step 3, beyond the 28 sites:

- Raw controls that feature CSS restyled became primitives, so their overrides could go without new P2 allowlist entries: the timeframe preset, the four Timeline selects, Chart metric, Record scope and the repository scope select became `NativeSelect`, and the repository selector's checkboxes became `Checkbox`. Chart points and removable filter chips, native buttons no primitive renders, are styled by their own classes.
- Primitive additions: an `Input` `font` prop (`sans` or `mono`, for the temporary password) and `DropdownMenuScrollGroup`, which keeps the Account type menu's label and Apply in view while its options scroll. `PasswordInput` and `ScrollableDialogContent` take no `className`, so rule 3 cannot be bypassed through them.
- The header Repositories menu, a `layout/` site, moved early to `size="md"` because its override was deleted; four `layout/` sites remain for P4.
- The control-override check reads every height and block size (min and max included), every background and border property except `border-radius`, `box-shadow`, `font` and `font-size`.
- Expected at Checkpoint B: menus use the primitive's 4px padding (Columns was 8px, Repositories 6px) and the Columns menu's 72svh cap gives way to the available height; icon-only ghost buttons (column help, dialog close, remove period) are muted until hovered, and the column help grows from 26px to 28px; Add second period is a 34px secondary button; field text is 13px (was 12px) and selects take the input fill; company breakdown links take the 8px control radius and filter chips the 4px small radius.

Step 4:

- The contributor and company headings' 48px avatar sits on the canvas, not a card. The contribution header sets `--identity-surface` to the canvas, so the badge disc reads as cut out, and the 48px avatar takes a 1px edge in the default line token, so its selection tint shows on the canvas in both themes. P4's `PageHeader` keeps both.
- Decision 1's notice shows only when every value in the range, not-applicable included, is a complete recorded zero. A repository timeline whose median merge time is not-applicable therefore shows no notice, even when every count in it is zero.
- The insight records table (`RepositoryRecordTable`, `record-base-columns.tsx`, the merge-duration drilldown) shows no Avatar, because `RepositoryPullRequest` and `PullRequestRow` carry no account type. Owner P3, which adds the field with the table system.
- The masthead sign-out error (`src/components/layout/toolbar.tsx`) stays a plain `role="alert"` paragraph. It is a P4 holdout owned by the account menu, which sits beside sign-out; the sign-out code stays unchanged.

Step 5:

- An empty table whose page holds its search (`search: 'external'`, the repository pages) says "Adjust the selected scope or search." where it said "Adjust the selected scope.", because those pages now have a search field. A table with no search keeps "Adjust the selected scope."
- The footer count says "matching" while a search or a filter narrows the rows. `DataTable` takes a `filtered` flag for filters it does not apply itself; the repository pages set it while a search or any record filter differs from its default, so a list narrowed only by a label filter counts "matching PRs" and an unfiltered list counts plain "PRs".

Step 6:

- Each report page's scope controls and scope summary are one `ReportToolbar` region: "Repository view settings" on Summary, "Selected repository scope" on repository pages and author lists, "Timeline scope" on the three Timelines and "Contribution report scope" on contribution reports. The separate "Timeline settings" panel and scope boxes are gone; "Timeline settings", "Report filters" and "Repositories" name the groups. On repository pages the Record scope select has its own "Record scope" group and Reset view sits in "Columns, sorting and charts", named for what it restores, since it keeps the record scope; author lists, which have no scope select, show only the second.
- The summary row leads with the range ("range · UTC") or the list title and lists only facts the controls do not show: interval and included-account counts, company attribution, the primary branch, the measure's meaning, record counts and draft handling. Grouping, record kind, measure family, repository counts and population leave the summaries. Account types stay while only some are included ("Account types: Human, Bot", in the fixed type order; "No account types" for none), because the Account type control shows only a count ("2 types") for two or three; with all included the control reads "All" and the fact goes. The repository page's "Current open"/"Period activity" tag shows only where no Record scope select is shown.
- A view rendered without controls (stories, component tests) shows its summary alone. The toolbar disables its groups, resets included, until client handlers attach and while an update loads.
- The matrix period-window status line is named "Period window", so specs address it beside the toolbar's status line.
- `zonedRangeLabel` replaces the ad-hoc range strings in scope summaries, chart captions and bar details, the activity period headings, the activity-date filter chip, the drilldown scope and the supporting interval scope of Timeline supporting views. These keep their own notation, because each is a row, column or window position or an exact instant, not a report's range: the Timeline table's period labels and covered dates, and their hover description in exact instants with the end rule; the matrix window label and its interval column descriptions (exact instants); and the Summary Period activity row labels and metric link names, which name a row's period ("This month" or its dates) in a two-period comparison. The period column's help, the activity period headings and the toolbar summaries state the zone.
- One disclosure pattern: `DisclosureChevron` (`src/components/ui/disclosure-chevron.tsx`) draws the trailing chevron of ChartPanel, FilterChoices and the sign-in help. It turns while its button has `aria-expanded="true"` or its `<details>` is open, and a summary that holds it hides its native marker, so the three copies of the marker and rotation CSS are gone. In the sign-in view only the summary's decorative icon and its stylesheet change.
- All Repositories explains its value glyphs with `DataLegend` in each table's footer, from the marks that table's visible columns show; the hand-written glyph-key paragraph is gone, and its sentence that human reviewers, current approvals and agent/bot activity are measured separately joins the Current backlog footer note.
- The allowlist closes at 46 entries (P3 15, P4 31) and 68 unmodelled sites. Fifteen P2 entries went with the code or onto tokens, the two `ui/table.tsx` text sizes move to P3 with the administrator Users table, and chart bars keep their 2px radius through `--prebid-radius-mark`.

Checkpoint B (structure comparison of `e4ba804` and the P2 head at 1440, every inventory view in both themes, plus captures at 1440, 1366 and 390):

- Fixed: record-table Author columns are 200px (were 150px), so a typical handle and its 14px external-link icon stay on one line instead of breaking at the handle's hyphens (40 of 44 merge-duration rows had grown to two lines); a longer handle still wraps rather than being cut off; a toolbar group that holds only its reset wraps it to the row start at <=600px like every other group; the merge-duration, PR-author and contribution-credit drilldowns frame their scope with the summary-only `ReportToolbar`; filter disclosures in the Filters dialog take the field edge the selects beside them use.
- Expected: data, links, headings, statuses and URLs are unchanged on every view. Collapsed ChartPanel content is no longer rendered, and the collapsed Trend trigger's `aria-controls` now names an element in the page. The new components set `type="button"` on their buttons (none is inside a form). In record tables the external-link icon follows the handle instead of the cell edge (its placement is P3, TBL-10). `Label` uses the small type role, so the authentication fields sit about 6px lower. Where an identity cell sits beside a visible Account type column, the row name repeats the type, as the badge does visually; hiding the column keeps the type in the identity cell. At 1440x900 the Current backlog Columns menu opens above its trigger, because the toolbar card moves the trigger down; P3's table system revisits the menu.

### Exit

- Rules 3 and 4 are lint errors with no violations; the lint unit test passes.
- The design-token check passes with no P2-owned entries and `completedPhases` `['P1', 'P2']`.
- Story coverage lists every new story and passes in both engines with no recorded violations; the contrast tests and the reset-pattern test pass.
- `npm run check:all` passes.

Checkpoint A: the new primitives' stories in Light and Dark. Checkpoint B: `capture:views` against `e4ba804` and the P2 head, with a structure comparison like P1's, expecting only the planned text changes.

### Decisions (2026-11-01)

1. All-zero timelines show an info Callout: "Every value in this range is a recorded zero; no data is missing." Approved, built minimally (one condition, one Callout): it is expected to go once real data replaces the samples.
2. The unmapped company bucket is a dashed tile with a muted `Building2` glyph, not a monogram. Approved.
3. The agent account glyph stays the specified `Cpu`. Approved. Checkpoint A shows it at both badge sizes.
4. Toolbar wording: "Reset view" restores what a view saves, "Reset filters" restores the shared report filters (Over time shows both, one per group); every toolbar says "Preferences saved for your account on this browser." or, without storage, "Browser storage is unavailable. Changes still work in this URL." Approved.
5. Secondary buttons take the input-border edge (`#798b99` / `#6a8396`, about 3.5:1) that fields and selects use, not the lighter strong line the Controls paragraph names (1.74:1 in Light, 2.29:1 on the Dark overlay), which the Lines paragraph and rule 8 contradict. Light outlines become visibly darker. Approved.
6. The sign-in and change-password controls shrink from 47px to 40px, the top of the 28/34/40 scale. Approved on one condition: the authentication pages change presentation only. Nothing under `src/lib/auth`, the server actions, `src/middleware.ts`, form and field names, or submit handling changes, and the account and production suites pass unchanged, because the AWS account tables cannot be reached to verify a behaviour change before the next deploy.

Made as technical calls, each recorded above: the Radix Select retires (item 3); `sheet.tsx` is removed (item 4); rule 3 covers shared components (item 9).

### Unverified premises (P2)

- WebKit renders the `appearance: none` checkbox, radio and select the same as Chromium.
- The `pointer-coarse` Tailwind variant reaches every control size and the 16px field text; checked with a Playwright context using `isMobile` and `hasTouch`.
- Hiding single-page pagers changes no footer count text that a spec pins.
- `collisionPadding` keeps the Columns menu 16px inside the viewport at 390 and 1440 in both engines.

## P2 evidence

Recorded 2026-11-01 against the P1 head `e4ba804` on `build:preview`/`start:preview`, Node 24.22.1.

### Checks

- `npm run check:all` passed at `81d7fae`: Vitest 2,387, account integration 34, production integration 13 and Playwright 1,328 (Chromium and WebKit), with no skipped, pending or flaky results. The Checkpoint B fixes after it (record author column width, toolbar reset wrapping, insight scope toolbar, filter disclosure edge) pass `npm run check` (2,388) and the browser specs they touch: repository insights, drilldowns, page layout, page filters and inventory design, 202 in both engines.
- Rules 3 and 4 are lint errors with no violations; four `layout/` sites wait for P4. The design-token check passes with 45 allowlisted sites, none owned by P2, `completedPhases` `['P1', 'P2']` and 68 unmodelled sites under its ceiling. The story-coverage spec runs all 161 stories in Light and Dark with no recorded violations.
- Decision 6: nothing under `src/lib/auth`, `src/middleware.ts`, `src/app/auth` or `src/app/api/auth` changed between `e4ba804` and the P2 head; the authentication views changed presentation only, and the account and production suites pass.

### Checkpoints

Checkpoint A, approved 2026-11-01: 31 stories in Light and Dark (buttons, fields, pager, dialog, menu, callouts, empty states, data legend, chart panel, avatars, record status, report toolbar, sign-in and change password), after an independent review whose five findings were fixed.

Checkpoint B, approved 2026-11-01: `capture:views` against `e4ba804` and the P2 head, 204 cells each, none failed. Structure: every inventory view, two of them also loaded signed out, in Light and Dark at 1440px, 72 pairs, keep every data value, the known-zero/missing distinction, link target, heading, status code, final URL and title; Light and Dark change identically; the changed text, names and controls are the planned ones recorded in the step notes. The comparison found four unplanned differences, fixed before approval (step notes, Checkpoint B).

### Baseline measurements

Unchanged: 186 Tab presses to Period activity, 22 distinct font size and weight pairs (24 with uppercase tracking), a 1,208-character Summary→Timeline href and 598 characters after one scope change. Changed, because every report now frames its scope in a toolbar card: All repositories header to first control 220 → 237px, first table y=449 → 514 and Period activity y=1362 → 1464; repository page first table y=772 → 894; author lists y=696 → 787; Contributors y=625 → 673. Pages whose separate settings box merged into the toolbar move up: Timelines first table y=813 → 749, insight drilldowns y=556 → 516. The `/repos` document 695,628 → 700,276 bytes and flight 264,067 → 264,504 bytes.

### Unverified premises (P2): results

- WebKit and `appearance: none`: the story-coverage spec renders every field story in WebKit with no axe violations; the checkbox, radio and select geometry was measured in Chromium only.
- `pointer-coarse`: at a 390px touch viewport every button size measured 40px in Chromium; the 16px field text on a coarse pointer was not measured.
- Single-page pagers: four "Page 1 of 1" assertions became assertions that the pager is absent; no other spec pinned footer text, and the browser suite passes.
- `collisionPadding`: menus keep 16px from the viewport at 1000 and 390px in Chromium. At 1440×900 the Current backlog Columns menu opens above its trigger (step notes, Checkpoint B).

## P3 plan

Proposed 2026-11-01 against `26b4456`, the head of the P0–P2 pull request. The branch `feature/p3-table-system` is cut from that head; its pull request targets `main` once P0–P2 merge. Line references were read at `26b4456`.

### Scope

The 31 P3 findings in Appendix A except TBL-15 (the administrator Users page is outside the redesign, decision 8), under the Delivery rules: about 60–70 files (roughly 40 source, config and docs; 22–28 tests), against 222 in P2. Most fixes land in `src/components/tables/data-table.tsx` and its CSS, which already render every header, pinned column and footer. A call site changes only where the call site itself is the defect, and each one is named below.

### Items

**1. Headers and lines** (CONTRIB-06, REPO-09, REPOS-12, TBL-01, TBL-02). In `data-table.module.css` only: group headings centred at 11/700 uppercase +0.07em over a 2px Prebid-blue spanner; 2px strong lines between column groups and at the pinned junction (one line, not two); 1px subtle lines between columns and rows; the header-band hover fill on sortable headers; a 3px blue inset bar on the first cell of a hovered row. Core contribution metrics get display-only group headings, Authoring (PRs authored, Authored PRs merged), Reviewing (Reviewer contributions, Approval contributions, Merges performed) and Issues (Issues authored), set in `contribution-columns.tsx`; column order and CSV headers do not change.

**2. Sort** (TBL-03, TYPE-05, CONTRIB-08, CTRL-05, GAP-02). A `SortIcon` in `src/components/tables/` in a 14px slot with 12px icons at stroke 2: idle `ChevronsUpDown` in the muted sort ink, sorted `ArrowUp`/`ArrowDown` in the link colour; before the label in numeric columns and after it in text columns; an orange underline on the sorted header. `aria-sort` stays the state and the sort button's name is the column label alone, so labels never shift. When the sorted column is hidden or outside the visible period window, DataTable's footer note is the one description; the duplicates in `contribution-view.tsx` and `repository-page-view.tsx` go.

**3. Alignment and numbers** (CONTRIB-07, GAP-01, TBL-04, TBL-05, REPO-17). Text left, numbers right with tabular figures, headers aligned with their cells and top-aligned, wrapping to at most two lines at one metric width. Body cells top-aligned, so numbers sit level with a record's title. The partial-value asterisk gets its own trailing slot, so digits align (the Phase 2 carry-over). Displayed negatives use the Unicode minus; CSV keeps the ASCII hyphen. Weekly period headers read a compact range (decision 3), and weekly rows print the range once.

**4. Width, pinning and sticky headers** (TBL-06, TBL-07, TBL-08). The pinned identity column stays 248px (164px at <=600px; from the final visual inspection, 128px at <=374px where the next column holds numbers) and numeric columns share surplus width (decision 4). The pinned edge shows a shadow while the table is scrolled sideways, and the trailing edge shows the same shadow while more columns remain (decision 5). The insights authors and credits tables pin their account column. Sticky headers use a bounded-height scroll area per table (decision 1): one `thead`, no script, and the horizontal scrollbar stays in view; a `--sticky-offset` token, which P4 sets, reserves room for the page header.

**5. Records** (REPO-06, REPO-07, TBL-09, TBL-10, GAP-08, TBL-12). One record row: `RecordIdentity` (number, title link, `RecordStatus`, label chips) moves to `src/components/github/` and serves record pages, author lists, Timeline supporting records and the merge-duration insight, with status and labels inline instead of separate columns. The author link's external icon follows the name. Author-scoped lists hide the Author column. The feature density overrides in the contributions, records and page CSS go. The merge-duration rows gain the author type (model and mock), so their authors get avatars (the Phase 2 holdout).

**6. Drillable numbers** (CONTRIB-10, REPOS-13, TBL-11, TYPE-13). One style for a number that opens its records: ink at rest, a dotted Prebid-blue underline, the link colour on hover. Summary, Timeline, Contributions and the supporting views use it; the KPI tiles take the same style and nothing more (decision 6).

**7. Periods** (REPOS-08, GAP-05). In two-period comparison each period carries an overline tag, "Period 1" and "Period 2", and the difference row shows its sign with the Unicode minus (decision 2). One partial-period marker everywhere, the caption "Partial" on its own line (decision 7).

**8. Allowlist.** The P3-owned entries go and `completedPhases` adds `P3`. The two `src/components/ui/table.tsx` entries, which only the excluded Users page uses, move to P4 with that reason. No new tooling.

### Tests

Behaviour only (Delivery rule 2). New: the sort button's name and `aria-sort` through idle, ascending and descending; the label does not move when sorted; non-text contrast of the sort icons and spanner on the header band; the header stays visible after scrolling a 50-row table at 1440 and 375; the pinned column stays put at both scroll ends; digits right-aligned with the asterisk outside them; record numbers level with the title's first line; the Unicode minus on screen and the hyphen in CSV; the Authoring, Reviewing and Issues headings with unchanged CSV headers; one sort note for a hidden sorted column; one computed style for drillable numbers across pages; the author link icon beside the name. Updated: 31 test files whose names include the typed sort arrows or pin header text and geometry. Dropped: three class-name assertions in `pager.test.tsx`. New stories for `SortIcon` and a sticky-header table join the coverage list.

### Order

1. One worker builds the shared core: `data-table.tsx` and its CSS, `SortIcon`, the sort tokens, the Unicode minus, the asterisk slot, the drillable-number style and the sticky scroll area, with their tests and stories.
2. Then three workers in parallel, each in its own worktree with disjoint files: (a) All repositories Summary, the Timeline table and the matrix; (b) repository records, insights and Timeline supporting views; (c) contributions.
3. One worker merges the three, closes the allowlist and records the step notes; one independent review of the whole phase; `npm run check:all` once; one checkpoint for approval (stories and page captures together, decision 9); then the pull request.

### Step notes

Step 1, the core (`f9bfa53`), beyond the items: two optional props, `DataColumn.displayGroup` (a heading drawn over a column on screen only, never in metric names, menus or CSV headers) and DataTable's `offscreenSort` (the footer note for a sort by a column outside a window, such as the matrix's period window). The drillable-number style is `src/components/metrics/drillable-number.module.css`.

Step 2(a), Summary, the Timeline table and the matrix:

- GAP-05 was open at this step: the matrix header appended " (partial)" to its period label and sort-button name, because `DataColumn.label` is one string inside one two-line clamp. Step 4 closes it with `DataColumn.labelCaption`.
- The compact weekly range comes from a new `timelinePeriodHeading`, used only by the Timeline table and the matrix. `timelineIntervalLabel` is unchanged because the chart tooltip and the Timeline CSV "Period" column use it, so those still read "Sep 21, 2026 – Sep 27, 2026".
- The covered-dates line under a Timeline row heading uses the compact range in every grouping, not only weeks, so one cell never mixes two notations, and it is omitted where it equals the heading (a full week).
- The matrix repository name takes the Summary `.repositoryLink` rule from `overview.module.css`. In the multi-metric matrix the ranking metric is named only by the off-window sort note; while the sorted period is visible, its column description names the metric.
- `TimelineTable` also renders the contribution Over time views and the Timeline supporting tables, so the compact headings, the dates line and the "Partial" caption appear there too.

Step 2(b), records, insights and Timeline support:

- The merge-duration rows are typed `MergedPullRequest` (`RepositoryPullRequest` plus `authorType`) and `MergedPullRequestList` in `src/models/repository-insights.ts`. Typing them through `repository-page.ts` would close a type-only import cycle, which dependency-cruiser's `no-cycles` rejects.
- `actorLabels`, `commonColumns`, `recordPrColumns` and `recordIssueColumns` moved into `record-base-columns.tsx`, and `repository-records-view.tsx` re-exports the three public ones, so `repository-page-columns.tsx` and `repository-records-view.tsx` do not import each other.
- `RepositoryRecordTable`'s `list` prop narrows from `RepositoryRecordList` to `MergedPullRequestList` and its issues branch is removed, because its only caller passes merged PRs. This is a prop change under Delivery rule 1, recorded as decision 10. Its defaults are `repositoryRecordColumnDefaults(selection)` plus `mergeDays`. Status and labels moved inline, and the visible columns are otherwise the ones it showed before.
- `RecordIdentity` takes `{ title, url, status, labels? }`, because it also renders the credit list's `SupportingRecord`. `RecordNumber` ships in the same module and keeps the number in its own pinned column. Record links are plain `<a target="_blank">`.
- Also changed: the insight "View N PRs" link uses the drillable style, since removing `.recordLink` left it unstyled. The credit table's PR number became a `RecordNumber` link. The base `prColumns`/`issueColumns` title cells are deleted and the labels column is hidden everywhere and absent from Columns. `.records table { --pinned-width }` stays as the number column's width and now also wraps the merge list.
- `repositoryRecordColumnDefaults` always returns an explicit `author` key. Author lists and a repository's main list share one stored column key. Read from the code but not run: hiding Author on the main list also hides it on that repository's author lists.

Step 2(c), contributions:

- The contribution tables keep their own pinned width, 220px (180px at <=600px; from the final visual inspection, 140px at <=374px where a metric column follows it). P3 changes no pinned width. The 248px/164px in item 4 is DataTable's default, which Summary uses. `contribution-layout.spec.ts` bounds the identity column at <=255/<=185px either way.
- Every number column is 126px wide, the Companies "Included accounts" column included (it was 110px). The Contributors table's minimum width therefore rises by 96px, to 1,216px with the pinned column. These widths are computed from the column widths, not measured. Below that width the table scrolls sideways inside its own area.
- Record titles take the surplus width instead (a column's `grow`), so on record lists the numbers keep their declared widths and titles stay on one line at 1440px, as in the P2 look. Decision 4 applies to tables without a growing column. Measured at 1440px on `/repos/prebidjs`: the title column was 345px before and is over 500px after.
- The scroll area sets `overflow-anchor: none`. In Linux WebKit, scrolling a table sideways to its end moved the page up by the area's own scroll offset with no page script scrolling; with the property set, 3 of 3 runs kept the page still, against 3 of 3 jumps without it.
- The Contributors company cell reads in body ink at body size (it was 12px muted), so the identity columns beside it share one style.
- The supporting-record cell keeps one "#n title" link with a muted number. At the merge it used the feature's `.identityLink` and its own `.recordLink` and `.recordNumber` rules; step 4 moves it to `RecordTitleLink`. The contribution details keep their own Current state column.
- `contributionDetailColumns` also renders the Timeline supporting contributions table, so the state, record and account cells change there too.

Step 3, the merge (`p3/integrate`):

- The three branches change disjoint files except `scripts/design-token-allowlist.json`. Each side removed one P3 entry there, and the merge keeps both removals.
- The Timeline supporting-interval scope (`timeline-support-frame.tsx`) renders `PartialPeriodMarker`, the one partial-period marker of decision 7. It already used that marker's style, and its text changes from "Partial calendar period" to "Partial".
- The allowlist closes at 33 entries, all P4, down from 45 (P3 14, P4 31). Twelve P3 entries went with their code: the core removed 4, step (a) 6, step (b) 1 and step (c) 1. The two `src/components/ui/table.tsx` text sizes move to P4 because the administrator Users page is outside the redesign (TBL-15 withdrawn). Step (b) renamed one P4 selector to `.breadcrumbs a:focus-visible, .meta a:focus-visible`, because `.number` and `.titleLink` moved into the shared record module. `completedPhases` is `['P1', 'P2', 'P3']`, and `CEILING` is 33. The unmodelled ceiling stays 68, because the count is still 68. The token-check unit fixtures that stood for an open phase move from P3 to P4, as the P2 close-out moved them from P2.
- No U+2190–U+21FF character remains in a `src/` text source, and the token check's arrow scan passes with no arrow entry.

Step 4, phase review fixes (`p3/review-fixes`):

- `DataColumn.labelCaption`, optional and additive, draws a caption line inside the header's sort button in the partial-period marker's style, and the button's name reads it after the label. Metric names, Columns, the CSV dialog and CSV headers keep the label alone. The matrix sets it to `partialPeriodCaption` ("Partial", the text `PartialPeriodMarker` draws) for a partial period, and its period descriptions drop "Partial calendar period." (GAP-05, decision 7).
- Group headings wrap instead of ending in an ellipsis. DataTable's `measure()` sets `--table-group-height` on the table frame from the group row's measured height, and its ResizeObserver also watches the header, so the second header row sticks beneath a wrapped group row. The stylesheet keeps 34px (30px at <=600px) on the frame for the first paint.
- The 14px sort-glyph slot sits in the label's text inside a no-wrap span with the first word (numeric columns) or the last word (text columns), so it stays beside a wrapped label. The slot is present in every sort state, so the label does not move.
- `pullRequestStatus` shows Draft only while a PR is open. The contribution details use it and `issueStatus`; their own status map is deleted, and the Current state column's value reads the same status label.
- `RecordTitleLink` renders the record-row title link; `RecordIdentity` uses it, and the contribution supporting-record cell uses it with `number`, `hint` and `external`. The cell's `.recordLink`, `.recordNumber` and `.recordLink svg` rules leave `contributions.module.css`; `.identityLink` stays for the account and company links.
- The matrix's `.groupEnd td { padding-bottom: 16px }` override is deleted (TBL-12); the 2px row border separates metric groups.
- A text column's `<col>` width is its declared pixel width; the `--table-column-width` fallback had no setter.
- Tests: the three class-name assertions in `pager.test.tsx` and the lucide class assertions in `icons.test.tsx` and `data-table.test.tsx` are replaced by glyph-identity checks or removed; the `data-scrolled`/`data-more` hook test is deleted, since `table-system.spec.ts` checks the visible shadows. Period activity has no CSV export, so the planned "hyphen in CSV" check has no subject; `repository-overview.spec.ts` no longer claims it.

Visible text changes (P3 as merged):

- Sort buttons are named by the column label alone, and the typed arrows are gone (core).
- Summary two-period comparison: "Period 1" and "Period 2" become visible overline tags (they were screen-reader text). The accessible text "Period 1: …" is unchanged.
- Timeline table, weekly grouping: row headings and their value-link names read "Sep 21–27, 2026" (they read "Sep 21, 2026 – Sep 27, 2026"). The covered-dates line reads "Oct 1–24, 2026" in every grouping except day, and is omitted when it repeats the heading. The partial caption reads "Partial" (it read "Partial period"). The same applies in the contribution Over time and supporting tables.
- Matrix: weekly headers and sort-button names use the compact range. A partial period's header shows "Partial" on its own line under the label, and its sort-button name reads "Oct 2026 Partial" (it read "Oct 2026 (partial)"); its description, in the header's hover text, its screen-reader description and Column definitions, no longer ends "Partial calendar period." (step 4). The matrix's own note "Sorted by {period}[ · {metric}] ({direction}[; outside visible periods])." is gone. DataTable shows "Sorted by {period}[ · {metric}] ({direction}); its column is outside the visible periods." only while the sorted period is outside the window.
- Repository record pages: the "Newest created first" table description is gone. A sort on a hidden column is described by the footer note.
- Author-scoped record lists and author-scoped Timeline supporting records start with the Author column hidden; Columns still lists it.
- The merge-duration list shows the record row: a pinned number link, the title with its status ("Draft" where the title read "… (Draft)") and label chips beneath it, and avatar authors. Its separate Status and Labels columns leave the table and Columns, and its footer counts "N PRs" (it counted "N items"). The title column's value, which search reads, keeps " (Draft)".
- Insight credit list: the PR number is a link named by the number. The title shows its status beneath it, "Draft" where it read "… (Draft)". The insight authors and credit tables pin their account column.
- Contributions: the core metrics sit under "Authoring", "Reviewing" and "Issues" headings, while metric names, Columns, the CSV dialog and CSV headers keep the plain labels. A sort on a hidden column now shows the footer's "Sorted by {group} — {label} ({direction}); its column is hidden." beside the "Credits, comment activity and merged PR volumes are separate measures." note, where it used to replace that note.
- Timeline supporting-interval scope: "Partial" replaces "Partial calendar period" (merge).
- Group headings at narrow widths wrap onto a second line instead of ending in an ellipsis (step 4).
- Record status: a PR merged or closed while still marked draft reads Merged or Closed on record pages, the merge-duration list and the credit list, as it already did in the contribution details. In the sample data this is Prebid Server (Go) PR 104, a closed draft, whose status read Draft (step 4). Record search text and the Draft filter still follow the draft flag alone.

Expected at the checkpoint:

- Headers: sort icons in a 14px slot (before numeric labels, after text labels); the orange rule under the sorted header; centred group headings over a 2px blue spanner; 2px strong lines between groups and at the pinned junction; header labels wrapping to two lines; body cells top-aligned.
- Each long table is a bounded-height pane with a sticky header and its horizontal scrollbar in view; pinned-edge and trailing-edge shadows while scrolled sideways; the insight authors and credit account columns pinned.
- Drillable numbers in ink with a dotted blue underline on Summary, Timeline, the matrix, Contributions, the KPI tiles, the Timeline author counts and the insight "View N PRs" links. A contribution count past the link limit is not styled as a link.
- Record rows on record pages, author lists, Timeline supporting records, the merge-duration list and the credit list: a title in ink 500 with status and labels beneath it, and a muted number. Merge-duration authors gain avatars.
- Contributions: wider metric columns (126px) and therefore more sideways scrolling at narrow widths; the company cell in body ink; stacked credited-account cells; the record state as a coloured `RecordStatus`.
- Unicode minus on signed differences on screen (CSV keeps the hyphen); a partial value's asterisk hangs past its digits.
- Unchanged: data values, the known-zero/missing distinction, link targets, URLs, CSV headers and column order.

### Exit

- Every table renders through one header implementation; no typed sort glyph remains; no allowlist entry is owned by P3; `completedPhases` includes `P3`.
- The new behaviour tests and story coverage pass in both engines; `npm run check:all` passes.

### Decisions (2026-11-01)

1. Sticky headers: long tables scroll inside a bounded-height area, so a 50-row table becomes an in-page pane with its own vertical scroll and its horizontal scrollbar in view. The alternative, a header mirrored outside the scroller and kept in sync by script, avoids nested scrolling but adds about 100 lines to DataTable. Recommended: the bounded area.
2. Two-period comparison: "Period 1"/"Period 2" overline tags and a signed difference with the Unicode minus, no colour and no extra glyph. Recommended.
3. Weekly period headers read "Sep 21–27, 2026" instead of "Sep 21, 2026 – Sep 27, 2026". Recommended.
4. Surplus width goes to the numeric columns equally, as Contributors does today. Recommended.
5. A trailing-edge shadow while more columns remain to the right, with the pinned-edge token. Recommended.
6. KPI tiles take the drillable-number style only; no icon or accent ("Headline totals" stays not added). Recommended.
7. The partial-period marker is the caption "Partial" on its own line, replacing both "(partial)" and the bordered chip. Recommended.
8. The administrator Users page is outside the redesign; TBL-15 is withdrawn and the page keeps its current table.
9. One checkpoint at the end of the phase, stories and page captures together, instead of Checkpoint A before pages and B after.
10. Technical call: `RepositoryRecordTable`'s `list` prop narrows from `RepositoryRecordList` to `MergedPullRequestList`, and its issues branch is removed. Its only caller, the merge-duration insight in `repository-insights-view.tsx`, passes merged pull requests, so the issues branch was dead code. This is a prop change under Delivery rule 1.

Decisions 1–7 and 9 were approved as recommended; decision 8 is the maintainer's exclusion; decision 10 is a technical call recorded at the phase review.

## P4 plan

Proposed and approved 2026-11-01 against the P3 head; the branch `feature/p4-shell-header` is cut from it and its pull request stacks on the P3 pull request until both merge. The maintainer approved continuing from P3 into P4 with any choice that keeps the look approved on 2026-10-31; the decisions below follow that rule and are recorded rather than awaited.

### Scope

The P4 findings in Appendix A: about 95–120 files (roughly 55–65 source, config and docs; 40–55 tests and stories), larger than P3 because every page's header is replaced. P4 adds `PageHeader`, `ViewBar`, `SectionNav` and an account menu (Component ownership); the existing headers keep their props and render through `PageHeader`, so call sites do not change.

### Items

**1. Masthead** (SHELL-01, SHELL-07, SHELL-08, SHELL-09, CTRL-11). Navy in both themes, sticky at the top, 64px (`--shell-height`; at 1000px and below a 56px row plus a 44px navigation row, 1120px from P6), a 3px Prebid-blue top rule and the knockout logo. Navigation labels in Mona Sans 14/600 with a hover pill and the orange underline; no navigation icons (decision 8). Header icon buttons are 36×36 through a new `Button` size `icon-lg` and variant `masthead`, with a visible pressed and open state; the theme and width controls drop their `className`. Repositories menu items show pending navigation.

**2. Account menu** (SHELL-06). A 36px trigger with a 28px `Avatar` and the name (hidden at 600px and below) opens a menu with name, email, role and, outside preview builds, a Change password link to the existing route. Sign out stays a visible masthead button, rightmost, styled as a masthead button: its handler, `signOut` call, labels, disabled state and alert are unchanged (decision 6).

**3. Page header** (CONTRIB-01, REPOS-01, TYPE-03, REPO-02, REPO-04, SHELL-17). One `PageHeader`: an optional breadcrumb row (back icon once, separators, the current view unlinked with `aria-current="page"`), the title flush left at display 30/34, an optional identity slot inside the same `<header>`, one meta line, and the amber "Data as of" chip inside `aside aria-label="Data source"`. Fixed row heights keep sibling tabs from moving the toolbar. `AllRepositoriesHeading`, `RepositoryHeader`, `ContributionHeading` and the Timeline support header render through it with unchanged props and accessible names. A repository subpage keeps the repository name as its `h1` and shows the subpage as the current crumb (decision 5).

**4. View bar and sections** (CONTRIB-02, CONTRIB-03, CTRL-07, REPO-13, REPO-16, P4 sticky sections). A fixed 44px `ViewBar`, sticky below the masthead, holds the tabs and, on pages with two or more sections, `SectionNav` chips with scroll-spy; a jump moves focus to the section heading and updates the fragment with `history.replaceState`, adding no Back entry; at 600px and below a "Sections" menu replaces the chips, and from the final visual inspection it also does so above 600px wherever the chips do not fit beside the tabs. Sections are the panels with an `h2`: tables and chart panels (decision 11). `ViewTabs` gains an optional `variant`: underline for subject sets (Contributors|Companies, Pull requests|Issues|Timeline) and segmented for view modes (Summary|Timeline, Report|Over time, company breakdown) (decision 3); tabs never wrap and scroll sideways at narrow widths. On Over time, the area tabs link to the other area's Over time (decision 1). Count pills leave the area tabs (decision 2); the repository record tabs keep one shared `TabCount` style. The two contribution tab rows merge into the view bar. P4 sets `--sticky-offset` to the masthead plus the view bar, so P3's sticky table headers sit below both, and `scroll-padding-top` to that height plus 12px.

**5. Frame, edge pages and footer** (SHELL-05, SHELL-10, SHELL-14, SHELL-15, REPO-03, REPOS-14, CONTRIB-17). The frame's sample-data row is deleted. A footer after `<main>` carries the secure icon and "Private workspace. Access by invitation." with no links (decision 10). A token-styled skip link sits over the masthead's left gutter. Root not-found, error and global-error render through a branded `EdgeFrame` and keep their `h1` text. Contained mode caps content at 1760px (decision 9). The Timeline support frame states its interval through a summary-only `ReportToolbar`; insight panel titles stay (decision 4). At 600px and below the header and toolbar compact; a bottom-sheet filter pattern is not added (decision 12).

**6. Lint and allowlist** (rule 3, rule 4). Rule 3 drops the `layout/` exemption once the four sites are fixed; the `h1` rule (Architecture rule 4) rejects `h1` outside `PageHeader`, the authentication views, `src/app/auth/**` and the edge files, through the shared selector arrays. P4-owned allowlist entries go, except those of the deferred items below; `completedPhases` gains `P4` only when those are settled.

### Deferred while AWS access is out

The authentication and account pages change presentation only until AWS access returns (2026-11-03). Deferred: the branded setup page (`src/app/auth/setup/page.tsx`, SHELL-05 part) and sentence-case copy on the sign-in and change-password pages (SHELL-13 copy; its CSS-only token changes in `authentication.module.css` proceed). The administrator Users page stays outside the redesign (SHELL-16 withdrawn, P3 decision 8). Their allowlist entries stay owned by P4.

### Tests

Behaviour only (Delivery rule 2): the masthead and view bar stay visible while scrolling; a section jump moves focus and updates the fragment without a Back entry; Period activity is reachable in one action from the first screen, with Tab presses counted against the 186 baseline; the three navigation labels fit one row at 390px; the account menu shows its contents per build; P3's sticky table headers stay below the view bar. 42 test files that pin the old headers, Sign out placement, the Data source aside, tab names or layout geometry are updated; nine class-name assertions in them are removed.

### Order

1. One worker builds the shared core: tokens, `Button` `icon-lg` and `masthead`, `PageHeader`, `ViewBar`, `SectionNav`, `ViewTabs` variant and `TabCount`, the `DataTable` section anchor, their stories and tests.
2. Three workers in parallel, each in its own worktree: (a) repositories and Timeline support; (b) contributions; (c) shell, account menu, edge pages and footer.
3. One worker integrates, applies the lint rules and closes the allowlist; one independent review; the pull request's CI as the full gate; one checkpoint page, published without waiting.

### Step notes

Step 1, the core (`e83773f`), beyond the items:

- `ChartPanel` takes the same optional `anchor` as `DataTable`, so chart panels are sections too (decision 11). The icon map gains `SectionsIcon`, `SignOutIcon`, `ChangePasswordIcon` and `DataAsOfIcon`.
- `--shell-height` is 64px, and 100px at 1000px and below (a 56px row over a 44px navigation row; 1120px and below from P6). `--sticky-offset` is the masthead height, plus the view bar's 44px when the page has one, and the root `scroll-padding-top` is that offset plus 12px.
- `PageHeader` shows "Data as of —" for a snapshot time it cannot read.
- `tests/e2e/view-bar.spec.ts` checks the button sizes, the masthead buttons' geometry and contrast, the sticky bar, section jumps and the Sections menu on stories. The two `view-tabs.module.css` allowlist entries closed with the token radii (33 to 31 entries).

Step 2(a), repositories and Timeline support (`c0f6015`):

- A subpage (a supporting view or one author's records) names itself as the current crumb and marks the list it belongs to with `aria-current="true"` on that list's tab, so no tab claims the current page. `RepositoryHeader` takes `contextKind` and `current` for this, and its default Timeline link follows `activeKind ?? contextKind`.
- Sections: Summary links Current backlog and Period activity; a record list links its charts and records; the repository Timeline links Trend and the over-time table. `TimelineChart` and `TimelineTable` forward an optional `anchor`, and `repository-charts.tsx` exports `repositoryChartsSection`.
- The invalid Timeline state and the invalid repository and author states read no snapshot, so they render no `PageHeader`: the Timeline state drops its bare `h1` and its `EmptyState` heading, "Invalid timeline view", names the page; the repository and author states keep their link above the `EmptyState`, now token-styled with the back icon.
- Timeline support pages have no current crumb, because the frame does not receive the supporting table's title; the trail reads "Back to timeline › Back to authors", names that `timeline-support.spec.ts` and `timeline-metrics.spec.ts` pin. The summary-only `ReportToolbar`, "Supporting interval scope", leads with the metric label, followed by "Timeline value: …", the covered dates and "Partial" as inline text, because `PartialPeriodMarker` is a block.
- Author records pages show no avatar: the 18px meta row has no avatar size, and an avatar beside the repository name would mislabel the subject. The current crumb and the toolbar summary name the author.
- GitHub links in the meta line are plain `<a target="_blank">`; their names, targets and hrefs are unchanged.
- `repository-overview.spec.ts` bounds visible rows below every sticky or fixed element, because the view bar would otherwise cover rows the old `header` bound counted.

Step 2(b), contributions (`9784a97`):

- CONTRIB-02's "Back to report" on a contributor's or company's Over time lands in P4 rather than P5d, because Report and Over time cannot keep the same header rows without it. Pure helpers in `contribution-timeline.ts` derive it from the server-supplied Report tab href; no server change.
- Model: `ContributionTimeline.scope.company` (optional) is set for contributor reports. A contributor's Over time links that company's Report page, with the Over time page as its return target, as the Report page's company link does.
- Decision 1 as built: the other area's Over time tab carries the current Over time URL (scope, period and Timeline view keys, `timeline.state=1` included) without `nav`/`returnTo`. Switching areas keeps the grouping and columns and does not restore the other area's own saved Timeline preferences.
- Overviews have no meta line on Report or Over time. The company report keeps its "N included accounts · Current company mapping" text as its meta line.
- The company breakdown is a segmented `ViewTabs` in its table panel. Contribution pages have no section chips, because each has one table panel.
- The invalid contribution view renders `PageHeader` with an empty snapshot, so its chip reads "Data as of —"; the Timeline and repository invalid states (step 2(a)) render no header instead.
- The `.identityLink` and `.companyLink` focus outline radius moves from 3px to `--prebid-radius-small` (4px).
- Not done: CONTRIB-17's two-column toolbar at phone width, which sits in `src/components/reporting/report-toolbar.module.css`.

Step 2(c), the shell (`80479fc`):

- Sign out keeps its handler, `signOut` call, labels, disabled state and alert text. It gains the sign-out icon, and at 600px and below its label is visually hidden while the button's name stays "Sign out". Its alert sits below the masthead in the error tokens.
- Phone compaction beyond the plan: at 600px and below the logo is 100px wide, the account group gap 6px and navigation item padding 6px. Estimated from font metrics, not measured: an administrator's first row fits 375px but overflows at 320px (about 330px against 288px); not fixed.
- Above 1000px (1120px from P6) the masthead grid is `auto auto minmax(0, 1fr)` with the account group last, so a long account name ends in an ellipsis instead of overflowing the row.
- The account trigger is named by `aria-label` "Account: <name>", which contains the visible name. The viewer's avatar is `Avatar` `person` with account type `human`, so it shows the human badge and the title "Human". In preview builds the menu holds only the name, email, a separator and the role.
- The repository 404 renders the `EdgeMessage` card inside the dashboard frame. Root `error.tsx` renders `PageError` inside `EdgeFrame` and keeps its `h2`, because it also renders when the dashboard layout fails. `/foundation` keeps its own `h1` at the display token.
- The skip link appears below the masthead on the content gutter rather than over its left gutter, which cannot hold it without covering the logo.
- `WorkspaceFooter` (`src/components/layout/workspace-footer.tsx`) serves `DashboardFrame` and `EdgeFrame`; the frozen `AuthFrame` keeps its own footer markup.
- Authentication presentation: notices take the 12px panel radius and the eyebrow the overline weight (600). `ThemeMenu` takes `tone` and puts its `className` on its wrapper, so the sign-in theme control becomes a 36px secondary button; `src/app/auth/layout.tsx` is unchanged.
- The masthead's 3px rule is a `border-top` inside `--shell-height`, so the total height equals the token.
- `.storybook/repositories.stories.tsx` renders a stand-in Sign out button with Toolbar's markup, because Toolbar's handler needs a session.
- Not done: REPOS-14's two-column Timeline toolbar at 390px, which sits in `src/components/reporting/**`.

Step 3, the merge (`p4/integrate`):

- The three branches change disjoint files except `scripts/design-token-allowlist.json`; each removed its own entries (repositories 9, contributions 4, shell 14), and the merge keeps every removal.
- `ViewTabs` draws a tab marked `aria-current="true"` with the underline and the ink change but not the weight change, and `ViewBar` scrolls it into view like a current tab (`section-nav.test.tsx`).
- `.storybook/navigation-feedback.stories.tsx` renders the company breakdown as the screen does, a segmented `ViewTabs`; its names and links are unchanged. `.storybook/timeline.stories.tsx` passes the Over time `navigation`, so the contribution Over time stories show the area tabs, or Back to report and, for a contributor, the company link.
- Rule 4's `h1` restriction: `no-restricted-syntax` rejects `JSXOpeningElement[name.name="h1"]` in `src/**` through the shared selector arrays, except `page-header.tsx`, `edge-frame.tsx`, `src/features/authentication/**`, `src/app/auth/**`, the administrator Users page (`users-view.tsx`, outside the redesign) and `foundation/page.tsx`, which has no snapshot for the chip. Beyond the plan: the Users and foundation exemptions. `createElement('h1')` and a computed tag are not read. The exempt files keep rule 3 and the icon rule; `lint-restrictions.test.ts` covers each scope.
- The allowlist closes at 4 entries, all P4 and all deferred: the setup page's `text-2xl` (SHELL-05 part), the two `src/components/ui/table.tsx` `text-sm` (TBL-15 withdrawn) and the Users page's `text-3xl` (SHELL-16 withdrawn). The sign-in copy (SHELL-13) has no entry. `completedPhases` stays `['P1', 'P2', 'P3']`; `CEILING` is 4 and the unmodelled ceiling 67, the count since the core commit.
- `scripts/capture-views.mjs` counts keyboard reach as key presses from a fresh `/repos` until focus is inside Period activity: Tab presses, plus one Enter once focus reaches the "Period activity" section chip. A build without chips, such as the base at Checkpoint B, still counts Tab presses alone.
- `layout-width.spec.ts` checks that at 390px the three main navigation destinations share one row without scrolling it (Tests; P6 extends it to the four destinations).
- Documents: `all-repositories-plan.md:38` and `acceptance-matrix.md:26` drop the sample-data label. `docs/product/README.md:26`, `login.md:60` and `account-operations.md:114` still describe "clearly labeled sample reports"; the Sample-data row does not name them, so they are unchanged.

Step 4, review fixes (`p4/fix`), superseding the step notes above where they differ:

- The invalid Timeline state keeps its `h1` "Timeline": it renders `PageHeader` with an empty snapshot above the `EmptyState`, as the invalid contribution view does, so its chip reads "Data as of —". The invalid repository and author states are unchanged. `timeline-matrix.spec.ts` checks the one level-1 heading.
- Administrator masthead at 320–375px: the account trigger shortens its name, never itself (a minimum of its avatar, padding and border). At 600px and below the trigger and Sign out are 36px squares like the theme button, the column gap is 8px, and the account group never narrows below its controls; an administrator's row takes the room it still needs from the logo, which narrows from 100px to 72px (about 74px at 320px). `layout-width.spec.ts` checks at 320, 340, 360 and 375px that the first-row controls do not overlap and the avatar sits inside its trigger.
- Tabs follow the Typography decision in both variants: the current tab is 700. `ViewTabs` wraps each string child of a tab in a label span over an invisible, zero-height 700 copy of itself (`data-label` and `::after`, hidden from assistive technology), so every tab is as wide at 600 as at 700 and marking another tab current moves no tab (`view-bar.spec.ts`, both variants). A tab marked `aria-current="true"` stays 600.
- The opened account menu is described by its email and role lines (`aria-describedby`), which are text, not items.
- The account trigger is named by its content, a visually hidden "Account:" and the name, instead of an `aria-label`: axe's `label-content-name-mismatch` read the avatar's initials as visible text missing from the label, which failed `story-coverage.spec.ts` on the six All repositories stories and `foundation.spec.ts` in CI. The name stays "Account: <name>".
- The table scroll area takes `overflow-anchor: none`. In Linux WebKit, scrolling the area sideways to its end moved the page up by the area's own scroll offset (849px to the top on a repository page at 375px). No page script scrolled, and excluding the area from scroll anchoring stopped it in 3 of 3 runs against 3 of 3 jumps without. `table-system.spec.ts` caught it in CI and in a Linux container; macOS WebKit and Chromium did not show it.
- `view-bar.spec.ts` measures the sticky masthead on `repositories-all-repositories--overview`, which renders `DashboardFrame` and `DashboardHeader`; the phone check bounds the bar and the page by the viewport, and the Sections specimen's grid takes a `minmax(0, 1fr)` column. `viewTabsClassName`, which had no caller, is removed.

Visible text changes (P4 as merged):

- Every report header: "Reporting snapshot" and its time become the amber "Data as of" chip with the same time. Timeline support's "Reporting snapshot: …" line becomes the same chip.
- Frame: the "Sample reporting data" row is gone. A footer reads "Private workspace. Access by invitation."
- Masthead: the account name moves into an account button (named "Account: <name>"; the name is hidden at 600px and below) whose menu shows the name, email, "Role: Viewer", "Role: User" or "Role: Administrator" and, outside preview builds, "Change password". Sign out shows an icon; its text is unchanged and hidden at 600px and below.
- Edge pages: "Page not found" and "Repository not found" add "No page in this workspace matches this address." and "No repository in this workspace matches this address."; "Back to all repositories" and the global error's "Try again" are primary buttons. Headings are unchanged.
- All repositories Summary: "On this page" chips "Current backlog" and "Period activity".
- Repository pages: the meta line reads "Primary branch <name>" (it read "<name> primary branch"); breadcrumb links are separated by a chevron icon instead of "/"; a subpage's title follows them as the current crumb. Record lists with charts gain chips for their panels; the repository Timeline gains "Trend" and "Activity over time" or "Backlog over time".
- Timeline support: the interval facts (metric, "Timeline value: …", covered dates, "Partial") read as the toolbar summary line.
- Invalid Timeline view: the unstyled "Timeline" heading above the error becomes the page header's title, with the chip "Data as of —".
- Contributions: the eyebrows ("Contribution activity", "Contributor report", "Company report") and the subtitles ("Understand who authors, reviews and merges work.", "Explore contribution activity by current company affiliation.", "Contribution activity across your selected population.", "Contribution activity for this account." and "… company.") are gone. The area tabs read "Contributors" and "Companies" without counts. Over time shows the area tabs on an overview and "Back to report" on a contributor or company, and a contributor's company is a link. The invalid contribution view's chip reads "Data as of —".
- Sign-in, change-password and setup pages: no text change.

Expected at the checkpoint:

- A navy masthead in both themes, 64px (100px at 1000px and below; 1120px from P6) under a 3px blue rule, with the knockout logo, Mona Sans navigation with a hover pill and the orange underline on its bottom edge, 36px header buttons, the account button and Sign out at the right; it stays at the top while scrolling.
- Page titles flush left at display 30/34 with one meta line and the amber chip on the right (beneath the title at 600px and below); sibling views keep the toolbar in place.
- A 44px view bar sticky under the masthead: underline tabs for subject sets, segmented tabs for view modes, section chips with scroll-spy where a page has two or more panels and a Sections menu at 600px and below (from the final visual inspection, also wherever the chips do not fit beside the tabs); a jump lands the section's title under the bar and focuses it. P3's sticky table headers sit below the bar.
- Subpage tabs underlined without the bold weight; tab counts in one style.
- The footer on every dashboard and edge page; branded 404 and error pages; contained width capped at 1760px.
- Keyboard reach: `npm run capture:views -- --measure` against the 186-Tab baseline. Predicted from the tab order, not measured: about 15 presses.
- Unchanged: data values, the known-zero/missing distinction, link targets, URLs, CSV content and the sign-in pages' copy and behaviour.

### Decisions (2026-11-01)

Settled under the approved look, recorded for review:

1. Over time area tabs link to the other area's Over time.
2. Count pills leave the area tabs; the record tabs keep one count style.
3. Underline tabs for subject sets, segmented for view modes.
4. Insight panel titles stay; the toolbar summary states the scope.
5. A repository subpage keeps the repository name as its `h1`; the subpage is the current crumb.
6. Sign out stays a visible masthead button; the account menu holds name, email, role and Change password.
7. The setup page's branding and the sign-in copy wait for AWS access.
8. No navigation icons.
9. Contained width caps at 1760px.
10. The footer carries the secure icon and "Private workspace. Access by invitation." with no links.
11. Sections are panels with an `h2`: tables and chart panels.
12. No bottom-sheet filters at phone width; header and toolbar compaction only.

## P5 plan

Proposed 2026-11-01 against the P4 head. The maintainer approved continuing into P5 with any choice that keeps the approved 2026-10-31 decisions; the choices below follow the URLs and Preferences rows and are recorded rather than awaited. Each sub-phase is one pull request stacked on the one before it until the stack merges.

### Scope

| Pull request | Goal | Files (estimate) |
| --- | --- | --- |
| P5a | Golden URL set; no runtime change | 7–9; no `src/` file |
| P5b | Server-read preference cookies | 50–60 |
| P5c–P5e | One pull request (2026-11-02): the codec, registry, v1 defaults and lint (P5c-1), the contribution routes (P5c-2), return context (P5d), and cleanup and gates (P5e) | 217 against main after P5b (measured) |

P5c is split by area (decision 11) as work, not as pull requests: a core step built the codec, then a repositories step and a contributions step ran in parallel on disjoint files, and an integration step converted the Timelines, retired the old writers and ran the gates. P5c, P5d and P5e ship together, so no released build sends in-app links through a 307.

### Freeze constraints

Until AWS access returns (2026-11-03), nothing under `src/middleware.ts`, `src/lib/auth`, `src/app/auth`, `src/app/api/auth` or the authentication server actions changes, and `tests/production` and the account suites pass unchanged. P5 needs none of them:

- P5b's server reader imports `requireViewer()`, which already returns the account ID and `authVersion`.
- Legacy translation moves out of middleware into a page-level server helper (decision 8).
- `back=` validation uses the codec's own route allowlist; `safeReturnPath` in `src/lib/presentation/navigation.ts` stays as it is, because the authentication views and `src/lib/auth/viewer.ts` share it.
- The sign-in, change-password and Sign out navigations stay as named rule-6 exceptions (decision 18).

### Items

**P5a Golden URL set.** For every view in `tests/support/views.ts`, a Chromium browser spec records the address bar after load, the address bar after one scope change on All repositories, and one link per distinct route pattern and parameter-key set, with its count and longest length (decision 16). The set is compared against a committed text snapshot through Playwright's `toMatchSnapshot`, with a platform-free `snapshotPathTemplate`, and is regenerated with `--update-snapshots`. A unit test resolves every recorded link through today's pure readers and records the states as a Vitest file snapshot. Captured on the P4 head, because P4 changes the Over time area-tab links. No new script.

**P5b Server-read preferences.** Two cookies (decision 13, amended in P5b to `Path=/` for both):

- `repositories`, `Path=/`: All repositories settings and sorts, repository-page columns and sorts per list kind, repository and matrix Timeline presentation.
- `contributions`, `Path=/`: contributors, reviewers and companies scope, columns and sort per table kind, contribution Timeline presentation.

Each value carries a version, the account ID and `authVersion`, and is ignored when they do not match the session. Sections are keyed by view kind and table kind, not by repository (decision 2). Each cookie stays under 3,072 bytes, evicting the least recently updated section with a visible notice. The server validates each section through the existing readers; an invalid section renders defaults with the existing recovery notice. Only deliberate changes write, field by field, through `document.cookie` (decision 6); relative presets stay presets; exports never read a cookie. A one-time localStorage migration takes effect from the next request.

The five client restoration effects and the second Timeline render go. Saved contribution scopes are validated on the server against the directory, which retires the 15-second client lookup. URL semantics do not change, so the golden diff is empty.

**P5c Canonical short URLs.** One parameter registry and codec under `src/lib/presentation/`, with its history hook under `src/lib/navigation/` (rule 6), and frozen v1 defaults that include both lens defaults from the P6b text. Compact encodings:

- comma-separated slugs, with all repositories omitted;
- `-column` for a descending sort;
- period plus snapshot instead of exact instants;
- a bare `?timeline` flag that the codec writes itself, because `URLSearchParams` writes `timeline=` (decision 3);
- `cols=` as a diff against the defaults on record, contribution and Timeline tables, with Summary columns viewer-only (decision 1).

Unknown parameters show the existing invalid-view page. The Timeline allowlist and the contribution return-scope keys accept every registry name. A server helper called after `await requireViewer()` at the top of each report page does two things (decisions 8 and 9):

- It answers legacy links with a 307 to the canonical form, decoded by the frozen current readers.
- It redirects a bare entry to the saved view when that view differs from the defaults.

Toolbar and breadcrumb entry links carry the saved explicit form, so an ordinary click needs no redirect. A rendered defaults-equal entry is materialized with `v=1` before its first push (decision 5). `scope=1` and `timeline.state=1` become legacy forms. Detail and drilldown routes never apply saved scope. Every history writer preserves `location.hash`, including P4's `SectionNav`. The rule-6 selectors join the shared arrays in `eslint.config.mjs`. Export routes accept the legacy form and serve the file without a redirect (decision 14).

**P5d Return context.** `back=` frames appear only when the parent cannot be derived. A link carries at most eight frames within a 1,000-character budget, dropping the farthest first. When the immediate parent cannot fit, the link is disabled with the existing limit message. An unresolvable frame, snapshot pin or cookie section shows a notice or the unavailable state. When the parent is the previous history entry, the back link uses `history.go(-1)`. A Period activity drilldown's back link ends in a derived `#activity`, which costs no `back=` bytes (decision 4). The `returnTo`, `summary`, `timelineParent` and base64 `nav` writers retire.

**P5e Cleanup and gate.** The retired writers and the base64 encoder go. A decode-only legacy reader stays, so old links keep their 307 (decision 12). The 7,500-byte cap and its message stay. Browser assertions over the inventory check that no in-app href exceeds 300 characters or contains `%25`, that the Summary→Timeline href is under 25 characters, that the address bar after one All repositories scope change is under 60, and that no history write happens after load.

### Decisions (2026-11-01)

Settled under the approved URLs and Preferences rows, recorded for review:

1. Column visibility is a `cols=` diff on record, contribution and Timeline tables; Summary columns stay viewer-only.
2. Preference sections are keyed by view kind and table kind. Sample-scenario isolation is dropped.
3. The Timeline tab is a bare `?timeline` flag; `timeline=1` becomes a legacy 307.
4. Return-to-section is a derived fragment, `#period-activity` for Period activity drilldowns (amended in P5c–P5e: the panel's anchor is `period-activity`, and no element has the id `activity`).
5. An entry is a report route whose query holds only view selectors. A defaults-equal entry is materialized with `v=1`; an absent `v` means v1.
6. Preference cookies are written with `document.cookie`: non-HttpOnly, `SameSite=Lax`, `Secure` on https.
7. An invalid section renders defaults with the recovery notice. After hydration, the client deletes it only if the cookie still holds that value. Rule 9 is amended to name this as the second permitted post-load write; it is cookie-only, with no history write.
8. Legacy translation runs in a page-level server helper after `requireViewer()`, not in the frozen middleware. A `loading.tsx` above these pages would move it into the segment layout, which reads `x-dashboard-return-path`; this is recorded for P0b. P0b result (2026-11-02): a layout-level 307 would need a request signal from outside Next, `sec-fetch-dest`, so that RSC requests are not redirected. Whether CloudFront and Amplify forward it is not verified.
9. The bare-entry redirect runs in the same helper, because a layout does not re-render on a same-segment navigation.
10. P5b lands before P5c, because both rewrite the five control hooks and the screens.
11. P5c is split by area into P5c-1 and P5c-2.
12. P5e removes the encoder and writers and keeps a decode-only legacy reader.
13. Two cookies: `repositories` and `contributions`, both with `Path=/` (amended in P5b; `Path=/repos` was the proposal, see P5b notes).
14. Export links are not redirected; export routes accept the legacy form. A test asserts that a legacy and a canonical export link produce identical CSV bytes.
15. The theme stays in localStorage, outside P5.
16. The golden set keeps one link per route pattern and parameter-key set per view, with counts and the longest length.
17. Each P5 pull request amends the conflicting documentation lines, including `foundation-contracts.md:17`, `:20`, `:28`, `:34` and `:132`, `repository-detail.md:238` and `timeline-reporting-plan.md:83`.
18. Under the freeze, authentication navigation keeps named rule-6 exceptions; they are removed once AWS access returns.

### Unverified premises (P5)

- P5b: Amplify and CloudFront forward the preference cookies within header limits. This needs AWS access and is not verified in P5. Locally, a request to the built preview carrying the session cookie plus two 3,072-byte cookies returns 200, not 431; `tests/e2e/preference-headers.spec.ts` checks this. Both cookies are site-wide, so every request carries them.
- P5c: literal `,` `:` `@` survive a `Link` click and a `router.push` in both engines.
- P5c: a page-level `redirect()` during an RSC navigation replaces the entry with the canonical URL, without adding to `history.length`.
- P5c: a request with `maxRedirects: 0` returns 307 for one legacy URL and one bare entry per route group.
- P5c: the router cache serves each entry's own view on Back after a cookie change.
- P5c: every exact drilldown interval round-trips through period plus snapshot.
- P5d: the back link detects a previous-entry parent in Chromium and WebKit.

### Tests

Behaviour only (Delivery rule 2). The golden snapshot is the review artefact for every P5 pull request:

- P5a creates it.
- P5b's diff is empty.
- P5c adds a canonical form per row. The unit test asserts that `legacyDecode(old)` equals the P5a state, that `encode(state)` equals the canonical form, and that the two round-trip.
- P5d rewrites only the trail-bearing rows.
- P5e's diff is empty, and its gate assertions run over the set.

The tests that assert URLs (88 `toHaveURL` lines in 32 specs; `timeline=1` on 385 test lines; `returnTo`, `summary`, `timelineParent` and `nav` inputs) move with the area that changes them. Login helpers that assert a bare `/repos`, and the production suites' `waitForURL('**/repos')`, keep passing because every test starts without a preference cookie.

### Order

P5a, then P5b, then the P5c–P5e pull request. Inside it: the core codec commit; the repositories and contributions steps in parallel on disjoint files; then integration (Timelines, masthead, crumbs, P5e removals, gates and documents). One independent review covers the pull request, and its CI is the gate. There is no Checkpoint A; the pull request records its golden-URL diff.

### P5a notes

- `tests/e2e/golden-urls.spec.ts` records 34 views, the whole inventory. Signed-out views are recorded before sign-in, and local and session storage are cleared before each view, so no saved preference shapes a record. The set is 173 per-view link kinds, 61 of them distinct, and 70,766 bytes before P4 merged. The webkit project ignores the spec through `testIgnore`, because the browser-result check rejects skipped cases. `tests/fixtures/golden` is excluded from Prettier, because Prettier reflows the generated JSON.
- `tests/unit/golden-urls.test.ts` resolves 122 distinct URLs: 116 through today's readers, and 6 sign-in, setup and foundation paths recorded as "no reader".
- Recorded on the P4 head: the address bar after one All repositories scope change (PR age, clear "Over 30 days") is 598 characters, and the longest href is the 1,208-character Summary→Timeline link, both equal to the Baseline rows. On the Timeline views, 11 of them rewrite their address after load (for example `/repos?timeline=1` gains `period`, `timeline.state` and the window keys); P5b removes that second render.
- The set was first recorded on the P3 head. On the P4 head it differs only in the Over time area tabs (P4 decision 1) and the Report links on Over time pages.

### P5b notes

- Built as a core step (cookie codec, server reader, client cookie hook, and the shared table and Timeline hooks), then a repositories step and a contributions step on disjoint files, merged without textual conflicts. The contract is recorded in `foundation-contracts.md` `## Preference cookies`.
- Cookies: `dashboard-repositories` holds 16 sections and `dashboard-contributions` 18 (`src/models/preferences.ts`). Both use `Path=/`, which amends decision 13. In Chromium and WebKit, a `Path=/repos` cookie written through `document.cookie` was not readable on `/repos` after the sign-in landing or after an in-app navigation from `/contributors`, and was readable only after a full load of `/repos`. A field-wise write there reads no other sections and would drop them. Every request now carries up to 6,144 bytes of preferences beside the session cookie.
- Sections are keyed by view kind and table kind (decision 2). Record-list columns, charts and sorts are shared by all 18 repositories, and Timeline supporting-table sorts are shared per detail kind and record kind. A well-formed saved sort or column for a column a table lacks is not applied there and stays saved. Record-list, insight, supporting-table and contribution column and sort sections are checked for shape on the server, because their column lists are built in `'use client'` modules; the client applies only the columns its table renders. All repositories sections are checked against `overview-columns.tsx` exactly.
- One cookie holds one session's sections. When a second account saves in the same browser, the first account's saved view is replaced; neither account sees the other's.
- Entries: a Timeline URL without `timeline.state` and a contribution report URL without scope fields get a 307 to the explicit URL with saved preferences applied, so the 11 Timeline views that rewrote their address after load (P5a notes) now arrive at it. All repositories and repository pages render saved values at the requested address. The masthead Contributions link renders bare on the server and carries the saved explicit scope after hydration; only its href changes. Cookies fire no cross-tab event, so the link reads the cookie again when its window regains focus or becomes visible, where it used to listen for the `storage` event. The contribution route builds the default report before deciding to redirect, so each redirect costs one discarded render.
- Invalid sections: All repositories gained "Saved All repositories preferences are invalid. Defaults are shown." through the existing `OverviewSettingsControl.notice` field. The contribution scope and the Timeline keep their existing notices. A well-formed Timeline presentation whose saved choices fail even on a bare entry (for example a period-column sort that its own saved grouping never has, or a matrix repository that is no longer enabled) is also invalid, but only on an entry that had to leave a saved choice out: the server renders that entry at the requested address with defaults and "Saved Timeline choices that do not fit this report were skipped.", and the client deletes the whole section. Before P5b the client removed only the failing fields and kept the rest; rule 9 permits no field-level repair after load. A saved choice that fails only against an entry's explicit fields is left out of the redirect without a notice and stays saved; before P5b that case also showed the notice. Record-list, insight, supporting-table and contribution column and sort sections render defaults without a notice, because those views have no notice slot. Every invalid section is deleted after hydration while the cookie still holds it (decision 7; rule 9 amended).
- Saves are field-wise against the live cookie: a setting an explicit link shows but the viewer did not change is no longer saved by a later change. Before, All repositories saved the whole resolved view. A contribution column change replaces only the columns its table renders, so credit details, which have no last-activity column, keep a `lastAt` choice saved from comment details in the shared `contributions.details.columns` section.
- Retired: the 15-second saved-scope lookup and its two notices ("Saved filters changed before they could be restored…" and "Saved filters could not be checked…"). The contribution-options endpoint's `validate` action has no in-app caller and is left for P5e.
- The Timeline table reconciled a page past the last one with `history.replaceState`, called from the shared table's effect after load. It now keeps the correction in memory, as the shared table controller does, and the next deliberate change writes it.
- Header-size premise, local half: `tests/e2e/preference-headers.spec.ts` sends the session cookie plus two cookies whose `name=value` is 3,072 bytes to `/repos` and `/contributors` without following redirects and expects 200, then loads `/repos` in the browser with both cookies set. The Amplify and CloudFront half is not verified.
- Golden URL diff: empty. `golden-urls.spec.ts` passes against the unchanged `tests/fixtures/golden` set on the integration head, and the reader snapshot in `tests/unit/golden-urls.test.ts` is unchanged.
- Not verified in P5b: whether Back after a cookie change serves a cached RSC payload with earlier saved props, and how Next records a server redirect during an in-app RSC navigation to a bare entry (both P5c premises).

### P5c–P5e notes

- Built as one pull request in three stages: the core codec commits; a repositories step and a contributions step on disjoint files, merged without textual conflicts except the shared rule-6 exception list in `eslint.config.mjs` (resolved to the intersection); then integration, which converted the Timelines, wired the masthead entry links and crumbs, removed the interim writers and added the gates.
- Golden URL set: the P5a record stays as `tests/fixtures/golden/legacy-urls.json`. Its rows still decode to the recorded P5a states (`golden-url-states.json` is unchanged), and their canonical forms are `golden-url-canonical.json`. Against the core step, 33 canonical rows gain `v=1`: an old link holding `scope=1` or `timeline.state=1` was explicit, so its canonical form keeps the defaults pinned (decision C4). `golden-urls.json` is re-recorded on the integration head.
- Measured over the two JSON files, P5a record → integration record: 34 views each; 1,527 → 1,302 recorded anchors; the longest in-app href 1,208 characters (the Summary's Timeline link) → 221 (a supporting-records link from the mixed-sample quarterly matrix); per-view link kinds with an href over 300 characters 63 → 0; link kinds whose example holds `%25` 5 → 0; the longest address bar 226 → 97; the address after the Baseline scope change (PR age, clear "Over 30 days") 598 → 11 characters, `/repos?age=`; the Summary's Timeline tab is `/repos?timeline`, 15 characters. No recorded link or address uses a legacy name (`timeline=1`, `timeline.*`, `support.*`, `returnTo`, `summary`, `timelineParent`, `nav`, `scope`, or the `prs.`, `issues.`, `backlog.`, `activity.` and `report.` prefixes). The anchor drop is in the 11 contribution views only: the v1 columns are the lens's three metric columns (decision C5), so each Over time table has 30 fewer cell links and each report 3 fewer per row.
- Gates, `tests/e2e/url-budget.spec.ts`, in Chromium and WebKit: no in-app href over 300 characters and none holding `%25` on any signed-in inventory view (the longest is the 221-character link above); the Summary's Timeline href under 25 characters; the scope-change address under 60; no history write after load before any interaction on any signed-in inventory view, counting `pushState` and any `replaceState` that changes the address from the first script on.
- Premises (§12 and the P5d back link), `tests/e2e/canonical-urls.spec.ts` and `tests/e2e/return-history.spec.ts`, in Chromium and WebKit: literal `,` `:` `@` survive a link click and a server navigation; a page-level 307 during an in-app `router.push` lands on the canonical address with one history entry; requests with `maxRedirects: 0` get one 307 for an old link and for an entry whose saved view differs, per route group, and 200 otherwise; Back serves each entry's own view after a saved-view change; an old link opened signed out reaches its canonical form after sign-in; a crumb whose target is the entry the page was opened from goes back without a new entry, Forward returns (pinned with `v=1` when it was a bare entry), and the same holds after a reload; a page opened directly pushes its crumb's link; a modified click opens the link and leaves the page. Exact drilldown intervals round-trip through period plus snapshot in `tests/unit/url-legacy-decode.test.ts` and `tests/unit/repository-drilldown.test.ts`; an interval that does not start at a UTC day boundary has no such form, and no prepared interval starts off one.
- Timelines keep their query form as the internal form of their presentation (decision C9): `src/lib/presentation/url/legacy/timeline-state.ts` holds the proposals, validation and entry resolution, and `src/lib/presentation/url/timeline.ts` converts registry values to and from it. The preference cookie sections keep that query.
- Links into Timelines carry the saved Timeline presentation (decision C3), resolved as the entry would resolve it; such a link left holding only selectors is pinned with `v=1`. The browser suite found the gap: a matrix repository link whose metric equalled the default was a bare entry, so the saved chart metric replaced the matrix's metric.
- Found by the browser suite and fixed: clearing every matrix metric wrote `/repos?timeline&metric=&rank=prsOpened`, which is invalid. The empty selection now has no ranking metric, as the query form writes it.
- Changed behaviour, recorded rather than restored: the Over time Report tab carries the Timeline's current scope and the parent report's presentation, dropping the page when the scope changed. Supporting views are never entries; their columns are in the address only when changed, so an author link no longer freezes columns into its history entry. A legacy Timeline link whose view fails validation (for example over 500 intervals) renders the route's generic invalid view; the specific message is shown for canonical addresses. An identity segment holding `/` does not match a route. Timeline exports ignore return context: a legacy link with its trail and the canonical link with or without `back` export the same bytes (`tests/unit/timeline-endpoints.test.ts`).
- Review fixes: a server navigation to the same page (route and screen) keeps `location.hash`, as the history writes do, and a fragment link within the page does not pin a bare entry. A `back=` list that loses a frame other than `-` to the eight-value cap or the 1,000-character share ends in `!`, so that ancestor is unavailable rather than its derived default (P5d design §9); a child link whose parent frame fits only without that mark is disabled. The golden round trip reads each canonical URL through the screens' own readers (the repository loaders, `readRepositoryFilters`, the codec's table binding, `readOverviewValues`, `loadContributionValues`, and `timelineParams` with the frozen Timeline readers) and compares the result with the recorded P5a state; the test-only inverse of `legacyDecode` is gone. Contribution columns that a legacy URL did not name are not compared, because their v1 defaults are the lens columns (decision C5). The inventory requests its nine repository views that still used old links at their canonical addresses; `repo-open-issues-metric` is `/repos/prebidjs?view=issues&v=1`, because its canonical form is the Issues tab's address and inventory paths are unique.
- Authentication: no file under `src/lib/auth`, `src/middleware.ts`, `src/app/auth`, `src/app/api/auth`, `src/features/authentication`, `src/features/administration`, `tests/production` or `tests/accounts`, and not `src/lib/presentation/navigation.ts`, changed. `src/components/layout/toolbar.tsx` gained only an `asOf` prop passed to the masthead; its Sign out handler, labels, disabled state and alert are unchanged. The sign-in, change-password and Sign out navigations stay the named rule-6 exceptions, and every other interim exception is removed.

## P6 plan

Approved 2026-11-02 against the P5c–P5e head. P6a, P6b and P6c ship as one pull request (decision 1), which amends the Phases table and Process step 2, where P6 was three pull requests.

### Scope

- **P6a fixture.** The large sample (and so `coverage-gap`) gains 935 review credits and 447 approval credits, none by a PR's author (LOAD-02 in `test-data-plan.md`). The reference, partial and missing samples are unchanged.
- **P6b lenses.** `/reviewers`; the lens model and metric population roles; the Column set choice in the Columns menu, the CSV dialog and Over time; per-lens columns and sort with shared filters; `lens` through entity links, drilldowns, Over time and exports; named crumbs; two totals clusters; the "No reviewer activity in this scope" callout; the Contributors and Reviewers masthead links.
- **P6c lens populations.** The Reviewers lens lists reviewer evidence, with a Show all switch; role-aware Hide zero labels.

### Order

As in P5c–P5e: a core step (fixture, model, codec registration, presentation, server and routes), then three steps in parallel on disjoint files (tables and the CSV dialog; the contribution views and hooks; the masthead and shell), then integration (view inventory and titles, story list, `tests/e2e/contribution-lenses.spec.ts`, spec updates, the golden re-record, documents and gates). The Phase 5 review fixes that landed after the core step were merged into the integration branch.

### Decisions (2026-11-02)

1. One pull request.
2. Every Merges performed credit, self-merges included, is reviewer evidence. A self-merge carries no review or approval evidence, so the large sample's review and approval credits come only from other accounts.
3. Population roles: Contributor (PRs authored, Authored PRs merged, Issues authored), Reviewer (Reviewer contributions, Approval contributions, Merges performed), none for the 33 comment and volume metrics. `tests/unit/contribution-lens.test.ts` assigns each of the 39 report metrics from a literal table.
4. Account-specific partial or missing Reviewer-role history qualifies an account for the Reviewers list; a global gap creates no row.
5. In the Reviewers lens a company qualifies through a reviewer-eligible selected member; its totals and member counts include every selected member.
6. Show all is a bare `all` flag on Reviewers-lens overviews without a metric and their exports, saved as `showAllAccounts` in that table's Reviewers-lens column section. Default off.
7. Hide zero reads all 39 metrics in the Contributors lens ("Hide zero totals") and the three Reviewer-role metrics in the Reviewers lens ("Hide zero reviewer totals"). Partial and missing values stay visible.
8. Column sets (Contributor, Reviewer, All credits, All columns) decide the metric columns and leave identity columns as they are. The trigger reads "Columns · <set>" or "Columns · Custom"; tables without sets keep "Columns".
9. A set applies its lead sort only when it hides the sorted column: Contributor sorts by Authored PRs merged, Reviewer by Reviewer contributions, All credits by the lens's default, each descending; on Over time the fallback is Period ascending. In the CSV dialog a set changes only the export's columns.
10. The picker group "Reviews and approvals" becomes "Reviews, approvals and merges" and holds Merges performed, so each lens's set covers whole groups. Metric labels, CSV headers and table order are unchanged.
11. The lens cue is the masthead's active item, the people tab label, the named crumb, the document title and, on focused reports, the active lens's totals cluster first. No chip or switch is added.
12. A crumb whose parent is an overview report without a metric or Over time reads "Back to Contributors", "Back to Reviewers" or "Back to Companies"; any other parent keeps "Back to report". This also changes Contributors-lens crumbs.
13. The people overview is titled "Reviewers"; any other Reviewers-lens title that does not end with "Reviewers" gains " · Reviewers".
14. Fourteen new sections, `contributions.reviewers.<table>.{columns,sort}` and `timeline.reviewers.<area>.<focus>`, take `dashboard-contributions` from 18 to 32. The scope, the supporting-records table and `timeline-support.contribution.sort` are shared. Column sections gain version 2, a `cols` diff against the lens's v1 defaults; version 1 is still read.
15. At 600px and below the navigation labels use the 13px body size at 100% width with 4px horizontal padding; at 6px, Chromium on Linux needed 369px of the 358px row at 390px. The two-row masthead and the 100px shell move from 1000px to 1120px; the gutter, width switch and account-name rules stay at 1000px.
16. The members table is titled "Company members" in the Reviewers lens.
17. `ReviewersIcon` maps to `MessageSquareCheck`.
18. `lens` is not registered on `/contributors` or `/reviewers` (the invalid view); it is accepted on the contribution supporting screen.
19. "No reviewer activity in this scope." shows on a Reviewers-lens report whose three Reviewer-role totals are all complete zero, never when one is partial or missing.
20. Approved by the maintainer: `tests/production/browser.test.ts` follows the masthead link "Contributors", and `tests/components/account-recovery.test.tsx` mocks `useSearchParams`. No authentication assertion changes.
21. Seven Reviewers-lens views join the inventory: `/reviewers`, `/reviewers?sample=large`, `/reviewers?timeline`, `/companies?lens=reviewers`, `/contributors/account-alice?lens=reviewers`, `/contributors/account-finn?lens=reviewers` and `/companies/id/company-acme?lens=reviewers`.
22. Over time shows the lens's three metrics by default, and its presentation is saved per lens.

### Authentication freeze

Nothing under `src/lib/auth`, `src/middleware.ts`, `src/app/auth`, `src/app/api/auth`, `src/features/authentication`, `src/features/administration` or `tests/accounts` changes, nor `src/lib/presentation/navigation.ts` or `src/components/layout/toolbar.tsx`. Because `safeReturnPath` does not list `/reviewers`, a signed-out visit to `/reviewers` signs in to `/repos`; `/companies?lens=reviewers` and person or company pages with `lens=reviewers` keep their callback. This is recorded, not tested.

### Exit

Both lenses reproduce the six-column people view through "All credits"; every metric stays addable in both; the four navigation labels fit at 390px. `tests/e2e/contribution-lenses.spec.ts` covers the first two and the masthead premise (P6b) in Chromium and WebKit; `layout-width.spec.ts` covers the third.

## P6 evidence

Measured at `9927495` on `feature/p6-contributors-reviewers`: the core step `e383de6`, the three parallel steps merged with `--no-ff` and no conflicts, and the P5c–P5e review fixes (`949db2c`) merged with no textual conflict. No file under `src/` or `.storybook/` changed after the builds below.

### Checks

| Check | Result |
| --- | --- |
| `npm run check` | exit 0; 195 test files, 3,006 tests, each verified as an individual pass |
| `npm run test:accounts` | exit 0; 34 tests |
| `npm run build:production:fixture`, `npm run test:production` | exit 0; 13 tests in 4 files, `browser.test.ts` among them |
| `npm run build:preview`, `npm run build:storybook` | exit 0 |
| Full browser suite, Chromium | 796 passed; `check-test-results.mjs playwright` verified 796 |
| WebKit: the 12 `contribution-*` specs, `column-selection`, `layout-width`, `navigation-feedback`, `view-bar`, `url-budget`, `return-history` | 123 passed; the checker verified 123 |

The eight new stories passed the story-coverage spec (axe in Light and Dark) in Chromium.

Specs outside the three parallel steps that follow the product, changed before the full run, which then had no failure: `canonical-urls.spec.ts` follows the "Contributors" masthead link; `return-history.spec.ts` and `contribution-eligibility.spec.ts` follow "Back to Contributors", because their crumbs' parent is the `/contributors` overview; `timeline-layouts.spec.ts`, `timeline-controls.spec.ts` and `visual-review.spec.ts` open contribution Columns menus whose trigger names the column set.

### Unverified premise (P6b): result

Holds. In Chromium and WebKit on `build:preview`, the first case of `contribution-lenses.spec.ts` renders five routes with JavaScript off and finds the masthead marking the right lens on each (`/reviewers`, `/companies?lens=reviewers` and `/contributors/account-alice?lens=reviewers` mark Reviewers; `/companies` and `/contributors/account-alice` mark Contributors). With JavaScript on, it moves the masthead through a query-only `router.push`, Back, Forward and two link clicks without a document request or a hydration error.

### Exit

- All credits: in both lenses the people table's columns become Contributor, Account type, Company and the six core credits in report order (`contribution-lenses.spec.ts`).
- Every metric stays addable: in both lenses the Columns menu locks only "Contributor (required)", and All columns shows all 39 metrics (same spec).
- At 390px the four destinations sit on one row inside the viewport and the navigation does not scroll (`layout-width.spec.ts`, Chromium and WebKit). At 1121px an administrator's masthead is one 64px row; at 1120px it takes two rows (same spec).

### Lens populations and fixture

- Reference `/reviewers`: 6 rows, without Finn; Show all: 7 rows, `all` in the address, and the CSV's "Listed accounts" changes from "Reviewer activity" to "All accounts with activity".
- `/reviewers?sample=large`: five pages; the first ends at 5 Reviewer contributions and the second starts at 4. `/companies?lens=reviewers&sample=large`: 3 rows, 4 with Show all.
- `coverage-gap` in the Reviewers lens: 250 rows over five pages, a 251-line CSV, and 3 companies (4 with Show all).
- Example Beacon's roster: Finn stays under "Hide zero totals" and is hidden under "Hide zero reviewer totals".

### Golden URL set

Re-recorded on `build:preview`; compared with the P5c–P5e record:

- 34 → 41 views; 1,302 → 1,754 recorded anchors; 191 → 282 per-view link kinds; 67 → 93 distinct link kinds, none removed.
- Each of the 30 existing report views gains one bare `/reviewers` masthead link, and nothing else in them changes, so every Contributors-lens link kind is unchanged.
- The seven Reviewers-lens views add 26 distinct kinds, all `/reviewers` or carrying `lens`. The longest href is still 221 characters; no kind is over 300 or holds `%25`. The scope-change record is unchanged.
- `tests/unit/golden-urls.test.ts` checks that each of the 34 recorded Reviewers-lens URLs parses as canonical and serializes to itself.

### Not run

- Checkpoints A and B: no visual sign-off of the new stories, the two-row masthead between 1001px and 1120px, or the 13px phone navigation labels.
- The full WebKit suite; only the files above ran in WebKit.
- `npm run audit:dependencies` and `npm run capture:views`.
- Amplify and CloudFront limits for the 32-section contributions cookie (the P5b premise remains open).
- The signed-out `/reviewers` sign-in callback, which falls back to `/repos` (recorded, not tested).

## Final visual inspection

An inspection of the redesigned dashboard after P6, on `build:preview` of `418c3a4`, and the fixes on `feature/final-visual-fixes`, cut from `b72b042`.

### Method

1. **Captures.** The 41 inventory views at 320, 375, 390, 768, 1366, 1440 and 2560px in Light and Dark: 574 cells, each a viewport and a full-page capture. `scripts/capture-views.mjs` ran through a wrapper outside the repository that adds viewport heights for 320 (568), 375 (667) and 768 (1024).
2. **DOM audit** on every cell: page overflow, clipped text, overlapping interactive elements, targets under 24px, text under 11px, and visible focus on the first 15 Tab stops at 1440 Light. It found no page overflow, no target failing after the WCAG 2.5.8 spacing exception, no text under 11px and visible focus on all 572 sampled stops. It flagged 104 clipped-text elements, all rows that scroll sideways, and 56 overlapping pairs.
3. **Four inspectors** read the captures and the audit and reported 57 findings, each with its views, a cropped image, the cause at file and line, a fix and a test.
4. **Consolidation** checked each finding against its image, the code at the cited lines and the approved decisions. Duplicates were merged into 27 verified findings; 7 were refuted.
5. **Fixes.** Three workers split by area (navigation; tables; toolbars, Timeline and sign-in presentation), each with a behaviour test per finding, merged with `--no-ff`. The integration step finished the parts that crossed their files: the Current backlog description (15), the global paragraph wrap and the table footer note (24), the typed Over time heading (11) and the plan amendments.

### Findings and fixes

Numbers follow the consolidated list. Each fix keeps the approved look; a divergence from the inspector's suggested fix is stated.

| # | Finding | Fix | Test |
| --- | --- | --- | --- |
| 1 | From 601 to about 1120px the view bar cuts the record tabs and section chips | Above 600px `SectionNav` measures the bar's row with a ResizeObserver and shows the Sections menu only where the chips and their caption do not fit beside the tabs at their natural widths. The server renders the chips, so where they fit nothing moves after load; at 600px and below the menu shows from the first paint, as P4 approved. From 601 to 700px the row gap is 8px, the underline tabs sit 16px apart and the trigger shows its icon only, so the three record tabs fit beside it | `view-bar.spec.ts`: at 601, 640, 700 and 768 the record tabs lie inside an unscrolled row beside the Sections button, and once widened the chips return unscrolled; on All repositories at 768, the comparison at 700 and two repository views at 1000 and 1440 the chips show, the trigger is never laid out during the load, and the page without JavaScript shows the chips |
| 2 | A bounded table pane hides its last rows with no cue | DataTable also sets `data-more-below` from the vertical scroll position; the frame draws an 8px bottom-edge cue. It is a gradient of `--prebid-scroll-shadow`, as the menu scroll cue is, because the token check accepts only a bare token as `box-shadow` | `table-system.spec.ts`: the cue shows at 1440×900 on `/repos` until the pane is scrolled to its end, and not at 2560×1300 |
| 3 | Segmented view-mode controls lose an option inside their frame on phones | The segmented variant never shrinks; underline subject tabs scroll beside it. At 600px and below the bar's row gap and the segmented padding are 8px; at 375px and below the bar's tab icons hide, segmented padding is 6px and the Sections trigger shows its icon alone, keeping the name "Sections" | `layout-width.spec.ts`: at 320, 375 and 390 both view modes and the current subject tab lie inside their rows and the viewport |
| 4 | At 320 the current masthead destination is scrolled out of view on Reviewers pages | `reveal()` is exported from `view-bar.tsx`, and `DashboardHeader` scrolls the current destination into view when the row overflows; `toolbar.tsx` and `navigation.ts` are unchanged | `layout-width.spec.ts`: at 320 Reviewers stays inside the overflowing navigation on three Reviewers-lens views, and Contributors on `/contributors` |
| 5 | At 320 the first numeric column's values are off-screen | At 374px and below, where the first visible column after the pinned one is right-aligned, the pinned column is 128px in DataTable and 140px in the contribution tables. DataTable derives this from its column definitions and marks its scroll area; beside a text column, such as Account type in the people, account and member tables, the names keep 164px or 180px | `layout-width.spec.ts`: at 320 the first value beside the pinned column is inside the visible area on Companies, contributors Over time and a quarterly Timeline; on Contributors, Reviewers, a company's members and the repository credits table each of the first six names has as many lines at 320 as at 375 |
| 6 | A toolbar group holding only its reset leaves an empty labelled band | CSS only: the reset sits on the overline's line, or beside the status sentence when its group is the toolbar's only one, at every width, so no card opens with a row that holds the reset alone; on phones the sentence wraps in the room the reset leaves. With two groups, on phones the reset drops below the overline | `repository-page-layout.spec.ts`: at 1440 and 768 the reset is level with the overline or the status line; at 390 and 320 it is level with the status sentence's first line, after its end and inside the card; at 320 the page does not scroll sideways |
| 7 | The "All open PRs/issues" scope link is drawn in ink | It takes the link colour. It keeps its underline at rest, since inside the summary sentence colour would otherwise be its only cue (Architecture rule 8) | `repository-page-layout.spec.ts`: its colour equals the breadcrumb link's in Light and Dark |
| 8 | From 601 to 1365px a reset drops to a row of its own once the fields wrap | The fields take a zero flex basis, so they wrap beside the reset; on phones the reset still starts its row | `layout-width.spec.ts`: at 768 the reset is level with the last field row; at 390 it starts the group |
| 9 | Merge-duration handles wrap into three-line rows while Base branch takes spare width | Author is 224px (measured; the suggested 210px still wrapped `sample-author-3[bot]`); Base branch, Agent reviewer, Bot reviewer, Latest actor and Author type declare 120px, so only Title takes surplus (P3 step 2(c)) | `repository-insights.spec.ts`: at 1440 every Author handle is one line and Base branch is at most 121px |
| 10 | Account type and Company wrap two-word values | Account type 132px and Company 168px (measured; "Unmapped company" wrapped at 160px) | `contribution-layout.spec.ts`: at 1440 on `/reviewers` and `/contributors` each value and the Account type header is one line |
| 11 | Over time lacks the Authoring, Reviewing and Issues headings | The Over time metrics take the report table's display-only headings through an optional `TimelineMetricDefinition.displayGroup`; names, Columns, the CSV dialog and CSV headers keep plain labels | `contribution-lenses.spec.ts`: the headings span their metrics and the CSV is unchanged |
| 12 | The current breadcrumb is cut mid-word on phones | The current crumb shrinks and ends in an ellipsis; parent crumbs keep their size and the full text stays in the DOM | `layout-width.spec.ts`: at 320, 375 and 390 the crumb ends inside an unscrolled breadcrumb row |
| 13 | The pager label wraps at 320 | The position text never wraps; below 360px "Previous" and "Next" are visually hidden and keep the buttons' names. The buttons are 40×34, not the suggested 34px squares, because rule 3 forbids a `className` on `Button` | `repository-page-layout.spec.ts`: at 320 and 375 "Page 1 of 247" is one line and the pager ends inside the footer |
| 14 | Toolbar summaries set hyphens at tabular width | The summary drops `font-variant-numeric`; it is prose | `repository-page-layout.spec.ts`: a hyphen measures under 0.9 of a figure (the suggested 0.45em fails even when fixed: 0.466em in Chromium) |
| 15 | Dot-separated summaries break inside facts and start lines with "·" | Each summary item is an inline block, and its separator is a no-wrap " ·" at its end, so `textContent` is unchanged. The Current backlog description ends "Open now" with a no-break " ·" | `layout-width.spec.ts`: at 320 and 390 no separator starts a line, a fact wraps only when longer than the line, and the backlog separator sits on the "Open now" line |
| 16 | The help icon jumps to the panel edge when a title wraps | The title row is inline flow, with a word joiner before the help button (WebKit needed it as well as `nowrap`) | `repository-page-layout.spec.ts`: at 320 the button follows the title's last line |
| 17 | The Timeline "Record filters" trigger has no Filters icon | It leads with `FiltersIcon` at 14px; its name is unchanged | `timeline-repository-filters.test.tsx`: glyph identity and the name "Record filters (1)" |
| 18 | Weekly range headings strand the year on its own line | `compactRangeLabel` puts no-break spaces inside each date, so a range breaks only around its dash; charts and CSV keep `timelineIntervalLabel`. A cross-month range on two lines beside one-line siblings is accepted; see below | `timeline-matrix.spec.ts` and `timeline-layouts.spec.ts`: each date is one line |
| 19 | In approval headers the numeral stays with the sort icon and its noun wraps | In a numeric header, a label that leads with a count keeps its noun in the glyph's no-wrap span ("⇕ 0 approvals"), and that label may run into the cell's start padding; it still ends at the values' edge. See below | `table-system.spec.ts`: at 1366 and 1440 on the comparison and at 1000 on `/repos`, "0 approvals", "1 approval" and "2 approvals" are each one unclipped line ending within 1px of their column's digits |
| 20 | Table panels are inset 24px, toolbar and chart panels 20px | ReportToolbar and ChartPanel use 24px above 600px; DataTable is unchanged | `timeline-layouts.spec.ts`: at 1440 the three titles start within 1px of each other |
| 21 | Phone toolbar selects mix full and content widths | At 600px and below the reporting-period select grows to the card width | `timeline-layouts.spec.ts`: at 320 the four selects are equal within 1px |
| 22 | A one-line account name sits 6px below its row | The account cell aligns to the top | `repository-insights.spec.ts`: the name and the Account type text share a top within 1px |
| 23 | The external-link icon can wrap alone | The name's last character and the icon sit in one no-wrap span | `repository-insights.spec.ts`: at 390 every icon follows its name's last line |
| 24 | Single words alone on the last line | Paragraphs take `text-wrap: pretty` in the `globals.css` base layer; the centred sign-in subtitle takes `balance` in `authentication.module.css`. CSS only, under the authentication freeze | `authentication.spec.ts` (sign-in and error at 320 and 1440) and `repository-page-layout.spec.ts` (the table footer note at 320) |
| 25 | The Confirm New Password placeholder is cut at 320 | The `Input` primitive ends overflowing text with an ellipsis; its story gains a long placeholder | Story coverage with axe in Light and Dark; weaker than geometry, since no DOM measure shows a placeholder's clipping |
| 26 | On account setup the theme button covers the card's corner on phones | At 600px and below the setup card, the only card rendered directly in the surface, gains a 32px top margin. The suggested surface padding would also have moved the sign-in cards. `src/app/auth/setup/page.tsx` is unchanged | `layout-width.spec.ts`: at 320, 375 and 390 the button and the card do not intersect |
| 27 | On the foundation specimen "Example input" is separated from its field | The label and its field wrap as one unit | `foundation.spec.ts`: at 320 and 768 the label sits beside or directly above the field |

Finding 19. Binding the numeral to its noun alone does not fix it: "⇕ 0 approvals" needs 80.4px in Chromium and 80.2px in WebKit (macOS), while the header's content box in the comparison's ten numeric columns is 73px at 1366 and 78px at 1440, so the bound label was clipped (measured: scrollWidth 80 against clientWidth 73 and 78). Widening only the Human approvals columns would not help either, because numeric columns without a growing column share the table's width equally (decision 4), so at the table's minimum each takes the mean declared width. The label therefore may run into its cell's 16px start padding, which gives 89px at the comparison's narrowest and 88px at the default backlog's 106px. Chromium on Linux (the Playwright 1.64.1 image, aarch64) sets "⇕ 0 approvals" at 84px, so a 10px allowance still clipped it there by 0.8px. All three approval headers, and the reviewer headers with the same form, are one line at every width, and no column width or minimum changes. The cost is that at the narrowest such a label starts about 4px (Linux) or 8px (macOS) after its column's line.

Finding 18's two-line weekly matrix headers are accepted: a range that crosses a month, such as "Sep 28 – Oct 4, 2026", breaks only at its dash and so takes two lines beside one-line sibling headers at 1366 and 1440. The header cells share one row height, so only the text differs. Fitting such a range on one line would widen every weekly matrix column, the same kind of column-width decision as finding 19.

### Refuted

- Masthead navigation at 320 should show all four labels: the row scrolls by design below the 390px fit (P6 decision 15); only the cut current item was kept (finding 4).
- Record titles take all surplus width: settled by P3 step 2(c).
- Two-line numeric headers such as "Age in / days": P3 item 3 allows two lines at one metric width.
- The Companies identity column is too narrow for the Unmapped company subtitle: the 220px pinned width is fixed by P3 step 2(c) and decision 4, and the subtitle stays readable.
- GitHub logins should never break at hyphens in the phone account column: P2 Checkpoint B accepted wrapping over cutting; the lone icon was kept (finding 23).
- Underline subject tabs clipped at phone width: tabs scroll by design (P4 item 4) and `reveal()` keeps the current one in view; kept only where a view mode or a tablet-width destination is lost (findings 1 and 3).
- The audit's 56 overlapping pairs: password fields and their Show password toggles, which sit inside the field's reserved padding by design.

### Technical calls

Recorded here rather than awaited, under the approved look:

- Above 600px the Sections menu replaces the chips only where `SectionNav` measures that they do not fit beside the tabs, instead of at a fixed breakpoint; at 600px and below it always does (P4 item 4; amended above). A fixed 1120px breakpoint, used before the review, also replaced chips that fit: All repositories and the comparison lost them from about 660 to 1120px. Measured in Chromium and WebKit on macOS, the chips show on All repositories from about 655–660px and on repository views from between 900 and 1000px depending on their tabs; in Chromium on Linux from about 680px and 920–1000px. At the widths sampled between 601 and 1440px, no chip or tab was cut in any of the three. Before hydration a page whose chips do not fit shows them scrolling beside the tabs until the measure runs; on a wide screen nothing moves.
- View bar compaction: at 700px and below an 8px row gap, 16px between underline tabs and 6px between a tab's icon and label (600px before the review); at 600px and below the row also spreads its items to both ends and the segmented padding is 8px; at 375px and below no view-bar tab icons and 6px segmented padding. The Sections trigger shows its icon alone, keeping the name "Sections", at 375px and below and from 601 to 700px, where the three record tabs otherwise lose up to 58px beside it. Chromium on Linux still cut a record tab by 3–13px at 601px with the wider tab gaps, which the 16px gap removes.
- Pinned columns at 374px and below: 128px (DataTable) and 140px (contributions), only where the first visible column after the pinned one is right-aligned. DataTable reads this from its column definitions and sets `data-numeric-beside-pinned` on its scroll area; its props do not change. The contribution tables' minimum width grows by 60px with the wider Company and Account type columns.
- A numeric header whose label leads with a count ("0 approvals") keeps the count and its noun beside the glyph and may run into its start padding (finding 19).
- The browser job's timeout is 40 minutes instead of 30: one WebKit shard ran 29.5 minutes on pull request 24.
- Declared widths: record Author 224px; Base branch, Agent reviewer, Bot reviewer, Latest actor and Author type 120px; contribution Company 168px and Account type 132px.
- The bottom-edge cue of a bounded table pane is a gradient of the scroll-shadow token, and the pager's buttons below 360px are 40×34.
- ReportToolbar and ChartPanel inline padding is 24px above 600px, matching DataTable.
- `TimelineMetricDefinition` gains the optional `displayGroup`, an additive change under Delivery rule 1.

Visible text changes: the Over time core metrics sit under "Authoring", "Reviewing" and "Issues"; the "Record filters" trigger shows the Filters icon; below 360px the pager shows chevrons only and at 375px and below and from 601 to 700px the Sections trigger shows its icon only, both keeping their names; compact weekly ranges, and the names of the headers and links that show them, hold no-break spaces inside each date and read the same; the Current backlog description's separator follows "Open now". Unchanged: data values, link targets, URLs, CSV content, the other accessible names and the sign-in pages' copy, form fields and submit handling.

### Checks

On `feature/final-visual-fixes`: the three worker branches merged with `--no-ff` (conflicts only where two branches appended tests at the end of `layout-width.spec.ts` and `repository-page-layout.spec.ts`; all kept), then the integration commits. No file under `src/` or `.storybook/` changed after the builds below.

| Check | Result |
| --- | --- |
| `npm run check` | exit 0; 195 test files, 3,015 tests, each verified as an individual pass |
| `npm run test:accounts` | exit 0; 34 tests |
| `npm run build:production:fixture`, `npm run test:production` | exit 0; 13 tests in 4 files |
| `npm run build:preview`, `npm run build:storybook` | exit 0 |
| Full browser suite, Chromium | First run: 825 passed, 2 failed. `repository-overview.spec.ts` at 320px expected the 164px pinned column; it now expects 128px below 375px (finding 5). Rerun: 827 passed; `check-test-results.mjs playwright` verified 827 |
| WebKit: `repository-page-layout`, `timeline-layouts`, `view-bar`, `table-system`, `inventory-design`, `visual-review`, `layout-width`, `contribution-layout`, `repository-overview`, `repository-insights`, `timeline-matrix`, `authentication`, `foundation`, `contribution-lenses` | 246 passed; the checker verified 246 |

After-fix captures of 15 views named by the findings, at 320, 390, 768 and 1440 in Light on `build:preview` of this branch, are kept outside the repository for review. In them the narrower pinned column at 320px wraps repository and company names onto two lines. It also wrapped account names in the people, account and member tables by one to two more lines, where the column beside them is text; the review round scoped the narrower column to tables with a numeric neighbour.

### Not run

- Visual sign-off of the after-fix captures, and any Dark capture after the fixes.
- The full WebKit suite; only the 14 files above ran in WebKit.
- Chromium on Linux, which CI uses: the view-bar margins at 320–390px were measured in an aarch64 Linux container, not on CI's x86_64 runners, and widths between 376 and about 388px were not measured with the final CSS; there "Contributors" may clip by a few pixels.
- A pager inside a dialog below 360px.
- `npm run audit:dependencies`.

### Review round

An independent review of the fixes found one introduced problem and seven smaller ones. The rows and technical calls above are amended in place: findings 1 (the 601–700px band and the measured Sections menu), 5 (the narrower pinned column only beside a numeric column), 6 (the reset beside the status sentence on phones too), 18 (accepted) and 19 (fixed). Also changed: the Sections story's comment, the `foundation.spec.ts` sign-in helper, which now accepts a landing on `/repos` with a saved-view query (the P5 bare-entry redirect) and still requires the All repositories heading, `repository-overview.test.tsx`, which counted every ResizeObserver on the page and now counts the tables' own, and the browser job's timeout.

| Check | Result |
| --- | --- |
| `npm run check` | exit 0; 195 test files, 3,015 tests, each verified as an individual pass |
| `npm run build:preview`, `npm run build:storybook` | exit 0, from the final source |
| Chromium and WebKit: `view-bar`, `layout-width`, `table-system`, `repository-overview`, `repository-insights`, `contribution-layout`, `foundation`, `repository-page-layout`, `timeline-layouts` | 262 passed (131 in each); the checker verified 262 |
| Chromium on Linux (Playwright 1.64.1 image, aarch64), a probe outside the repository | Approval headers one line with 4px or more to spare; no record tab cut from 601 to 768px; chip thresholds as recorded above |

After-fix captures of the 13 changed views at 320, 375, 390, 768, 1366 and 1440px, and of 5 view-bar views at 640 and 700px, in Light, are kept outside the repository. Not run in this round: the other browser specs, Dark captures, `npm run test:accounts`, `npm run test:production` and `npm run audit:dependencies`; the Linux probe ran on aarch64, not CI's x86_64 runners.

## P7 plan

Approved 2026-11-03 against `b6fcd69`. P7 adds a top-level Companies destination as a third contribution lens, and connects company attribution for database sources from the "Github Mapping – User List" sheet. It ships as one pull request.

### Scope

- **Companies lens.**
  - The lens value is `all`. The masthead's fifth item, Companies, comes after Reviewers and opens `/companies?lens=all` in the viewer's saved view.
  - The overview lists the same companies as the Contributors-lens Companies view: any-metric eligibility, `contributions.ts:60-73`.
  - Default columns: Company, Included accounts and the six credits, under the existing Authoring, Reviewing and Issues headings.
  - Default sort: Authored PRs merged, descending. Column set: All credits.
  - The view bar shows only Report | Over time, with no subject tabs. Over time shows the six credits, sorted by Period.
  - Company pages (`/companies/id/<id>?lens=all`) and person pages (`/contributors/<id>?lens=all`) carry the lens, so the masthead, defaults and crumbs stay in Companies.
  - The existing Companies tabs, `/companies` and `/companies?lens=reviewers`, keep every URL, default, saved section, title and masthead marking.
- **Company mapping.**
  - `npm run data:companies -- <csv> --exported <YYYY-MM-DD>` writes `src/server/company-mapping.json` from a sheet export.
  - The file holds only lowercased logins, company ids and display names: no names, notes, membership or PMC reviewer data.
  - Database sources read it through `src/server/company-mapping.ts`. The contract is `src/models/company-mapping.ts`.
  - Attribution becomes `current-mapping` when a mapping is loaded. Samples are unchanged.
  - Moving the sheet to AWS later replaces only how the file reaches the build: a build-time copy to the same path.

### Decisions (2026-11-03)

1. **Consolidated means defaults, not rows.** Same rows as the Contributors-lens Companies view, the six credits side by side, sorted by Authored PRs merged. No combined cross-role total (`contributors.md:289`) and no headline totals (`:24` above).
2. **Address.** The lens is the query value `lens=all`, carried to company and person pages, exports and Over time. No new route; bare `/companies` keeps its v1 meaning. Over time is `/companies?timeline&lens=all`.
3. **Masthead position.** Companies is fifth, after Reviewers.
4. **Masthead width.**
   - Phones: five labels do not fit one row at 390px, so at 600px and below the row scrolls, and `reveal()` keeps the current destination in view.
   - 601–1120px: the navigation row scrolls the same way.
   - Above 1120px: the one-row breakpoint is set from measurement in Chromium and WebKit on macOS and in Chromium in the Linux Playwright image. If the administrator's account name can take the overflow as an ellipsis, 1120px stays; otherwise `dashboard.module.css` and `prebid.css` move together.
5. **v1 defaults.** They gain additive keys only, `lensMetricColumns.all` and `contributions.sort.all`, for a value that was invalid before. No existing value changes, and `url-defaults-v1.json` changes by additions only. The `defaults.ts` header and `foundation-contracts.md` record the rule.
6. **Lens model.**
   - `lensRole` becomes `PopulationRole | null`, with `all: null`.
   - `lensDefaultSort.all` is Authored PRs merged; `lensColumnSet.all` is `credits`.
   - The lens value `all` is unrelated to the `all` flag (Show all) and to the All columns set id. The `all` flag is invalid with `lens=all`, on pages and exports.
7. **Population controls under `lens=all`.**
   - Hide zero reads all 39 metrics, as "Hide zero totals".
   - The "No reviewer activity in this scope" callout never shows.
   - The CSV records "Report lens: all" and "Listed accounts: All accounts with activity".
8. **Saved sections.** Nine new sections, reachable ones only, take `dashboard-contributions` from 32 to 41:
   - `contributions.all.{companies,members,repositories}.{columns,sort}`
   - `timeline.all.companies.overview`, `timeline.all.companies.company`, `timeline.all.contributors.contributor`
   - The people table is unreachable, because `lens` is refused on `/contributors` and `/reviewers`.
   - The scope and supporting sections stay shared.
9. **Titles.**
   - Companies-lens titles gain " · All activity", for example "Companies · All activity" and "Example Acme · Companies · All activity".
   - No existing title changes. The h1 stays "Companies". The members table is titled "Company members".
10. **Back parent.** A person page in the Companies lens derives `/companies?lens=all`, so its crumb reads "Back to Companies".
11. **Invalid views.** `/contributors?lens=all` and `/reviewers?lens=all` show the Companies heading and recovery link, and the masthead marks Companies. `/contributors/export?lens=all` with the overview entity is refused.
12. **Company attribution source.**
    - The source is the "Github Mapping – User List" sheet export, not GitHub's self-reported `account_profiles.company`, which would guess (`contributors.md:207`).
    - The first import uses the 2025-09-12 export. Its conflicting `adserver-online` rows resolve to "Adserver Online" (maintainer, 2026-11-03), and the sheet is to be corrected.
    - Committing the generated file publishes login→company pairs in this public repository. It is committed only with the maintainer's approval (open).
13. **Mapping rules.**
    - Match: logins are matched case-insensitively.
    - Unmapped: blank, "None", "independent developer", "Small Pub", bot markers and the stray file path. No "Unknown Organization" pseudo-company. Bots stay classified from the database.
    - Spelling merges: case, spacing and trailing-parenthetical variants merge automatically. Corporate lineages (Appnexus/Xandr, Smart Ad Server/Equativ, PubNative/Verve) stay separate.
    - Ids: bare ASCII slugs of the canonical name, permanent across refreshes. `unmapped` is refused.
    - Conflicts: a login listed twice with different companies is refused, never resolved silently.
    - Prebid is a company. The PMC Reviewer column is out of scope (the Prebid-reviewer mapping).
14. **One pull request**, with the work split across parallel workers.

### Lens comparison sites

`git grep -n -P "(\blens\b|lensOf\([^)]*\)|get\('lens'\)|values\.lens|routeLens)\s*(===|!==)\s*'(reviewers|contributors)'" -- src ':!*.test.*' ':!*.stories.*'` lists 36 lines in 17 files at `b6fcd69`. Each file has one owning step.

| Step | File: lines | Disposition for `all` |
| --- | --- | --- |
| Core | `url/defaults.ts:105` | `lensOf` returns `all` for `lens=all` |
| Core | `presentation/contribution-lens.ts:32, 43, 56, 69` | location lens reads `all`; section and timeline prefixes `all.`; overview path and crumb labels |
| Core | `contribution-url.ts:60, 85, 206` | target and lens values for `all`; Show all stays Reviewers-only |
| Core | `contribution-navigation.ts:34` | `all` path |
| Core | `page-title.ts:37, 109, 123` | query lens `all`; " · All activity" suffix; invalid heading |
| Core | `url/back.ts:188` | person parent `/companies?lens=all` |
| Core | `contributions.ts:66, 308` | unchanged: any-metric population, no reviewer filter |
| A | `server/reporting.ts:137, 147` | parse `all`; `all` flag stays Reviewers-only |
| A | `server/timeline-preview.ts:127, 242, 271` | accept, parse and section-prefix `all` |
| A | `url/timeline.ts:95`, `url/legacy/decode.ts:505` | carry `lens=all` (named exception to the frozen reader, as in P6) |
| A | `contribution-export.ts:125, 130, 227, 229, 315` | `all` parse and href; people-overview refusal; CSV values |
| A | `app/_screens/contribution-route.tsx:70` | route lens `all`; invalid view as decision 11 |
| B | `contribution-header.tsx:89` | no subject tabs for `all` |
| B | `contribution-view.tsx:44, 76, 151` | contributor cluster first; no callout; "Company members" |
| B | `app/_screens/contributions-screen.tsx:268` | unchanged: Hide zero reads all metrics |
| C | `dashboard-header.tsx:131, 133, 143` | Companies item marked for `all`; Contributors and Reviewers unchanged |

### Order

1. **Core** (serial): lens model, v1 defaults keys, registry values, preference keys, the Core rows above, their unit tests and the `url-defaults-v1.json` re-record.
2. **Parallel groups** on disjoint files:
   - A: server and URL round trip.
   - B: views (`contribution-header.tsx`, `contribution-view.tsx`, `contributions-screen.tsx`, `timeline-screens.tsx`, `contribution-timeline-view.tsx`).
   - C: shell (`dashboard-header.tsx`, `use-contribution-entry.ts`, `dashboard.module.css`, `prebid.css`).
   - D: company mapping (`src/models/company-mapping.ts`, `src/server/company-mapping.ts`, `scripts/export-company-mapping.ts`, `package.json`, `src/server/activity-contributions.ts`).
3. **Integration**:
   - Inventory views `/companies?lens=all`, `/companies?timeline&lens=all`, `/companies/id/company-acme?lens=all` and `/contributors/account-alice?lens=all`.
   - Titles and counts.
   - The golden URL re-record: existing views gain only the Companies masthead link kind; `legacy-urls.json`, `golden-url-states.json` and `golden-url-canonical.json` are unchanged.
   - Browser specs and the story list.
   - Document amendments: `:20`, `:27` and `:171` above; `contributors.md`; `foundation-contracts.md`; `docs/product/README.md`.
4. **Gates**:
   - Self-review and one independent review.
   - Checkpoints A and B, with the masthead measurements.
   - `npm run check:all`.
   - `## P7 evidence`.
   - CI `quality` on the exact head, with non-zero Chromium and WebKit case counts.

### Authentication freeze

No file changes under `src/lib/auth`, `src/middleware.ts`, `src/app/auth`, `src/app/api/auth`, `src/features/authentication`, `src/features/administration`, `tests/accounts` or `tests/production`. `src/lib/presentation/navigation.ts` and `src/components/layout/toolbar.tsx` do not change either. `safeReturnPath` already allows every `/companies` path.

### Exit

- The Companies lens reproduces the six-credit Companies table, and every metric stays addable.
- Exactly one masthead destination is marked on every inventory view.
- Both existing Companies tabs render as before.
- A database source with the mapping reports `current-mapping` with mapped companies in `report()` and `directory()`. Without the mapping it stays `not-connected`.

### Unverified premises (P7)

- Masthead widths for five destinations; they are measured at Checkpoint B.
- Amplify and CloudFront forwarding of a 41-section contributions cookie (the open P5b premise).

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
| P2 | TYPE-05 (part) | high | Arrow glyphs typed as text for back links and the scroll hint (moved from P3; the sort glyphs stay in P3) |
| P2 | COLOR-05 | medium | Controls in the same toolbar use different fill and border tokens, and field borders are below 3:1 |
| P2 | CONTRIB-04 | medium | Filter/scope area is one card on Report but three blocks with two reset buttons on Over time, and differs again from the Repos timeline card |
| P2 | CONTRIB-09 | medium | Identity presentation is generic: every human, agent, bot and company gets the same muted icon tile, including 'Unmapped company'; detail headers have no identity visual |
| P2 | CONTRIB-13 | medium | Icons are overloaded or missing: 'Users' means three things, CalendarDays two; search/export/reset have no icons; account-type options omit the actor icons |
| P2 | CONTRIB-14 | medium | Empty, error, loading and all-zero states are plain text with no icon or tone; the all-zero timeline has no notice while the missing one does |
| P2 | CONTRIB-17 (part) | medium | On phones the identity avatar disappears (moved from P4; the filter card and header height stay in P4) |
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
| P3 | TYPE-05 | high | Arrow glyphs typed as text for sort state (the back-link and scroll-hint parts moved to P2) |
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
| — | TBL-15 | low | The admin users list uses the generic shadcn table instead of the shared table design (withdrawn: the administrator Users page is outside the redesign) |
| P4 | CONTRIB-01 | high | Contribution pages use a third, divergent page-header pattern (left title + eyebrow) vs centered Repositories headers; snapshot emphasis also flips |
| P4 | CONTRIB-02 | high | Switching Report -> Over time rebuilds a different header: area tabs vanish (74px jump), detail pages lose 'Back to report' and the company link, subtitle copy changes |
| P4 | REPOS-01 | high | Three different page-header builds, and the 'Reporting snapshot' emphasis flips between pages |
| P4 | SHELL-01 | high | The header is a static, flat bar that almost disappears in light mode and has no product identity. One shell spec is proposed here. |
| P4 | TYPE-03 | high | Page headers: three layouts, four h1 sizes, and snapshot emphasis inverted between pages |
| P4 | CONTRIB-03 | medium | Two stacked tab rows (and a third breakdown style) look identical, so the Contributors/Companies -> Report/Over time hierarchy does not read |
| P4 | CONTRIB-17 | medium | On phones the filter card and header push the first table row below ~1.5 screens (the hidden avatar moved to P2) |
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
