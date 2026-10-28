# Repository page — initial requirements draft

Status: Step 2 shared layout and tables are implemented for visual review. Advanced filter controls and saved column preferences remain Step 3; graph presentation remains Step 4. Shared metric definitions, the lightweight record-list scope, graphs, current-open defaults, and grouped Repos navigation were confirmed on 2026-10-24. The shared page size was updated to 50 on 2026-10-28. Pagination behavior is specified below; chart selection, exact columns, and visual layout remain recommendations for discussion.

## Confirmed purpose

Provide a page for each repository focused on individual PRs and issues: titles, tags/labels, general top-level information, and the summary indicators needed to identify relevant records. Graphs help users understand the distribution or activity of those records and narrow the lists.

Clicks from All Repos must open the appropriate prefiltered list on this page. Preserve the exact meaning of the selected summary metric.

Selecting a PR or issue opens the actual record on GitHub. There is no intermediate in-app record-detail page, expanded description, comment viewer, review transcript, or diff viewer.

The intended flow is: All Repos summary -> prefiltered repository list -> actual PR or issue on GitHub.

Use the definitions in [All Repositories](all-repositories.md):

- Repository statistics are independent of other repositories.
- Human reviewers are distinct non-author humans who commented, inline-commented, or requested changes. Approval alone does not qualify.
- Current approvals are counted independently, once per current human approver.
- Prebid agents come from the explicit account mapping; other bots come from GitHub's classification. Agent mapping takes precedence.
- Prebid human reviewers are identified through the existing reviewer mapping.
- Primary-branch merge metrics support the repository's configured `main` or `master` branch.
- Missing data uses a dash; known zero uses zero.
- Review requests, predicted waiting states, and inferred merge readiness are not summary metrics.

## Page scope

Use one reusable page structure with repository-specific data and configuration.

The page context should identify the repository, configured primary branch, and data freshness, with navigation back to All Repos and a link to GitHub.

The two primary record lists are:

| View | Purpose |
| --- | --- |
| Pull requests | Identify relevant PRs using titles, tags/labels, state, and top-level summary fields, then open the PR on GitHub. |
| Issues | Identify relevant issues using titles, tags/labels, state, and top-level summary fields, then open the issue on GitHub. |

Whether these appear as tabs, sections, or another layout will be decided during design. The earlier proposal for four main views is withdrawn; separate People and Review activity workspaces are not assumed requirements.

Names, counts, approval state, agent/bot indicators, and latest-activity metadata can support filtering and summary information. They do not introduce in-app conversation or record-detail views. The underlying activity may be needed to calculate agreed metrics without displaying its text.

Tags/labels belong on these repository-level record lists. Their exclusion from All Repos applies only to the summary page.

## Entry paths and default state

| Entry path | Initial scope |
| --- | --- |
| Unfiltered repository navigation, repository name link, or direct repository URL | The first page of current open PRs, including drafts, and current open issues: at most 50 rows per list, newest-created first by default. Older matching items remain accessible through pagination. |
| A metric selected on All Repos | The first page of the specific record list and filters represented by that metric, limited to 50 rows per page. Historical activity selections retain their period and date basis. |
| A bookmarked/shared URL with explicit filters | The view and filters encoded in the link. Do not reset them to the unfiltered default. |

Explicit incoming scope takes precedence over defaults. Saved presentation preferences, such as visible columns, sorting, and graph visibility, can apply without changing that scope. A previously selected historical period must not silently replace current-open defaults on a new unfiltered repository visit.

If a repository link requires login, successful sign-in returns to that view with its explicit filters and navigation context preserved. See the [Login page specification](login.md).

Provide a clear way to return to Current open. In-page filtering and browser back preserve the user's explicit context.

### Repos navigation

Use one top-level **Repos** navigation item. Its expandable list contains **All Repos**, followed by a link for each repository. Keep individual repository links inside this group so they do not clutter the main navigation bar. Individual repository links open the unfiltered current-open scope.

Repository pages remain independently addressable. All Repos is the cross-repository comparison and filtered entry point; users can also go directly to a repository from the Repos list.

## Graphs

