# Foundation hardening review packet

**Current handoff supplement:** read the [adversarial self-audit](foundation-self-audit.md) first. Its code checkpoint is `ef41880`, with 135 unit/component and 18 browser cases and explicit open production findings. The packet below preserves the preceding `81e68b4` checkpoint and its evidence. Use the [latest source/review inventory](evidence/self-audit/review-scope.json) for the subsequent changes.

Code checkpoint: **81e68b4033fa00ffa810a10be959ac5749099423**. Branch: `codex/quality-foundation`. Original source baseline: **fba4d04b588a01149df2c8b5bd8a02f55a709cc2**. This is an implementation-author packet; independent review and hosted CI are pending.

The application previously mixed reporting aggregation/storage with rendering and lacked dependable quality enforcement. The branch retires that reporting layer, supplies deterministic typed samples, preserves the chosen stack and account integration, and adds executable foundation checks. The latest hardening adds type-aware lint, runtime schemas, tested account boundaries, reliable table state/paging contracts, resolved architecture checks, and CI parity. Final page layouts and the future reporting database are outside this review.

## Reproduce

```sh
nvm install
nvm use
npm ci
npx playwright install --with-deps chromium webkit
npm run check:all
```

Keep ports 3100 and 6007 free. Preview/testing require no real GitHub/AWS credentials. Production build success checks compilation and mode separation, not a real deployed login. CI runs on Ubuntu 24.04; local verification ran on macOS ARM64 with Node 24.22.1/npm 11.19.1. Linux CI results are not yet available.

The command runs formatting, typed lint, types, both architecture checks, coverage-gated unit/component tests, full npm audit, production-auth build, preview build, Storybook, and Chromium/WebKit tests. Test reports are in `test-results/`, coverage in `coverage/`; CI uploads both.

## Evidence and disposition

| Finding | Implementation disposition | Remaining review |
| --- | --- | --- |
| FND-01 dependency/advisory completeness | Vitest toolchain advisories removed; updated compatible packages, exact versions, native UUID; full audit zero. | Review explicit Next/ESLint/TypeScript/Auth.js holds and maintenance triggers. |
| FND-02 lint/runtime boundaries | Recommended type-aware rules, validated request/store/response shapes, handled promises. | Review contracts and failure semantics; no broad rule suppressions introduced. |
| FND-03 coverage and behavioral tests | 103 unit/component cases; application-wide coverage report; explicit per-file critical gates; 12 browser cases. | Inspect assertions and uncovered scope, not only percentages. |
| FND-04 auth/access isolation | Real Auth.js CSRF/cookie handlers against controlled storage, access/API/layout tests, paginated store reads, hashed-password write tests. | Bootstrap policy unresolved; live AWS/Amplify and retained identity-system limitations remain deployment gates. |
| FND-05 state/architecture | Initial/history notifications, stale-page suppression, total shrink correction, async export failures; resolved dependency graph with negative cases. | Future adapters must honor documented request/result ownership; source graph is not a runtime security sandbox. |
| FND-06 CI parity | CI and local `check:all` include audit, coverage, both build modes, Storybook and two engines; isolated clean run passed. | Hosted execution remains pending until publication. |
| FND-07 independent review | Source ledger and evidence prepared. | **Pending; no independent approval claimed.** |

[Verification receipt](evidence/hardening/verification.json) · [Source hashes](evidence/hardening/source-manifest.json) · [Full audit](evidence/hardening/audit-all.json) · [Test cases](evidence/hardening/vitest.json) · [Browser cases](evidence/hardening/playwright.json) · [Coverage](evidence/hardening/coverage-summary.json) · [Dependency decisions](evidence/hardening/dependency-decisions.json) · [Change ledger](evidence/hardening/change-ledger.json)

The ledger enumerates all 1,102 changed paths from the original baseline through the code checkpoint, including the large retirement of generated reporting artifacts. Its review statuses are pending. Later documentation/evidence-only commits do not alter the verified executable source; the manifest permits that comparison without claiming untested code is verified.

## Suggested review passes

1. **Toolchain/build/CI:** package and lockfile, peer-compatible holds, full audit scope, preview/production launcher, Amplify configuration, coverage selectors and thresholds, required CI steps.
2. **Account boundary:** real handler call sites, schema validation, lazy AWS client, API/layout permissions, fail-closed errors, user/whitelist pagination. Read the unresolved bootstrap brief and retained JWT/concurrent-write limitations explicitly.
3. **Frontend contracts:** route composition, pure display models, table query/prefs/history behavior, current-result identity, exports and errors, extension with a second feature/provider.
4. **Tests and removal:** independent expected outcomes, real graph negative fixtures, global cleanup, complete test selection, legacy consumer/dependency retirement, unchanged product definitions/catalog, no claims of final visual approval.

The [contract reference](foundation-contracts.md) and [bootstrap decision brief](account-bootstrap-decision.md) provide the intended behavior and limits. The [pre-hardening assessment](foundation-review-readiness.md) remains historical evidence of the defects this pass addressed.

## Release/layout boundary

No remote push, pull request, deployment, review-team message, or independent approval is part of this checkpoint. Resolve review findings and obtain the review owner's acceptance before layout work. Decide and verify first-admin provisioning and the retained authentication deployment separately before exposing a real environment. The current mock frontend remains usable without those live services.
