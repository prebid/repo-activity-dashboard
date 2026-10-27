# All Repositories page — product definition

Status: requirements baseline agreed in the page-planning conversation on 2026-10-24. Layout, visual design, implementation, and database integration follow separately.

## Purpose and scope

Give an account holder a sortable, table-based overview of each selected repository's current backlog, review activity, approvals, recent throughput, and authorship.

Each repository is an independent reporting unit. A person active in three repositories counts independently in each of those repositories. There is no cross-repository deduplication or combined unique-participant total on this page.

The landing page contains the login form. A normal successful login opens All Repos; a login initiated from an application link returns to that view. See the [Login page specification](login.md).

## Page structure

Use two tables, each with one row per selected repository:

1. **Current backlog:** the latest known state, unaffected by the activity timeframe selector.
2. **Activity during selected period:** events and authorship within the selected dates.

Group related columns so users can show the information they need and save their selection. The detailed default layout is a subsequent design task.

## Current backlog table

| Group | Columns | Definition |
| --- | --- | --- |
| PR backlog | Draft PRs; Open non-draft PRs; Total open PRs | Current open PRs. Total open PRs equals drafts plus non-drafts. |
| Issue backlog | Open issues | Current open issues, excluding PRs. |
| Aging | Open >N days | Open non-draft PRs whose time since creation exceeds the chosen threshold. |
| Human review participation | 0 reviewers; 1 reviewer; 2 reviewers | Number of open non-draft PRs with exactly that many distinct non-author humans who commented, left inline comments, or requested changes. An approval alone does not qualify. |
| Current human approvals | 0 approvals; 1 approval; 2 approvals | Number of open non-draft PRs with exactly that many distinct current human approvers. |
| Agent coverage | PRs with Prebid agent feedback | Open non-draft PRs with qualifying feedback from a mapped Prebid agent account. |
| Bot coverage | PRs with bot feedback | Open non-draft PRs with qualifying feedback from a GitHub-identified bot, excluding mapped Prebid agents. |
| Latest activity | Last: Prebid agent; Last: bot; Last: Prebid reviewer; Last: contributor | Number of open non-draft PRs in each latest-activity category. |

All values are observed counts. There are no configured reviewer targets, first/second-review waiting columns, review-request counts, inferred approval deficits, or merge-readiness decisions.

### Aging

- Threshold options: 30, 60, 90, 120, 180, and 360 days.
- Default: 30 days.
- Save the selected threshold per account.
- Include the threshold in the column heading.
- This is age since creation, not time since last activity.

### Human review participation

Qualifying feedback includes a PR conversation comment, an inline comment, a submitted comment review, or a submitted request for changes. Count each non-author human account once per PR across all these feedback types. Unsubmitted feedback does not qualify.

An approval action alone does not qualify someone as a human reviewer for this metric. If the same person also provides qualifying comments or requests changes, count that person once as a reviewer and independently evaluate their current approval. The two metrics can include the same person, but neither is calculated from the other.

Examples, for one non-author human account on a PR:

| Activity | Human reviewers | Current human approvals |
| --- | --- | --- |
| Comments or requests changes, with no current approval | 1 | 0 |
| Approves, with no qualifying comments or change requests | 0 | 1 |
| Comments and has a current approval | 1 | 1 |
| Leaves multiple comments and repeatedly approves, with an approval still current | 1 | 1 |

The author's own replies do not contribute another reviewer. Agents and bots have separate coverage columns.

Participation describes who has provided qualifying feedback over the PR's lifetime. A new push does not erase that participation. Current approval state is measured separately.

The summary has only the requested 0, 1, and 2 columns; no default 3+ column. These are exact counts, not a data constraint. If an open PR unexpectedly has more than two reviewers or approvers, preserve its actual count for drill-down and identify that exception; do not clamp it to two or discard it. Do not assume these three buckets exhaust all possible source data.

### Current human approvals

Count each human approver at most once per PR using their effective current approval state. Repeated approvals by the same person are not additional approvers. A historical approval that has been dismissed or superseded must not remain counted as current.

Use GitHub's reported review state and applicable approval semantics. Do not reset all approvals merely because a new commit or review request exists. Current approval counts are not a claim that merge requirements are satisfied.