Graphs are part of the repository page. They summarize record metadata and counts without displaying descriptions, comments, reviews, or diffs.

Choose a small relevant set for the active PR or issue view; the exact selection and placement remain open. Candidate graphs are:

| Record scope | Candidate graph | Purpose |
| --- | --- | --- |
| Current open PRs | Age distribution | Show how long the open backlog has existed; include drafts or clearly show the active draft filter. |
| Current open non-draft PRs | Human-reviewer distribution: 0 / 1 / 2 | Show distinct qualifying human-feedback counts per PR. |
| Current open non-draft PRs | Current human-approval distribution: 0 / 1 / 2 | Show current approvals independently from feedback participation. |
| Current open issues | Age distribution | Show the age of the open issue backlog. |
| Explicit period activity | PRs opened/merged or issues opened/closed over time | Show dated activity using the agreed creation, merge, and closure definitions. |

Review participation and approvals are independent measures; do not stack or add them as mutually exclusive parts of a total. Preserve the agreed exact 0/1/2 summary buckets without clamping unexpected higher values.

Current-open graphs do not require a historical period. Historical trend graphs belong to an explicitly selected activity scope and must not silently replace current backlog graphs on a direct visit.

Graphs must use the complete matching dataset, not just the loaded table page. State their scope and as-of time. Apply the relevant active filters consistently; explicitly label any restriction such as non-draft PRs so a graph does not imply it includes all open PRs.

Where a graph supports selection, selecting a bar or segment applies a visible, removable filter to the corresponding record list. The selected count must reconcile with that filtered list for the same data snapshot. A PR or issue number/title still opens the actual record on GitHub.

Use the same date boundaries, actor classifications, and metric definitions as the lists and All Repos. When the selected scope has no suitable graph, omit an irrelevant graph rather than substituting unrelated current or historical data. Missing data and known zero remain distinct. Retain a textual/table representation of values so the graph is not the only way to access them.

## Drill-down behavior

| All Repos selection | Destination and filters |
| --- | --- |
| Total open PRs | Pull requests: currently open, including drafts. |
| Draft PRs / Open non-draft PRs | Pull requests: open with the corresponding draft filter. |
| Open >60 days | Pull requests: open, non-draft, age since creation greater than 60 days. Preserve whichever threshold was selected. |
| PRs with 0 / 1 / 2 human reviewers | Pull requests: open, non-draft, exact qualifying human-reviewer count. This is a count of PRs, so the destination is a PR list. |
| PRs with 0 / 1 / 2 current approvals | Pull requests: open, non-draft, exact current human-approval count. |
| PRs with agent / bot feedback | Pull requests: open, non-draft, feedback from the selected actor category. |
| Last activity by an actor category | Pull requests: open, non-draft, latest qualifying activity by that category. |
| Open issues | Issues: currently open. |
| PRs opened / merged during a period | Pull requests: created in the period, or merged in the period into the configured primary branch, respectively. |
| Issues opened / closed during a period | Issues: creation or closure in the period, respectively. |
| Unique PR / issue authors | A compact author list or author-filtering context for the corresponding records, preserving the selected period. No person-detail page is implied. |
| Agent / bot feedback or approval contributions | A compact contribution-credit list with one row per account, PR, and metric, showing the first-credit date and a GitHub PR link. Preserve the reporting period and actor category. Repeated actions do not create additional rows or credits in later periods. |
| Median time to merge | Pull requests: the merged cohort underlying the median, with creation-to-merge durations. |

If reviewer or approver names are exposed alongside a count, keep them as compact identity metadata. Keep reviewer and approver membership separate; the same person can appear in both only if independently qualified. Do not expand into the comments or review contents. Supporting list placement remains undecided and does not require additional main views.

Show active filters and their date basis explicitly. Created during a period is different from merged during that period, and neither means only records that remain open today.

Navigation from a summary metric takes precedence over saved default filters. Preserve relevant date boundaries, reporting timezone, branch scope, and aging threshold. Browser back should restore the All Repos context.

When summary and detail use the same data snapshot, the filtered list total must reconcile with the source count. If data refreshed between views, disclose the newer as-of time rather than implying the snapshots are identical.

