# Execution plan: quality foundation and reporting-data removal

Prepared 2026-10-25 from the checked-out source at `fba4d04b588a01149df2c8b5bd8a02f55a709cc2`, the [audit](source-audit-2026-10-24.md), and the [frontend architecture](frontend-architecture.md). Working branch: `codex/quality-foundation`. This is the execution specification. The local milestone is implemented and verified; see [status and evidence](quality-foundation-status.md). Hosted CI and live integrations remain unexecuted.

## Outcome of this milestone

Deliver a maintained, testable frontend project that runs on local prepared data, has a compatible upgraded toolchain, produces correct Tailwind styles, and contains **no old repository-reporting ingestion/storage implementation**.

The milestone includes enough mock-backed route and component behavior to exercise the foundation. It does not claim that every planned page has its final design or complete product behavior. Detailed visual development follows on this base.

### Meaning of “no data layer”

Remove the old GitHub fetch/sync pipeline, generated statistics, raw store files, mapping synchronization, filesystem-backed repository discovery, and historical reporting calculations embedded in page components.

Retain simple typed display models, the 18-repository catalog, fixed sample records, and local helpers needed for mock interactions. Those are frontend inputs; they do not simulate a database, replay GitHub history, or implement production reporting.

The previously agreed login behavior remains. Its current DynamoDB-backed account/whitelist integration is a separate retained server concern, not part of the reporting removal. Mock development/tests use a controlled viewer/session and require no connection to that integration. Thus the exact claim is **no legacy reporting data layer and no live-service requirement for mock frontend work**, rather than no database-related code anywhere.

A literal removal of account storage/authentication would change the earlier [login decision](../product/login.md) and is not implied by retiring reporting.

## Existing coupling that determines the cutover

These are source observations, not guesses about the future database:

- `src/app/page.tsx`, `src/app/contributors/page.tsx`, and `src/app/companies/page.tsx` import the generated contributor timeline and perform reporting calculations.
- Companies additionally imports `public/store/sheets/github-mapping.json`.
- Repository detail imports `src/lib/repoData.ts`, which fetches raw PR/issue/sync-state files and aggregates them.
- `src/app/api/repos/route.ts` discovers repositories by reading the store directory.
- `package.json` runs S3 synchronization in `prebuild` and retains ingestion CLI commands.
- `amplify.yml` syncs mapping data, copies store files into public, and checks for generated data artifacts.
- `src/lib/aws/clients.ts` mixes S3 and DynamoDB clients. Authentication uses the DynamoDB client; S3 cannot be removed by deleting that entire file.
- `src/lib/auth/users.ts` and the setup route use uuid. Removing ingestion does not make uuid automatically unused.
- The existing three test files, their fixtures, and global setup target the outgoing validation/storage/sync implementation.

The source and baseline results are already recorded. Repeat baseline checks only if source, environment, or unresolved failures justify it.

## Small reviewable changes, in order

| Change | What it delivers | Completion evidence |
| --- | --- | --- |
| 1. Preserve the starting point and define required checks | Capture the planning/catalog work on the feature branch, retain the audit evidence, and register frontend versus legacy check scope. Establish meaningful type/test/build commands without disguising known failures. | Recoverable source/planning baseline; commands have named inputs and honest results. No required empty suite counts as passing. |
| 2. Compatible runtime and core toolchain | Verify the audit's candidate Node, Next/React/types, compiler, and quality-tool versions against Amplify and their peers. Upgrade related packages together. Introduce lint/format/type boundaries early. | Locked installation without force/legacy-peer-deps; actual selected source/config/test files checked; explicit disposition of inherited failures. |
| 3. Mock-backed route cutover and reporting removal | Supply prepared display models to the existing reporting routes; remove their raw-data imports and calculations. Promote the 18-repository catalog to the application's single source. Remove reporting scripts, artifacts, endpoints, tests, and unused dependencies once their final consumers are replaced. Update build/deployment configuration in the same working slice. | Existing reporting routes render useful sample views; no old reporting imports, /store requests, sync commands, or raw store publishing remain. Mock build/start works without reporting credentials. |
| 4. Styling and reusable component foundation | Complete Tailwind v4, normalize tokens/primitives/theme handling, introduce shared table/control parts and catalog stories, and finish component/browser checks. Upgrade adopted UI/chart packages before visual approval. | Standard utilities and semantic tokens render correctly; keyboard and light/dark states work; shared parts render independently from server auth/storage. |
| 5. Clean-checkout verification and handoff | Run required checks using the pinned toolchain, exercise the production-built mock app, verify isolation and absence of retired code, and wire identical commands into CI. | Reproducible local results, machine-readable test output, reviewed representative renders, and explicit CI status. Final page designs and real-data integration remain separate milestones. |

