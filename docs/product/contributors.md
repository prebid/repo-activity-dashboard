# Contributors and Companies

Current product contract for the Contributors and Companies frontend. Reporting uses prepared fake data; authentication and account access retain the foundation's protections. Implementation and review history live in Git and PR #8, not in this specification.

## Delivery scope — updated 2026-10-29

The current frontend milestone covers Contributors and Companies, their focused reports, individual/company inclusion and exclusions, saved report preferences, and full filtered exports. Custom groups are deferred until real reporting data from the database is integrated into the application. This includes group navigation, reports, group-based selection, membership, editing permissions and group-specific samples/tests; none is required for the current frontend milestone. Existing group requirements below remain the later contract. Personal report filters and saved views remain in scope and do not require a custom-group implementation.

Follow the [approved project sequence](README.md#approved-delivery-sequence) and [five-step frontend process](README.md#five-step-frontend-delivery-process). This milestone contains the six core contribution metrics; merge-review status and direct pushes follow as a separate frontend increment.

## Confirmed goals and decisions

- Rank contributors independently on different contribution metrics.
- Keep code contribution, feedback, approval activity, and performing merges distinguishable.
- Use **PR authorship**, not commit authorship or co-authorship, as the code-contribution basis.
- Break contributions down by repository; each repository remains an independent source of activity.
- Use the existing company-to-contributor mapping to combine contributors into company reports.
- Attribute activity using the **current company mapping**, clearly labeled. Do not present this as employment at the time of the activity.
- Support inspecting one contributor, including/excluding specific contributors, and user-defined groups.
- Retain the established distinction between human feedback participation and approvals.
- Count a given account's contribution once per PR and metric across the PR's lifetime, assigning it to the first qualifying action's date. Changing months or years does not create another contribution.
- Include Issues authored as a supported metric.
- Custom groups are stored definitions maintained by the user and explicitly designated additional editors, initially perhaps one other person. Ordinary report users do not automatically receive group-editing rights.
- Use sortable tables and metric exports for contributors, companies, and custom groups. Repository breakdowns also use tables.
- Keep charting on the repository pages. Contributor/company charts and a custom charting tool are outside the current scope; a possible future tool does not require implementation work now.

## Report structure

Use one top-level **Contributions** area with two initial sibling overview views: **Contributors** and **Companies**. Add **Groups** after database integration. Each delivered view has its own linkable URL and presents the same reporting measures grouped by its entity type. These views share metric definitions, filters, table components, and export behavior.

Selecting a contributor, company, or group opens a focused report with its own URL and a clear route back to the overview. The shared reporting model does not require fitting overview rankings, repository breakdowns, and group membership onto one screen. This overview/focused-report hierarchy was accepted during the page-planning discussion.

Separate these concepts:

| Control | What it changes |
| --- | --- |
| Repositories and timeframe | Which activity is in scope. |
| Included/excluded accounts | Whose activity is in scope. |
| Metric | Which metric orders the ranking; other metrics remain separate table columns. |
| Group results by | Account or company in the initial scope; custom groups follow database integration. |
| Pagination and visible columns | How much of the ranked table is displayed, without changing underlying totals or limiting the full filtered export. |

Changing a grouping must not silently change the selected accounts, timeframe, or repository scope.

### Page hierarchy

| Report | One row represents | Main purpose |
| --- | --- | --- |
| Contributors overview | One contributor account | Rank people/accounts by separate metrics across the selected repositories. |
| Companies overview | One company | Rank companies using all selected members' contributions. |
| Groups overview (after database integration) | One stored custom group | Compare groups using the same metrics; designated editors maintain membership separately from users' reporting filters. |
| Individual contributor report | One repository | Inspect that person's contributions to each selected repository. |
| Company report — By contributor | One included contributor | Identify the people contributing to the selected company's totals. |
| Company report — By repository | One repository | Inspect the selected company's contributions to each repository. |
| Custom group report — By contributor (after database integration) | One included group member | Inspect members' contributions to the selected group's totals. |
| Custom group report — By repository (after database integration) | One repository | Inspect the selected group's contributions to each repository. |

Use metric columns, not a column or block of columns for every repository. With 17–20 repositories, the overview should remain a fixed-width metric table. Repository breakdowns use vertical rows on the focused report. Display the selected repository scope in the filters rather than repeating a long repository-name list in every overview row.

Company and group reports share the same By contributor / By repository structure. Group reports expose their membership; any management controls are restricted to designated editors. The choice between these two table breakdowns does not change the underlying selection or totals.

Keep totals and the current repository/timeframe/filter context visible on focused reports. Carry exclusions and actor filters into nested reports and clearly label them; clicking a group member must not silently replace the scoped report with that person's unfiltered lifetime activity. Offer an explicit reset if the user wants a broader scope. Back navigation restores the prior overview's filters, sorting, and page.

From an overview, choosing one repository in the shared filter immediately compares all contributors, companies, or groups within that repository. Comparing repositories for one entity uses its focused report. This supports both questions without a 20-repository column layout.

## Account links, type filtering and column explanations

In contributor and company-member tables, the display name opens the internal contributor report, while the `@handle` opens the source-provided GitHub profile in a new tab. There is no separate View report action. Human, Prebid-agent and bot icons accompany the identity; Account type remains its own filterable column. Invented accounts use visibly identified `github.example` profile placeholders, not potentially unrelated real accounts. Repository author/contributor lists use the same profile component. Company names continue to open internal company reports.

**Account type** is a default contributor/member column. Redundant per-row human/agent/bot tags are removed. A multi-select filter can include Human, Prebid agent, Bot and Unknown in any combination. Empty selection means none, not all. Filtering precedes company aggregation, resets table pages and carries through overview/focused navigation, reload and Back/Forward. Repository, timeframe and population controls share the same scope and saved-preference behavior.

Reporting tables use one column-help pattern: native header hover descriptions and accessible header descriptions come from the column definition; the help button beside each table title opens the same visible-column definitions for keyboard/touch. The contribution-only page dropdown is removed. Sorting and help remain separate actions.

## Optional comment and merged-change volume columns

These additions were approved on 2026-10-29. Keep the six core contribution columns intact and expose the new measures through **Columns**, hidden by default. Hiding a metric does not remove an account with activity in it. These measures are separate from one another and from any evaluation of contribution quality.

| Comment metric | Counting and date basis |
| --- | --- |
| PR comments | Posted conversation comments on PRs, including author replies; excludes diff comments and submitted review-summary bodies. One comment identity, dated by creation. |
| Inline comments | Posted PR file/diff review comments and replies. One comment identity, dated by creation. |
| Issue comments | Posted comments on issues, excluding PRs, including the issue author's replies. One comment identity, dated by creation. |

Edits and repeated collection do not add comments. A later comment can count as new comment activity without creating another once-per-account/PR reviewer credit. Comment bodies are not displayed or stored in these frontend models.

For change volume, the user selected **the final merged PR diff and merge date for every role**. Include only merges into each repository's configured primary branch. Provide separate optional groups:

- **Authored merged PR volume:** attribute the final diff to the PR author.
- **Reviewed merged PR volume:** attribute the same final diff once to each distinct non-author account with qualifying reviewer participation before merge.
- **Approved merged PR volume:** attribute the same final diff once to each distinct account that gave an approval before merge. Effective approval state at merge remains a separate measure.

A qualifying action may precede the selected period; the PR's merge date places its volume in the period. Repeated comments or approvals do not add volume for the same account/PR/role. These are associated PR sizes, not evidence that each person wrote or read every changed line. Merges performed stays an independent count; volume is not attributed to the person merely executing the merge.

Each role group includes all ten fields:

| Field | Meaning |
| --- | --- |
| Files changed | Total changed file entries in the final PR diff. |
| Files added | GitHub `ADDED` status. |
| Files removed | GitHub `DELETED` status. |
| Files modified | GitHub `MODIFIED` status; content changed. |
| Files renamed | GitHub `RENAMED` status. |
| Files copied | GitHub `COPIED` status. |
| File type changes | GitHub `CHANGED` status / Git status T. |
| Lines changed | Final-diff additions plus deletions; not net growth or accumulated intermediate commit churn. |
| Lines added | Final-diff line additions. |
| Lines removed | Final-diff line deletions. |

For complete data, files changed equals the six mutually exclusive file-status counts, and lines changed equals lines added plus lines removed. A file changed in several PRs is counted in each PR. In company reports, each person's role-associated volume remains: two company reviewers on one six-file PR produce twelve reviewer-associated file changes across one PR, not twelve distinct repository files. Do not add authored/reviewed/approved groups into an overall score or unique-code total.

Incomplete categories remain partial or unavailable; never force reconciliation by guessing a missing category. The database integration will collect/prepare the actual counts, final-diff identity and pre-merge role evidence. GitHub's file-list coverage must be checked, including pagination/endpoint limits, before treating category counts as complete. Current samples test supplied facts and arithmetic, not real collection completeness. Source definitions: [GitHub PR diff fields and file statuses](https://docs.github.com/en/graphql/reference/pulls#patchstatus), [PR review comments](https://docs.github.com/en/rest/pulls/comments), [PR file listing](https://docs.github.com/en/rest/pulls/pulls#list-pull-requests-files).

## Over time tables — planned timeline increment

After the core contributor/company overview and focused reports, add the [shared timeline view](README.md#timeline-reporting). Keep contributor/company reporting table-based: one row per calendar interval, separate metric columns, and full filtered CSV exports. Use Daily, Weekly, Monthly, Every 2 months, Quarterly, Every 6 months or Yearly grouping independently of the overall selected date range.

Retain the selected person/company/population, repository scope, actor filters and exclusions when changing grouping or opening supporting details. Reviewer and approval contributions use their first qualifying credit dates, preserving the once-per-account/PR/metric rule across months and years. This measures credited contributions, not raw comment/review-event volume or the number of currently approved PRs.

Show exact interval boundaries, current/partial-period coverage, known zero and unavailable values. Additive credit totals reconcile with the same full-range report under identical filters, mapping and snapshot; missing coverage must not become a falsely complete total. Company aggregation includes all selected members before paging. Period tables and repository breakdowns offer different views of the same scoped metrics without creating a column per repository. Custom-group timelines follow the later group milestone.

## Contribution metric definitions

This report counts **contributions first credited during a period**. Each account/PR/metric contribution has one credit date across all reporting periods. Current outstanding PRs and current approvals remain available through the repository pages and are different measures. Repeated activity can update current state without creating additional contribution credit.

| Metric | Actor receiving credit | Period basis | Counting rule |
| --- | --- | --- | --- |
| PRs authored | PR author | PR creation time | One per PR created during the period, including draft PRs. |
| Authored PRs merged | PR author | Merge time | One per authored PR merged into that repository's configured `main` or `master` branch during the period. |
| PR reviewer contributions | Account providing feedback | First qualifying feedback time on that PR | One per account and PR over the PR's lifetime. Credit appears only in the period containing that first qualifying action. |
| Approval contributions | Account giving approval | First approval time on that PR | One per account and PR over the PR's lifetime. Reapproval in a later month or year does not create another credit. |
| Merges performed | GitHub-recorded merge actor | Merge time | One per PR that actor merged into the configured primary branch during the period. |
| Issues authored | Issue author | Issue creation time | One per issue created during the period, excluding PRs. Reopening the issue does not create another authorship credit. |

PR feedback uses the agreed qualifying actions: conversation comments, inline comments, submitted comment reviews, and change requests. An approval alone does not establish feedback participation. Exclude the PR author's own responses from feedback credit, consistent with the existing reviewer definition.

Keep an account's roles independent. The same person can receive feedback, approval, and merge credit on a PR. Do not sum these different metrics into an overall contribution score or infer contribution quality from a count.

### Example attribution

Alice authors a PR, Bob comments and approves it, and Carol merges it:

- Alice receives PR authorship credit and, when it merges, authored-PR-merged credit.
- Bob receives one feedback contribution and one approval contribution in the applicable periods.
- Carol receives one merge-performed credit.

If Alice and Carol are the same person, that account receives both authorship and merge-performed credit in their separate columns. Do not infer the merger from the PR author, last commenter, last approver, or commit author.

Automated merges retain the actor GitHub records. Do not invent a human executor behind an agent or bot. An unavailable merge actor produces an unattributed count or dash as appropriate, not a guessed person.

### Count once, then assign a reporting date

Identify each contribution by **repository + PR/issue identity + account identity + metric**. Month, year, company, group membership, ingestion run, and export are not part of that identity. Use stable record/account identities so a rename or repeated import does not create another contribution.

For feedback and approvals, establish the first qualifying action across the full relevant PR history before applying any date filter. Save or derive one contribution record and its first qualifying timestamp. A later action by that account on that PR does not append another contribution of the same type.

Example for a non-author reviewer on one PR:

| Action | New feedback credit | New approval credit |
| --- | --- | --- |
| First comment in January | 1 in January | 0 |
| More comments in January or February | 0 | 0 |
| First approval in February | 0 | 1 in February |
| Reapprovals in March or a later year | 0 | 0 |
| Combined report covering all those dates | 1 total | 1 total |

Separate contribution types remain separate: the same account can earn one feedback credit and one approval credit on a PR. Two different accounts can each earn one approval credit on that PR. Repeated actions by one account are what must not inflate the counts.

The same contribution cannot fall into two disjoint month buckets. Monthly **contribution-credit counts** reconcile with a combined period when filters, company/group definitions, and data snapshot are the same. Overlapping report windows are not additive. Unique-author headcounts, current-backlog snapshots, and medians are different measures and must not be summed as if they were contribution credits.

Re-imported events and retries must update or reuse the same contribution identity. If verified older history is later found, correct its first-credit date rather than adding a second contribution. Retain data-as-of information so historical corrections are understandable.

First observed is not necessarily first ever. If available history cannot establish the first qualifying date, mark the affected period metric incomplete instead of counting a later observed action as a new first contribution. Filters and grouping must not reset the first-credit date.

### Approval credit versus current approvals

If the first approval was in March, its one approval credit belongs to March even if the PR merges in April or the approval is later dismissed. Reapproval afterward creates no further credit. The separate current-approval metric follows the effective state now, and review-at-merge metrics follow the effective state immediately before merge.

Historical credit requires evidence of an actual approval; do not assume every currently dismissed review was previously an approval. The six core contribution metrics do not count raw events or repeated review rounds. The optional comment-activity columns added on 2026-10-29 use separate posted-comment identities and creation dates; they do not change reviewer or approval credit. Event metadata may still be needed to establish first-credit dates and approval state.

### PR authorship scope

Use the label Authored PRs merged for the landed-work metric. It measures PR authorship, not actual authorship of every changed line. Commit counts and co-author credit remain outside this definition. Optional final-merged-diff file/line volumes are separate measures with the merge-date basis below; they do not claim line-level authorship.

PRs authored is repository-wide. Authored PRs merged and Merges performed use each repository's configured primary branch, as on the existing pages. Feedback and approval contributions use their first qualifying dates and are not silently restricted to PRs opened, still open, or merged in that period.

### Proposed merge-review status extension

Add selectable status-at-merge columns alongside Merges performed, keeping human, Prebid-agent, and bot feedback/approvals separate. Attribute these counts to the recorded merger. Direct pushes outside PR merges are a separate action count attributed to the pusher when known. Preserve the distinction between PR counts and push-event counts in tables and exports. Definitions, historical-data requirements, and proposed cross-page placement are in [Merged PR review status and direct pushes](merge-review-status.md).

## Accounts, companies, and aggregation

Treat a contributor as a GitHub account. Use account identity for attribution and preserve the current display casing of its login/name. Validate login uniqueness case-insensitively. Do not merge separate accounts merely because display names match.

Retain the existing actor categories: human, mapped Prebid agent, and other GitHub-identified bot. Offer an actor-type filter. Initial scope is all account types, visibly labeled, with the ability to save a Humans-only or other selection.

### Repository attribution

All activity remains associated with its repository. The same person can contribute to every selected repository; there is no allocation to a single home repository. Totals across repositories sum the relevant per-repository contributions. Even identical-looking records or copied commits in another repository do not justify removing that repository's activity.

### Company attribution

Look up the company of the actor receiving credit for each metric. A PR author's company receives authorship credit; the reviewer's company receives their feedback/approval credit; the merger's company receives merge credit.

Use the current mapping, labeled **Company attribution: current mapping**. Changing an account's mapped company will regroup its earlier activity in this reporting mode. Historical employer attribution is not claimed.

Keep unmapped accounts visible under **Unmapped company** and in individual contributor results. Do not exclude their activity or guess their company. Mapping aliases and company display names should resolve consistently to the same mapped company.

### Combining contributor metrics

Company and group totals combine the same per-account metrics. For PR authorship and merge execution, an individual PR normally credits one account for each role. For feedback and approvals, more than one account can contribute to the same PR.

Example: Alice and Bob from Company A each approve the same PR for the first time during the selected period. The company has **2 approval contributions across 1 distinct PR**. Repeated approvals by either account add nothing in that period or later periods. Its approval-contribution total must not be labeled 2 unique PRs. A separate PR-coverage metric, if later requested, would count that PR once.

Company/group ranking therefore uses the same contribution units as the individual ranking. Do not silently switch between person/PR contributions, distinct PRs, and raw event counts when grouping changes.

Calculate company totals from every selected member's in-scope activity before ranking companies. Never take only the top individual contributors and then aggregate that truncated list into company totals.

## Inclusion and exclusion

Provide a clear account-selection mode:

- **All accounts:** all accounts eligible under the other report filters.
- **Selected accounts:** choose individuals and/or companies. Company selection expands to its member accounts. Saved-group selection is added only in the post-database group milestone.

Selected accounts form a union. A person selected directly and through their company is still included once in that combined selection. The same union rule applies to overlapping groups when the later group milestone is implemented. An empty Selected accounts selection means no selected accounts, not all accounts.

Allow explicit exclusions that take precedence over all inclusion paths. Scope remains constrained by the repository, timeframe, and actor-type filters. Display the effective selection and exclusions so the report is understandable.

Examples:

- Focus on Alice across selected repositories.
- Show everyone except Alice.
- Show Company A except Alice and Bob.
- Show Company A plus Carol from Company B.
- Show the members of a saved group, excluding a member temporarily for this report.

Excluding an account changes the current report, not its company mapping or stored group membership. Label a company report with active exclusions as filtered so it is not mistaken for the full company's total.

This selection deduplication only prevents including the same account twice in one selected population. All of that account's activity remains independently counted in each repository.

## Custom groups after database integration; saved views in the initial scope

Custom groups are named, explicit lists of GitHub accounts stored in a database, file, or other configured source. The storage choice is an implementation detail. Example names: Release maintainers, Mobile contributors, or Review rotation.

- Groups can span companies and repositories.
- Group definitions are available for reporting under the application's existing access rules. Show their membership clearly.
- Restrict creation, renaming, membership changes, and deletion to designated group editors: initially the user and, if designated, one additional specific person. Being a group member or ordinary report user does not grant editing permission.
- Definitions may be maintained through the configured source initially. An in-app group editor is not required to deliver the reporting pages; if provided, its operations must enforce the same editor permissions.
- A group is independent of company affiliation; changing a company mapping does not rewrite a manually defined group's membership.
- Membership changes affect subsequent reports using that group, including reports over older activity. Label reports with the group definition in use; historical group membership is not implied.
- Nested groups and complex automatic membership rules are not required initially.
- Users can filter, exclude members from their own report, and save personal views without changing the shared group definition.

A **saved view** stores repositories, relative timeframe, metric, grouping, include/exclude selection, actor filters, sorting, and presentation preferences. It differs from a group, which stores membership. Company-based selections in saved views use the current company mapping; manual groups retain their explicit members.

### Overlapping groups

Groups may overlap. In side-by-side group comparisons, the shared person's activity appears in each group to which they belong. Mark overlap and do not present the sum of overlapping groups as an ecosystem total or a partition of 100%.

If groups are instead combined into one selected population, include each member account once before calculating metrics. This preserves fair comparison while avoiding accidental duplicate inclusion.

## Tables and exports

### Ranking table

Show contributor/company/group identity, the separate metric columns, and a link to the focused report. Company information appears alongside individual accounts. Company/group views replace the identity columns as appropriate while retaining the same metric columns. Sorting a metric changes the ranking on that metric only.

Supported metric columns are PRs authored, Authored PRs merged, PR reviewer contributions, Approval contributions, Merges performed, and Issues authored. Keep the actor identity and any relevant company label compact; do not create repository columns or automatically expand a repository subtable underneath every overview row.

Compute rankings across the full selected dataset before pagination. Reuse the 50-row Previous/Next pagination approach. Display zero distinctly from unavailable data. Do not turn incomplete historical coverage into a confident low ranking.

### Zero contributions and incomplete data

Overview row eligibility requires recorded positive activity or account-specific evidence of incomplete data in the selected repositories. A period-wide collection gap remains visible in report coverage and totals without creating a row for every directory account. Contributor/company counts and exports follow the same eligibility rule; company-member rosters and directly opened reports retain their existing purpose. Missing values remain unknown. A globally unavailable overview has no confirmed rows and says **No confirmed contributions to list** alongside its coverage notice; this is distinct from a known-zero period. Empty CSV results remain header-only, without invented account rows or numeric zeros.

Overview rankings normally show accounts with at least one counted contribution across the supported metrics in the selected scope. Hiding a metric column does not change row eligibility. Company/group member tables show all included members by default, including known zero totals, with a **Hide zero totals** filter.

Use language such as No counted contributions in this period rather than claiming a person was inactive: repeat work on an already-credited PR may produce no new contribution credit. Keep incomplete-history rows distinguishable from known zero; the Hide zero totals filter must not silently discard unknown values as zero.

Show which metric or reporting period has incomplete coverage. In either sort direction, place complete values first, then numerically ranked partial subtotals, then missing or not-applicable values. Show this policy beside a sorted metric and include it in export metadata. Missing history is not a confirmed lack of contributions.

### Repository breakdown table

On the focused report, show a row for each selected repository with activity or incomplete metrics within the contributor, company, or group. Omit repository rows that are confirmed zero across all 39 metrics, including optional columns. Make each column sortable and preserve the report's timeframe, actor filters, and exclusions. Keep known zero distinct from missing data; a repository with no activity must not look like unavailable reporting.

Compute company/group totals from all selected members before sorting or pagination. Keep each metric in its own column; do not add different contribution roles into a single total. No chart display limit or chart-specific controls are needed.

### Individual, company, or group focus

Selecting an entity opens its focused report and shows:

- Separate metric totals for the selection and period.
- A per-repository table using those same metrics.
- For a company or group, a By contributor / By repository choice, its included members and exclusions, and links to individual contributor reports.
- Lightweight links to supporting PR/issue records or review metadata, preserving the activity type and period.

This is contribution analysis, not an in-app GitHub profile or PR-detail viewer. Actual descriptions, comments, reviews, and code remain on GitHub.

Where a metric spans several repositories, first expose the per-repository breakdown or a metadata-only record list with a repository column. A repository-specific selection can then open the existing repository page with exact actor, role, branch, and first-credit-date filters. Do not restrict a historical contribution drill-down to PRs that remain open now or include a later repeat action as a new credit.

For company feedback/approval totals, several credited people can relate to one PR. Preserve that distinction in the supporting list or show contribution and distinct-PR counts separately; the number of PR rows is not necessarily the contribution total.

### Metric exports

Metric exports are required. The current format is **CSV**, suitable for spreadsheets and reporting tools. One **Export CSV** action opens shared export controls. PDF, PNG and PowerPoint are deferred until after custom groups and the established core milestones; see the [export roadmap](README.md#expanded-export-formats--deferred).

Support exports of:

- The contributor/company/custom-group summary table.
- The repository breakdown, with one row per reported entity and repository and the same metric columns.

Use a flat export structure for repository breakdowns: entity type/identity, repository, and metric columns. Repeat the entity identity on each repository row. Do not force 17–20 repositories into separate CSV columns. A company/group member-table export uses one row per included contributor, preserving the enclosing report's filters.

Export the **full filtered result**, not just the current 50-row page. Apply the same repository selection, timeframe, grouping, included/excluded accounts, actor filters, metric definitions, and sorting as the report. Explicit exclusions remain excluded from both summary and breakdown exports.

Include the metric columns selected for export and enough identity information to distinguish contributors, companies, groups, and repositories. Include report context such as resolved date boundaries, timezone, company-attribution mode, active filters/exclusions, first-credit counting basis, and data as-of time so a filtered company report cannot be mistaken for its full total. Exact metadata packaging is an implementation/design detail.

Export numeric metrics as numbers. Keep known zero as zero and represent unavailable metrics as blank with availability information; do not convert missing data to zero. Use the same underlying data snapshot and company/group definitions for the exported rows and totals.

The 50-row limit applies to the on-screen table, not the export. Large exports must use bounded data retrieval or server-generated output rather than loading all source activity into the browser. Export summaries and record metadata only; descriptions, comment text, review bodies, and diffs remain outside scope.

## Initial defaults

- Group results by Contributor.
- Use the saved repository selection for this report, or all repositories on first use.
- Timeframe: This year to date, with the existing agreed timeframe presets available.
- Rank by Authored PRs merged.
- Table: 50 rows per page, with a sortable repository breakdown table. Account type is a default identity column; the six core metrics remain visible and the 33 optional activity/volume metrics start hidden.
- Export: full filtered results as CSV, with summary and repository-breakdown options.
- Include all actor types with an explicit filter and saved preference.
- Current company mapping, visibly labeled.
- Shareable filter URLs take precedence over saved defaults.

These are the agreed starting defaults for visual review. Refinements can be made at that checkpoint without reopening the contribution definitions or adding custom groups to the initial scope.

## Sources and limits

- GitHub exposes the recorded PR merger as `mergedBy` and its merge time as `mergedAt`: [Pull request fields](https://docs.github.com/en/graphql/reference/pulls).
- Submitted reviews carry an actor, state, and submission timestamp: [GitHub review API](https://docs.github.com/en/rest/pulls/reviews). Historical approval activity needs evidence of its original action; a current state alone may be insufficient.
- The repository's mapping processor at main commit `fba4d04b588a01149df2c8b5bd8a02f55a709cc2`, checked during this discussion, emits one company per account without effective-date ranges: [mapping processor](https://github.com/prebid/repo-activity-dashboard/blob/fba4d04b588a01149df2c8b5bd8a02f55a709cc2/src/scripts/processGithubMapping.ts). The actual mapping file has not been inspected in this planning pass. Current-mapping attribution was independently selected by the user.

This proposal defines the desired report, not proof that the existing ingestion pipeline contains every necessary actor or historical event. Fixture-based design can proceed with explicit coverage metadata. Do not fabricate missing historical activity as zero.

## Representative examples to validate during design

- One PR with different author, feedback provider, approver, and merger.
- One person performs several roles on the same PR: roles remain separate.
- Repeated comments and reapprovals on one PR across multiple months or years create only one lifetime credit per account and metric, attributed to its first qualifying date.
- Monthly contribution-credit counts reconcile with the combined period under identical filters, current company/group definitions, and data snapshot.
- Re-importing the same activity or renaming an account creates no new contribution; discovering an earlier qualifying event corrects the existing credit date.
- Incomplete early history is not mistaken for a first-ever contribution in a later reporting month.
- Two company members approve one PR: two approval contributions, one covered PR.
- One person contributes in several repositories: every repository's activity remains present.
- An excluded person belongs to both a selected company and group: exclusion still wins.
- Two compared groups overlap; a combined population includes shared members once.
- Changing grouping retains filters and underlying contribution totals in the same metric units.
- An account changes mapped company: historical activity is regrouped under current mapping with the chosen attribution mode visible.
- An unmapped contributor and a mapped agent remain visible in the appropriate scopes.
- More than 100 contributors or records, and a company total that includes contributors outside the visible contributor page.
- Export more than 100 matching results while the UI displays one page; retain all filters, exclusions, grouping, metric definitions, and repository attribution.
- Summary and repository-breakdown exports preserve their respective row meanings, and missing metrics are not exported as zero.
- Missing historical approval or merger evidence is distinguished from known zero.
- An issue-only author appears in reports through Issues authored; reopening the issue creates no new authorship credit.
- A group member with zero counted contributions remains visible in the member list, while incomplete metrics are not silently hidden as zero.
- An ordinary report user can filter a group without editing its membership; only designated group editors can modify the definition.



## Shared interaction and data boundaries

- Server-rendered reports include actual rows. Controls wait for hydration; navigation never substitutes a blank preference-loading screen.
- Explicit URL scope wins over saved preferences. Only fields changed by the user update personal defaults. Sorting and columns are saved per viewer, scenario and table kind; exclusions remain part of population scope.
- Nested links carry bounded, self-contained return history. Reloading or opening a link in a new tab retains its immediate parent and filters. If a link cannot represent its scope safely, show the limit instead of silently broadening the report.
- Reports carry one active row collection. Supporting details and metadata-only account choices are separate; account/company pickers search and page at 50 choices. Sparse prepared metrics are aggregated before table pagination without materializing every account/repository combination.
- Table rendering and exports share filtering and stable ordering. Both aggregate CSV layouts use one producer with selected value, coverage, reason and counting-basis columns. Stable entity/repository identities and scope metadata remain automatic. Optional identity display fields respect export choices.
- One Export CSV dialog owns current-table and repository layouts. Its initial columns mirror the table; export changes never mutate table columns. Cancellation, timeout and errors are shared. Downloads include the full filtered population, regardless of the visible page.
- Column menus and CSV choices share grouped sections: Identity, Pull requests, Reviews and approvals, Issues, Comment activity, and three role-volume groups with Files and Lines subsections. Required identities and partially selected groups are explicit.
- Account and CSV dialogs share one scrollable frame: header/actions remain visible, choices scroll within a labelled keyboard-focusable region. Route errors use the shared page-error component; no contribution-specific loading screen is promised.

Saved-view and editing safety: the main Contributions link only embeds cached scope that can be checked from the enabled repository catalog and preset definitions. Account/company references and custom ranges use validated restoration on entry. A definitively invalid saved view is discarded only if it still matches the checked value, with a visible recovery notice; transient validation failures retain it. Explicit incoming URLs remain authoritative.

Selected-only pickers snapshot their membership until the filter or search changes; checkboxes and selected counts remain live so unchecking can be undone in place. Paging keeps the last same-source choices visible while loading and prevents repeated paging actions. Rejected report changes show inline feedback and keep the editable draft open; rejected settings do not change the report URL or saved preferences. Return links now compact repeated ID lists inside independent snapshots and remain compatible with older shared links. Parent accounts, exclusions, repositories, periods and presentation survive child edits, reloads and copied links. Overview eligibility now uses account-specific evidence independently of report-wide coverage.
