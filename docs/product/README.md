# Product planning index

Settle layouts and interactions across the pages with prepared sample data before building the replacement reporting layer or connecting its database. Lightweight typed display inputs are enough for this phase; full historical calculation fixtures remain later verification work. The linked definitions capture agreed behavior; fields explicitly marked as recommendations remain design choices to resolve during design.

## Page definitions

| Area | Definition | First frontend scope |
| --- | --- | --- |
| Login | [Login](login.md) | Centered Prebid sign-in and password setup, shared Light/Dark/System controls, and preserved return context. |
| Repository summary | [All Repos](all-repositories.md) | Current backlog and period tables, repository selection, sorting, saved preferences, and filtered navigation. |
| Individual repository | [Repository page](repository-detail.md) | Metadata-only PR/issue lists, 50-row pagination, repository graphs, and links to actual GitHub records. |
| Contributors, companies, groups | [Contributions](contributors.md) | Tables, focused reports with repository rows, inclusion/exclusion, configured group membership, and full filtered exports. |
| Agent/bot tracking | [Agents & bots](agents-and-bots.md) | Catalog, GitHub activity, recorded run history, model/harness metadata, results, and source links. |
| Historical merge status | [Merge review status](merge-review-status.md) | Shared definitions for human/agent/bot state at merge and separate direct-push records; fixtures explicitly represent unknown historical coverage. |
| Agent launching | [Deferred launch notes](agent-launching-deferred.md) | Deferred until after tracking and its integration. No launch/cancel/retry UI in the first frontend delivery. |

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
