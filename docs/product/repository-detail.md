# Repository page — initial requirements draft

Status: shared metric definitions, the lightweight record-list scope, graphs, current-open defaults, grouped Repos navigation, and a maximum of 100 visible PRs or issues per page confirmed on 2026-10-24. Pagination behavior is specified below; chart selection, exact columns, and visual layout remain recommendations for discussion.

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
| Unfiltered repository navigation, repository name link, or direct repository URL | The first page of current open PRs, including drafts, and current open issues: at most 100 rows per list, newest-created first by default. Older matching items remain accessible through pagination. |
| A metric selected on All Repos | The first page of the specific record list and filters represented by that metric, limited to 100 rows per page. Historical activity selections retain their period and date basis. |
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

On a direct visit without drill-down filters, query currently open PRs including drafts, but load and show only the first page of up to 100 rows. Default to newest-created first unless the user has explicitly chosen another sort. Older open PRs remain accessible through pagination, sorting, or filtering.

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

On an unfiltered direct visit, load and show the first page of up to 100 currently open issues, newest-created first by default. Do not render the entire issue backlog. Older open issues remain accessible through pagination, sorting, or filtering. Arriving from All Repos preserves its exact filter scope while applying the same page-size limit.

Candidate top-level fields: number/title linking directly to GitHub, tags/labels, author and actor category, open/closed state, created date, closed date when applicable, age for open issues, last activity, and assignees.

Candidate filters: title/number search, tags/labels, author, state, assignee, age, and created/closed date range. Issue descriptions and comment threads stay on GitHub.

## Proposed merged-PR review status and direct-push lists

Merged-PR lists may show and filter compact feedback/approval state at merge time, separately for humans, Prebid agents, and bots. These fields are historical and do not replace current approval state on open PRs. Actual PR records continue to open on GitHub.

If a direct-push metric is selected, show a separate lightweight list of primary-branch push metadata with GitHub commit/comparison links; do not fabricate a PR record for a push without one. This is a filtered supporting list, not a new top-level workspace. See [Merged PR review status and direct pushes](merge-review-status.md). Both lists retain the existing 100-row pagination and metadata-only scope.

## Supporting identity and contribution metadata

Existing author, reviewer, approver, and automation metrics can retain lightweight identity/count lists or filtering controls where needed for summary navigation. They are secondary to the PR and issue lists, not separate main workspaces.

Preserve the agreed role definitions: commenting does not establish authorship, and approval alone does not establish human-reviewer participation. Author records may represent humans, Prebid agents, or bots. Reviewer and approver membership remain independent.

If a contribution count opens a supporting list, each row contains only top-level metadata such as PR title/link, account, actor category, contribution type, and first-credit date. Actual review contents are viewed on GitHub.

Keep measurement units explicit: people, PRs, and contribution credits are different counts. Several accounts can contribute to one PR, but each account receives at most one lifetime credit per metric on that PR. Supporting contribution lists use the [Contributors counting rules](contributors.md); repeated comments, review rounds, or approvals are not additional report rows. These distinctions do not require a full activity explorer.

## Pagination and sorting

Use paginated tables with **Previous** and **Next** controls for PRs and issues. Default to 100 rows per page and never request or display more than 100 record rows in a single page. Moving between pages replaces the visible rows instead of continually appending to the table.

- Show the visible range separately from the full matching count; for example, Showing 1–100 of 834 open issues. The example is illustrative, not a measured repository count.
- Apply filtering, search, and sorting to the full matching dataset before selecting a page. Searching must not be limited to the first 100 loaded records.
- Newest-created first is the default. Allow other sorts, including latest activity and oldest first, and honor explicit or saved sort preferences.
- Changing filters or sorting returns to the first page. Pagination preserves all active filters and sorting. Browser back restores the previous list context and page.
- Keep a stable secondary ordering for ties so page boundaries do not arbitrarily duplicate or omit records. Account for refreshed data rather than silently treating different snapshots as identical.
- The 100-row cap limits display and page retrieval, not the total result set or the summary statistics. Graphs and total counts cover all matching records and remain unchanged when moving between pages.
- Fetch a bounded record page and the needed aggregate summaries. Do not download every matching PR or issue merely to display the first page or build the graphs in the browser. The future reporting API must support this boundary; fixture-based development should exercise the same paginated behavior.
- Preserve distinct initial-loading, page-loading, no-match, and error states. A failed next-page request must not be mistaken for the end of the results.

## Shared behavior

- Numeric and date columns are sortable; active filters can be inspected and cleared.
- Direct links should retain the selected view and filters.
- Saved presentation preferences apply on an unfiltered direct visit while the data scope starts at Current open. Explicit incoming filters take precedence over defaults.
- PR and issue lists use the 100-row pagination policy above; display the full matching count separately from the currently visible rows.
- Loading, no matches, missing data, partial data, and errors are distinct states.
- PR/issue number and title links open the actual GitHub record directly.
- Descriptions, comment text, inline-comment bodies, review bodies, diffs, and full event timelines are outside this page's display scope.
- PR/issue editing is outside the reporting page's scope. Agent launching and any Run agent shortcut are deferred until after tracking; no launch control is required in the first repository-page design. See [deferred agent-launching notes](agent-launching-deferred.md).

## Planning boundary

The scope is now established: grouped Repos navigation, graphs, and useful top-level PR and issue lists, with Current open as the unfiltered entry scope and record links leading directly to GitHub. Exact fields, graph selection, and visual arrangement remain open for the next discussion. Do not add in-app record-detail views or additional workspaces while resolving those choices.

No application behavior has been implemented or verified by this document.