GitHub can dismiss stale approvals or require approval of the most recent changes while retaining earlier approvals. These behaviors are distinct. Source: [GitHub protected-branch approval rules](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches#require-pull-request-reviews-before-merging).

If current approval state cannot be established from available data, show a dash rather than a historical approval total presented as current.

## Actor classification

Apply classification in this order:

1. **Prebid agent:** the account is explicitly identified in the mapping file. This takes precedence over GitHub's bot classification.
2. **Bot:** GitHub identifies the account as a bot and it is not mapped as a Prebid agent.
3. **Human:** neither of the above applies and sufficient identity data is available.

Do not infer agent identity from comment wording or collapse Prebid agents into the bot category. The specific agent identity will be supplied in the mapping file. Unknown identity data remains unknown.

For latest-activity reporting, humans are further classified relative to the PR:

- **Contributor:** the PR author. This takes precedence when the author is also a Prebid reviewer.
- **Prebid reviewer:** a human identified by the existing reviewer mapping who is not the PR author.
- **Other:** an identifiable human who fits neither role. Preserve this category, with an optional column or drill-down, rather than assigning that person to a false role.

Agents and bots retain their automation category even when they authored the PR. These categories classify the acting account; they do not infer whether a human used AI assistance.

### Latest activity

Use the latest attributable qualifying event, including:

- PR conversation comments and inline comments;
- submitted reviews;
- code pushes to the PR branch.

PR creation supplies the initial actor when no later qualifying activity exists. Title edits, label changes, reviewer-request changes, and routine check updates do not change this classification.

Each PR contributes to one latest-activity category. Identify the actor of the event itself; a timestamp or commit author alone must not be treated as proof of who performed a push. Where history or attribution is incomplete, preserve that uncertainty and use a dash for a metric that cannot be established.

Latest activity describes who acted most recently. It does not infer whose turn it is or who is blocking progress.

## Activity during selected period

| Group | Column | Definition |
| --- | --- | --- |
| PR activity | PRs opened | PRs created during the period, regardless of their current status. Includes draft PR creation without a historical draft breakdown. |
| PR activity | PRs merged | PRs merged into the repository's configured primary branch (`main` or `master`) during the period, including PRs created earlier. |
| Issue activity | Issues opened | Issues created during the period, excluding PRs. |
| Issue activity | Issues closed | Issues with a closure during the period, regardless of closure reason. Count each issue once within the period; reopening does not erase the fact it was closed. |
| Authorship | Unique PR authors | Distinct accounts that created PRs in this repository during the period. Includes human, bot, and agent authors. |
| Authorship | Unique issue authors | Distinct accounts that created issues in this repository during the period. Includes human, bot, and agent authors. |
| Agent contributions | Prebid agent feedback contributions | One credit per mapped agent account and PR, assigned to its first qualifying feedback date. Repeated actions never create new credits in later periods. |
| Agent contributions | Prebid agent approval contributions | One credit per mapped agent account and PR, assigned to its first approval date. |
| Bot contributions | Bot feedback contributions | One credit per other GitHub-identified bot account and PR, assigned to its first qualifying feedback date. |
| Bot contributions | Bot approval contributions | One credit per other GitHub-identified bot account and PR, assigned to its first approval date. |
| Duration | Median time to merge | Median creation-to-merge duration among PRs merged into the repository's configured primary branch (`main` or `master`) during the period. |

The PR-opened metric is repository-wide; merged PRs and merge durations concern the configured primary branch for that repository. Support both `main` and `master`, with one resolved reporting branch per repository. Show the branch name in supporting detail and preserve it when drilling into records. Do not combine merges into other branches with primary-branch merges.

Each author counts once per repository and period. A commenter is not included in authorship merely for commenting. There is no unique reviewer, bot, agent, or combined participant headcount. Unique-author headcounts are distinct-account counts for the selected period; do not sum monthly headcounts into a yearly unique-author count. This is different from the additive, first-dated contribution credits below.

PRs opened and PRs merged can include the same PR. Do not add them into an ambiguous total-activity number. There is no lifetime total-PR metric.

### Coverage versus contribution credits

Coverage counts PRs, with at most one contribution per PR to each actor category. A PR can have both agent and bot coverage. Repeated feedback does not inflate either coverage count.

Agent and bot period metrics use the same once-per-account, once-per-PR, once-per-metric contribution rule as [Contributors](contributors.md). Feedback and approvals remain separate. Determine each credit's first qualifying timestamp across the PR's history before selecting the reporting period. Repeated comments or approvals, including those in later months or years, create no additional credits. These metrics replace the earlier raw-submission-count proposal.

A coverage count and a contribution-credit count have different units. Two bots can each receive one feedback credit on the same PR, while that PR contributes only one to bot coverage. Raw event history may support state calculations, but raw comment or repeated-review totals are not report metrics.

### Median time to merge

Use elapsed time from creation to merge. Include only PRs merged into the repository's configured primary branch (`main` or `master`) during the selected period. Show the sample size in supporting detail. An empty sample displays a dash.

The median limits the effect of a few unusually old merged PRs. It excludes still-open PRs; the backlog aging metric covers those separately.

### Proposed merge-review status extension

The activity table may expose optional counts of primary-branch PR merges by their human, Prebid-agent, and bot feedback/approval state at merge time. Direct pushes outside PR merges are counted separately. These historical states must not be inferred from current approvals or missing data. See [Merged PR review status and direct pushes](merge-review-status.md) for the proposed shared definitions and placement.

## Timeframes and change display

Presets:

- This week; last week.
- This month; last month.
- This year to date.
- Last year to the same date.
- Last full year.
- Custom date range.

Defaults: Monday-start weeks and a shared UTC reporting timezone. Display the exact selected dates and reporting timezone. Current periods run through the reporting as-of time. Historical selections never change the current-backlog table.

Offer an optional, saved **Show change** setting within the activity table:

- Keep the selected-period value primary; show its absolute difference as secondary text.
- Completed periods compare with the preceding equivalent period.
- Incomplete week/month periods compare with an equivalent elapsed portion of the preceding period.
- Year-to-date compares with the matching calendar range in the preceding year.
- Custom ranges compare with the immediately preceding equal-duration range by default.
- Show exact comparison dates and the prior value in supporting detail.
- Use neutral directional indicators; increased activity is not inherently good or bad.
- A zero baseline is valid for an absolute difference. Do not display an infinite percentage.
- Missing comparison data displays a dash. Historical draft comparisons are out of scope.

Optional PR/issue backlog-change columns may show the total open count at period end minus the total open count at period start when trustworthy history exists. Do not substitute opened-minus-closed, because reopenings and repeated transitions can differ from those distinct-item counts. This does not require historical draft breakdowns.

## Filtering, sorting, preferences, and drill-down

- Searchable repository multi-select with select-all and clear-selection actions.
- The repository selection applies to both tables.
- Every numeric column supports ascending and descending sorting.
- Preserve separate sort settings for the two tables.
- Save selected repositories, visible columns/groups, sorting, timeframe, aging threshold, and Show change preference per account.
- Save relative timeframe choices as relative choices: This month remains This month on a later visit.
- Use a single top-level Repos navigation item with an expandable list containing All Repos and the individual repository links.
- Selecting a repository name opens its repository page in the default Current open scope: the first page of open PRs including drafts and open issues, newest-created first by default, with at most 100 rows per list. Older matching records remain accessible through pagination. Selecting a metric count preserves that metric's specific filters with the same page-size limit; summary counts continue to cover the full matching set.
- Clicking a count opens the repository-specific page with the relevant list prefiltered to the same repository, metric definition, branch scope, and period or current-backlog scope. PR and issue lists are the primary views. Supporting author/reviewer/approver and contribution-credit lists, where needed, contain only identity, count, and top-level record metadata; they do not require separate workspaces or display discussion content. Preserve the distinction between counts of people, records, and contributions. Selecting a PR or issue opens the actual record on GitHub. See [Repository page draft](repository-detail.md).
- Display data freshness and distinguish complete, partial, and missing data.
- Show **0** for a known zero and **—** for a value that is unavailable or not applicable. Supporting text can explain the dash.
- Show a clear state when no repositories are selected or filters yield no results.

## Explicit exclusions

- PRs closed without merging.
- Issue labels and closure-reason breakdowns on this All Repos summary page. Tags/labels are included in the scope of repository-level PR and issue lists.
- Historical draft counts and lifetime PR totals.
- Review-request metrics, expected-reviewer configuration, waiting-for-reviewer predictions, and inferred merge readiness.
- Cross-repository unique-person totals or allocating a person to only one repository.
- Unique automation-account headcounts and commenters counted as authors.

## Inputs needed when connecting real data

- The Prebid agent account identity in the mapping file.
- The existing Prebid human reviewer mapping, confirmed to be available.
- The configured primary branch for each repository: `main` or `master`.
- Event history sufficient for current approval state, latest-activity attribution, first qualifying contribution dates, and any enabled historical backlog changes.

These inputs do not block fixture-based design. Fixtures must distinguish known zero from missing data and must not imply a future database capability has been verified.

## Representative fixture scenarios

- A normal repository with drafts, non-drafts, issues, and 0/1/2 reviewer and approval counts.
- One human leaving multiple inline comments, a conversation comment, and repeated approvals: one reviewer and at most one current approval.
- One human approving without qualifying comments or change requests: zero reviewers and one current approval.
- One human commenting or requesting changes without a current approval: one reviewer and zero current approvals.
- The same author active in two repositories: counted once in each repository.
- A mapped Prebid agent also identified by GitHub as a bot: classified only as a Prebid agent.
- Agent and bot feedback on the same PR: both coverage counts include the PR; latest activity has only one actor category.
- A contributor pushing code after reviewer feedback: latest activity changes to the contributor.
- A human comments and approves, then the approval is dismissed: the reviewer count remains one and the current approval count becomes zero.
- Known zero, partial data, missing event history, and no merged PRs for the median.
- An unexpectedly higher reviewer/approval count: retain the real value rather than forcing it into the 2 bucket.

No application behavior has been implemented or verified by this document.
