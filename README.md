# Repository Activity Dashboard

A TypeScript/Next.js frontend foundation for repository activity reporting. Reporting uses deterministic sample values while the pages are designed. The previous GitHub ingestion, filesystem storage, and generated reporting datasets have been retired.

Foundation hardening and independent review are the current phase; layout work is on hold. See [review readiness](docs/implementation/foundation-review-readiness.md).

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
npm run check
npm run build
npx playwright install chromium
npm run build:storybook
npm run test:e2e
```

`npm run check:all` combines those checks except browser installation. Browser tests start the built preview on port **3100** and the built component catalog on **6007**; keep both ports available. `npm run check` covers formatting, lint, app/test/tool types, architecture/removal boundaries, and unit/component tests. Machine-readable test reports are written under `test-results/`.

Use `npm run format` for maintained source/config formatting. Historical plans/audit artifacts in docs/design are deliberately outside automatic formatting.

For interactive component development, use `npm run storybook` on port 6006.

## Build modes and Amplify

- `npm run build` and `npm start` create/run a **preview** with fixed local accounts.
- `npm run build:production` and `npm run start:production` use the retained real authentication integration.
- Start mode must match the recorded build mode.
- Amplify uses `build:production`; the preview launcher refuses an Amplify environment.
- Both modes currently render synthetic reports. Production mode changes authentication, not the reporting source.

Production auth uses the server environment documented in `.env.example` and the hosting runtime's AWS access. Secrets are not embedded through Next's env map. The authentication store is separate from reporting; its real deployment is not exercised by preview tests.

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
