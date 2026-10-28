# All Repositories implementation plan

Build the All Repositories frontend with prepared sample data, preserving the approved Prebid authentication design and the merged foundation. Deliver an interactive page for visual review before connecting real reporting data. The product definitions remain authoritative; this plan specifies implementation order, ownership, and verification.

Status: steps 1–3 are implemented and verified locally. The user approved the base design and row-divider correction before step 3. The added controls are ready for review; steps 4–5 remain planned. The layout and column defaults below describe the current preview. The existing reporting layout is not a design reference. Preserve the approved Prebid authentication styling while designing the tables around clarity and the agreed interactions.

## Scope and delivery boundary

- Start from the merged `codex/frontend-rebuild` branch. PR #3 merged at `ae0eb52ee571fdb0b6b348ca9e2416b52530aadc`; refresh the integration branch before starting code. Create a `codex/` feature branch there and target every delivery PR to `codex/frontend-rebuild`. Production `main` and its deployment remain outside this work.
- Implement the two summary tables, repository selection (with search inside its picker, no summary-table search), period and aging controls, column groups, independent sorting, saved browser preferences, availability states, and meaningful sample drilldowns.
- Retain TypeScript, the existing stack and dependencies, authentication gates, account behavior, dark default, saved Light/Dark/System choices, and six-character password policy. No account-system redesign is required.
- Reporting remains invented in preview and production-auth modes. Do not add a reporting database, GitHub collection, HTTP reporting API, remote table adapter, or historical event reconstruction.
- Use the existing repository page only as a minimal destination for summary drilldowns. Its final layout, graphs, and broader workflows remain the next page delivery.
- Keep the optional historical merge-status/direct-push extension and historical backlog-change columns tracked in their existing product definitions. It is a subsequent frontend increment, not an extra requirement for this core summary delivery. Do not expose unfinished controls or represent those metrics using current approvals.
- Preserve existing exports elsewhere; adding All Repositories export controls is outside this delivery's agreed core scope.

References: [All Repositories](../product/all-repositories.md), [login design](../product/login.md), [repository detail](../product/repository-detail.md), [merge-status extension](../product/merge-review-status.md), [foundation contracts](foundation-contracts.md), and [acceptance matrix](acceptance-matrix.md).

## Existing pieces and concrete gaps

| Existing piece | Reuse and required change |
| --- | --- |
| `src/app/(dashboard)/repos/page.tsx` and `src/server/reporting.ts` | Preserve server-side viewer checks. Supply typed summary display data through the existing composition boundary. |
| `src/app/_screens/repositories-screen.tsx` | Compose page settings and two independently scoped table controllers instead of one starter controller. |
| `src/features/repositories/all-repositories-view.tsx` | Replace the seven-column starter with the complete backlog/activity presentation. The hard-coded 60-day column becomes a selectable threshold, defaulting to 30. |
| `src/components/tables/data-table.tsx` | Reuse the existing table engine, sorting, paging, accessible controls, and export behavior. Add controlled column visibility, grouped headings, sizing, a pinned identity column, and optional toolbar content only as this page requires. |
| `src/lib/navigation/use-table-controller.ts` | Retain router integration, debounce, latest-draft handling, safe history writes, and URL precedence. Give each table distinct query and preference scopes. |
| `src/config/repositories.ts` and `src/mocks/reporting.ts` | Retain the authoritative 18-repository catalog; extend prepared samples beyond the starter backlog. |
| `design/mocks/all-repositories.json` | Use as a visual reference only. Its 20 fictional repository IDs, single period, and 60-day threshold are not the runtime catalog or a complete interaction fixture. |
| `ThemeMenu`, `MetricValue`, feedback and UI primitives | Extend existing parts where useful. Keep the shared theme provider and visible keyboard focus. |

## Starting layout

Use the existing top navigation with one Repos menu containing All repositories and the repository links. Carry the approved Prebid logo, blue/slate palette, orange accent, typography, and theme behavior into the dashboard. The authenticated shell needs a reporting layout, while the approved centered authentication screens retain their appearance.

Arrange the page vertically:

1. Page title, clearly labeled sample-data/as-of information, and one searchable repository multi-select shared by both tables. Include select all and clear selection; searching the picker only filters its options and does not silently change the selected repositories.
2. Current backlog table with its multi-select PR age menu and column-group controls.
3. Activity table with up to two period selectors, separate custom-range actions, exact UTC dates, and its own column-group controls. When two periods are selected, their labeled rows stay adjacent for each repository.