## Proposed pull-request list

On a direct visit without drill-down filters, show currently open PRs including drafts, starting with up to 50 visible rows. Default to newest-created first unless the user has explicitly chosen another sort. Older open PRs remain accessible through pagination, sorting, or filtering.

Candidate columns:

- PR number and title linking directly to the actual PR on GitHub.
- Tags/labels.
- Author and actor category: human, Prebid agent, or bot.
- Draft/open/merged state and target branch.
- Created date and age; merged date and merge duration when relevant.
- Distinct human-reviewer count, with optional compact usernames.
- Current human-approval count, with optional compact usernames.
- Separate agent-feedback and bot-feedback indicators.
- Latest qualifying activity time, actor, and actor category.

Candidate filters: title/number search, tags/labels, author, author category, draft/open/merged state, branch, age threshold, human-reviewer count, current approval count, agent/bot coverage, latest actor category, and the relevant activity date range.

These are candidate top-level fields, not a finalized column list. The eventual choice should support scanning and filtering the records. Allow saved column preferences and sorting. Selecting the record goes directly to GitHub.

## Proposed issue list

On an unfiltered direct visit, load and show the first page of up to 50 currently open issues, newest-created first by default. Do not render the entire issue backlog. Older open issues remain accessible through pagination, sorting, or filtering. Arriving from All Repos preserves its exact filter scope while applying the same page-size limit.

Candidate top-level fields: number/title linking directly to GitHub, tags/labels, author and actor category, open/closed state, created date, closed date when applicable, age for open issues, last activity, and assignees.

Candidate filters: title/number search, tags/labels, author, state, assignee, age, and created/closed date range. Issue descriptions and comment threads stay on GitHub.

## Proposed merged-PR review status and direct-push lists

Merged-PR lists may show and filter compact feedback/approval state at merge time, separately for humans, Prebid agents, and bots. These fields are historical and do not replace current approval state on open PRs. Actual PR records continue to open on GitHub.

If a direct-push metric is selected, show a separate lightweight list of primary-branch push metadata with GitHub commit/comparison links; do not fabricate a PR record for a push without one. This is a filtered supporting list, not a new top-level workspace. See [Merged PR review status and direct pushes](merge-review-status.md). Both lists retain the existing 50-row pagination and metadata-only scope.

## Supporting identity and contribution metadata

Existing author, reviewer, approver, and automation metrics can retain lightweight identity/count lists or filtering controls where needed for summary navigation. They are secondary to the PR and issue lists, not separate main workspaces.

Preserve the agreed role definitions: commenting does not establish authorship, and approval alone does not establish human-reviewer participation. Author records may represent humans, Prebid agents, or bots. Reviewer and approver membership remain independent.

If a contribution count opens a supporting list, each row contains only top-level metadata such as PR title/link, account, actor category, contribution type, and first-credit date. Actual review contents are viewed on GitHub.

Keep measurement units explicit: people, PRs, and contribution credits are different counts. Several accounts can contribute to one PR, but each account receives at most one lifetime credit per metric on that PR. Supporting contribution lists use the [Contributors counting rules](contributors.md); repeated comments, review rounds, or approvals are not additional report rows. These distinctions do not require a full activity explorer.

## Pagination and sorting

Use paginated tables with **Previous** and **Next** controls for PRs and issues. Default to 50 visible rows per page. With a real reporting adapter, each record-page request must also be capped at 50 rows. The current fake-data phase uses the complete supplied population, as described below. Moving between pages replaces the visible rows instead of continually appending to the table.

