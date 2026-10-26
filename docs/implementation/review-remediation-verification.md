# Foundation review remediation verification

The code corrections for the PR 2 review are implemented and locally verified at `b5397928e435e68c1f818acdc1467b74563f5821`. The review baseline was `7a567cd50a4fc75568c425fcd2bf2d44c7cee112`. Subsequent handoff documentation does not change the executable inputs recorded in the [source manifest](evidence/review-remediation/source-manifest.json).

All reporting pages now require a current authenticated viewer before returning data. Auth.js retains protocol and cryptographic responsibilities; current account authorization is separate. Account creation/reset share expiring-credential policy, legacy record preflight covers both populations, and table rendering is controlled independently of Next routing. The [accepted plan](foundation-review-remediation.md), [implemented contracts](foundation-contracts.md), and [operations guide](account-operations.md) describe the boundaries.

## Verification

`npm run check:all` completed on Node 24.22.1, npm 11.19.1, macOS ARM64, and OpenJDK 21.0.11. Individual result files were validated; counts below are cases, not a claim of exhaustive behavior coverage.

| Check | Result |
| --- | --- |
| Formatting, type-aware lint, TypeScript, resolved import/removal checks | Passed |
| Unit and component cases, including effective per-file coverage gates | 241 passed |
| DynamoDB Local account integration cases | 27 passed |
| Packaged production scenarios | 3 passed: HTTP/API plus Chromium and WebKit account workflows |
| Preview/catalog browser cases | 26 passed across Chromium and WebKit |
| Production, explicit preview, and Storybook builds | Passed |
| Full npm dependency audit | Zero advisories |
| Failed, skipped, pending, or flaky required cases | Zero |

Total: **297 passed cases**. The [verification receipt](evidence/review-remediation/verification.json) binds the results to 171 source/configuration/test inputs and the pipeline-log digest. [Unit cases](evidence/review-remediation/vitest.json), [account cases](evidence/review-remediation/accounts.json), [production cases](evidence/review-remediation/production.json), and [browser cases](evidence/review-remediation/playwright.json) retain individual names/statuses.

Unit line coverage is 64.17% across the measured application population. Account integration line coverage is 90.00% across its separate selected population; the account-store gate also passes. These are separate reports and are not added together. Browser and child-process execution are verified behaviorally. Unfinished product views and broad UI coverage are not represented as complete.

## Finding dispositions

These are implementation/evidence dispositions, not GitHub thread resolutions or independent approvals. Composite feedback remains separated. IDs correspond to the plan's 23-item ledger.

