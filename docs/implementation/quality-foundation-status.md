# Quality foundation current implementation status

Updated 2026-10-26. Reviewer-feedback remediation is implemented and locally verified at `b5397928e435e68c1f818acdc1467b74563f5821` on `codex/quality-foundation`. The updated draft PR needs independent re-review. Final page layouts and real reporting integration remain later milestones.

[Current verification and finding ledger](review-remediation-verification.md) · [Contracts](foundation-contracts.md) · [Account operations](account-operations.md) · [Local receipt](evidence/review-remediation/verification.json) · [PR checks](https://github.com/prebid/repo-activity-dashboard/pull/2/checks)

## Delivered foundation

- The chosen pinned Next.js/React/TypeScript/Tailwind/Radix/Recharts stack and Amplify target remain. No dependencies were added by this remediation.
- All reporting pages require current authentication. Pages and sample loaders enforce access independently of layouts; API actions retain current account checks and transactional actor conditions.
- Auth.js owns token/cookie/CSRF behavior. Current profiles and authorization come from account storage. Temporary service errors preserve valid cookies while denying access. The shell and password page use current server props instead of global session polling.
- Administrators create and reissue expiring temporary credentials. `DASHBOARD_TEMP_PASSWORD_HOURS` defaults to 24 and accepts 1–168; web/operator configuration affects future issuance. Legacy temporary credentials without expiry require reissue. Private operator files and writes use the same prepared expiry.
- Legacy numeric/string whitelist timestamps are compatible. Preflight validates both complete populations, and interrupted migration apply reports progress for safe rerun.
- Production build/start are the default. Explicit preview remains convenient for design without cloud credentials. Runtime configuration is non-secret, packaged with readable permissions, and does not invent an account region.
- Shared tables consume controlled state; application controllers own Next URL synchronization, scoped preferences, debounced searches and query transitions. Date labels are deterministic and unknown repositories return proper 404 responses.
- Effective per-file coverage gates, browser error detection, import boundaries, and individual test-result checks accompany the implementation.

## Verified locally

| Check | Result |
| --- | --- |
| Formatting, lint, types and architecture/removal checks | Passed |
| Unit/component cases and coverage gates | 241 passed |
| DynamoDB Local account cases | 27 passed |
| Packaged production HTTP and browser scenarios | 3 passed |
| Preview/Storybook Chromium and WebKit cases | 26 passed |
| Production, preview and Storybook builds | Passed |
| Full dependency audit | Zero advisories |
| Required failed, skipped, pending or flaky cases | Zero |

Total: 297 cases. Unit line coverage is 64.17%; account-integration line coverage is 90.00% in its separate population. These are not summed and do not establish exhaustive product/UI coverage. Production child-process and browser behavior are asserted separately.

The local receipt identifies the tested source manifest. Hosted results must be read from checks on the published PR head; independent approval is a separate decision.

## Remaining scope and release prerequisites

The old GitHub collector, reporting storage/sync scripts, raw-store endpoint and generated datasets remain retired. Authentication's account store is retained. Reporting uses prepared samples; historical calculation correctness, full contributor/group workflows, agent execution and final layouts are not delivered by this milestone.

Live Amplify/IAM configuration, deployed shared login throttling, package handling, and actual account data acceptance remain release prerequisites. The user deferred live AWS inspection. The [operations guide](account-operations.md) documents maintenance, preflight, deployment, migration, rollback and credential retirement. No live account mutation, deployment or merge occurred in this work.

Next 15 remains the selected Amplify-compatible major. The retained ESLint 9 and Auth.js v5 beta lines are explicit maintenance tradeoffs. Historical implementation/verification records remain under their original checkpoints: [initial completion](foundation-completion.md), [second self-review](foundation-second-review.md), and [original self-audit](foundation-self-audit.md).
