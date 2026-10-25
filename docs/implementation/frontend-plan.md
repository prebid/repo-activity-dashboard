# Frontend implementation plan

Prepared on 2026-10-24 from the [product definitions](../product/README.md). This is a preparation and delivery plan, not a record of completed implementation. The quality foundation remains the first engineering deliverable. The user then wants to settle the frontend visually and interactively with mock numbers and records before building the new data layer or connecting a database. Ready-to-display sample values are sufficient; a simulated reporting backend is not a prerequisite.

## Verified starting point

- On 2026-10-25, the actual application source and repository history were fetched into this workspace from https://github.com/prebid/repo-activity-dashboard.git. The working branch is `codex/quality-foundation`, starting at `fba4d04b588a01149df2c8b5bd8a02f55a709cc2`, equal to the fetched `origin/main` and the audited source.
- All 28 pre-existing planning/mock/evidence files were backed up and verified byte-for-byte after checkout. They remain uncommitted additions. The 994 tracked source files have no local changes from the imported commit.
- GitHub `prebid/repo-activity-dashboard` main was rechecked at `fba4d04b588a01149df2c8b5bd8a02f55a709cc2` during preparation.
- Its package manifest declares Next.js, React, Tailwind, Radix-based local UI components, Recharts, TypeScript, Zod, Vitest, and MSW. Keep this stack as the starting point; exact dependency alignment and updates require checking the actual checkout.
- The manifest provides Vitest scripts but no lint or typecheck script. TypeScript strict mode is already enabled in its configuration.
- The current prebuild script runs S3 mapping synchronization. A frontend-only fixture build must be decoupled from that reporting-data setup.
- The [2026-10-24 source audit](source-audit-2026-10-24.md) verified the pinned archive, installed its locked dependencies with lifecycle scripts disabled, and ran source typechecking, existing tests, a credential-free build, and stylesheet probes in an isolated temporary copy. New frontend implementation and visual/browser checks have not begun in the working project.
- Keep **AWS Amplify hosting**, as confirmed by the user during the audit. The candidate target is documented Next.js 15 support with Node 24; upgrading to Next.js 16 is not part of the current plan.