| ID | Implemented outcome or remaining obligation | Main verification |
| --- | --- | --- |
| 01 | Page guards and guarded sample loaders prevent anonymous/revoked new reads from returning reporting rows. Layouts provide the shell, not the only gate. | Production HTTP checks route-specific data canaries in authorized controls and anonymous HTML/RSC; production browsers verify subsequent revoked navigation. |
| 02 | Numeric/string legacy timestamps are accepted. Preflight scans users and the complete whitelist, reports bad keys/fields, and identifies credentials needing reissue. Apply exposes partial progress and supports reruns. | Real DynamoDB numeric metadata, whitelist-only invalid records, malformed initialization metadata, interruption/resume, and existing-account cases. |
| 03 | Both non-secret runtime files finish with mode 0644; private operator files remain 0600. Configuration errors retain safe diagnostic causes. | Restrictive-umask/overwrite tests, packaged runtime loading, private-file tests. Actual Amplify ownership/mode normalization remains a deployment check. |
| 04 | Ordered maintenance, configuration, migration, acceptance and rollback procedure is documented. | Operations guide. Live branch auto-build/IAM configuration is unverified; the accepted foundation-branch webhook does not prove a production deployment. |
| 05 | Successful password changes replace the route with `/repos` and refresh cached state; fallback navigation is refreshed too. Forms are keyed to identity/revision. | Real production Chromium/WebKit first-login, human-paced input, subsequent navigation and cross-tab identity change. |
| 06 | Current-account failures occur outside cookie-mutating JWT callbacks. Outages preserve incoming cookies; revocation returns no session or renewal. Read conflicts and deadlines are bounded. | Real Auth.js cookie/CSRF cases, production service-fault/recovery, conflict/retry tests, and a dependency that ignores cancellation. |
| 07 | Default build/start use production auth; preview commands are explicit and default to loopback. Build/start mismatch guards remain. | Launcher tests, both builds, real production and preview identities. |
| 08 | The toolbar and password form use server-validated viewer props; the global SessionProvider is removed. Cross-tab notifications request revalidation without carrying authority. | Zero client session requests on production dashboard hard loads; cross-tab/browser and notification-failure tests. |
| 09a | URL changes use Next's native history integration with null external state. | Browser sort retention through a real cross-tab-triggered router refresh. |
| 09b | The controller observes Next query changes, including same-route links and browser history. | Controller tests and Chromium/WebKit same-route reset of URL, input and rows. |
| 09c | Search is debounced; navigation/scope changes cancel pending writes. Sort/export capture the latest intended draft. | Controlled timer tests, 130-character browser typing, and immediate filtered CSV export. |
| 10 | As-of text is formatted on the server and passed as a string. Unexpected page errors fail browser tests. | Both browser engines, plus a controlled uncaught exception proving the error guard detects failures. |
| 11a | Actual request bytes and read duration are bounded before parsing, including Auth.js POST bodies. | Streamed/understated-length/oversize/abort/cancellation cases and supported real auth/API flows. |
| 11b | Login/current-password inputs have a UTF-8 byte bound; new-password rules retain the bcrypt limit. | Exact/multibyte boundaries and no-trimming/no-truncation cases. |
| 12 | Raw secrets beginning with `{` work; only a recognized `authSecret` JSON envelope is unpacked. | Raw/envelope/malformed/expired-cache/concurrent-load tests. |
| 13a | Disallowed/missing identities receive dummy hash work and generic failure outcomes. | Credential-policy and real-handler cases. This does not claim constant-time network behavior. |
| 13b | **Open deployment prerequisite:** shared hosted login throttling must be activated and verified before production release. | User deferred live AWS work. The Prebid deployment administrator owns this gate; no process-local counter or unverified deployment is represented as a completed remedy. |
| 14 | Managed configuration requires explicit account region; partial local builds no longer package a guessed region. | Build/runtime precedence and malformed configuration tests; operator target isolation. |
| 15 | The obsolete loading boundary is removed so unknown repositories return HTTP 404. | Authenticated Chromium/WebKit HTTP assertions; valid routes remain usable. This corrects application behavior under normal Next streaming semantics. |
| 16 | Each coverage glob explicitly enforces per-file thresholds. | A real child Vitest run passes at group level and fails on the under-covered file with the actual configured rule. |
| 17a | Password-bearing mailto links are removed; clipboard failures appear inside the credential dialog. | Component and production administration flows. |
| 17b | Creation/reset use one prepared credential/expiry and atomic revision update. Expired or legacy undated temporary credentials require reissue; permanent passwords do not expire under this setting. | Exact expiry, configured lifetime, reset/change races, file/database expiry equality, and real login/reset/change flows. |
| 17c | Accidental dismissal requires confirmation, explicit acknowledgement clears the dialog, and reissue is available. | Keyboard/focus/component tests and real create-dismiss-reissue workflows. Plaintext is never retrieved from storage. |

## Final self review

The composition pass checked transport plus policy, not only isolated helpers. It found and corrected a read-deadline dependency assumption, stale password-form state across an identity change, and privacy assertions that needed route-specific canaries. It also checked current actor conditions at writes, invalid metadata diagnostics, input bounds before parsing, scoped query defaults, and pending-search/export interactions.

The first hosted runs exposed a Linux WebKit `ResizeObserver` error during the long select's exit animation. The select now closes immediately, and browser tests additionally cover reopening, viewport-resize closure/focus restoration, and bounds at the new size. The strict page-error detector remains unchanged. During subsequent local validation, one account-suite runner startup failed before test selection with Vite `code.charCodeAt is not a function`; an unchanged isolated rerun and the final complete pipeline passed. The cause of that startup failure was not established, and the failed attempt is not counted as passing evidence.

No new dependencies, reporting database, historical aggregation, agent execution, or final product layouts were introduced by this remediation. Tests explicitly isolate AWS credentials/configuration and use local services; a missing mock must not discover the developer's real cloud identity.

## Remaining release and review work

- Live Amplify app/branch settings, IAM, package handling, and the actual account-table population were not verified. AWS access was deferred by the user.
- Shared deployed login throttling remains open as stated above. The release procedure treats it as a prerequisite.
- No production migration/provisioning, credential retirement, merge, or deployment occurred.
- The independent team must review this updated revision. GitHub inline threads were not automatically resolved or replied to.
- Hosted CI belongs to the published head. Check the [PR checks](https://github.com/prebid/repo-activity-dashboard/pull/2/checks); the local receipt is not a claim about a later workflow run.
