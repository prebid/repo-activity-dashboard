# Product planning index

The functional vision is ready for visual frontend work using mock numbers and records, with the quality foundation first. Settle layouts and interactions across the pages before building the new reporting/data layer or connecting a database. Lightweight typed display inputs are enough for this phase; full historical calculation fixtures remain later verification work. The linked definitions capture agreed behavior; fields explicitly marked as recommendations remain design choices to resolve during design.

## Page definitions

| Area | Definition | First frontend scope |
| --- | --- | --- |
| Login | [Login](login.md) | Existing sign-in approach; normal login returns to All Repos, explicit links return to their original context. |
| Repository summary | [All Repos](all-repositories.md) | Current backlog and period tables, repository selection, sorting, saved preferences, and filtered navigation. |
| Individual repository | [Repository page](repository-detail.md) | Metadata-only PR/issue lists, 100-row pagination, repository graphs, and links to actual GitHub records. |
| Contributors, companies, groups | [Contributions](contributors.md) | Tables, focused reports with repository rows, inclusion/exclusion, configured group membership, and full filtered exports. |
| Agent/bot tracking | [Agents & bots](agents-and-bots.md) | Catalog, GitHub activity, recorded run history, model/harness metadata, results, and source links. |
| Historical merge status | [Merge review status](merge-review-status.md) | Shared definitions for human/agent/bot state at merge and separate direct-push records; fixtures explicitly represent unknown historical coverage. |
| Agent launching | [Deferred launch notes](agent-launching-deferred.md) | Deferred until after tracking and its integration. No launch/cancel/retry UI in the first frontend delivery. |

## Rules shared across pages

- Each repository retains its own activity and attribution. A person is not assigned to a single home repository.
- PR authorship, feedback, approvals, and merge execution remain separate metrics.
- Contribution credit is once per account/PR/metric over the PR's lifetime, dated to the first qualifying action. Current approval state and state at merge are separate measures.
- Humans, mapped Prebid agents, and other bots remain distinguishable. Model, harness, agent definition, and GitHub account are separate identities.
- Company reports use the current mapping, visibly labeled. Group definitions are maintained by designated editors; personal report exclusions do not alter them.
- Metric columns remain fixed in width; repositories become rows on focused reports.
- Pagination limits displayed records to 100 per page. Counts, repository graphs, sorting, search, and exports use the full matching set.
- Charts belong on repository pages. Contributor/company/group reports use tables and exports.
- PR/issue records open on GitHub. Their descriptions, comment bodies, review text, and diffs are not reproduced in reporting views.
- Unknown/incomplete values are distinct from known zero. Historical GitHub activity is not automatically a fully recorded agent run.
- Tracking comes before launching. Execution controls and detailed deployment policy do not block frontend design.

## Delivery planning

- [Foundation and frontend-only cutover](../implementation/frontend-only-cutover.md): concrete next changes, reporting/data removal map, authentication boundary, and completion criteria.
- [Tracked repository catalog](../../design/mocks/repository-catalog.ts): the complete user-supplied list of 18 repositories, with verified identities and branches; application wiring is pending.
- [Source audit and upgrade assessment](../implementation/source-audit-2026-10-24.md): confirmed Tailwind/configuration issues, baseline results, compatibility candidates, and limits; Amplify retained.
- [Frontend architecture blueprint](../implementation/frontend-architecture.md): component ownership, typed display inputs, shared tables, extensibility, testing, and implementation slices.
- [Quality foundation](../implementation/quality-foundation.md): the first engineering deliverable, required checks, and what passing each check establishes.
- [Starter All Repos display data](../../design/mocks/all-repositories.json): invented ready-to-display values for layout work, separate from real reporting logic.
- [Example-data and fixture plan](../implementation/test-data-plan.md): concrete reference records, large datasets, expected answers, and missing/error states.
- [Acceptance matrix](../implementation/acceptance-matrix.md): product rules linked to scenarios and planned verification.
- [Frontend implementation plan](../implementation/frontend-plan.md): source baseline, preservation decisions, preparation stages, and subsequent feature delivery.

The existing source was checked in an isolated audit copy; its results are linked above. New frontend implementation and its planned acceptance cases remain pending.