- Show the visible range separately from the full matching count; for example, Showing 1–50 of 834 open issues. The example is illustrative, not a measured repository count.
- Apply filtering, search, and sorting to the full matching dataset before selecting a page. Searching must not be limited to the first 50 loaded records.
- Newest-created first is the default. Allow other sorts, including latest activity and oldest first, and honor explicit or saved sort preferences.
- Changing filters or sorting returns to the first page. Pagination preserves all active filters and sorting. Browser back restores the previous list context and page.
- Keep a stable secondary ordering for ties so page boundaries do not arbitrarily duplicate or omit records. Account for refreshed data rather than silently treating different snapshots as identical.
- The 50-row cap limits display and page retrieval, not the total result set or the summary statistics. Graphs and total counts cover all matching records and remain unchanged when moving between pages.
- With the real data adapter, fetch a bounded record page and separate full-cohort aggregates. The current frontend phase retains the foundation’s complete supplied fake population: search/filter/chart selection precede the shared 50-row table pagination. Do not add an unused remote paging mode during this phase. The page model rejects a truncated population whose row count disagrees with its supplied measurement.
- Preserve distinct initial-loading, page-loading, no-match, and error states. A failed next-page request must not be mistaken for the end of the results.

## Shared behavior

- Numeric and date columns are sortable; active filters can be inspected and cleared.
- Direct links should retain the selected view and filters.
- Saved presentation preferences apply on an unfiltered direct visit while the data scope starts at Current open. Explicit incoming filters take precedence over defaults.
- PR and issue lists use the 50-row pagination policy above; display the full matching count separately from the currently visible rows.
- Loading, no matches, missing data, partial data, and errors are distinct states.
- PR/issue number and title links open the actual GitHub record directly.
- Descriptions, comment text, inline-comment bodies, review bodies, diffs, and full event timelines are outside this page's display scope.
- PR/issue editing is outside the reporting page's scope. Agent launching and any Run agent shortcut are deferred until after tracking; no launch control is required in the first repository-page design. See [deferred agent-launching notes](agent-launching-deferred.md).

## Planning boundary

The scope is now established: grouped Repos navigation, graphs, and useful top-level PR and issue lists, with Current open as the unfiltered entry scope and record links leading directly to GitHub. Exact fields, graph selection, and visual arrangement remain open for the next discussion. Do not add in-app record-detail views or additional workspaces while resolving those choices.

## Step 1 display contract

Implementation starts from the merged All Repositories work on `codex/frontend-rebuild` (`4e79f10`). The `codex/repository-pages` branch prepares the next view; existing route rendering and layouts are unchanged at this step.

- `src/models/repository-page.ts` extends existing PR/issue record inputs with author classification, nullable latest-activity metadata, and nullable issue assignments. Missing assignments are distinct from a known empty assignment list.
- `readRepositoryPageEntry` normalizes direct visits and the existing 37 summary metric/threshold destinations. Explicit metric scope wins over legacy tab hints. Author/contribution/duration entries remain supporting views, with their original dates, branch and return context.
- `selectRepositoryPage` accepts a complete available fake cohort, validates the PR/issue filter kind, and narrows it without changing the original scope. Multiple values within a facet mean any selected value; separate facets combine with AND. Search matches number/title and the visible Draft marker. Validated author handles normalize case. Branch filters may include non-primary targets; merged summary cohorts retain their configured primary-branch scope.
- Current age bands are disjoint: up to 30 days, over 30 through 60, over 60 through 90, over 90 through 120, over 120 through 180, over 180 through 360, and over 360. They reuse the existing thresholds; cumulative summary age links remain cumulative base scopes.
- Current review/approval/agent/bot filters exclude drafts. Their eligibility must be visible in the later controls. Historical activity does not reinterpret current approval values as approval-at-merge data.
- Unknown metadata that could satisfy an active filter makes the resulting count partial, even when there are zero known matches. A definite mismatch in another filter excludes that row. Explicit Unknown selections remain separate from zero/false/unassigned.
- Current PR charts carry age and separate non-draft reviewer/approval distributions. The exact zero/one/two buckets retain separate more-than-two and unknown values for honest totals; the later visual layout determines how exceptional buckets are presented. Current issues have an age distribution. Period views use only the selected creation, merge or closure event date, with UTC daily bins for spans through 31 days and calendar-month bins for longer prepared ranges. Zero bins are retained, end-exclusive boundaries are respected, and an inclusive boundary event belongs to one bin.
- All charts reflect the full filtered population, independently of table sorting/paging. The base cohort/count and selected filters remain available for scope labels and reset behavior. A selected distribution value or activity interval uses those same filter fields; it can narrow, never broaden, the incoming scope.
- `repositoryPageSample` and `repositoryPageRecordsSample` enrich the existing prepared record lists; there is no second generator for summary counts. Metadata follows record identity across filtered lists and author-record routes. Human/agent/bot sample classifications have one owner in `src/mocks/repository-accounts.ts`.