| Setting | Preview starting value |
| --- | --- |
| Repositories | All 18 selected |
| Activity period | This month, resolved against the sample's fixed reporting clock |
| Aging | Over 30 days selected initially; independently add/remove 30/60/90/120/180/360-day columns. None selected hides the group. |
| Second period | Optional; at most two distinct preset/custom ranges. No Show change toggle. |
| Sort | Repository name ascending in both tables; subsequent sorts are independent |
| Backlog default columns | Repository; total open PRs; drafts; non-drafts; open issues; PRs older than the selected threshold; human approvals 0/1/2 |
| Activity default columns | Repository; PRs opened/merged; issues opened/closed; unique PR/issue authors; median time to merge |
| Additional selectable groups | Human feedback 0/1/2; agent coverage; bot coverage; latest actor; separate agent and bot feedback/approval contribution credits |

All core product metrics remain available, even when initially hidden. Preserve exceptional counts above two and other/unknown latest actors in supporting detail; never force them into a visible bucket. Clear labels distinguish feedback participation from current approvals and contribution credits.

Use semantic tables, grouped headers, tabular numbers, useful column widths, and a pinned repository column. Keep horizontal scrolling within each table, with an accessible name and visible scroll affordance. Do not shrink text to fit every column or turn rows into unrelated cards on phones. Keep the repository name identifiable and controls reachable at 320 px. Display all 18 selected repository rows without unnecessary pagination controls; retain the shared 100-row limit for larger lists. Do not add charts, headline KPI cards, drag-to-reorder columns, virtualization, or a new navigation system for this page.

## Ownership and composition

Use small typed display inputs; they are not a database schema or a frozen network API. Add focused files only when their responsibility becomes real during implementation.

| Owner | Responsibility |
| --- | --- |
| Pure display types under `src/models/` | Repository identity, current backlog, per-period values, availability notes, and drilldown selection. Keep existing contribution and account models independent. |
| Prepared samples under `src/mocks/` | Fixed clock, stable IDs, summary values, and bounded supporting rows. These remain behind the existing server composition boundary. |
| Pure helpers under `src/lib/presentation/` | Validated settings/query parsing, UTC period boundaries, display formatting, and drilldown URL construction. No React, storage access, or reporting calculations from event history. |
| Page controller under `src/lib/navigation/` and `_screens` | Current URL, browser preference restoration, page-level selection, and composition of two table controllers. One owner for each setting. |
| Repository feature under `src/features/repositories/` | Backlog/activity column definitions, metric explanations, controls, and page composition from supplied values/callbacks. Repository-specific meanings stay here. |
| Shared components | Table mechanics, numeric/availability presentation, menu and input primitives. No repository metric registry, router, mock imports, account store, or GitHub client inside the table. |

The flow remains: authenticated route -> prepared display inputs -> screen/controller -> feature views -> shared components. Storybook supplies values and a memory controller directly, without Next navigation or authentication services.

Keep the existing TanStack table integration as the single table engine. Column definitions can carry presentation metadata such as group, width, alignment, and whether they may be hidden. The repository column cannot be hidden. Add optional controlled visibility with the existing local behavior as the fallback for other callers; never maintain two authoritative visibility states. Keep generic mechanics reusable without creating a universal dashboard configuration framework.

The auth palette is currently feature-scoped while global dashboard tokens are neutral. Put any shared brand primitives in a neutral style location; map dashboard semantic tokens deliberately and preserve the auth values. Do not import authentication feature CSS into the repository feature or globally restyle forms as a shortcut. Regression-check login, password setup, error screens, and portal menus if shared tokens change.

## State and persistence rules

