# Merged PR review status and direct pushes — proposed extension

Status: tracking merges without feedback/approval and changes made directly to the primary branch was requested on 2026-10-24. Separate human, Prebid-agent, and bot categories were explicitly confirmed. Placement, column defaults, and the proposed direct-push counting unit below remain recommendations. No implementation or historical data coverage has been verified.

## Purpose and placement

Expose the review and approval state of PRs when they entered the repository's configured primary branch (`main` or `master`), and separately report primary-branch updates made outside a PR merge.

Recommended placement uses the existing reporting areas:

- **All Repos:** optional activity-period columns showing the corresponding counts per repository.
- **Repository page:** filters and compact status fields on merged-PR rows; a lightweight list of direct-push metadata when that metric is selected.
- **Contributions:** optional columns alongside Merges performed, with the same company/group aggregation and exports.

No new top-level navigation area is proposed. These are observed counts and states, not inferred waiting states or policy-violation judgments.

## Three independent actor categories

Use the existing account classification: mapped Prebid agents first, other GitHub-identified bots second, and humans separately. Keep feedback and approvals independent within every category.

| Category | Feedback at merge | Approvals at merge |
| --- | --- | --- |
| Humans | Distinct non-author humans who had provided qualifying feedback before merge. | Distinct humans with an effective approval immediately before merge. |
| Prebid agents | Whether a mapped Prebid agent had provided qualifying feedback before merge. | Whether a mapped Prebid agent had an effective approval immediately before merge. |
| Bots | Whether another bot had provided qualifying feedback before merge. | Whether another bot had an effective approval immediately before merge. |

Agent/bot fields are coverage indicators, not new unique-automation-account headcounts. Historical human counts are not capped at two; the existing 0/1/2 summary columns apply to the previously defined open-PR views.

Qualifying feedback follows the agreed comment/inline-comment/change-request definition. Approval alone does not establish feedback. The PR author's own responses do not count as independent feedback, regardless of actor category. An actor who both comments and approves can contribute to both independent measures.

An agent or bot action does not substitute for a human action. For example, a PR may have zero human feedback, zero human approvals, agent feedback present, agent approval present, and no bot activity. Preserve that full state rather than labeling it simply reviewed or unreviewed.

## Time basis

Select PRs by their merge timestamp within the requested reporting period and primary-branch scope. Determine feedback and approval state from the full relevant history before each merge, even when the feedback occurred before the reporting period.

- Later comments or approvals do not change the classification at merge.
- A previously given approval that was no longer effective at merge does not count as approval at merge.
- A dismissal after merge does not retrospectively erase an approval that was effective at merge.
- Repeated approvals from the same human count as at most one effective approval at that point.
- Use known review/dismissal state and applicable GitHub semantics; do not assume every new commit or review request resets all approvals.

This is separate from both current approval state on an open PR and the lifetime-once approval credits whose first-approval date falls in a reporting period. A repeated approval can affect state at merge without creating another contribution credit.

## Counts and filters

Support independent presence/absence filters and selectable count columns for human feedback, human approvals, Prebid-agent feedback, Prebid-agent approvals, bot feedback, and bot approvals at merge.

Examples:

- Merged with no human approvals.
- Merged with no human feedback.
- Merged with agent feedback but no human approval.
- Merged with bot feedback but no Prebid-agent feedback.
- Merged with neither feedback nor approvals from any of the three categories.

The last example is a combined absence filter over six separate states, not a replacement for them. A PR with an approval but no comments has no qualifying feedback but is not classified as having neither feedback nor approval.

Presence/absence counts overlap. A PR can have feedback from several categories, or lack both human feedback and human approval. Do not add these columns together into an overall merge total. Any percentage must name its denominator and disclose unclassified history rather than assuming unknown means zero.

## Attribution to contributors, companies, and groups

Attribute merge-status counts to the GitHub-recorded merger, consistently with Merges performed. A PR author is not automatically the person who performed the merge. An author's report may expose the status of their authored PRs as a separately labeled view without converting that into merge-execution credit.

Roll up by the merger's current company mapping or selected custom groups, preserving the existing inclusion/exclusion and overlapping-group rules. Keep the merge actor's category independent of the categories that supplied feedback and approvals.

## Direct pushes outside a PR merge

Use the separate label **Direct pushes to primary branch (outside PR merges)**. A direct push can introduce several commits and might have no PR record. It is not a PR with zero reviewers, and it is not evidence that no review happened elsewhere.

Recommended counting unit: one confirmed primary-branch push/update event outside a PR merge. Show the number of introduced commits as supporting metadata rather than counting each commit as another PR or push. Branch creation/deletion or a ref update introducing no new code should not silently count as a code-delivery event; preserve them separately if relevant.

Deduplicate repeated ingestion of the same push event. Different confirmed direct pushes remain separate actions because they do not share a PR contribution identity; do not collapse every push by an account into one lifetime account/branch count.

Attribute the action to the recorded pusher/actor when established. Commit author and committer identity alone do not establish who performed the push. If the actor is unknown, retain repository-level evidence and leave contributor attribution unknown.

Do not count the branch update produced by a normal PR merge as a separate direct push. A commit with no returned PR association is only a candidate for investigation; an empty or incomplete association lookup does not prove a direct push. Correlate trustworthy push/ref-update history with PR merge history, accounting for merge methods and automation. Leave ambiguous cases unclassified.

The proposed repository list contains only top-level metadata: repository/branch, timestamp, recorded actor and category, commit count, and a GitHub commit or comparison link. It follows the same 100-row pagination and metadata-only display boundary as the other lists. There is no fabricated PR title, PR number, approval count, or PR-review status for an event without a PR.

## Data completeness and exports

Historical absence requires sufficiently complete history. Missing feedback, approval, dismissal, push, or actor evidence must not be presented as a confirmed zero or a confirmed bypass. Use a dash and supporting coverage information for unestablished values, consistent with the existing reporting rules.

This feature can be designed with explicit fixtures before real historical coverage is available. Do not claim historical backfill is complete or reliable merely because GitHub exposes relevant event types.

Exports preserve each actor category, the feedback/approval distinction, merge-time basis, attribution, and known/unknown state. PR merge rows and direct-push rows have different units and must be identifiable as such.

## Source grounding

- GitHub supports review dismissal and different stale-approval policies: [protected branch settings](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches#require-pull-request-reviews-before-merging).
- Review-dismissal events expose timing and previous review state: [pull request event reference](https://docs.github.com/en/graphql/reference/pulls#reviewdismissedevent).
- Push payloads expose the updated ref, before/after commits, commit information, and actor-related metadata: [push events](https://docs.github.com/en/webhooks/webhook-events-and-payloads#push).
- Commit-to-PR associations are a separate data surface: [commit fields](https://docs.github.com/en/graphql/reference/commits#commit). Their availability does not by itself prove historical absence or actor attribution.

## Representative cases

- Approval-only PR: feedback absent, approval present in that actor category.
- Agent-only feedback/approval: human fields remain zero; agent fields remain present.
- Bot feedback does not become Prebid-agent feedback.
- Feedback before the reporting period but before merge still counts toward the merge-time state.
- An approval dismissed before merge versus after merge produces the appropriate different historical classifications.
- Later comments cannot turn a merge with no prior feedback into a reviewed-at-merge PR.
- A normal PR merge's push event is not double-counted as a direct push.
- A direct push with several commits is one push event; unavailable pusher identity does not get replaced by the commit author.
- An empty PR-association lookup or missing review history produces an unknown state, not a confirmed absence.
