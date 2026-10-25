# Foundation review handoff

The implementation is complete for this foundation milestone. Start with the [second self-review](foundation-second-review.md) at code checkpoint `203efc5`, which records the current changes and verification. [The current completion record](foundation-completion.md) identifies the verified code, closed findings, executable evidence, and environment limits.

The branch replaces the previous reporting ingestion/storage-dependent pages with typed prepared data and shared frontend contracts while retaining the chosen stack and Amplify target. It includes strict quality gates, repaired Tailwind v4 primitives, tested table/query behavior, and completed account/security/configuration fixes from the self-audit. Full product layouts and the new reporting database are later work.

## Reproduce

```sh
nvm install
nvm use
npm ci
npx playwright install --with-deps chromium webkit
npm run check:all
```

Java 17+ is required for the account emulator; CI installs Java 21. The emulator download is pinned and verified. Ports 3100/6007 must be free for preview/catalog checks; account and production fixtures allocate their own ports. Tests use synthetic accounts and local services and need no live AWS credentials.

`check:all` runs formatting, type-aware lint, types, architecture/removal checks, coverage-gated unit/component tests, DynamoDB Local account tests, full npm audit, a production build and packaged-server HTTP test, the preview build, Storybook, and both browser engines. Reports are under `test-results/` and `coverage/`. Required result files are cleared before execution and validated afterward.

## Review material

- [Current implementation and closed-findings record](foundation-completion.md)
- [Presentation, state and module contracts](foundation-contracts.md)
- [Account/runtime operational contract](account-operations.md)
- [Current review inventory](evidence/completion/review-inventory.json)
- [Self-audit history and reproductions](foundation-self-audit.md)
- [Product definitions](../product/README.md)

The source inventory separates active implementation, tests/tooling, documentation, and retired artifacts. Local verification and this self-review are by the implementation author. Independent review, hosted Linux CI and actual Amplify/IAM acceptance are not claimed. No remote publication or deployment is included in the local checkpoint.