- Explicit URL state takes precedence over valid saved defaults, then page defaults. A present empty repository selection means no repositories; absence means restore/default. Unknown IDs must not silently turn a deliberate empty selection into all repositories.
- Use separate table namespaces, such as `backlog` and `activity`, and separate preference scopes. Sorting or changing columns in one table must leave the other unchanged.
- Page preferences own selected repositories, visible columns for both tables, ordered period choices/custom dates and selected aging thresholds. Existing table controllers own their respective saved sorts. Do not store the same setting in both places. Store preferences per account in the current browser, with a version and validation; cross-device synchronization comes later.
- Keep repository selection, period, threshold, table sort, and other meaningful drilldown context addressable in the URL. Preserve unrelated query parameters. Column visibility is a display preference, not a data filter.
- Restore preferences after hydration without writing history. Invalid or denied browser storage must leave a working page. Account/revision changes continue to reset mounted page state through the foundation boundary. One account must never inherit another account's settings.
- A relative preset stays relative when saved. Custom ranges store dates. Use UTC and Monday-start weeks; reject invalid/reversed dates. The sample reporting clock is fixed, independent of the real authentication clock.
- Current backlog never changes when the selected periods change. Aging choices only change which age columns are shown; the PR age group disappears when none are selected. Each age column retains its own metric and drilldown threshold. Repository selection applies to both tables.
- Changing displayed columns or period selection must not alter values, units, or sort by the current-period metric. Sorting uses underlying values, places missing values last in both directions, and has a stable repository-name/ID tie-break.
- Default sorting prefers Total PRs then Open for backlog, and PRs Opened then Merged for activity, descending. A visible chosen sort takes precedence; a missing or hidden sort uses the first visible preferred metric, then Repository ascending. Derive this presentation fallback without automatically saving it. Display, navigation capture, and paging use the same effective query; local previews share the same helper.
- Add Reset view to restore this page's defaults and clear only its account-scoped preferences. Preserve the theme and other pages' settings. Changing a filter or scope resets affected list pages; Back/Forward and return navigation restore URL context using the foundation's history conventions.

## Prepared data and honest interactions

Build one coherent runtime sample for these 18 catalog identities. Summary components receive summaries, not every supporting PR/issue row. Load only the selected drilldown's prepared rows through the guarded repository route. Keep large-list generation out of summary client renders.

Provide current backlog values for every aging option, activity values for every selectable preset and prepared custom range, median sample sizes, exact dates, and branch scope. Include normal, quiet, empty, very large, long-name, known-zero, missing, and partially available examples. Preserve independently prepared known answers so tests do not calculate their expected result by calling the same helper being tested.

Prepared values may be selected with small pure helpers. Visible arithmetic must agree: draft plus non-draft equals total; reviewer and approval distributions are independent; coverage can overlap; latest-actor buckets are mutually exclusive only when attribution is complete. Authorship is per repository/period; first-dated automation contributions are distinct from coverage. Missing values render as a dash with accessible supporting information. Known zero stays zero. A partial value is visibly partial and cannot masquerade as an exact total.

Implement the separate custom-range actions and period selection behavior now. Supply explicit prepared custom-range examples. For any range without sample values, show a clear sample-availability state for activity while retaining current backlog. Do not reuse another period's numbers, invent known zero, or build an arbitrary-range reporting simulator. This sample limitation does not remove custom-range support from the eventual product.

Period Activity uses one or two independent periods. Its custom-range actions are outside the preset dropdowns. With two periods, render each repository as a group containing both labeled periods and an automatic Difference row (Period 1 minus Period 2). Show the repository name once, omit numbered row badges, and use a compact difference row and separator to distinguish groups. Differences require two complete values and otherwise show a dash. Sort numeric columns by Period 1, and offer Swap periods to rank by the other. Keep each group together, including at page boundaries (99 rows per comparison page). Keep the values and missing-data state of each period independent. Validate exact duplicate ranges and cap the selection at two.

Loading, error/retry, empty selection, no matches, missing sample ranges, and partial availability must be separately renderable in Storybook and relevant route tests. Use explicit controllable test states rather than random delays or production timers. An unknown scenario/query must never silently return the default sample as if it matched.

## Drilldown boundary

Give each clickable metric an explicit typed destination: repository, metric, current/period scope, primary branch when relevant, dates, aging threshold when relevant, and return context. Use one URL builder and a matching route parser. A malformed URL must not fall back to a different cohort while claiming the requested one; unknown repository identities keep the existing 404 behavior.

