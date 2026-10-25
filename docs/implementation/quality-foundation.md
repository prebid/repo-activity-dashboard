# Quality foundation — before feature implementation

Status: first foundation implementation locally verified on 2026-10-25; hardening and independent review pending. See [implementation status and evidence](quality-foundation-status.md) for exact scope, dependency decisions, and results. Hosted CI, live authentication/deployment, and final product-page acceptance remain separate.

The [readiness assessment](foundation-review-readiness.md) supersedes any implication that local passing checks alone complete this foundation. Layout work is on hold until the hardening/review gate is satisfied.

## Purpose

Define how we will know the application satisfies the product rules before we start implementing pages. The foundation consists of enforceable code standards, clear data contracts, a test plan with known answers, repeatable local/CI commands, and explicit completion criteria.

Obtaining the real source checkout is a mechanical prerequisite to wiring tools, not a competing feature milestone. Quality-tooling setup is the first engineering deliverable. The foundation includes limited mock-backed replacements for existing reporting routes where needed to remove their old data imports and exercise the tools. Those replacements do not establish final page designs or complete product behavior.

The foundation does not require tests for nonexistent pages to pass. It must distinguish **planned**, **implemented but not run**, **passed**, **failed**, and **incomplete** requirements. A future requirement is not covered just because the runner is installed.

The latest delivery decision is visual-first after this foundation. Fixed, typed display values and sample records are enough to build the frontend. The full historical test-data specification and reporting calculations are retained for later data-layer verification; they are not additional prerequisites for drawing and reviewing pages.

The [frontend-only cutover plan](frontend-only-cutover.md) makes removal of the old repository-reporting data layer an explicit completion requirement of this milestone. It defines the source/dependency removal map, minimal mock-backed route cutover, retained authentication boundary, and required checks. The existing DynamoDB-backed login remains separate under the prior login decision; mock frontend work must not contact it.

## Milestone 1: execution order

The quality scope and architecture are defined in the [frontend blueprint](frontend-architecture.md). The source audit establishes concrete issues and candidate upgrade versions. Keep Amplify hosting as the user confirmed. Do not restart product/page discovery or implement the historical reporting engine for this milestone.

Current progress: the working checkout, compatible upgrades, mock reporting cutover, retired data-layer removal, quality tooling, and local verification are complete. The clean-copy run passed 41 unit/component tests, 6 browser tests, both app build modes, and Storybook. The original ingestion baseline is preserved as historical evidence; its retired tests do not count as passing new frontend coverage.

| Step | Work | Reviewable result |
| --- | --- | --- |
| 1A. Source and dependency audit | Audit and working checkout complete. The branch starts at the same audited/fetched head; preserve planning/mock files and refresh the head if implementation starts later. | The [audit report](source-audit-2026-10-24.md) records current versions, checks, gaps, preservation decisions, and candidate versions. Package compatibility still requires application verification. |
| 1B. Minimum baseline | Record locked installation, TypeScript, existing-test, and build results. Add a small meaningful smoke check if needed. Record failures and distinguish missing reporting credentials from code failures. | A reproducible before-upgrade result tied to the source revision and toolchain. Required install/runtime fixes can precede this where the original environment cannot run. |
| 1C. Controlled dependency upgrades | Update compatible groups separately: framework/React/types; compiler and quality tools; necessary UI/chart dependencies. Check the affected behavior after each group. Preserve locally owned UI component changes. | Compatible chosen versions, an updated lockfile, explicit migration changes, and verification results. Avoid upgrading outgoing data-layer dependencies merely for freshness. |
| 1D. Complete quality setup and reporting cutover | Finalize formatting, linting, strict types, unit/component/browser runners, CI entry points, and the independent mock frontend build. Replace reporting consumers, remove the old reporting layer and orphaned dependencies, and isolate retained auth. Follow the concrete cutover plan. | Working checks over real selected source, useful mock-backed routes, no old reporting implementation/artifacts, and shared local/CI commands. CI configuration and an actual hosted CI run are separate results. |
| 1E. Foundation checkpoint | Inspect results and unresolved failures. Confirm the app can be developed against local sample values without the future database/reporting service. | A foundation ready for visual page work, with historical/data-integration checks still explicitly planned. |

Each step should be a small reviewable change or report. Establish enough checks to evaluate upgrades before making them; complete the detailed tooling against the selected versions afterward. Planned UI-library upgrades should finish before the frontend's visual baseline is approved.

