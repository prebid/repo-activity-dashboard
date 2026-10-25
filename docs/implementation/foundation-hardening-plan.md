# Foundation hardening execution plan

Layouts remain on hold. This work implements the open FND findings in small verified stages. The goal is a reviewable, reproducible foundation with explicit limits, not a claim of perfection from test counts.

| Stage | Scope | Exit evidence | State |
| --- | --- | --- | --- |
| H1 | Dependency decisions, patched Vitest, supported test DOM/icons, remove unnecessary UUID dependency | Fresh lock/install; full runtime + development audit; compatibility checks; every direct dependency disposition | Passed locally |
| H2 | Type-aware lint and runtime account/API boundary validation | Unsafe-value/promise checks enabled; no broad suppressions; invalid input and failure tests | Pending |
| H3 | Query/history/paging contracts and resolved dependency graph | Regression tests for state transitions, storage denial, callbacks, stale pages; graph/cycle/layer enforcement with negative fixtures | Pending |
| H4 | Offline production-auth/access tests, meaningful coverage scope, browser contracts | Actual policy/wiring tests with controlled account storage; critical-module coverage gates; browser assertions match claimed behavior | Pending |
| H5 | CI parity, clean verification, review packet | Both build modes, coverage and full audit in CI commands; refreshed source/change ledger and evidence | Pending |
| H6 | Independent review and hosted verification | Review-team findings dispositioned and exact-head hosted CI result | Requires the later review/publication step |

Retain Amplify, Next.js, TypeScript, React, Tailwind, and the existing production account integration. Do not add a reporting database, ingestion simulator, new product layouts, or agent execution. The old reporting layer stays removed.

Dependency policy: use compatible maintained releases where available, record justified holds and their revisit conditions, and never use force or legacy-peer-deps to manufacture a successful installation. A successful dependency resolution is not a passing application test.

Verification policy: test observable contracts and failure paths; preserve fixed clocks and deterministic samples; use explicit coverage scope and meaningful module gates rather than an arbitrary whole-project percentage. No empty/skipped required check is a pass. Independent review remains separate from the implementation author's verification.