- Repository names open the current-open default.
- PR and issue counts open matching metadata-only lists; known zero opens a valid empty list. Missing values are not misleading links.
- Author counts open distinct-author rows with supporting top-level PR/issue links. Contribution counts open contribution-credit rows, preserving account/PR/metric units. Approval/reviewer buckets open PR cohorts, not a list whose row count uses a different unit.
- A duration's supporting detail identifies the merged-PR cohort and sample size, not a count equal to the duration. A change indicator is supporting text, not an ambiguous new metric drilldown.
- Preserve summary return context and the current/period distinction. Period/branch/metric filters must survive list navigation and pagination.
- Supporting records contain title, identity, labels/top-level metadata where applicable, and source links. No descriptions, comments, review text, or diffs.
- Keep the existing reserved `github.example` destinations for invented records. Test hrefs without loading a third-party page; invented numbers must never link to unrelated real Prebid records.
- Use the existing shared table with at most 100 rows per page and full-set filtering/sorting. Every enabled known count must reconcile with its prepared destination. Clearly label partial coverage when exact reconciliation is unavailable.

This is the smallest useful extension of the current repository screen. Do not add repository graphs or redesign the full repository workspace in this delivery.

## Implementation sequence and checks

Each step leaves the application runnable. Keep closely related callers, models, samples, and tests together rather than landing a broken intermediate contract. Aim for one focused feature PR with reviewable commits; split only if the actual diff warrants it, always against the rebuild branch.

| Step | Deliverable | Required evidence before proceeding |
| --- | --- | --- |
| 1. Display contract and sample coverage | Focused types, prepared preset/aging data, availability cases, bounded drilldown descriptors, and a control-to-sample inventory. Update obsolete starter expectations intentionally. | Catalog remains exactly 18 unique repositories. Handwritten sample answers, arithmetic, dates, missing/zero distinctions, and pure URL round trips pass. No new reporting service is introduced. |
| 2. Table composition and visual preview | Grouped headers, controlled visibility, pinned repository column, numeric cells, two table views, and the branded dashboard shell in Storybook. | Both tables render from props with memory controllers. Existing table consumers/export tests remain green. Keyboard controls, group/header associations, pinning and overflow work. Review an initial desktop/narrow-screen preview before polishing the full interaction set. |
| 3. Page controls and preferences | Repository multi-select, periods/custom dates, aging columns, one/two activity periods, independent table state, and Reset view. | Tests prove scope isolation, URL precedence, empty selection, same-route changes, Back/Forward, storage failure, account switching, relative presets, and stale/debounced updates. Preset changes change activity values while backlog remains identical. |
| 4. Sample drilldowns | Typed links and the minimal guarded destination lists needed by enabled metrics. | Known summary values reconcile with rows in their correct units. Branch/period/threshold and return context survive navigation. Zero, missing, malformed scope, >100 rows, and search beyond page one are exercised. |
| 5. Visual baseline and handoff | Complete page states, final user-reviewed layout, maintained docs, focused self-audit, and review-ready PR. | Chromium/WebKit, dark/light, 320/768/1280/1440 px, keyboard/focus, 200% zoom, and accessible names/states checked. Relevant axe checks and strict browser-error observation pass. Run the complete registered quality pipeline and inspect individual results. |

Add feature tests beside the existing unit/component/browser suites and a dedicated All Repositories Storybook story. Retain existing shared behavior checks; don't lower coverage gates to accommodate the page. Use handwritten expected destinations and counts for decisive cases. Browser tests must interact with the actual page and receiving route, not merely compare generated URL helpers with themselves.

At each step, run the smallest relevant registered checks and expand after shared-component changes. Run `npm run check` at integration points. Before final handoff, run `npm run check:all` once on the final source, verify non-empty individual results and no required skips, and confirm hosted checks match the submitted head. Do not claim a visual baseline until the user reviews the rendered page. Sample performance and green UI tests do not establish future database performance or real metric correctness.

## Readiness and remaining review

Review the repository, timeframe, aging, comparison, and saved-preference controls in the updated preview. Numeric metric drilldowns are the next implementation step. Authentication design, metric definitions, and the approved base layout are preserved.

Step 3 implements the searchable repository picker with Apply/Cancel and all/none selection; seven timeframe presets and validated custom dates; six independently selectable aging columns; one or two labeled activity periods; account/browser defaults for scope, columns and sorts; and Reset view. Explicit URLs override defaults, empty selections persist, malformed links and unavailable sample ranges are explicit, and denied storage leaves a usable in-memory view. Pure settings helpers, a browser controller, and separate selector components keep storage/routing out of the shared table. The sample collection carries current backlog once and does not calculate historical metrics.

