# Foundation hardening and review readiness

Assessment date: **2026-10-25**. Code checkpoint: **6d7efb44725d0f1f6802765c05467b1143ee3377** on `codex/quality-foundation`; comparison base: **fba4d04b588a01149df2c8b5bd8a02f55a709cc2**.

**Status: first implementation exists and has local verification; foundation approval is pending. Layout work is on hold.** This assessment is by the implementation author. It is not the review team's independent review or a claim that the foundation is the strongest possible implementation.

The earlier suggestion to proceed directly to layouts was premature. Passing the initial checks established specific behavior, not dependency completeness, comprehensive coverage, production-policy correctness, or independent approval.

## What is actually in place

- Compatible core upgrades and a reproducible lockfile; repaired Tailwind v4 setup.
- Strict TypeScript over application, tests, and tool configuration.
- ESLint/formatting, a scoped import/removal check, component catalog, and typed presentation components.
- 41 unit/component tests and 6 Chromium browser checks previously passed against the implementation checkpoint.
- A clean-install verification, preview build, Storybook build, and production-auth build.
- Removal of the old reporting ingestion/storage code and artifacts; retained account authentication is isolated from mock reporting.
- CI configuration, but no hosted run or independent approval.

Those are useful deliverables. The gaps below remain real and should be closed or explicitly dispositioned before treating the foundation as approved.

## Dependency completeness

A fresh check covers **47 direct packages**. **12 entries differ from npm's latest tag**; this does not mean all 12 should be upgraded blindly. The [complete inventory](evidence/2026-10-25-readiness/dependency-inventory.json) records declared ranges, locked versions, and the outdated result.

Examples of actual resolved upgrades include AWS SDK **3.1156.0** and Radix Dialog **1.3.1**, even though their package.json ranges retain older minimum versions. The lockfile, not the lower bound of a range, identifies the installed version.

| Entry | Locked | Latest tag observed | Disposition needed |
| --- | --- | --- | --- |
| Next / eslint-config-next | 15.5.28 | 16.4.3 | Hosting-constrained hold while retaining Amplify; revalidate support when the target changes. |
| Node types | @types/node 24.19.2 | 26.6.5 | Intentional runtime alignment with Node 24. Do not introduce types for unavailable Node 26 APIs. |
| TypeScript | 6.0.3 | 7.0.2 | Retain only with a current parser/tool compatibility justification; revisit the compiler API dependency in the boundary checker too. |
| ESLint | 9.39.5 | 10.13.0 | Existing Next/React/accessibility plugin compatibility is the current reason. Its deprecation requires an explicit maintenance decision. |
| Vitest / coverage-v8 | 4.1.10 | 5.0.5 | Must revisit. Full audit reports fixable advisories, and the earlier version-5 resolution failure did not reproduce in a clean manifest resolution. |
| next-auth | 5.0.0-beta.32 | 4.24.15 | Different release channels. npm latest would select an older major; evaluate beta-line risk separately from a blind update. |
| jsdom | 27.4.0 | 30.1.3 | Upgrade or document an application-tested hold. |
| jest-dom | 6.9.1 | 7.0.1 | Upgrade or document a justified hold. |
| lucide-react | 0.544.0 | 1.61.0 | Assess exported icon/API compatibility and update or document the decision. |
| uuid | 13.0.2 | 14.0.3 | Assess upgrade or replacement with the supported Node API where appropriate. |

The other 35 entries were not flagged by this npm outdated run. That result is not a full support-lifecycle audit of every transitive dependency.

### Development dependency advisories were missed by the earlier audit scope

The earlier zero-advisory result was specifically `npm audit --omit=dev`. The fresh **full** audit reports **3 moderate package entries**: Vitest, its coverage companion, and @vitest/mocker, deriving from **2 advisories**. No high/critical entries were reported in this snapshot.

