# Product planning index

Settle layouts and interactions across the pages with prepared sample data before building the replacement reporting layer or connecting its database. Lightweight typed display inputs are enough for this phase; full historical calculation fixtures remain later verification work. The linked definitions capture agreed behavior; fields explicitly marked as recommendations remain design choices to resolve during design.

## Page definitions

| Area | Definition | First frontend scope |
| --- | --- | --- |
| Login | [Login](login.md) | Centered Prebid sign-in and password setup, shared Light/Dark/System controls, and preserved return context. |
| Repository summary | [All Repos](all-repositories.md) | Current backlog and period tables, repository selection, sorting, saved preferences, and filtered navigation. |
| Individual repository | [Repository page](repository-detail.md) | Metadata-only PR/issue lists, 50-row pagination, repository graphs, and links to actual GitHub records. |
| Contributors and companies | [Contributions](contributors.md) | Tables, focused reports with repository rows, individual/company inclusion and exclusions, saved preferences, and full filtered exports. |
| Timeline reporting | [Shared timeline contract](#timeline-reporting) | A continuous date range with selectable calendar grouping; repository charts and contribution/company period tables, with matching drilldowns and exports. |
| Custom groups | [Deferred group requirements](contributors.md#delivery-scope--updated-2026-10-29) | Deferred until real reporting data from the database is integrated; includes group reports, selection and membership management. |
| Agent/bot tracking | [Agents & bots](agents-and-bots.md) | Catalog, GitHub activity, recorded run history, model/harness metadata, results, and source links. |
| Historical merge status | [Merge review status](merge-review-status.md) | Shared definitions for human/agent/bot state at merge and separate direct-push records; fixtures explicitly represent unknown historical coverage. |
| Agent launching | [Deferred launch notes](agent-launching-deferred.md) | Deferred until after tracking and its integration. No launch/cancel/retry UI in the first frontend delivery. |

## Approved delivery sequence

Approved 2026-10-29. This section owns the project sequence; page contracts describe behavior, and implementation/operating documents describe how to deliver and verify it. The foundation, branded login, All Repositories and individual repository pages are merged into `codex/frontend-rebuild` (PRs #2, #3, #6 and #7).

| Order | Milestone | Scope and completion evidence |
| --- | --- | --- |
| 1 | Continue the frontend with fake data | Contributors and Companies are next, with focused reports, individual/company inclusion and exclusions, saved preferences and exports. Then deliver shared timeline reporting, the merge-review/direct-push frontend extension and agent/bot tracking. Use the five-step process below and record the visual baseline for each delivered area. |
| 2 | Deploy the reviewed frontend before database integration | Use the existing internal live site with clearly labeled sample reports and production authentication. Verify actual hosting, sign-in, access and account configuration. A separate staging site is optional. The deployment checkpoint can occur once a reviewed frontend increment is ready; remaining frontend work continues with samples. |
| 3 | Integrate real reporting data incrementally | Connect one report area at a time through the server-side data boundary, preserving its reviewed display models and interactions. Verify counts, date/actor scope, summary-to-detail reconciliation, full-result filters/sorts/charts/exports, 50-row paging, missing-data behavior and access. Retain deterministic samples for design and regression tests. |
| 4 | Add custom groups | Begin after real database data is integrated and validated in the application. Deliver group reporting, selection, membership and designated-editor behavior with their own models, visual review and tests. |
| 5 | Add agent launching as the last core feature | Begin after tracking and its real-source integration are established. Launch only existing configured agents; use the deferred execution contract. |
| 6 | Expanded export formats — deferred follow-up | After custom groups and the core milestones above, evaluate PDF, PNG and PowerPoint through the shared export flow. Not required for current frontend delivery, deployment or database integration. |

Calendar heatmap: optional, low-priority follow-up only after all the planned milestones above are complete and the site is deployed and validated with real database data. It is not a requirement for timeline reporting, database integration or deployment; no heatmap UI, sample generation or dedicated architecture work is required in the current milestones. Revisit it only when prioritized later.

The existing live site has no current users. Temporary downtime or frontend defects during the transition are acceptable; maintaining uninterrupted service is not a project constraint. Authentication, authorization and account-data integrity remain required. Early hosted samples are not evidence of real-data correctness, and missing real data must not silently fall back to invented report values.

Frontend implementation PRs continue to target `codex/frontend-rebuild`. A production release is a separate requested operation with the actual Amplify branch/build settings checked first; merging a feature PR does not itself approve deployment. This roadmap records the order, not a completed deployment or database integration.

## Expanded export formats — deferred

Updated 2026-10-29: PDF, PNG and PowerPoint are planned after custom groups and the established core milestones. This is a later reporting enhancement, not work to start during the current Contributors/Companies handoff. Format-specific libraries, prototypes, document templates and rendering tests are deferred with it. Excel/XLSX is excluded: CSV covers the requested spreadsheet-data workflow.

Current work stays CSV-only: one **Export CSV** action opens shared controls, initially selects the table's visible columns, permits export-only changes and exports all filtered rows in the current sort order. Identity/context and coverage metadata accompany selected values. Alternate row layouts appear within that same dialog only where useful; there is no separate Export options action.

When expanded formats are prioritized, begin with a bounded plan and feasibility samples using the established reporting models. Validate actual output files for row/column/count fidelity, missing-data semantics, long-table pagination, font/asset rendering and browser/build compatibility. Specify image/page scope explicitly and distinguish editable PowerPoint objects from slide images. Keep contributor/company reports table-based; reuse repository charts where applicable. A shared export interface may gain format choices then, without introducing separate page-specific export implementations.

## Timeline reporting

Status: requested on 2026-10-29; every-two-month and every-three-month meanings are confirmed. This extends the current repository activity charts, which automatically use daily or monthly bins, and the existing two-period overview comparison. The broader timeline is planned, not implemented. Deliver it as a frontend increment after core Contributors/Companies and before real reporting integration, using the same five-step process and prepared sample data. Keep the two-period comparison for focused comparisons.

**Range and grouping are independent controls.** The range chooses the whole time window; grouping chooses the size of each consecutive interval within it. For example, the 2025 calendar year grouped by month produces twelve monthly values; changing grouping retains the same overall date range and report filters.

| Grouping label | Calendar alignment |
| --- | --- |
| Daily | UTC calendar day. |
| Weekly | Monday-start UTC week. |
| Monthly | Calendar month. |
| Every 2 months | Jan–Feb, Mar–Apr, May–Jun, Jul–Aug, Sep–Oct, Nov–Dec. |
| Quarterly (3 months) | Jan–Mar, Apr–Jun, Jul–Sep, Oct–Dec. This also covers the requested tri-monthly interval. |
| Half-yearly | Jan–Jun and Jul–Dec. |
| Yearly | Jan–Dec. |

These are consecutive calendar intervals, not overlapping rolling windows. Reuse the reporting range's established UTC boundaries and as-of cutoff. Show partially selected first/last intervals and the unfinished current interval explicitly, including their actual covered dates. A date-boundary event belongs to exactly one interval. Retain known-zero intervals; absent or incomplete coverage remains a dash or visibly partial value.

Recommended presentation follows the existing page decisions:

- Repository pages gain a Timeline view with metric selection, the continuous range/grouping controls, a chart and a matching values table. Keep the current backlog distributions and record-list charts available for their existing uses. Start with a focused metric; distinct units such as counts and durations use separately labeled views.
- Contributors and Companies gain an Over time table for the current person, company or selected population. Rows represent time intervals and columns represent the separate metrics, with existing repository/account/actor filters and exclusions retained. Company totals continue to use the current mapping. Contributor/company charting remains outside the initial scope.
- Reuse the timeline selection/display contract across these views. Exact layout, entry points and defaults are reviewed visually. A calendar-grid/heatmap presentation is an optional, low-priority follow-up after the rest of the plan is complete and the site is deployed with validated real data.
- Selecting a known timeline value opens the matching supporting records/contributions for that interval and metric. Preserve actor role, repository scope, filters, exact covered dates and return context. A contribution count may correspond to several account/PR credits on one PR; do not substitute a distinct-PR count.
- Tables retain 50-row pagination; chart values, sorting and exports represent the full matching result. Exports include interval boundaries, metric identity/unit, coverage and report context. Long ranges must not silently drop intervals or change an explicitly selected grouping.

Temporal meaning remains metric-specific:

| Metric family | Timeline meaning |
| --- | --- |
| PR/issue activity | Group PR creation, primary-branch merge, issue creation or closure by that metric's event timestamp. |
| Contribution/reviewer/approval activity | Use the existing once-per-account/record/metric credit date. Repeated comments or reapprovals in later intervals do not create new credits. |
| Comment activity | Group distinct posted PR, inline and issue comment identities by creation time; edits do not add comments. |
| Role-associated change volume | Use final merged PR diffs for authors, pre-merge reviewers and pre-merge approval contributors, grouped by merge date for every role. Keep the three groups independent; repeated actions do not add volume. |
| Backlog, aging and current approval state | Historical values mean state at the interval's ending cutoff, not today's state repeated into earlier intervals. Real integration requires sufficient historical evidence or snapshots; otherwise show unavailable coverage. |
| Unique authors | Compute distinct accounts for each interval. A whole-range unique count must be recomputed for the whole range, not summed from interval counts. Repository attribution stays independent. |
| Medians or other derived measures | Recompute from the relevant underlying population for each interval and the whole range; do not average or sum interval medians. |

Prepared timeline values and supporting records are sufficient for frontend design. Defining historical snapshot requirements does not require building a history engine now. Real adapters must later validate these meanings and coverage against the database/source history. Custom groups remain a post-database milestone; timeline filters do not introduce them early.

## Five-step frontend delivery process

Use the same review checkpoints that worked for the repository pages. Finish and verify each step before advancing to the next.

| Step | Work | Checkpoint |
| --- | --- | --- |
| 1 | Define typed display models and coherent prepared samples, including large, zero, missing and partial results. Reuse existing contracts and components where they fit. | Contract/sample tests before layouts; do not build real-history calculations or a database adapter in this step. |
| 2 | Build reusable overview and focused-report layouts using the approved Prebid design. | First user visual review in both themes and narrow/desktop layouts. |
| 3 | Add filters, navigation, saved preferences and shared 50-row pagination. | Test state ownership, account isolation, Back/Forward, explicit URLs and full-result filtering; review the interactions visually. |
| 4 | Complete supporting details, drilldowns and exports where applicable. | Details and full filtered exports reconcile with summaries and preserve report context; review the complete flows. |
| 5 | Perform focused self-audit/adversarial review, required quality checks and final visual review. | User visual sign-off, then a draft PR against `codex/frontend-rebuild` with implementation, review notes and test evidence. Address review feedback in focused, tested groups. |

Custom groups are outside the initial frontend steps, including group navigation, group-based filters, configuration, editor permissions and group-specific samples/tests. Personal report filters and saved preferences remain in scope. Remaining layout choices are resolved during the relevant visual checkpoint; settled metric definitions and the fake-data boundary are preserved.

## Rules shared across pages

- The dashboard is internal-only: all reporting pages require sign-in, including Contributors and Companies. The database repository's public visibility does not make dashboard reports public.
- Each repository retains its own activity and attribution. A person is not assigned to a single home repository.
- PR authorship, feedback, approvals, and merge execution remain separate metrics.
- Contribution credit is once per account/PR/metric over the PR's lifetime, dated to the first qualifying action. Current approval state and state at merge are separate measures.
- Humans, mapped Prebid agents, and other bots remain distinguishable. Model, harness, agent definition, and GitHub account are separate identities.
- Company reports use the current mapping, visibly labeled. Group definitions are maintained by designated editors; personal report exclusions do not alter them.
- Metric columns remain fixed in width; repositories become rows on focused reports.
- Pagination limits displayed records to 50 per page. Counts, repository graphs, sorting, search, and exports use the full matching set.
- Charts belong on repository pages. Contributor/company/group reports use tables and exports.
- PR/issue records open on GitHub. Their descriptions, comment bodies, review text, and diffs are not reproduced in reporting views.
- Unknown/incomplete values are distinct from known zero. Historical GitHub activity is not automatically a fully recorded agent run.
- Tracking comes before launching. Execution controls and detailed deployment policy do not block frontend design.

## Maintained implementation references

- [All Repositories implementation plan](../implementation/all-repositories-plan.md): sequenced frontend work, component/state ownership, prepared samples, and acceptance checks.
- [Foundation contracts](../implementation/foundation-contracts.md): component ownership, typed display inputs, table state, authentication boundaries, quality checks and visual-design readiness.
- [Account operations](../implementation/account-operations.md): configuration, provisioning, migration, recovery and release prerequisites for the retained account system.
- [Tracked repository catalog](../../design/mocks/repository-catalog.ts): the user-supplied list of 18 repositories and its metadata provenance.
- [Starter All Repos display data](../../design/mocks/all-repositories.json): invented values for layout work.
- [Test-data specification](../implementation/test-data-plan.md): display scenarios and future reference records for metric verification.
- [Acceptance matrix](../implementation/acceptance-matrix.md): product rules and their planned verification.