Step 3 verification: `npm run check:all` passed 414 unit/component, 31 DynamoDB Local, 8 packaged-production, and 64 Chromium/WebKit cases (517 total), with no failed/skipped/pending/flaky cases. Formatting, lint, types, architecture checks, coverage gates, dependency audit, both app builds, and Storybook passed. Browser cases cover direct return, account isolation, URL precedence, Back/Forward, Reset, pending searches, custom-range validation, missing samples, denied storage, accessible dialogs, narrow layouts, and the pinned-divider regression. The preview is local; no production merge or deployment is part of this work.

Step 2 connects the protected overview route to the prepared samples and adds grouped tables, pinned repository names, independent sorting and column visibility, measured overflow hints, and a reusable dashboard frame/header. Shared Prebid palette values preserve the authentication colors exactly. Storybook includes normal, two-period, empty, loading, and error examples. The timestamp formatter is deterministic across Node and WebKit; a browser reload regression checks hydration. Repository/date/aging selectors and saved page preferences were added in step 3; numeric metric drilldowns remain step 4.

Step 2 verification: `npm run check:all` passed 384 unit/component, 31 DynamoDB Local, 8 packaged-production, and 50 Chromium/WebKit cases, with no failures/skips/pending/flaky cases. Formatting, lint, types, architecture/retirement checks, coverage gates, production/preview/Storybook builds, and dependency auditing passed. Overview screenshots cover 320/768/1280/1440 px in both themes, with table accessibility, overflow and pinning checks. Authentication screens passed their existing responsive/theme checks. These are local implementation checks and an unapproved visual preview, not a production deployment or independent review.

Step 1 supplies typed/validated display measurements, all 18 repository samples, seven period presets, all six aging thresholds, a prepared custom range, explicit unavailable-range behavior, and pure drilldown URL descriptors. The [sample inventory](../../design/mocks/README.md#runtime-sample-for-all-repositories) maps controls and states to these inputs. `npm run check` passed formatting, lint, typechecking, architecture checks, and coverage gates with 377 individually passing unit/component cases (67 added for this step), with no skipped/pending/expected-failure/flaky cases. Layouts, browser controls, and receiving drilldown routes are deliberately not implemented by step 1. No reporting service or dependency was added.

Planning verification on 2026-10-27: the checked-out PR #3 head `fcfa861921d55317fb8932448a36f513c2d69b2d` has the same tracked tree as the merged rebuild commit above. `npm run test` passed all 310 individually verified unit/component cases with no skipped/pending/expected-failure/flaky cases. `npm run check:boundaries` checked 106 application source files and reported no retirement or architecture violations. These checks establish the existing starting point; the planned All Repositories behaviors are not implemented or verified yet. The complete build/browser/account integration pipeline was not rerun for this documentation-only plan.

## Review refinements after step 3

PR age is a checkbox column selector; clearing all choices removes the group. These options are excluded from the general Columns menu. Period Activity has no Show change control and supports at most two distinct periods, each independently preset or custom. Custom ranges are outside the preset dropdowns. A repository name heads each comparison group, followed by both labeled period rows and an automatic Difference row, with primary-period sorting and a Swap periods action. The user confirmed the two-period limit. Both changes remain sample-backed and local to the rebuild branch.

Combined refinement verification: `npm run check:all` passed 427 unit/component, 31 DynamoDB Local, 8 packaged-production, and 70 Chromium/WebKit cases (536 total), with no failures/skips/pending/flaky cases. Checks cover aging selection including none, preference migration, two presets or two custom ranges, duplicate rejection, paired sorting with actual row values, swapping/removal, persistence/history, responsive layouts, accessibility, and the divider regression. Desktop and narrow screenshots were visually inspected.

Follow-up comparison refinement verification: `npm run check`, preview/Storybook builds, and `npm run test:e2e` passed 432 unit/component and 70 Chromium/WebKit cases (502 total), with no failures/skips/pending/flaky cases. This covers removing duplicate age menu entries, automatic signed differences, incomplete-value dashes, period swapping, grouped sorting/pagination, saved preferences, accessibility, and the divider regression. Desktop and narrow layouts were visually inspected in both themes. Account and packaged-production integration suites were not rerun for this presentation-only refinement; the preceding full run remains separate evidence.