The affected mocking functionality has particular development-server exposure conditions. This audit does not establish that the dashboard is exploitable. The patched versions should nevertheless be used rather than keeping a known affected toolchain. The advisories identify fixes in the 4.1.x and 5.x lines. [Redirect-mock advisory](https://github.com/advisories/GHSA-82fw-gwwq-j7x9), [manual-registration advisory](https://github.com/advisories/GHSA-qxg6-89mg-rqv8)

A temporary manifest with Vitest/coverage-v8 **5.0.5** resolved successfully from an empty directory with peer checks enabled. Its resolved mocker is also 5.0.5. This corrects the earlier assertion of a permanent Storybook/Vitest-5 incompatibility. **The application's tests/builds have not yet been run on that candidate, and the actual project has not been upgraded in this assessment.**

Evidence: [outdated snapshot](evidence/2026-10-25-readiness/outdated.json), [full audit](evidence/2026-10-25-readiness/audit-all.json).

## Quality enforcement and test gaps

### Lint is real, but not yet a complete type-aware policy

The effective configuration enables no-explicit-any and the Next/TypeScript recommended rules. It does **not** enable type-aware floating-promise, misused-promise, unsafe-assignment, or unsafe-return checks. TypeScript strict mode does not substitute for these checks or validate JSON at runtime.

Hardening should adopt a deliberate type-aware rule set, fix violations, and document any narrow exceptions. Retained account/API boundaries need particular attention where JSON results currently flow through inferred any values.

### Coverage is narrower than the headline could suggest

The fresh coverage run passes the same **41 tests**. It reports **89.01% lines, 85.57% statements, and 87.96% branches across only 7 selected files** (91 executable lines in the report).

The glob includes table TSX files but excludes `use-table-query.ts`, the state/preferences hook. It does not provide whole-frontend coverage of views, route authorization, production credential handling, or retained account APIs. `search-params.ts` is included but has zero unit coverage. Some of these behaviors are exercised by browser tests; that does not make the unit coverage envelope comprehensive.

The main CI command does not run coverage, and no thresholds or equivalent coverage-regression gate are configured. Define the intended module scope and critical cases first; an arbitrary overall percentage would be a poor substitute.

Evidence: [coverage summary](evidence/2026-10-25-readiness/coverage-summary.json).

### Contracts need more failure-path tests

Prioritize tests that could catch meaningful regressions:

- URL/history synchronization, malformed/repeated parameters, invalid saved preferences, storage denial, and callback failures.
- Paged-data refreshes, out-of-range pages, full-result totals, export errors, and asynchronous query ownership.
- Production credential authorization with an offline fake account store: whitelist rejection, missing users, wrong passwords, role boundaries, forced password change, and preview/production separation.
- CSV edge cases and test-global cleanup.
- Keyboard/error/loading behavior for the shared controls actually adopted, plus explicitly chosen browser support.

One current browser test is named as if it checks independent feedback and approval values but only asserts row counts and pagination. Its name and assertions need alignment. Test names, test counts, and line coverage cannot stand in for behavioral evidence.

The table's paging contract also needs an explicit history policy: `useTableQuery` calls the provider callback from `update`, while popstate changes the returned query without calling that callback. Resolve the query-owner contract and add regression coverage before treating that seam as ready for a real provider.

### Boundary enforcement is partial

The custom checker catches specified direct/relative imports, computed module imports, raw-store strings, and known retired paths. It is not a resolved dependency graph. Bare Node built-in imports, indirect imports through helpers, layer direction/cycles, and dependencies placed outside the checked manifest section need explicit handling or clearly bounded enforcement.

Use maintained tooling where it improves correctness and maintainability. If the custom checker remains, its supported forms and negative fixtures must match the claim made about it.

### CI does not yet prove the complete foundation

Hosted CI has not run. Its current command omits the production-auth build, coverage, and full dependency audit. Local manual verification of a production build is useful, but future changes could regress it while the configured preview-only CI path remains green.

Bring the required checks into reproducible commands and the actual workflow. Keep live AWS authentication/deployment as a separate integration gate; offline production-policy tests do not require provisioning the future reporting database.

## Hardening worklist

| ID | Required work before foundation approval | Evidence needed |
| --- | --- | --- |
| FND-01 | Close the development-tool advisories and finish a disposition for all 47 direct dependencies. | Clean resolution/install, full audit, compatibility decisions, and relevant application checks on the chosen versions. |
| FND-02 | Establish type-aware lint and strengthen runtime boundary typing. | Effective configuration, fixed violations, narrow documented exceptions, and type/lint results. |
| FND-03 | Correct the coverage envelope and strengthen behavior/error-path tests. | Explicit critical-module map, meaningful regression tests, measured coverage, and a chosen regression policy enforced in CI. |
| FND-04 | Review offline production auth/access behavior and preview isolation. | Real call-site tests using controlled storage, not only helper/config tests; live-service limitations remain explicit. |
| FND-05 | Resolve table/query/state ownership and strengthen architectural enforcement. | History/async/paging tests, dependency-direction checks, and documented capability limits. |
| FND-06 | Complete CI parity and obtain an exact-head hosted result before sign-off. | Preview and production builds, required suites, dependency checks, and actual hosted logs for the review head. |
| FND-07 | Obtain independent review and close findings. | Review of implementation, architecture, tests, and removal scope; every actionable finding resolved or explicitly accepted by the user/review owner. |

These are foundation tasks. They do not require new product layouts, a reporting database, or agent launching.

## Review-team preparation

The [checkpoint change ledger](evidence/2026-10-25-readiness/change-ledger.json) enumerates every branch change at the assessed head and groups it for review. Every independent-review status is pending. Large generated-data deletions should be assessed through the removal inventory and consumer checks; behavioral source, tests, auth, tooling, and documentation require their own dispositions.

Suggested review order:

1. Dependency decisions, build modes, and CI scope.
2. Authentication/access and preview isolation.
3. Component boundaries, table/query ownership, and extension contracts.
4. Test assertions, isolation, coverage scope, and failure behavior.
5. Data-layer retirement, dependency cleanup, documentation, and evidence claims.

Before external handoff, refresh the ledger and evidence to the final hardening head. Include retained/removed boundaries, executable commands, exact results, known limitations, and the legacy-test retirement rationale. No review team has been contacted and no independent review has been claimed.

**Exit from this phase:** hardening items have explicit dispositions, required checks pass at the final reviewed head, independent review findings are addressed, and the review owner accepts the foundation. Only then return to page-layout work.
