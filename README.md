# Repository Activity Dashboard

A TypeScript/Next.js frontend foundation for repository activity reporting. Reporting uses deterministic sample values while the pages are designed. The previous GitHub ingestion, filesystem storage, and generated reporting datasets have been retired.

The foundation implementation is ready for independent review; layout work is on hold. See [the self-audit history](docs/implementation/foundation-self-audit.md), [the execution plan](docs/implementation/foundation-hardening-plan.md) and [tested contracts and limits](docs/implementation/foundation-contracts.md).

## Run locally

```sh
nvm install
nvm use
npm ci
npm run dev
```

Open http://localhost:3000. Preview accounts are `alice@example.test` and `bob@example.test`, both with password `preview`. They are synthetic identities accepted only by an explicitly built preview.

No GitHub, S3, DynamoDB, or production-auth credentials are needed for preview development or tests. All report values are visibly labeled sample data; the repository catalog contains the 18 real repositories selected for the project.

## Verify

```sh
npx playwright install chromium webkit
npm run check:all
```

`npm run check:all` runs formatting, type-aware lint, app/test/tool types, architecture/removal boundaries, unit/component tests with coverage gates, a full dependency audit, real local account transaction tests, a production-auth build and packaged-server HTTP test, the preview build, Storybook, and Chromium/WebKit browser tests. CI runs the same command. Browser tests start the built preview on port **3100** and the built component catalog on **6007**; keep both ports available. `npm run check` runs the static/boundary/coverage checks without builds or browsers. Machine-readable test reports are under `test-results/`; coverage reports are under `coverage/`.

The account/production integration suites require Java 17+ and download a checksum-pinned DynamoDB Local archive into the ignored development cache. CI installs Java 21. They use synthetic accounts and local service fixtures; no live AWS account configuration is required.

Use `npm run format` for maintained source/config formatting. Historical plans/audit artifacts in docs/design are deliberately outside automatic formatting.

For interactive component development, use `npm run storybook` on port 6006.

## Build modes and Amplify

- `npm run build` and `npm start` create/run a **preview** with fixed local accounts.
- `npm run build:production` and `npm run start:production` use the retained real authentication integration.
- Start mode must match the recorded build mode.
- Amplify uses `build:production`; the preview launcher refuses an Amplify environment.
- Both modes currently render synthetic reports. Production mode changes authentication, not the reporting source.

Production auth uses the server environment documented in `.env.example` and the hosting runtime's AWS access. Secrets are not embedded through Next's env map. The authentication store is separate from reporting; its real deployment is not exercised by preview tests.

Public first-admin registration is closed. Account provisioning/recovery uses `npm run auth:operator` with explicit targets and private credential files. Existing accounts are preserved; pre-upgrade sessions sign in again. Production uses current account/whitelist state and revision checks, transactional account writes, and a runtime Secrets Manager key. See [account operations](docs/implementation/account-operations.md).

## Project structure

- `src/app/`: thin route/layout composition; protected routes use a server layout.
- `src/features/`: typed feature views.
- `src/components/`: UI primitives, shared table/metric/feedback/chart pieces.
- `src/config/repositories.ts`: the single repository catalog.
- `src/mocks/`: prepared display data, not an ingestion simulator.
- `src/lib/presentation/`: formatting, URLs, table state, and preview identity definitions.
- `src/lib/auth/` and `src/lib/aws/`: retained server account integration.
- `.storybook/`: isolated component states.

The shared table uses TanStack Table v9. Query state is reflected in the URL; the All Repos sort default is stored per account. Search operates on the entire supplied sample set before pagination. CSV exports all columns and all matching rows. A separate paged-input contract accepts a provider total and delegates query/export actions without reprocessing a single page. Final saved-view behavior, detailed product metrics, groups, agent tracking, and polished layouts remain in the page-design work.

## Scope and plans

[Product definitions](docs/product/README.md) · [Architecture](docs/implementation/frontend-architecture.md) · [Foundation status](docs/implementation/quality-foundation-status.md) · [Original audit](docs/implementation/source-audit-2026-10-24.md)

The foundation replaces the old reporting routes with minimal sample-backed views. It does not finish the full product or prove historical metric calculations. Database integration and agent launching are later milestones.
