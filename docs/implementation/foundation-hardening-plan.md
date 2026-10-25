# Foundation hardening execution plan

Layouts remain on hold. This work implements the open FND findings in small verified stages. The goal is a reviewable, reproducible foundation with explicit limits, not a claim of perfection from test counts.

| Stage | Scope | Exit evidence | State |
| --- | --- | --- | --- |
| H1 | Dependency decisions, patched Vitest, supported test DOM/icons, remove unnecessary UUID dependency | Fresh lock/install; full runtime + development audit; compatibility checks; every direct dependency disposition | Passed locally |
| H2 | Type-aware lint and runtime account/API boundary validation | Unsafe-value/promise checks enabled; no broad suppressions; invalid input and failure tests | Passed locally |
| H3 | Query/history/paging contracts and resolved dependency graph | Regression tests for state transitions, storage denial, callbacks, stale pages; graph/cycle/layer enforcement with negative fixtures | Passed locally |
| H4 | Offline production-auth/access tests, meaningful coverage scope, browser contracts | Actual policy/wiring tests with controlled account storage; critical-module coverage gates; browser assertions match claimed behavior | Passed locally |
| H5 | CI parity, clean verification, review packet | Both build modes, coverage and full audit in CI commands; refreshed source/change ledger and evidence | Passed locally; hosted execution pending |
| H6 | Independent review and hosted verification | Review-team findings dispositioned and exact-head hosted CI result | Requires the later review/publication step |

Retain Amplify, Next.js, TypeScript, React, Tailwind, and the existing production account integration. Do not add a reporting database, ingestion simulator, new product layouts, or agent execution. The old reporting layer stays removed.

The local hardening checkpoint is `81e68b4033fa00ffa810a10be959ac5749099423`. A clean install passed the complete command: 103 unit/component tests, 12 Chromium/WebKit browser cases, both build modes, Storybook, coverage gates, static checks, and a full zero-advisory audit. [Evidence](evidence/hardening/verification.json) · [Contracts](foundation-contracts.md) · [Review packet](foundation-hardening-review.md).

Operator-controlled bootstrap is now implemented, along with current-session authority, atomic account writes, and runtime configuration. See [implementation completion](foundation-completion.md) and the [implemented bootstrap decision](account-bootstrap-decision.md).

Dependency policy: use compatible maintained releases where available, record justified holds and their revisit conditions, and never use force or legacy-peer-deps to manufacture a successful installation. A successful dependency resolution is not a passing application test.

Verification policy: test observable contracts and failure paths; preserve fixed clocks and deterministic samples; use explicit coverage scope and meaningful module gates rather than an arbitrary whole-project percentage. No empty/skipped required check is a pass. Independent review remains separate from the implementation author's verification.


## Adversarial self-review follow-up

The user requested a full self-audit before external handoff. That review is complete at `ef41880`: 11 confirmed defects/enforcement gaps were addressed, with 135 unit/component and 18 cross-browser cases passing. [The report](foundation-self-audit.md) records reproductions, architecture conclusions, dependency checks, scope, and the open production-auth/Amplify findings. This does not complete H6 or resolve the pending bootstrap decision.

## Final implementation pass

The user authorized finishing the implementation before handoff. AUTH-01, AUTH-02, AUTH-03 and HOST-01 are implemented and locally verified; the current completion record supersedes their earlier open dispositions. H6 remains independent review/hosted verification, not a request for reviewers to implement the fixes.