## Decisions already made and inputs still needed

| Area | Working decision | Remaining input |
| --- | --- | --- |
| Application stack | Retain TypeScript, React, Next.js, the existing UI/component approach, repository-only charting, and Amplify hosting. | Verify the audit's candidate dependency set in the actual checkout. |
| Type safety | Retain strict checking; type component props, display records, filters, and states. | Actual compiler/configuration compatibility. |
| Formatting and linting | Explicit commands, consistent formatting, relevant React rules, and import boundaries. | Choose compatible configuration against the audited source and target framework. |
| Tests | Reuse suitable existing tests/Vitest; component checks for interactions and Playwright for browser flows. | Resolve or explicitly disposition the five legacy integration failures; add app/test/tool typing and frontend checks. |
| Mock development | Local typed display data; no database or full mock reporting engine prerequisite. | Smallest safe way to isolate the existing app from reporting setup. |
| CI | Run the same required commands as local development and expose failures accurately. | Existing workflow/hosting context and runtime versions. |
| Completion | Check meaningful behavior and actual execution; distinguish planned checks from passed checks. | Recorded baseline and post-upgrade results. |

Technical defaults can be resolved from the audit. User input is needed only if it exposes a material product, hosting, or compatibility tradeoff; routine configuration does not require another page-planning round.

## Quality gates

| Gate | Required check | Evidence and limits |
| --- | --- | --- |
| Formatting | Consistent formatting of maintained source/configuration. | Formatting command runs over the intended files. Formatting does not establish correctness. |
| Linting | Applicable React/Next.js rules, unsafe patterns, and agreed import boundaries. | Real source files are selected; ignore rules do not silently exclude new feature folders. |
| Types | Strict TypeScript and explicit report/domain types. | Type checking passes without weakening strictness or replacing important types with `any`. Types do not establish correct counts. |
| Data contracts | Runtime validation of request/response shapes, IDs, dates, pagination, and value availability. | Valid examples pass and explicit invalid examples are rejected. Missing data cannot become an invented zero. |
| Counting/query behavior | Fixed examples for attribution, first-credit dates, grouping, exclusions, sorting, and pagination. | Results match independently specified answers, not expected values computed by the same implementation under test. |
| Component behavior | Relevant filters, sorting, selection, empty/error states, keyboard controls, and accessible labels. | Tests exercise observable interactions and outcomes; avoid assertions on internal state or CSS implementation. |
| Browser flows | Important end-to-end navigation, preference isolation, pagination, downloads, and GitHub links. | Browser tests exercise the built application using the intended reporting boundary. |
| Build and isolation | Fixture-mode app builds and starts without reporting-service credentials. | No unexpected GitHub/AWS/database/agent-launch requests. Fixture identity does not weaken production authentication. |
| Visual/accessibility review | Dense tables, long labels/titles, focus visibility, narrow screens, and graphs with textual alternatives. | Automated checks plus deliberate visual/keyboard review of representative states. A screenshot alone is not interaction coverage. |
| CI | The same applicable commands run on changes and expose machine-readable results. | Required jobs actually ran, selected expected suites, and reported failures/skips accurately. A missing job is not a pass. |

Use the existing Vitest and MSW foundation and add compatible UI/browser tooling as needed. Playwright is the planned browser runner. Do not introduce a new application framework as a quality prerequisite.

## Registered commands and scope

Registered commands are `format:check`, `lint`, `typecheck`, `check:boundaries`, `test:unit`, `test:components`, `test:e2e`, `build`, and `build:storybook`. `check` combines static/unit/component checks; `check:all` additionally builds the preview and Storybook and runs browser tests. Historical reporting-contract tests remain future work; no empty contracts suite is advertised as passing.

For each command, record its input scope, required environment, expected suite selection, failure behavior, and result artifact. CI should call these commands rather than maintaining separate copies of their logic.

Required cases must not disappear behind skipped tests, `continue-on-error`, absent credentials, or a test selector that selects nothing. Empty collection is a failure/incomplete result for a required suite. Keep relevant existing tests; if a test belongs to functionality deliberately retired with the old data layer, record that disposition instead of silently deleting coverage.

Capture actual baseline failures when the source is checked out. Fix them or explicitly separate their scope before claiming the relevant gate passes. Do not label an infrastructure failure as a product failure or a product pass.

