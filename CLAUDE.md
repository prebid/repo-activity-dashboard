# Repository workflow

- Use the runtime in `.nvmrc` and `npm ci`.
- `npm run check` runs static, boundary, unit, and component checks. `npm run check:all` additionally builds the preview, runs browser tests, and builds Storybook.
- Browser tests require `npx playwright install chromium` and ports 3100/6007 available. They exercise the built preview, so build the preview and Storybook after changing runtime source.
- `npm run dev`, `build`, and `start` explicitly use preview identities. Amplify uses `build:production`. Keep these modes distinct; production auth never falls back to a preview identity.
- Reporting inputs are prepared samples. Preserve their known-zero/missing distinction and stable repository IDs. The canonical catalog is `src/config/repositories.ts`.
- New feature views receive typed models; route composition supplies samples or future adapters. `npm run check:boundaries` enforces the presentation/server separation and retirement of reporting ingestion/storage.
- Use TanStack Table v9 APIs from the installed package; v8 snippets are not interchangeable.
- Product scope and unimplemented behavior are in `docs/product/README.md`. Foundation evidence/limits are in `docs/implementation/quality-foundation-status.md`.
- The old ingestion baseline is historical evidence. Its retired tests are documented separately; do not reintroduce the removed pipeline to make them run.
