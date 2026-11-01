# Dashboard redesign plan

Bring every dashboard page onto one Prebid visual system, make navigation respond immediately, replace the long state-carrying URLs with short explicit ones, and split the contribution area into Contributors and Reviewers. The plan is grounded in the 2026-10-31 visual review of `8119ede`, which covered 29 report views and the sign-in pages in both themes at 390–2560px. Finding IDs such as `TBL-02` refer to that review; Appendix A assigns every finding to a phase, and each phase plan restates the findings it implements with their file anchors.

Status: decisions approved 2026-10-31. P0 checkpoints approved 2026-11-01 (see `## P0 evidence`). P1 checkpoints approved 2026-11-01 (see `## P1 evidence`); P1 and P2 land in the same pull request as P0.

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
| Typography | Mona Sans at 112% width for every header-level element: page titles 800, panel titles 700, top navigation, tabs and section chips 14px/600 (tabs 700 when active). Inter for text and numbers. | `foundation-contracts.md` `## What visually locked means` (P1) |
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
3. **Primitives own appearance; features own composition.** Feature, route and shared component code may set layout (grid, gap, width, order) on a wrapper but never a primitive's height, colour, background, border or shadow; a needed difference becomes a variant or prop. [P2: `no-restricted-syntax` in `eslint.config.mjs` rejects a `className` attribute on `Button`, `Input`, `SearchField`, `NativeSelect`, `Checkbox`, `Radio`, `DropdownMenuContent`, `DialogContent` and `Card` in `src/features/**`, `src/app/**` and `src/components/**`, except the primitives in `src/components/ui/**` and, until P4 rebuilds the shell, `src/components/layout/**`. The design-token check rejects feature CSS that restyles a native control or primitive through a descendant selector.]
4. **One component per pattern.** New code uses the owning component (see Component ownership). From P3, a phase replaces existing call sites only where the old pattern is wrong, not to rename it; other sites move when they are next changed (Delivery rules). [P2: `no-restricted-imports` of `lucide-react` outside the icon-map module. P4: `no-restricted-syntax` rejects `h1` outside `PageHeader`, authentication and edge pages.]
5. **Every primitive has Storybook stories** for each variant and state. A story is covered by the browser suite only when a spec opens its iframe; each phase adds its story IDs to a source-controlled list under `tests/e2e/`, and one spec visits every listed story in Light and Dark (`&globals=theme:light|dark`) with axe on `#storybook-root`. Test titles come from that list, not from `storybook-static/index.json`, because CI lists browser cases before Storybook is built. [P1]
6. **One URL codec.** From Phase 5, links and history writes go through one parameter registry and serializer: a pure module in `src/lib/presentation/` and its hook in `src/lib/navigation/`. `no-restricted-syntax` rejects `NewExpression[callee.name='URLSearchParams']`, `history.pushState`/`replaceState` and `router.push`/`replace` elsewhere; exceptions are named in the P5 plan and removed by P5e. A unit test runs ESLint on a fixture and expects the error. [P5c]
7. **Typed props in, presentation out.** New primitives take typed props, never raw samples or route parameters, keeping the boundary that `check:boundaries` enforces.
8. **Accessibility is part of the spec.** WCAG AA text contrast (4.5:1, 3:1 for large text) and non-text contrast (3:1, WCAG 1.4.11) for control boundaries, focus rings, selected indicators and chart marks, in both themes. axe checks text contrast only, so each phase adds computed-style contrast assertions for the non-text pairs it introduces. The orange underline on light surfaces is paired with a weight or ink change. Visible focus, keyboard reach for new navigation, `prefers-reduced-motion`, and no information carried by colour alone.
9. **No post-load rewrites.** New code from P0 renders its final state on the server. Existing client restoration (`use-table-controller.ts`, `use-overview-settings.ts`, `use-timeline-controls.ts`, `use-contribution-controls.ts`, `use-repository-page-controls.ts`) is removed in P5b; P5b's one-time localStorage migration is the only permitted post-load write and makes no history write.
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

**Type.** Display 30/34 Mona Sans 800; title 18/26 Mona Sans 700; KPI 28/36 Inter 600; heading 14/20 Inter 600; body 13/20 Inter 400 (controls 500); small 12/18; caption 11/16 Inter 500; overline 11/16 Inter 600, uppercase, +0.06em. Numbers use `font-variant-numeric: tabular-nums lining-nums` and one weight (500, KPI 600), so a known zero never renders bolder than a real value. Inter 700 only for table group headings and the sign-in submit. Nothing below 11px. Field text is 16px under `pointer: coarse` (`--prebid-text-input-coarse`), so iOS does not zoom into a focused field.

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
| P0 | Checkpoints approved; one pull request with P1 and P2 | — | Approved 2026-11-01 | Approved 2026-11-01 |
| P0b | Not started | — | — | — |
| P1 | Checkpoints approved; same pull request as P0 | — | Approved 2026-11-01 | Approved 2026-11-01 |
| P2 | Checkpoints approved; same pull request as P0 and P1 | — | Approved 2026-11-01 | Approved 2026-11-01 |
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
- `secondary`: overlay fill, a 1px edge (decision 5), level 1; hover fills `--prebid-hover` with a `#3887c2` edge; `aria-pressed="true"` or `data-state="open"` uses the selection tint, selection edge and ink at weight 600, so the state is not carried by colour alone.
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
| P3 | TBL-15 | low | The admin users list uses the generic shadcn table instead of the shared table design |
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