## Data and architecture standards

- Presentational components consume typed display inputs. Page-level sample modules/loaders can supply fixed values now; a real reporting adapter can supply them later. Components do not import legacy storage dumps or fetch all GitHub events for aggregation.
- Reporting availability is explicit. Zero, unknown/incomplete, empty selection, and request failure are different states.
- Stable account/record identities survive display-name changes and repeated ingestion. Dates have an explicit reporting timezone and frozen reference time in tests.
- Filtering/search/sorting precede pagination. Graphs and exports use the full matching set while lists render at most 100 rows.
- The contribution-credit identity excludes month, year, company, group, and ingestion attempt. First credit is established before filtering by date.
- Current approval state, state at merge, and first historical approval credit are separate fields/contracts.
- Report grouping and display-column selection do not silently change the selected population or metric units.
- Fixture mode is explicit. A failed real request must not silently fall back to invented successful data.
- Agent tracking remains read-only in this phase. No launch/cancel/retry connection or execution-policy UI is required.

These boundaries should be enforceable through types, appropriate static import rules, contract tests, and browser request checks. A folder name alone does not enforce them.

## Test-data quality

The [test-data plan](test-data-plan.md) defines three complementary sources:

1. A small, auditable reference dataset with explicit expected answers.
2. Deterministic large datasets for 20 repositories, 800+ issues, 100+ PRs, and 100+ contributors.
3. Named variants for incomplete data, transport errors, empty results, and display stress.

The small reference answers are the independent oracle. A generator or report calculator must not generate both an output and its expected answer using the same logic. The large datasets require explicit count/boundary invariants in addition to reproducible generation.

Local display samples must conform to the component input types. A mock API is optional; if introduced, its responses follow the same display meanings and unsupported queries must not return unrelated defaults. For server-rendered request paths, verify interception actually reaches that path; a browser service worker alone does not prove it does.

Before connecting real ingestion, add authorized sanitized source-response cases and verify mapping against real payloads. Passing synthetic frontend contract cases does not prove GitHub completeness, historical approval reconstruction, or actual database performance.

## Behavioral acceptance coverage

Maintain the [acceptance matrix](acceptance-matrix.md) linking each important product rule to a named scenario, expected answer, check level, and implementation/execution status.

For a page or shared feature to be complete:

- Its applicable acceptance cases exist and actually run.
- Expected identities, totals, scope, and navigation are asserted, including relevant negative cases.
- Pagination tests include a known record outside the first page; an empty response cannot satisfy the test.
- A missing metric, failed request, or unclassified historical state is not presented as zero or a successful empty result.
- Exports contain all matching rows and preserve the same filters, identity, counting basis, and metric units.
- The source revision and toolchain used for verification are recorded, and results are not reused after relevant source changes.

Coverage percentages are diagnostic information. They do not replace these behavior checks, and an arbitrary percentage should not become the main definition of quality.

## Scope of the first engineering deliverable

The quality foundation is ready to support further implementation when:

1. The source checkout and existing instructions have been inspected without losing planning files.
2. Quality commands are wired, documented, and exercised on real selected code/tests.
3. Applicable baseline checks have an explicit result and failures are not hidden.
4. Test discovery and machine-readable results establish that required bootstrap suites actually executed.
5. Local and CI entry points agree on scope; hosted CI execution is reported separately from local execution.
6. The reporting-boundary rules, planned acceptance cases, and test-data specifications are available for implementation.
7. The planned dependency upgrades have been verified or explicitly deferred with a reason; the selected toolchain and lockfile are recorded before visual frontend work proceeds.
8. The reporting cutover's removal checks pass: old ingestion/storage code, data artifacts, build hooks, and orphaned dependencies are retired; retained authentication is separate from credential-free mock operation.

The next step uses lightweight typed display mocks to build and review pages. Check sample shape, meaningful zero/missing distinctions, visible arithmetic, and the interactions actually implemented. Each page adds its own UI tests as it is built. Historical counting/query contracts and real-source validation are later data-layer checks; they must not be presented as passed by a screenshot or fixed sample.

No new page test is claimed to pass before its page exists. Existing-source check results are recorded in the [audit evidence](evidence/2026-10-24/baseline.json); they do not complete the new foundation or establish frontend coverage.
