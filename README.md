# Repository Activity Dashboard

A TypeScript/Next.js frontend foundation for repository activity reporting. Reporting uses deterministic sample values while the pages are designed. The previous GitHub ingestion, filesystem storage, and generated reporting datasets have been retired.

Follow the [approved delivery sequence](docs/product/README.md#approved-delivery-sequence): review the frontend with prepared data, deploy the reviewed frontend with clearly labeled samples, integrate real reporting data incrementally, then add custom groups. Agent launching remains the last core feature; calendar heatmaps are a low-priority follow-up after the rest of the plan and validated real-data deployment. The Contributors and Companies increment follows the [five-step delivery process](docs/product/README.md#five-step-frontend-delivery-process); its implementation and review checkpoints are recorded in the [contribution contract](docs/product/contributors.md). The [product definitions](docs/product/README.md), [foundation contracts](docs/implementation/foundation-contracts.md) and [account operations](docs/implementation/account-operations.md) are the maintained references.

## Run locally

```sh
nvm install
nvm use
npm ci
npm run dev
```

Open http://127.0.0.1:3000. Preview accounts are `alice@example.test` and `bob@example.test`, both with password `preview`. They are synthetic identities accepted only by an explicitly built preview.

No GitHub, S3, DynamoDB, or production-auth credentials are needed for preview development or tests. All report values are visibly labeled sample data; the repository catalog contains the 18 real repositories selected for the project.

## Verify

```sh
npx playwright install chromium webkit
npm run check:all
```

`npm run check:all` runs formatting, type-aware lint, app/test/tool types, architecture/removal boundaries, unit/component tests with coverage gates, a full dependency audit, real local account transaction tests, a production-auth build with packaged-server HTTP and Chromium/WebKit account-flow tests, the preview build, Storybook, and Chromium/WebKit browser tests. CI runs those same gates as fast checks, a shared build/production job, parallel browser shards and a final required `quality` gate. Browser tests start the built preview on port **3100** and the built component catalog on **6007**; keep both ports available. `npm run check` runs the static/boundary/coverage checks without builds or browsers. Machine-readable test reports are under `test-results/`; coverage reports are under `coverage/`.

### Development feedback and CI

Use `npm run dev` for hot-reloaded preview work and focused checks while editing, for example `npx vitest run tests/components/data-table.test.tsx`. Run `npm run check` at implementation checkpoints. Browser changes can be checked with an affected spec and one engine after building the preview/Storybook, for example `npx playwright test tests/e2e/repository-page-layout.spec.ts --project=chromium`. Stop a dev server in the same checkout before those builds, or use a separate checkout. Batch related fixes before pushing; every PR still receives the full required coverage.

CI reports the audit, static/unit/coverage and account checks independently of build/production work; these two jobs run concurrently. The build job tests the packaged production server and builds the preview and Storybook once. Browser jobs start only after both jobs succeed. The preview artifact is bound to the checked-out source revision and reused by isolated browser runners. Playwright retains one worker per runner, no retries, and its existing test isolation. Two shards per configured project currently produce four browser jobs. Superseded runs on the same PR cancel automatically.

`scripts/browser-shards.mjs plan 2` collects the complete native Playwright inventory and every proposed shard before emitting the matrix. The final `quality` job requires all prerequisite jobs and verifies that every planned case passed exactly once on the same source revision. Missing/duplicate cases or reports, skips, expected failures, flaky results and wrong-source artifacts fail the gate. New tests enter the plan automatically. Custom project names can set `metadata.ciBrowser` to `chromium`, `webkit` or `firefox`; unknown engines fail planning rather than silently losing coverage.

`frontend-verification` contains the verified browser plan and all shard reports. Core checks, production results, and browser screenshots/traces are retained in the corresponding `frontend-verification-*` artifacts. The [dependency audit disposition](docs/implementation/dependency-audit.md) documents the one approved legacy-package exception. `npm run check:all` remains available as a complete sequential local run.

The account/production integration suites require Java 17+ and download a checksum-pinned DynamoDB Local archive into the ignored development cache. CI installs Java 21. They use synthetic accounts and local service fixtures; no live AWS account configuration is required.

Use `npm run format` for maintained source/config formatting. Product and operating documentation are maintained separately from source formatting.

For interactive component development, use `npm run storybook` on port 6006.

## Build modes and Amplify

- `npm run build` and `npm start` create/run **production authentication**. `build:production`/`start:production` remain explicit aliases.
- `npm run build:preview` and `npm run start:preview` create/run fixed synthetic accounts, bound to loopback by default.
- Start mode must match the recorded build mode.
- Amplify uses `build:production`; the preview launcher refuses an Amplify environment.
- Both modes currently render synthetic reports. Production mode changes authentication, not the reporting source.

Production auth uses the server environment documented in `.env.example` and the hosting runtime's AWS access. Secrets are not embedded through Next's env map. The authentication store is separate from reporting; its real deployment is not exercised by preview tests.

Public first-admin registration is closed. Account provisioning/recovery uses `npm run auth:operator` with explicit targets and private credential files. Existing IDs and hashes are preserved; legacy cookies without an account-revision claim require sign-in again. Legacy temporary credentials without an expiry require reissue. The admin screen supports private delivery and reissue; `DASHBOARD_TEMP_PASSWORD_HOURS` configures future temporary credentials (default 24 hours, range 1–168). Production uses current account/whitelist state and revision checks, transactional account writes, and a runtime Secrets Manager key. See [account operations](docs/implementation/account-operations.md).

## Project structure

- `src/app/`: thin server composition and client screens; protected pages/data reads validate the current viewer independently of layouts.
- `src/features/`: typed feature views.
- `src/components/`: UI primitives, shared table/metric/feedback/chart pieces.
- `src/config/repositories.ts`: the single repository catalog.
- `src/mocks/`: prepared display data, not an ingestion simulator.
- `src/lib/presentation/`: pure formatting/query contracts and preview identity definitions.
- `src/lib/navigation/`: application URL, preference, and debounced-search controllers.
- `src/server/reporting.ts`: authorized sample reads; no real reporting database.
- `src/lib/auth/` and `src/lib/aws/`: retained server account integration.
- `.storybook/`: isolated component states.

The shared table uses TanStack Table v9. The table is controlled and router-independent. Application controllers synchronize query state with Next navigation and keep sort defaults scoped by account and report/repository. Search operates on the entire supplied sample set before pagination. The shared Export CSV dialog starts with visible columns, supports export-only column choices, and includes all matching rows in the current sort order with required identity/context metadata. The table currently consumes a complete sample population. A remote adapter contract will be introduced with its first real consumer. Remaining contribution and tracking views follow the product roadmap. Custom-group UI and membership behavior are deferred until after real database integration.

## Scope and plans

[Product definitions](docs/product/README.md) · [Current contracts](docs/implementation/foundation-contracts.md) · [Test-data strategy](docs/implementation/test-data-plan.md) · [Product acceptance matrix](docs/implementation/acceptance-matrix.md)

All dashboard reporting is internal-only and requires sign-in. Live Amplify/IAM, deployed login throttling, and deployment acceptance remain release prerequisites; local/CI checks do not certify them.

The foundation, login, All Repositories and individual repository pages are merged into the rebuild branch. Reporting remains sample-backed and does not establish historical calculation correctness. The current live site has no users; temporary downtime or frontend defects during transition are acceptable. The early hosted release still requires production authentication and clearly identified samples. Hosting the frontend does not require completed reporting integration.