Sources: [package manifest](https://github.com/prebid/repo-activity-dashboard/blob/fba4d04b588a01149df2c8b5bd8a02f55a709cc2/package.json), [TypeScript configuration](https://github.com/prebid/repo-activity-dashboard/blob/fba4d04b588a01149df2c8b5bd8a02f55a709cc2/tsconfig.json), [UI configuration](https://github.com/prebid/repo-activity-dashboard/blob/fba4d04b588a01149df2c8b5bd8a02f55a709cc2/components.json).

## Preserve, refactor, disconnect

Follow the [source-grounded architecture blueprint](frontend-architecture.md) for component responsibilities, extension points, styling, state ownership, test scope, and migration slices. It incorporates the user's requirement to keep adding features without duplicating page logic.

| Area | Direction |
| --- | --- |
| Next.js and React | Retain as the application foundation. A framework migration is not part of this work. |
| Tailwind and existing UI primitives | Reuse suitable primitives, theme support, and styling conventions. Inspect and adapt them to the new table-heavy layouts. |
| Recharts | Retain for repository-page graphs. No contributor/company charts or chart builder. |
| Existing authentication approach | Preserve it. A clearly isolated fixture session can support frontend development without changing production authentication behavior. |
| Page composition | Extract feature containers, reusable table/filter/state components, and explicit routing/filter state. |
| Reporting inputs | Replace component imports of storage JSON, direct storage fetches, and embedded aggregation with a typed reporting boundary. |
| Ingestion/storage scripts | Disconnect them from frontend development and fixture builds first; remove obsolete reporting code only after its consumers are migrated. |
| Agent execution | Leave deferred. Tracking UI must work without a launcher. |

Inspect shared dependencies before removing packages: AWS dependencies may also serve authentication. Separating reporting storage does not authorize an authentication rewrite or removal of unrelated services.

### Data-layer removal sequence

The [frontend-only cutover plan](frontend-only-cutover.md) is the concrete execution plan for reaching the quality foundation with the old reporting data layer removed. Its completion criteria distinguish reporting removal from the retained authentication integration.

Start the quality foundation with the source intact. During mock frontend setup, disconnect reporting synchronization from development/build commands and replace storage-specific page inputs with typed sample values. This separation is early foundation work; it does not require implementing a fake database or maintaining the old reporting behavior in the new views.

Remove old code in the same reviewable changes that retire its final consumers. Candidates include generated reporting JSON, published raw store copies, old aggregation helpers, and ingestion/sync scripts. Before deleting a candidate, check page imports, route handlers, package scripts, build/deployment configuration, and tests. Do not leave abandoned reporting code until the end merely because cleanup was described as later.

Retain the authentication code and any libraries it still uses while removing reporting dependencies. Retire obsolete ingestion tests with their intentionally removed behavior and record their disposition; preserve or adapt tests for behavior that remains. Keep the existing five integration failures visible until that decision is made. Verify the mock build and affected frontend checks after each removal.

## Quality foundation comes first

The [quality foundation](quality-foundation.md) defines the standards, commands, test responsibilities, and evidence needed before feature development. It is a standalone deliverable, not a subtask bundled into the first page or a cleanup phase after all pages exist.

Establish formatting, linting, strict types, test discovery, browser-test infrastructure, local/CI entry points, and a reporting-independent build first. Exercise those tools on actual selected source and bootstrap checks. The [acceptance matrix](acceptance-matrix.md) records the planned behavior checks; unimplemented page tests are explicitly planned, not claimed as passing.

Quality then continues through every milestone: typed display inputs and representative states accompany mock data; interaction and browser tests accompany each page. Full historical attribution, ingestion, and database correctness checks accompany the later data-layer work. The initial gate installs and verifies the means of checking the work. It cannot prove features that do not exist yet.

## Delivery sequence

| Stage | Work | Exit condition |
| --- | --- | --- |
| Prerequisite: establish the checkout | Preserve these documents; obtain the actual source checkout and repository instructions; record its head and baseline commands/results. Work in an implementation branch with the normal `codex/` prefix. | Source and planning documents coexist without overwritten work. This is setup, not a feature milestone. |
| 1. Quality foundation, upgrades, and reporting cutover | Use the recorded baseline; upgrade compatible package groups; replace existing reporting consumers with minimal typed mock-backed views; retire the old reporting layer; finalize tooling, styling checks, CI, and isolation. Follow the [cutover plan](frontend-only-cutover.md). | Chosen dependencies and checks are verified for the implemented scope; old reporting code/artifacts are removed; pending full page/product cases remain visibly planned. |
| 2. Expand display scenarios | Extend the foundation's minimal sample inputs into all needed page scenarios: table rows, numbers, graph points, and loading/empty/error/partial variants. Keep data in separate modules. | Page-design scenarios render without a database, API server, event processor, or reporting engine. Visible totals are coherent. |
| 3. Page and shared-component design | Prepare each page's layout, default columns, table density, controls, state behavior, and representative content using the defined scenarios. Specify shared components and their responsibilities. | Every page has a reviewable design and state specification; key navigation and reporting flows can be walked through before feature implementation. |
| 4. First feature flow | Implement login-return behavior, All Repos -> selected count -> filtered repository PR/issue list, saved preferences, pagination, and repository graphs. | The feature acceptance flow below works and passes its relevant checks. Review the implementation against the prepared designs. |
| 5. Contribution reports | Implement Contributors/Companies/Groups overviews, focused reports, repository rows, shared selection rules, and CSV exports. Groups load from configured definitions; a group editor is not required initially. | Individual/company/group reports and full filtered exports reconcile and pass their applicable acceptance cases. |
| 6. Agent/bot tracking | Implement catalog, recorded runs, historical GitHub activity, model/harness fields, filtered run lists, and available output/log links. | Recorded runs and GitHub-only activity remain distinct; repeated runs remain separate; applicable checks pass without execution controls. |
| 7. Visual and interaction baseline | Review every page and its important states with the user, save representative screenshots, and lock the agreed layout, component behavior, and displayed field meanings. | The frontend can be exercised with mocks; baseline checks pass for that scope. Data-layer acceptance cases remain separately planned. |
| Later: build and connect real reporting | Build the reporting/data layer and database integration behind the agreed display inputs. Implement historical attribution and source reconciliation; connect real preferences/access and run metadata. | Real adapters satisfy the agreed meanings and availability behavior; repeat visual and interaction checks to catch changes. |
| Last: agent launching | Revisit the [deferred launch notes](../product/agent-launching-deferred.md) against the actual existing agents and supported repositories. | Defined and verified separately; not a dependency of frontend delivery. |

Work in small reviewable changes. Preserve existing source until its replacement is wired and checked. Fix compatibility or build blockers when encountered; do not combine unrelated framework/library migrations with every page change.

## Prepare the designs before page implementation

Keep the defined metric meanings available during design, but start with their prepared outputs. For example, supply a current approval count directly instead of implementing approval-history reconstruction to draw its cell. The detailed reference examples remain useful for later reporting tests. Completing that reporting engine is not a gate on visual development.

Then prepare a design specification for each page: layout, default and optional columns, sort/filter behavior, active scope, supporting drill-down placement, export controls where applicable, and loading/empty/error/partial-data states. Specify the shared navigation, typography/spacing, table density, and reusable table/filter components. Keep charts confined to repository pages.

Use the small reference data to walk through exact totals and links; use 20 repositories, 834 issues, and 250 contributors to review scale. Inspect desktop and narrower layouts with long titles, many tags, known zeros, missing values, and active filters. Decide repository graph defaults and initial visible columns in this preparation phase, then verify and refine them in the working app.

Document shared component responsibilities before building them. For example, the table presents rows and emits sorting/pagination choices; the report layer owns query semantics and complete matching totals. The page composes these pieces instead of owning storage access and counting logic.

The architecture recommends Storybook for shared components and composed feature-view states using the same mocks as the app. Keep the catalog focused on useful variations; it complements actual route/browser tests and does not replace them.

## Small display-data boundary now; reporting implementation later

Use simple TypeScript input types for table rows, metric values, graph points, pagination metadata, and UI states as those components are built. Pass prepared values into presentational components. A small page-level loader can return the local example data; it does not need an HTTP endpoint, repository abstraction, query language, or mock database.

Keep fake values outside JSX and component logic. Local sorting, filtering, paging, and exporting of complete sample rows are sufficient to exercise interactions. Prepared responses can demonstrate loading, errors, missing history, and different timeframes. Clearly scope any unfinished drill-down to its mock scenario instead of showing a misleading unrelated list.

The starter [All Repos display data](../../design/mocks/all-repositories.json) contains fixed numbers for layout exploration. It is separate from the detailed historical reference world and makes no claim to be a fully implemented query provider.

The eventual reporting integration must supply the following information. Defining what the UI needs does not require choosing database tables or implementing these calculations now:

- Repository summaries: current backlog and selected-period metrics with clear date scope.
- PR/issue lists: filters, sort, bounded page, full matching count, availability, and as-of metadata.
- Repository graph summaries: aggregates over the full matching set, independent of the currently loaded page.
- Contribution reports: grouping, repository/date scope, account inclusion/exclusion, actor category, first-credit semantics, and current company/group mapping context.
- Exports: the same report query without the on-screen page limit, preserving metric units and context.
- Agent/bot catalog, recorded runs, and historical GitHub activity: distinguish available run evidence from account activity and expose unknown fields honestly.
- Account preferences and fixture session context, kept separate from reporting metrics.

Use TypeScript types and runtime validation at external data boundaries. Keep real numbers, including zero, distinct from unavailable values plus their availability metadata. Keep dates, IDs, metric names, filters, and sort keys explicit.

The UI consumes reporting results. It should not retrieve all GitHub events to calculate global rankings, current approvals, merge-time state, or first lifetime contribution dates inside page components. Those are reporting-service responsibilities. Fixtures model their outputs and query semantics now; the future backend must implement the same meanings.

Reuse the same named samples in development and UI tests. MSW remains an option when actual request flows need interception; it is not required to show fixed numbers in a component. When an HTTP or server-rendered path is introduced, verify its mock actually covers that path. Source: [MSW documentation](https://mswjs.io/docs/).

Require the same core semantics from fixture and future real-data adapters, including filter-before-pagination behavior. Do not scatter independent hardcoded arrays across screens or silently turn a failed real-data request into plausible fake results.

## Example data with known answers

A fixture is a named, repeatable set of invented data with expected results. For visual work, use ready-to-display numbers and records. The [test-data plan](test-data-plan.md) preserves detailed historical examples for later reporting validation; implementing all of that history is not required to begin visual work. Simple mocks still need realistic lengths, density, known-zero/missing distinctions, and consistent totals where the user follows a link.

| Scenario | What it exercises |
| --- | --- |
| 20 repositories, including `main` and `master` | Navigation, repository filters, fixed metric columns, and repository rows. |
| One repository with over 800 open issues and more than 100 PRs | Bounded pagination, full-result search/sort, totals, and graph aggregates. |
| Repeated comments and approvals across several months | One lifetime credit per account/PR/metric with the first qualifying date; current approval state remains separate. |
| Different PR author, feedback provider, approver, and merger | Correct role attribution and company rollups. |
| Two people from one company approve one PR | Two approval contributions versus one covered PR, with correctly labeled drill-downs. |
| Current company mapping, unmapped accounts, overlapping groups, exclusions | Membership/selection semantics and complete company totals before ranking. |
| Zero-contribution members and incomplete history | Visible zero versus dash; no false ranking from missing data. |
| Human, Prebid-agent, and bot activity | Independent classifications and feedback/approval fields. |
| Multiple runs of the same agent/model on one PR | Separate operational run records without extra contribution credits. |
| GitHub activity without runtime correlation | Historical activity is not invented as a fully recorded run. |
| Merge-time review states and unclassified direct pushes | Historical fields, distinct units, and explicit unavailable data. |
| Loading, error, partial data, no selected repositories, and no matches | Deliberate frontend states instead of misleading zero-filled screens. |

Use an explicit fixture mode. If a fake signed-in account is used to review login-return flows and saved preferences, isolate it to development/test/authorized preview behavior; production authentication must not be relaxed. Agent tracking fixtures do not invoke execution services or display deployment controls.

## First feature milestone acceptance

After the quality foundation, lightweight display mocks, and page-design preparation, the first feature milestone is **All Repos -> filtered repository lists**. This is the fourth delivery stage, not the first engineering deliverable.

It is ready when:

1. The fixture app starts and builds without reporting credentials or external reporting services.
2. All Repos shows coherent backlog and selected-period data for the 20-repository fixture.
3. Repository selection and sorting work, with visible scope and appropriate saved presentation preferences.
4. A summary count opens the correct repository list with the corresponding state, actor/metric, date basis, and other filters preserved.
5. An unfiltered repository visit starts with the newest open items; each list displays at most 100 rows and can reach older matching records.
6. Search and sorting use all matching items. Graphs and total counts remain independent of the loaded page, and graph selections reconcile with the filtered list.
7. PR/issue titles open the correct GitHub records; their bodies and comment threads are not reproduced in the app.
8. Back navigation and explicit filtered URLs retain context. Fixture login-return behavior preserves an intended view.
9. Known zero, unavailable data, loading, empty, and error states are distinct and usable.
10. Relevant lint/type/build/unit/browser checks pass, and a visual review confirms the table remains usable with large backlogs and long labels.

After reviewing this milestone, reuse its working patterns for contribution tables/exports and agent tracking. Do not broaden the test matrix repeatedly without a changed risk or unresolved failure.

## Remaining design choices

Initial visible columns, exact table density, supporting list placement, and repository-graph defaults belong to the upfront design work. Existing recommendations are working inputs; record the selected behavior before implementing each page and refine it from concrete design reviews.

Actual editor/operator account IDs, data refresh schedules, database schemas, complete historical run/event availability, and launch integration are later integration inputs. They do not prevent frontend work against explicit fixture contracts.

## What visually locked means

Before the new reporting/data layer begins, review and record the following for each page:

- Navigation, content hierarchy, component placement, spacing, typography, and supported theme behavior.
- Default and optional columns, widths, numeric formatting, sorting, filters, table density, and narrow-screen/overflow behavior.
- Click destinations, URL/filter context, paging, saved preference behavior, and export interactions where applicable.
- Normal, busy, empty, loading, error, partial-data, known-zero, and missing-value states, including long names/titles and large numbers.
- Repository graph types, labels, scope, and textual alternatives; table-only contribution and tracking reports.
- Representative screenshots at agreed viewport sizes and interaction checks that establish the reviewed baseline.

User review establishes the visual baseline; screenshots do not approve themselves. Repeat those checks during integration. The goal is to preserve the agreed frontend while replacing its data source. Mocks cannot prove real-data completeness or performance, so any integration-discovered mismatch must be identified and resolved explicitly rather than silently changing a screen's meaning.

## Immediate next work

The source audit, baseline, and working checkout are established. Implement the compatible toolchain and repaired Tailwind/component foundation from the [architecture blueprint](frontend-architecture.md#delivery-slices), separating mock frontend development from reporting dependencies early. Verify candidate versions as a set. The next feature/design focus remains All Repos using prepared mock values; the new data layer/database comes after the visual baseline.

The source checkout, audit-copy dependency checks, and planning/evidence updates are complete. No upgrades, data-layer deletion, or frontend feature implementation have been applied to the working project yet.