Changes 2–4 can contain smaller cohesive commits. Do not fix outgoing ingestion solely to make an intermediate upgrade look green. If an old dependency blocks an upgrade, perform its verified mock cutover/removal first rather than forcing package resolution or spending time modernizing code scheduled for deletion.

“Remove incrementally” means replace a consumer and delete its obsolete implementation together. It does not mean retaining an unused legacy directory indefinitely.

## Removal and preservation map

| Current area | Required action and replacement |
| --- | --- |
| `src/services/` GitHub fetcher, data fetcher, queue, rate limiter, storage service | Remove after all reporting consumers are cut over. No live GitHub collection belongs in this frontend milestone. |
| `src/scripts/` reporting/mapping/sync/validation scripts; `src/index.ts`; `src/generateStats.ts` | Retire the ingestion CLI and reporting generation. New quality commands live separately and must not invoke these scripts. |
| Root `fetch-merged-prebid.js`, `sync-all-repos-merged.js`, `sync-prebid-clean.js` | Remove with their package/documentation references. |
| `src/lib/repoData.ts` | Replace with prepared feature display inputs; do not hide its historical aggregation inside a renamed mock provider. |
| `src/validation/` and `src/types/index.ts`, `src/types/storage.ts` | Remove ingestion-specific schemas/types after references are replaced. New frontend models are small and typed around the agreed display semantics. Retain useful validation as new frontend contracts only where needed. |
| `src/types/repo.ts` and old repository-specific widgets | Replace stale reviewer/request-oriented models when their views are migrated. Shared semantic UI primitives can remain. |
| `src/config/repositories.ts` and root `repos.json` | Consolidate into one application catalog seeded from the complete 18-entry TypeScript catalog. Preserve stable IDs and existing slugs. |
| `src/app/api/repos/route.ts` | Remove filesystem discovery. Prefer direct catalog input for this phase; if an API consumer remains, serve the same catalog rather than create a second list. |
| `store/`, `public/store/`, `contributor-repo-timeline.json`, `contributor-stats.json`, `repo-stats.json` | Remove tracked reporting/mapping artifacts after the consuming views and build steps are replaced. Retain deliberate, clearly named synthetic UI samples. |
| `package.json` / lockfile | Remove ingestion scripts and packages with no remaining consumers. Re-resolve the lockfile and verify the retained dependency set. |
| `amplify.yml` | Retain Amplify hosting; remove reporting synchronization, store copying, generated-data checks, and forced installs. Use the pinned runtime and deterministic installation/build commands. |
| `src/lib/aws/clients.ts` | Separate retained authentication DynamoDB support from removable S3/reporting code. Check dynamic imports as well as static imports. |
| `src/lib/auth/`, auth/admin routes and viewer behavior | Preserve the chosen production login functionality behind server-only boundaries. Supply an explicit controlled session for mock development. Fix import-time configuration coupling as needed for independent mock builds. |
| `next.config.mjs` and health/debug routes | Remove inappropriate secret embedding and reporting-specific probes/config. A mock frontend health/smoke path must not query live storage. Retained authentication diagnostics remain separately scoped. |
| Legacy tests/setup/mocks | Retire only alongside the intentionally removed behavior; record the 46-case baseline and its disposition. Build fresh tests for actual retained/new frontend behavior. |
| Documentation and environment examples | Replace active ingestion setup instructions with frontend/mock commands. Preserve audit evidence and product decisions as historical/project documentation, not executable runtime inputs. |

