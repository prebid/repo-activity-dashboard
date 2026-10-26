# Foundation adversarial self-review

Reviewed published head `aeebc98a8333a706677e475acee95d9a3ded248b`; corrective code checkpoint `e3763220d39d37763a50ca02eec0487312a32281`. Original reviewer feedback targets `7a567cd50a4fc75568c425fcd2bf2d44c7cee112`. This is a same-author self-review, not independent approval.

The pass revalidated all 23 items in the [reviewer finding ledger](review-remediation-verification.md#finding-dispositions), traced the composed runtime paths, and found three additional defects. All three are corrected with regression coverage. No further code blocker was found within the audited paths. Shared deployed login throttling remains open, and live hosting/account acceptance remains unverified.

## Additional findings and corrections

| ID | Severity | Observed before correction | Corrected behavior and evidence |
| --- | --- | --- | --- |
| FA-20261026-01 | P2 | A password write could succeed, then a rejected automatic sign-in promise left the user on the password form with a generic failure. | Password-write success is a distinct phase. Sensitive form fields clear; failed automatic sign-in goes to a refreshed login page explaining that the new password should be used. Component cases cover success, rejected results, rejected promises, and failed writes. Both production browsers block the actual callback request, assert that the fault fired, and then successfully sign in manually with the new password. |
| FA-20261026-02 | P2 | A password response completing after form unmount still invoked sign-in for the old identity. | Each mounted form owns an abortable operation. Cleanup aborts the password request; stale completions cannot start re-authentication or navigate/notify from the disposed form. Deferred-promise tests resolve requests after unmount and assert absence of those side effects. |
| FA-20261026-03 | P2 | The packaged production account-list response returned HTTP 200 with no Cache-Control header. | `accountJson` enforces `private, no-store` for account data, issued credentials, and errors. All eight inspected account boundary modules use it; their 22 JSON emission sites and the two existing error-response branches delegate to the policy. Admin list fetches also explicitly bypass browser storage. Production HTTP assertions cover account listing and credential issuance, with unit cases for status/header preservation and error responses. |

Fix locations: [password flow](../../src/features/authentication/change-password-view.tsx), [recovery login](../../src/features/authentication/login-view.tsx), [account response policy](../../src/lib/auth/account-response.ts). [Baseline probe observations](evidence/adversarial-review/baseline-probes.json) record the source revision and diagnostic log digests. These baseline failures are separate from the final passing results.

Cancellation does not undo a server write that already committed. Auth.js owns its sign-in request; the guard prevents an obsolete form from starting it after a delayed password response and suppresses obsolete continuation effects. It does not claim to cancel a sign-in request already sent or serialize simultaneous sign-ins across browser tabs.

## Original feedback revalidation

| Original IDs | Revalidation |
| --- | --- |
| 01 | Protected pages and sample loaders gate before data composition. Packaged HTTP tests use route-specific positive controls and assert absent private data in anonymous HTML/RSC. Revoked browser navigation remains denied. |
| 02, 17b | Numeric legacy metadata, complete population scans, preflight failure before writes, interrupted migration resume, exact expiry, and reset/change conflicts pass on real DynamoDB Local. |
| 03, 04, 14 | File-mode and configuration tests pass; production artifacts use packaged settings without source or .env. The ordered maintenance/rollback procedure retains explicit live acceptance. Actual Amplify behavior and production auto-build remain unverified. |
| 05, 08 | Production account workflows preserve post-change navigation and server-provided identity, without global session polling. The two new password-flow findings strengthen error and disposal paths. |
| 06 | Actual Auth.js session cookies survive injected account-store failures without renewal or deletion; recovery uses the same cookie. Current revision/role/active checks, bounded conflict retries, and deadlines remain enforced. |
| 07 | Ordinary build/start select production; preview is explicit, isolated from real accounts, and bound to loopback by default. Both modes build and run in the required suite. |
| 09a, 09b, 09c | URL/history, same-route navigation, draft debounce, refresh, preferences, page correction, and immediate export remain coherent. Shared tables receive controllers rather than importing Next routing. |
| 10, 15 | Server-formatted timestamps, strict browser-error detection, long-select closure/reopening/resize, and actual HTTP 404 for unknown repositories pass in Chromium/WebKit. |
| 11a, 11b, 12 | Bounded streamed bodies, timeout/cancellation, byte-based password bounds, CSRF ownership, and raw/enveloped secrets retain their tested behavior. |
| 13a | Unknown/disallowed credentials perform dummy hash work and return generic failures. This is a bounded timing mitigation, not a constant-time network guarantee. |
| 13b | **Open deployment prerequisite**, owned by the Prebid deployment administrator: shared login throttling and trusted client-address handling. No process-local substitute is represented as completion. |
| 16 | The executable counterexample still passes at group level and fails with the actual per-file rule. The new account response policy also meets its 100% per-file gate. |
| 17a, 17c | Private credential delivery, dismissal confirmation, focus restoration, clipboard errors, and explicit reissue pass component and production browser tests. |

## Architecture assessment

- Authentication transport and current authorization are separate owners. Auth.js verifies tokens and handles its protocol; the viewer resolves current account state; mutation transactions recheck write authority. The new response policy preserves the library's cookie behavior and the outage/revocation distinction.
- Routes compose protected data and typed views. Sample data remains behind the server reporting boundary. Shared table rendering is independent of routing, storage preferences, reporting calculation, and future database adapters.
- URL state, search drafts, and page correction have explicit ownership. Account/scope keys remount sensitive state. Abort ownership now extends to pending password-form work.
- Operator stores bind immutable targets and owned clients. Migration is conditional and repeatable, with explicit maintenance requirements rather than a claim that separate scans form a snapshot.
- Runtime modes, canonical origin, request bounds, account expiry and private/no-store response policy are explicit contracts. Critical policies have executable regression checks; source import/removal checks cover 101 application files and reject empty scans.

The current base is an ancestor of the reviewed head, so two-dot and merge-base source comparisons agree. The audit considered the original remediation diff, its current callers, the deployed-artifact path, test/guard effectiveness, and the documentation. Generated historical datasets are checked through their retirement boundaries rather than treated as maintained code.

## Final local verification

`npm run check:all` passed on Node 24.22.1 / npm 11.19.1 / macOS ARM64 / Java 21.0.11. Individual results were parsed and validated:

| Population | Passed |
| --- | ---: |
| Unit/component | 254 |
| DynamoDB Local account integration | 27 |
| Packaged production HTTP/browser scenarios | 5 |
| Preview/catalog Chromium/WebKit cases | 26 |
| Total | **312** |

Formatting, type-aware lint, TypeScript, architecture/removal checks, per-file coverage gates, all three builds, and the full dependency audit passed. Zero failed/skipped/flaky required cases; zero npm advisories. Unit line coverage is 68.75%; separate account integration line coverage is 90.00%. These populations are not added together. Counts do not imply exhaustive coverage.

[Receipt and limits](evidence/adversarial-review/verification.json) · [173-input source manifest](evidence/adversarial-review/source-manifest.json) · [Unit cases](evidence/adversarial-review/vitest.json) · [Account cases](evidence/adversarial-review/accounts.json) · [Production cases](evidence/adversarial-review/production.json) · [Preview/catalog cases](evidence/adversarial-review/playwright.json) · [Coverage summaries](evidence/adversarial-review/coverage-summary.json)

Hosted CI must be checked on the final published PR head. No live AWS mutation, deployment, merge, independent approval, reviewer reply, or thread resolution is claimed. Firefox, assistive-technology acceptance, live account population, and Amplify/IAM/throttling acceptance remain outside this local verification.
