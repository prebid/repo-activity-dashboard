# Repository workflow

- Use the runtime in `.nvmrc` and `npm ci`.
- `npm run check` runs static, boundary, unit/component checks with coverage gates. `npm run check:all` adds the full dependency audit, local account/packaged-production integration tests, both build modes, Storybook, and browser tests. Integration suites require Java 17+ (CI uses 21).
- Browser tests require `npx playwright install chromium webkit` and ports 3100/6007 available. They exercise the built preview, so build the preview and Storybook after changing runtime source.
- `npm run dev` uses local preview identities. `build`/`start` and Amplify use production authentication; `build:preview`/`start:preview` explicitly select preview. Keep these modes distinct; production auth never falls back to a preview identity.
- Reporting inputs are prepared samples. Preserve their known-zero/missing distinction and stable repository IDs. The canonical catalog is `src/config/repositories.ts`.
- New feature views receive typed models; route composition supplies samples or future adapters. `npm run check:boundaries` enforces the presentation/server separation and retirement of reporting ingestion/storage.
- Use TanStack Table v9 APIs from the installed package; v8 snippets are not interchangeable.
- Product scope is in `docs/product/README.md`. Foundation evidence/limits are in `docs/implementation/quality-foundation-status.md`; current state/adapter contracts are in `docs/implementation/foundation-contracts.md`.
- The old ingestion baseline is historical evidence. Its retired tests are documented separately; do not reintroduce the removed pipeline to make them run.

- Account tests use isolated DynamoDB Local, not live AWS tables. Operator commands target real account tables; their configuration/recovery contract is in `docs/implementation/account-operations.md`.
