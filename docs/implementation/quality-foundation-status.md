# Quality foundation — current implementation status

Updated 2026-10-25. **The foundation implementation and known self-audit fixes are complete locally and ready for independent review.** Layout work remains on hold. Verified code checkpoint: `203efc5e9366963994fae337539700f6e260779f` on `codex/quality-foundation`.

[Latest self-review](foundation-second-review.md) · [Completion history](foundation-completion.md) · [Review handoff](foundation-hardening-review.md) · [Contracts](foundation-contracts.md) · [Account operations](account-operations.md) · [Verification receipt](evidence/second-review/verification.json)

## Delivered

- Compatible, pinned Next/React/TypeScript/Tailwind/Radix/Recharts stack with Amplify retained. Strict types, type-aware lint, formatting, resolved dependency boundaries, and test-result validation apply to the maintained source and tooling.
- Typed sample-backed route/view composition, canonical 18-repository catalog, shared tables/metrics/states, Storybook, corrected Tailwind v4 variables, and tested keyboard/theme/accessibility behavior. Final page layouts are not part of this milestone.
- URL/history/preferences/paging contracts with bounded rendered rows, stale-result handling, full-scope exports and error behavior. Reporting remains prepared data, not an ingestion simulator.
- All 11 defects/enforcement gaps from the first frontend self-review are fixed. The second review also closed request-origin/content-type, mixed provisioning/bootstrap, self-reset identity, operator-target isolation and build-marker gaps. Account operations now use explicitly scoped stores; application imports of operator scripts are prohibited.
- The four subsequent account/runtime findings are implemented: operator bootstrap, current versioned sessions, transactional account writes and migration, and packaged server configuration with runtime Secrets Manager retrieval.
- Real local account concurrency/failure tests and a built-production HTTP test accompany the unit/component and browser suites. CI runs the same complete command and installs its Java test prerequisite.

## Account findings closed

Public first-admin registration is closed. Operator commands provide private credential delivery, explicit targets, one-time bootstrap, creation/recovery, access changes, inspection, and a repeat-safe legacy-link migration. Existing account IDs and hashes are preserved; pre-upgrade cookies sign in again.

Production session use revalidates an atomic current account/whitelist snapshot and revision. Password/access changes invalidate older cookies. Admin mutations include current actor conditions in their transaction, and email claims prevent duplicate/partial creation. The required first password cannot be the existing temporary password.

Managed runtime settings are allowlisted non-secret values. Signing keys are retrieved through the SDK at runtime; incomplete managed configuration fails closed. A copied-artifact test without source or `.env` verifies the actual HTTP login/create/reset/change/session flow against local service fixtures. The [completion record](foundation-completion.md) maps each finding to its implementation and evidence.

## Current verification

The preceding completion checkpoint passed a clean locked install. The second review left dependencies unchanged and passed the complete pipeline on the current working source, including new production builds and real local database cases. Its own source hashes and individual results are under `evidence/second-review/`; the older clean-install receipt remains attached to its original checkpoint.

| Check | Result |
| --- | --- |
| Formatting, type-aware lint, strict types | Passed; previous clean install retained as historical evidence |
| Module graph and retired-reporting checks | Passed; 85 application source files selected |
| Unit/component cases and critical coverage gates | **200 passed; 0 failed/pending/skipped** |
| DynamoDB Local account integration cases | **19 passed**, including forced race interleavings and rollback |
| Packaged production HTTP scenario | **1 passed**, covering configuration, SDK key retrieval, cookies, account writes, reset and required password change |
| Production-auth, preview and Storybook builds | Passed |
| Chromium/WebKit browser cases | **18 passed; 0 failed/skipped/flaky** |
| Full npm audit, including development dependencies | **0 advisories** |
| Independent review / hosted Linux CI / actual Amplify and IAM acceptance | Not performed |

Whole-application unit line coverage is **54.61% across 84 files**. Account-integration line coverage is **91.35% across its three selected modules**, with a separate account-store gate. These reports are separate; they are not summed, and neither claims comprehensive future-product coverage. The production child process and browser execution are verified behaviorally rather than folded into those percentages.

## Reporting retirement and remaining scope

The previous GitHub collector, reporting storage/services/scripts, generated datasets, raw-store endpoint, and embedded report aggregation remain retired. Account authentication storage is intentionally retained. The original ingestion tests were retired with their implementation; their historical 41-pass/5-fail baseline was not relabeled as fixed by these frontend tests.

No real reporting database, historical metric engine, final page layouts, agent execution, or full contributor/group workflows were added. Screenshots remain inspection artifacts rather than approved design baselines.

## Verification limits and maintenance

- No live AWS account mutation, cloud deployment, remote push, review-team message, or independent approval occurred. Real environment/IAM/edge controls and hosted CI are separate acceptance checks.
- Next 15 remains the selected Amplify-compatible major. ESLint 9's deprecated status and the existing Auth.js v5 beta line remain explicit compatibility/maintenance tradeoffs. TypeScript 6 matches the retained parser; Node types match Node 24.
- The final pass added pinned `@aws-sdk/client-secrets-manager` 3.1156.0 and `tsx` 4.23.15. DynamoDB Local 3.3.2 is checksum/object-version pinned and test-only; the application does not require Java.
- Linked account lookups are point reads; legacy/unmapped lookups retain a complete scan fallback. The migration rejects ambiguous records instead of assigning identities automatically. Earlier nontransactional account writers must not run concurrently with this version.
- Secret caching, credential-file recovery, runtime configuration precedence and current-session behavior are documented as implemented operational contracts. The code does not claim zero-downtime key rotation, protection against a malicious IAM/database administrator, or erasure of data already rendered in a browser.
- Historical audit and verification records remain under their original checkpoint folders. Current readiness is grounded in `evidence/second-review/`, not the earlier smaller test suites.
