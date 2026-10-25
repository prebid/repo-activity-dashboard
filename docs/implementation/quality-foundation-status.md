# Quality foundation — implementation status

Updated 2026-10-25. **Local hardening is complete and ready for independent review. Layout work remains on hold.** Branch: `codex/quality-foundation`; verified code checkpoint: `81e68b4033fa00ffa810a10be959ac5749099423`. Hosted CI, Amplify deployment, and real account-store sign-in have not run. First-admin setup remains an unresolved deployment decision.

[Execution plan](foundation-hardening-plan.md) · [Review packet](foundation-hardening-review.md) · [Contracts](foundation-contracts.md) · [Machine-readable evidence](evidence/hardening/verification.json)

## Delivered foundation

- Compatible, exactly pinned dependencies and a reproducible lockfile. Node 24.22.1, Next 15.5.28, React 19.3.1, TypeScript 6.0.3, Tailwind 4.3.3, and Amplify are retained. Vitest/coverage are now 5.0.5; jsdom, jest-dom, and Lucide were upgraded; Node's UUID API replaced the separate package. Every direct dependency has a recorded disposition.
- Correct Tailwind v4 imports and shared theme tokens, with actual compiled-style checks.
- Strict TypeScript across application, tests, and tool configuration; type-aware ESLint checks unsafe values, floating promises, and misused promises. Runtime account/API shapes use Zod validation.
- Resolved dependency-graph enforcement for layer direction, indirect server dependencies, cycles, and cross-feature imports, plus separate retired-reporting checks. Negative fixtures exercise the real checkers.
- Thin route composition and typed sample-backed views, shared UI primitives, component stories, and a canonical catalog of 18 repositories.
- Shared table/query contracts for sorting, search, column visibility, 100-row paging, account-specific initial sort, URL/history synchronization, missing values, full-result exports, stale-page handling, and retryable export/request errors.
- Real Auth.js handler tests with controlled account dependencies, including CSRF, session cookies, failed credentials, store failures, and preview isolation. Account API/layout authorization is tested independently. Account scans follow pagination and distinguish absence from errors.
- Application-wide coverage visibility with per-file gates on critical foundation modules. Chromium and WebKit exercise built artifacts. CI invokes the same complete local verification command.

## Reporting layer retired

The old collector, GitHub ingestion/storage services, reporting scripts, generated datasets, raw-store endpoint, and embedded report aggregation have been removed from active source. Amplify no longer synchronizes mappings or copies reporting datasets into public assets.

Authentication's account/whitelist storage is intentionally retained. There is no legacy **reporting** data layer; this is not a claim that all database-related code is gone.

The original ingestion tests were retired with that implementation. Their historical baseline was 46 cases: 41 passed and 5 failed. The current frontend suite has a different scope and does not claim those old failures were repaired.

## Verification at the hardening checkpoint

A separate source copy contained no node_modules, generated build output, or copied environment files. Live-service environment settings were removed. It ran `npm ci` followed by `npm run check:all`. All 122 copied source/config/test/support files matched the working checkout afterward.

| Check | Result |
| --- | --- |
| Clean locked install | Passed |
| Formatting, type-aware lint, strict types | Passed |
| Resolved graph and retired-reporting checks | Passed; 75 application source files selected |
| Unit/component tests and coverage gates | **103 passed; 0 failed/skipped** |
| Production-auth build | Passed; no live service contacted by the checks |
| Preview and Storybook builds | Passed |
| Browser tests | **12 passed across Chromium/WebKit; 0 failed/skipped/flaky** |
| Full npm audit, including development dependencies | **0 advisories** |
| Hosted Linux CI, independent review, live AWS integration | Not run |

Unit coverage now reports all 74 application TS/TSX files rather than seven selected modules. Overall line coverage is **41.99%**, with uncovered UI scaffolds and retained account screens visible. This is intentionally not presented as comprehensive application coverage. Critical table/query files exceed 95% lines; registered credential/access/request policies and auth wiring have 100% lines/branches in the measured cases. Browser coverage is separate and is not added to those percentages.

Screenshots are inspection artifacts, not approved layouts or visual-regression baselines. Automated accessibility checks apply to the exercised foundation specimen.

## Remaining limits and gates

- **Independent review and hosted verification are pending.** Local checks do not substitute for them. The review ledger and reproducible commands are in the review packet.
- **Public first-admin setup still lacks proof of email ownership.** No bootstrap-policy change has been approved. [The decision brief](account-bootstrap-decision.md) recommends operator provisioning and explains alternatives. Resolve before exposing production setup; preview account mutations are blocked.
- Production authentication retains sign-in-time JWT claims, separate user/whitelist writes, and scan-based email lookup. Immediate session revocation, concurrent account uniqueness, and partial-write recovery need explicit production-auth disposition. The hardening does not certify the entire retained identity system.
- Next 15 is held for the selected Amplify target. ESLint 9 is deprecated but retained for the current React/accessibility/Next plugin peers; TypeScript 6 matches the current parser; next-auth remains on the existing v5 beta line. These are documented compatibility tradeoffs, not a claim that every package is on its newest major. See [dependency decisions](evidence/hardening/dependency-decisions.json).
- npm reports transitive install-script approval notices, and Storybook reports client-directive notices. Clean installation and required builds passed without broad install-hook approval or forced peer resolution.
- The dependency graph does not traverse package internals; the literal-import retirement check is not a proof about arbitrary runtime behavior. Future adapters still need ordering, authorization, schema, semantic, and database performance tests.
- Full page layouts, metrics/timeframes, saved views beyond sort defaults, contributor/group detail, agent tracking, and real reporting/database integration remain later milestones.

Next: independent review of this checkpoint, followed by hosted verification when published. Keep layouts on hold until the foundation review is accepted.