Package pruning candidates include Octokit, reporting S3 packages, CSV parsing, and CLI-only tooling. This list is not a blind uninstall command. DynamoDB libraries, bcrypt, uuid, and NextAuth currently have authentication consumers. A package stays only if its retained/new use is explicit. Zod and MSW may serve the new checks, but installed presence alone is not justification to keep unused machinery.

## Minimal mock-backed application

Supply local values through a narrow composition boundary. Presentational components accept values and callbacks; they do not choose their own dataset or import server modules.

The cutover must cover every current route that consumes reporting data, so removal does not leave broken pages. These can initially be simple, functional views using the new field meanings. Do not preserve obsolete contributor charts or old reviewer semantics merely to avoid changing their route files. Final spacing, table density, optional columns, and detailed page layouts are reviewed during the later design work.

The foundation should demonstrate:

- The real 18-repository catalog in navigation/selection.
- At least one complete sample-backed table flow with sorting/filtering and bounded paging.
- Explicit known zero, unavailable, empty, loading, and error/retry states.
- A repeatable repository-detail sample and links back to the relevant scope.
- A controlled viewer/session that allows login-return and preference behavior to be tested without account storage.
- At least two views or stories composing the shared table/control pieces, to check that reuse works in practice.

Mock data supports the interactions under test. Do not invent a general server/query engine to support every possible historical request. Prepared scenarios and straightforward local operations are sufficient.

## Authentication isolation

Keep production sign-in behind an explicit server boundary. Presentation code receives a small viewer model and sign-in/sign-out actions. Mock composition supplies controlled identities and results.

The mock path must not import live AWS clients or eagerly evaluate required production secrets. Production configuration should be validated at the boundary that actually requires it. Mock login/session behavior must remain explicit and must not become a fallback when real authentication fails.

Tests should verify that mock startup/rendering makes no account-storage or reporting calls, and that production configuration cannot silently select mock authentication. This is a bounded separation task, not a new identity-provider project.

## Required checks and truthful status

Use compatible tools already selected in the [audit](source-audit-2026-10-24.md), with versions confirmed during installation. Keep one documented entry point for the required frontend checks and smaller commands for development.

| Check | What must actually be proved |
| --- | --- |
| Formatting and lint | Maintained source, tests, and tool configuration are selected; React rules, accessible markup, and import boundaries apply to the new code. |
| Types | App, tests, sample data, and configuration are checked. No “passes” obtained by excluding problematic new folders or substituting any. |
| Unit/component | Deterministic helper results and observable interactions, including missing values and the actual shared controls. |
| Style/browser | Compiled utilities produce expected computed styles; adopted primitives work with keyboard and both themes. |
| Route/build | Production-built mock app starts and representative routes work without GitHub/reporting/account-service credentials. |
| Isolation | Unexpected real reporting/account-service requests fail tests. Presentation imports do not pull in server/storage modules. |
| Removal | Tracked runtime source, package scripts/dependencies, build configuration, and generated output no longer reference or contain the retired reporting implementation/artifacts. Audit documents are excluded from runtime checks, not silently deleted. |
| CI | The same commands are configured on appropriate changes, with actual hosted execution reported separately from local success. |

Known existing ingestion failures stay visible until their tests and implementation are intentionally removed. Once removed, document that those old tests no longer describe a supported component. Do not skip retained failing behavior or claim that deleting tests improved correctness.

## Definition of done

This milestone is complete only when:

1. Compatible dependency versions and the runtime are recorded and reproducibly install from the lockfile.
2. The selected formatting, linting, app/test/tool typechecks, and meaningful frontend tests run successfully.
3. The mock application builds and starts without live service credentials.
4. Existing reporting routes have sample-backed replacements, and the 18-repository catalog has one application owner.
5. The old reporting code, generated/raw data, sync commands, and orphaned dependencies have been removed from the active project.
6. Retained authentication is isolated and mock operation cannot silently replace production authentication.
7. Tailwind utilities/tokens and representative controls have browser-level verification.
8. CI configuration matches local commands; hosted execution, if not yet run, is explicitly outstanding rather than reported as passed.
9. The resulting project is ready for deliberate page-by-page visual design, with unfinished product behaviors clearly recorded.

Database selection/schema, ingestion reconstruction, historical metric calculations, agent launching, and final page appearance are outside this milestone. Those decisions do not block this execution plan.