The scenario tests cover all 18 repositories, all current metrics/thresholds and nine prepared periods, quiet and large cohorts, partial/missing results, bot handles, unchanged summary totals, UTC/leap-day boundaries, overlapping review measures, unknown metadata, and matching author records. Unsupported ranges retain the existing sample-unavailable state. Prepared periods remain independent display scenarios, not historical event reconstruction.

### Remaining implementation sequence

1. Models and samples (this step): pure contract/scenario tests and required static/coverage checks.
2. Shared repository layout and metadata tables: first visual checkpoint in both themes and narrow layouts; consolidate the legacy direct-entry view with the existing drilldown view.
3. URL-backed controls and presentation preferences: interactive checkpoint, one owner for filter/search intent, explicit Current open reset and preserved Back/Forward/return context. Saved presentation choices do not replace an unfiltered visit’s current-open scope.
4. Compact repository graphs and selection controls: chart visual checkpoint, keyboard/text alternatives and count reconciliation with the filtered table.
5. Full integration checks, adversarial review and final visual sign-off before the next PR against `codex/frontend-rebuild`.

Step 1 verification: `npm run check` passed formatting, lint, typechecking, architecture/retirement boundaries, coverage gates, and 522 individually passing unit/component cases (37 added for this step), with no skipped, pending, expected-failure, or flaky cases. The preview and Storybook builds passed. Route/layout wiring, browser interaction checks for the new page, and visual sign-off follow in the remaining steps.

## Step 2 layout checkpoint

Direct repository visits, summary record drilldowns, and author-record routes now use one guarded page composition and one record-table presentation. The legacy direct-entry renderer and its separate screen were removed. Existing supporting author/contribution/duration views share the repository header while retaining their distinct units and record tables.

The header shows repository identity, configured primary branch, snapshot time, and the catalog GitHub link. PR/Issues navigation badges explicitly show current-open totals, separately from the selected cohort count. Choosing a list tab opens that current-open list; incoming period/metric/author scope remains visible until another list or the explicit current-open link is chosen. Parent author and All Repositories return contexts are preserved.

Record numbers remain pinned; titles carry status and labels inline. Author/category and latest-activity metadata are compact, with unavailable values shown as dashes. Drafts do not display numeric human-reviewer or approval values. The existing table controller supplies search, sorting, columns, and 50-row pagination; scope totals describe the incoming cohort and the table footer reports search matches within it. State, labels, and author category remain export/search values without duplicate standalone columns in the menu. Known-unassigned issues remain distinguishable from unavailable assignment data.

The new layout has light/dark and narrow-screen browser cases, plus tab/back-pagination, full-population search, primary-branch, bot/agent identity and incoming-filter regressions. Repository graphs and advanced controls will be added in their designated steps after this visual checkpoint.

Step 2 verification: `npm run check:all` passed 525 unit/component, 31 account, eight packaged-production, and 156 Chromium/WebKit cases (720 total), with no skipped, pending, expected-failure, or flaky cases. Formatting, lint, types, architecture/retirement checks, coverage gates, dependency audit, both app builds, and Storybook passed. Desktop light/dark and narrow layouts were visually inspected. Status and author assertions were migrated to the new inline presentation while retaining exact cohort counts and identity checks. The layout is awaiting the user's visual feedback before Step 3.

Pagination refinement (2026-10-28): the shared default and maximum are now 50 visible rows. Three-row repository comparisons use 48 rows to keep each group together. The updated checks traverse successive 50-row pages without duplicates or omissions, preserve filtered/author return context, and retain full-set search and exports. `npm run check` passed 525 unit/component cases and all static/coverage gates; preview and Storybook builds passed; all 156 Chromium/WebKit cases passed without skips or flaky results.
