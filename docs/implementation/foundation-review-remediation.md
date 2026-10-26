# Foundation review remediation plan

Status: implemented and locally verified at code checkpoint `1fa73d5e21214af60a65670b5a62fe15c05c8519`, 2026-10-26. See [verification and finding dispositions](review-remediation-verification.md) for completion evidence and open deployment prerequisites. The design below records the agreed approach to [PR 2](https://github.com/prebid/repo-activity-dashboard/pull/2) feedback at baseline `7a567cd50a4fc75568c425fcd2bf2d44c7cee112`.

The foundation needs corrections to authorization, account compatibility, runtime packaging, browser state, and verification. Keep the chosen Next.js, TypeScript, Tailwind, Radix, Recharts, and Amplify stack. Complete this work before page-layout development or real reporting integration.

## Settled product and delivery decisions

- The dashboard is an internal Prebid tool. All reporting pages require sign-in, including Contributors and Companies. The public status of `prebid/github-activity-db` does not make the dashboard public.
- Administrators create accounts and privately distribute expiring temporary passwords. Retain this workflow and add usable reissue/recovery; invitation links and a different identity provider are outside this milestone.
- A planned maintenance window is acceptable for the eventual deployment.
- Reporting remains prepared sample data. Add the authorization boundary around those reads now; connecting a database remains later work.
- Live AWS inspection was explicitly deferred. Do not require an AWS login for local implementation. Live account changes, permission changes, deployments, and merging into a deployment-connected branch remain separate actions.

Use a configurable 24-hour temporary-password lifetime as the proposed engineering default, with a validated range of 1 to 168 hours. These bounds are engineering recommendations, distinct from the approved requirement that temporary credentials expire. They do not introduce account deletion or periodic expiration of permanent passwords.

## Investigation conclusions

The ten inline comments and seven summary items contain 23 independently tracked issues when composite comments are separated. Their identifiers below correspond to the investigation ledger, not implementation commits.

- Anonymous HTML and server-component responses contain report rows despite a layout redirect.
- A production-browser reproduction confirmed the password-change bounce: one of three sequential WebKit attempts returned to the form after a successful password/session update. Toolbar navigation also bounced; full document navigation recovered. An experimental replace-and-refresh variant succeeded in six sampled attempts across Chromium and WebKit. These samples establish a defect and a plausible remedy, not exhaustive correctness.
- Production/local-DynamoDB reproductions confirmed failures for documented numeric whitelist timestamps. A whitelist-only incompatible record can escape migration preflight while still breaking the admin list and provisioning.
- A temporary account-store error expires a valid cookie through Auth.js. Its catch-all JWT-callback error path also catches custom error classes. The installed SDK does not classify the observed transaction-cancellation/conflict shape as retryable.
- Browser probes confirmed stale same-route table filters, WebKit history-update failures, duplicate session requests, and date-format hydration mismatch.
- Removing only the repository loading boundary in a disposable build changed unknown-repository responses from HTTP 200 to 404; valid repositories remained 200. The current result is explained by streaming, not a malfunctioning `notFound()`.
- Unreadable runtime settings cause authentication HTTP 500 while health remains 200. Actual Amplify file ownership or permission normalization is unverified.
- The repository has an active Amplify push webhook. The latest inspected delivery was for the foundation branch and received HTTP 202. That does not prove production-branch auto-build or successful deployment.

The posted [review](https://github.com/prebid/repo-activity-dashboard/pull/2#pullrequestreview-5651321398) is the shared feedback record. Local machine receipts are under ignored `test-results/review-investigation-2026-10-26/`; permanent regression tests must carry the behavioral evidence into the PR.

## Implementation ownership and invariants

### Module responsibilities

Keep these responsibilities separate while reusing the existing policy and store modules. The paths identify intended ownership; do not create a general framework or duplicate a working abstraction to satisfy the names.

| Responsibility | Intended home | Allowed dependencies and callers |
| --- | --- | --- |
| Token verification and Auth.js protocol | Internal session transport beside `src/lib/auth/auth.ts` | Auth.js owns cryptography, CSRF, cookie names/chunks, and token expiry. Only the server viewer/session adapter consumes raw session claims. |
| Current account decision | `src/lib/auth/viewer.ts` with the existing pure session/access policies | Reads the account snapshot and clock. Shared by pages, loaders, session responses, and account API access. |
| HTTP and navigation decisions | Existing `api-access.ts`, auth route adapter, and page guard | Translate the common decision into API status or navigation. Do not independently recompute permissions. |
| Prepared reporting reads | A small `src/server/reporting` module | Calls the page/data guard itself, returns models from `src/models`, and imports existing samples. No database connection or reporting framework. |
| Account writes and issuance | Existing account store plus a pure credential policy | Operator and HTTP adapters use the same prepared operation. Preserve transactional actor and target conditions. |
| URL and preference coordination | Client-only `src/lib/navigation` controller | Next navigation and pure table-query helpers. No authentication, AWS, sample, or feature imports. |
| Feature composition | Route-level client screen components | Connect controllers to feature views through typed props. Feature views do not import route code or other features. |
| Table mechanics | Existing shared `DataTable` | Controlled query/events, column visibility, rendering, and export presentation. No URL, storage, or Next router access. |

Extend the existing dependency checks for these ownership rules, including a negative fixture that imports raw session access from a protected page instead of the viewer guard. Do not weaken server/client or feature-isolation rules to accommodate the refactor.

### Current viewer and protected data

One server-only viewer service owns current authorization. It verifies session identity and reads the current account/whitelist snapshot, including the account revision. It distinguishes anonymous/invalid credentials, denied access, mandatory password change, and service unavailability.

Layouts consume that service to render navigation, but are not the only access gate. Each protected page checks access before constructing its view. Reporting loaders also call the server guard themselves; a caller-provided viewer object is not proof of authorization. Initially these loaders return the existing typed samples. They do not introduce database clients, historical aggregation, or a speculative reporting service.

Keep feature views and shared components on sanitized presentation models. Server-only authorization and sample loading stay out of client bundles. The root layout supplies generic providers; the authenticated shell belongs with the protected routes.

Both current `useSession` consumers can receive server-validated props: the toolbar and password-change screen. Split the latter into a server page and a client form, and remove the global SessionProvider after both are converted. Keep Auth.js's supported client sign-in/sign-out functions; they do not require that provider. This removes session-fetch state from ordinary page presentation rather than relocating it.

Memoization deduplicates viewer reads within one server render/request only. Use React request/render caching for page composition and an explicitly request-owned memoized reader for HTTP handlers; do not assume React caching works identically outside a render. Never cache permissions by user ID in a process-global map. Existing transactional actor conditions on mutations remain necessary after an earlier access check passes.

Revocation applies to the next protected server read or write. Already-delivered browser content, prefetched responses, and back/forward caches cannot be remotely erased. Protected server responses must remain private and non-cacheable across users. Avoid speculative prefetch of protected screens during unauthenticated or password-change flows; invalidate the router after successful sign-in, sign-out, and password change. A lightweight app-owned, payload-free auth-transition notification can refresh other open tabs without restoring session polling or relying on Auth.js private broadcast internals. Such a notification can request a server refresh but never grant identity or access.

Tests must distinguish a new sibling-page server request after revocation from redisplaying data fetched before revocation. The former must be denied. Do not claim the latter is impossible. [Next.js 15 cache behavior](https://nextjs.org/docs/15/app/guides/caching)

### Session failure behavior

Move fallible current-account reads out of the Auth.js JWT callback. Throwing a different error inside that callback is not sufficient: Auth.js still clears the cookie.

The session endpoint, page guards, and account APIs must agree on current identity. Removing the callback read must not leave `/api/auth/session` exposing a revoked or downgraded identity.

Use a thin response adapter around the supported Auth.js handlers. For GET/POST session requests, first let Auth.js perform token verification and its CSRF checks. Before returning that response to the network, validate its verified identity/revision and resolve the current account. Replace the session's user projection with the current safe viewer only when allowed. Do not trust role/name/password-change claims from the cookie as current account state, and ignore client attempts to update identity or privilege.

On successful current authorization, preserve all library cookie headers and its session expiry. On a temporary lookup failure, return 503 with no session data and no Set-Cookie header; the original cookie remains available for retry. For a revoked account, return the existing null-session contract without renewing the cookie. Leaving its old opaque cookie to expire does not restore access: every protected operation checks current account state/revision. Invalid-token cleanup and normal sign-out remain Auth.js responsibilities. Do not implement custom cookie parsing, JWT cryptography, or blanket exception-to-logout behavior.

Server-rendered reads use the same internal Auth.js response reader directly, without an HTTP loopback fetch. Construct any internal session request from the configured canonical origin and incoming cookie header, not a caller-supplied destination. Preserve non-OK library/configuration outcomes so they cannot become truthy sessions or misleading successful reads. Calls outside a cookie-writing response do not promise to renew cookie lifetime. Retain the configured Auth.js maximum age and document the actual renewal points after removing the client provider.

Only session GET/POST responses receive this current-viewer projection. Other Auth.js actions keep their supported protocol. Credential sign-in service failures need a safe retry-oriented UI message within that protocol; do not assume exceptions caught inside Auth.js will emerge as an outer HTTP 503. In particular, do not replace all Auth.js responses or bypass its sign-in/sign-out CSRF handling to make session projection easier.

Six disposable compatibility checks against the installed Auth.js version established the feasibility of this response-adapter approach: cookie/expiry forwarding, transient-failure recovery with the original cookie, revoked-session suppression, malformed-cookie cleanup, invalid session-POST CSRF rejection, and ignoring client privilege updates. They used controlled dependencies, not a deployed implementation. Permanent handler and production HTTP tests must additionally cover chunked cookies, expiry, sign-out, and configuration failures.

| Current decision | Reporting page or read | Session endpoint | Account mutation |
| --- | --- | --- | --- |
| Valid identity and current access | Return protected view | Current safe viewer and library cookie behavior | Apply action policy and transactional checks |
| Valid, unexpired temporary credential requiring change | Redirect to password change before loading report data | Current viewer marked as requiring change | Only password change is allowed; recheck expiry and current-password proof |
| Missing/invalid/expired token | Login destination, no report data | Auth.js null-session/invalid-token behavior | 401 |
| Disabled, deleted, revision-mismatched, or expired temporary access | Login/reissue destination, no report data | Null session; no positive renewal | 401 |
| Current identity lacks the action's role | Deny that action/view | Current viewer with its actual role | 403 |
| Store/secret service unavailable | Retryable error, no report data | 503, no session body or cookie mutation | 503, no account write |
| Malformed account/configuration data | Safe operator-attention error, no report data | Safe 500, no misleading session or cookie mutation | Safe 500, no account write |

- Invalid, expired, or revoked access is denied through the appropriate login/authorization response.
- Store or secret-service unavailability denies protected access with a retryable response and does not delete an otherwise valid session cookie.
- Retry only the known transient transaction-conflict read shape, with a bounded total budget. Proposed defaults are three maximum application read attempts within a shared five-second account-read deadline, with full-jitter delays starting at 50 ms and capped at 200 ms. SDK attempts count against that same deadline. Forward cancellation and do not start another attempt after the budget is exhausted. Do not retry conditional authorization failures, invalid records, or writes indiscriminately. These are tested operational defaults, not measured production-latency promises.
- Client-supplied session updates cannot increase privileges or replace authoritative account state.

### Account compatibility and temporary credentials

Separate compatible record reading from rules for new writes. Accept documented string and finite numeric timestamp representations without weakening validation of identity, active status, roles, links, or revisions. Do not silently discard malformed authorization records.

Preflight must inspect both complete account and whitelist populations, including whitelist entries without accounts. Report affected record keys and invalid field names without passwords/hashes. Validate before applying any migration and preserve existing IDs, hashes, active flags, and explicit roles. Do not normalize unrelated data as a side effect of a read. Do not reinterpret identity keys merely to make a record pass a new schema.

Preflight validation failure means zero migration writes. This is not a promise of an all-or-nothing migration across the entire database: DynamoDB scans are not a multi-table snapshot, and apply is a sequence of conditional transactions. Under the maintenance window, stop old writers and rerun preflight immediately before apply. Each apply operation checks its target assumptions. An interruption/conflict reports completed and pending work, stops safely, and permits an idempotent rerun; do not attempt a speculative rollback of already committed links. Test interruption and changed-state conflicts, not just the successful migration.

Use one temporary-credential issuance policy for bootstrap, administrator creation, operator creation, and every reset path. A prepared operation contains the target identity/version, generated password/hash, issuance time, and expiration time. HTTP and operator adapters consume that same operation. The operator persists and syncs its private credential file, including the exact expiry, before committing; a file-write failure must cause zero account mutations. Do not independently calculate expiry in the output file and database writer.

Store expiry with the new hash/revision atomically. Credential checks and password-change authorization enforce it using the server clock; recheck the credential/version/expiry at the conditional write. Reissue atomically replaces the prior credential, and concurrent resets must not both claim success against the same version. Permanent-password changes remove temporary expiry. Reject an already-expired prepared operation. DynamoDB TTL deletion is not an account-expiration mechanism.

Expiry boundary is `now >= expiresAt`. Provide a validated deployment policy with a 24-hour default and a documented upper bound; keep its default usable by both the web process and standalone operator without requiring web secrets. Include the expiry in create/reset response schemas and private operator files. A lost HTTP response is not evidence that a credential was not issued: the admin recovery is explicit reissue, not retrieval or blind automatic retries.

Preflight identifies legacy temporary credentials without expiry. Their recipients need administrator reissue before those credentials can be used under the new policy; do not silently grant them indefinite validity. Permanent passwords are not subject to the temporary lifetime.

The admin UI presents the temporary password and expiry transiently, supports copying and reissue, and makes accidental dismissal recoverable. Never persist it in local storage, URLs, telemetry, or email links. Explicit Done acknowledges receipt; Escape/outside dismissal before acknowledgement uses an accessible confirmation instead of silently losing the delivery opportunity. Reissue remains available after dismissal/reload. Clear the plaintext after completed dismissal. Copy/reset errors appear in the active dialog, and a failed account-list load must not be presented as an empty successful list. These are recovery corrections, not a new administration layout.

### Runtime and request boundaries

Produce non-secret server configuration files with explicit final mode 0644 after writing, including under a restrictive umask and when overwriting an existing file. Operator credential files remain 0600. Preserve useful internal failure codes such as EACCES while returning safe public errors. Logs must not serialize request bodies, cookies, passwords, signing keys, or entire failed records; use safe error categories and a correlation identifier.

Managed deployment requires an explicit account-store region. Separate the partial build manifest from the fully validated runtime target: an unconfigured local production build can compile, but production authentication cannot start account operations with an incomplete target. Persist only an explicitly supplied build region. Resolve runtime `DYNAMODB_REGION` first, then the explicit packaged account region; any supported local-only `AWS_REGION` fallback must be documented and must never override an explicit target. Do not invent `us-east-2` in a production build manifest. Keep operator target arguments independently mandatory.

Secret parsing retains the documented raw-text and JSON forms. Recognize the JSON envelope only when it has the expected `authSecret` property, validate that property, and otherwise validate the original raw text. Do not expose secret content in diagnostics.

Make `build` and `start` use production authentication. Provide explicit `build:preview` and `start:preview` commands, keep `dev` as the clearly documented local fake-data workflow, and bind preview to loopback by default. Update the launcher, Playwright, `check:all`, Amplify aliases, README/operations guidance, CLAUDE.md, and build-mode tests together. Preserve the check that build and start modes match. Do not change instruction files ahead of the behavior they describe.

Bound actual request bytes before Auth.js or account handlers parse bodies. A Content-Length check alone is insufficient; absent or misleading lengths must not bypass the limit. Cancel oversized reads and return 413 without invoking credential verification. Preserve the supported Auth.js form/JSON and CSRF flows. Use a 16 KiB body limit and a separate 1 KiB UTF-8 limit for login/current-password input as proposed engineering bounds, with exact-boundary and multibyte tests. Retain the existing 72-byte new-password policy and do not trim passwords. Legacy passwords beyond the new verification bound require reset; do not silently truncate them to preserve login.

The bounded reader owns cancellation and a five-second body-read deadline, returns a reusable bounded request for Auth.js, and preserves the request method/URL/required headers. A read timeout returns 408; an already-disconnected request must release its reader without continuing work. Verify it at the actual HTTP boundary, including streamed bodies and aborted clients. Unit tests using a pre-parsed object do not prove resource bounds. Body-limit errors must not expire existing session cookies.

Reduce password-verification timing differences for unknown/disallowed accounts using equivalent password-hash work and generic failures. This does not establish constant-time network behavior. Deployment-level throttling must work across instances; an in-process counter is not an equivalent protection.

### Table state and deterministic rendering

The application table controller owns URL synchronization and account preferences. The reusable table consumes typed query state and callbacks and remains usable in component tests and Storybook without Next routing. Preserve the existing complete-population and externally paged input contracts. Convert all four DataTable call sites across AllRepositoriesView, RepositoryView (PRs/issues), and ContributionView, plus the foundation story and component tests. Remove the old internal URL hook in that same package so there is one state owner.

Use `useSearchParams()`/pathname observation and Next's supported native history integration with null external state. Do not pass private router history state or manually broadcast popstate. Keep one canonical committed/effective query and a separate input draft; the draft is not a second request/export query. Prefer a 250 ms debounce as a tested interaction default. The debounce owns a captured scope/generation and is invalidated when navigation supersedes it.

| Event | Required transition |
| --- | --- |
| Type search | Update the input draft immediately. On debounce, commit search plus page 1 in one URL update. |
| Enter/blur | Flush the latest draft once; do not duplicate a pending commit. |
| Sort or page while draft is dirty | Commit the latest search and chosen sort together, reset to page 1, and supersede the old page intent. If the draft is clean, apply the requested action normally. |
| Export while draft is dirty | Commit/capture the latest complete query and export that scope. Disable stale exports while an externally paged result is catching up, or export through the controller with the captured query. Never use rows from an older query. |
| Back/forward or same-route link | Cancel the pending draft, adopt the destination query, and update both the input and displayed result. |
| Repository/report/viewer changes | Cancel timers and obsolete adapter work; reset/remount by a scope key that includes those identities. The query namespace alone is insufficient. |
| Matching result shrinks | Derive a valid effective page and reconcile once in the controller. Never relabel old rows as the corrected page or write history during render. |

Restore saved sort only when the URL has no explicit sort. Server HTML and the first client render use the same URL-derived state; apply storage-derived defaults after hydration in controller memory without an eager history write. Subsequent user actions materialize the effective query in the URL. Include viewer and report/repository scope in preference identity. For externally paged results, reconcile only against the matching result scope. Preserve unrelated/repeated parameters, the 100-row limit, and full-filtered export semantics.

Format the as-of display label on the server and pass the string; keep the underlying timestamp separately if needed for semantics. Do not suppress hydration errors. For the current sample-backed repository page, remove the obsolete route loading boundary that commits HTTP 200 before slug validation. Future loading UI belongs inside an already-authorized, valid route. Check the not-found UI in a browser and HTTP status separately: text embedded in an RSC fallback is not proof that the UI is visible.

## Alternatives and tradeoffs resolved

| Choice | Selected approach and reason |
| --- | --- |
| Layout-only or middleware-only access | Use current authorization at pages/data reads and APIs. Navigation guards remain useful, but cannot own every data boundary. |
| Throw a typed error inside the JWT callback | Resolve fallible account state outside it. Auth.js catches both generic and typed callback errors and clears cookies. |
| Replace Auth.js or write a cookie/JWT layer | Keep supported library handlers and add current-account response projection. This preserves protocol behavior with a smaller change surface. |
| Move SessionProvider to password change | Supply both existing consumers with current server props and remove the provider. Add cache invalidation for explicit auth transitions instead of duplicate session fetching. |
| Put Next routing directly into DataTable | Use an application controller and controlled table props, preserving isolated tests/Storybook and future adapters. |
| Rewrite all legacy records to the new shape before use | Read documented compatible formats and perform explicit, validated, repeat-safe migration only for necessary links. |
| Suppress hydration errors | Produce deterministic display strings and fail tests on actual hydration errors. |
| Claim process-local login throttling is sufficient | Keep shared hosted enforcement as an explicit release prerequisite while AWS work is deferred. |

## Work packages and verification

Each package contains its behavior changes, tests, and affected documentation. Avoid commits that change a contract while leaving its callers or test configuration incompatible.

| Order | Package | Exit evidence |
| --- | --- | --- |
| 1 | Verification foundation | Correct glob-specific per-file thresholds. Add a counterexample proving an under-covered file fails even when its group average passes. Establish a reusable production-browser fixture with synthetic accounts, isolated services, bounded cleanup, and outcome assertions rather than diagnostic-only pass banners. |
| 2a | Compatible account records and preflight | Legacy read/preflight cases pass with zero writes on validation failure. Whitelist-only records are checked. Interrupted/conflicted apply reports partial progress and reruns safely. |
| 2b | Runtime configuration and build commands | Non-secret packaging permissions, region precedence, secret formats, and production/preview commands have focused tests. All command consumers change together; existing auth flows still work. |
| 3 | Viewer authorization, auth boundaries, shell, and password navigation | Land the current-account resolver, session response adapter, page/data/API guards, both server-provided viewer consumers, provider removal, and navigation refresh together. New unauthorized HTML/RSC reads contain no report rows. Outages preserve cookies and deny access. Validate real CSRF/body-limit paths. |
| 4 | Expiring temporary credentials and reissue | Shared prepare/commit operations, API response models, private operator files, record parsing, expiry enforcement, preflight reporting, and UI reissue change together. Test create/reset/change/expiry races without live AWS. |
| 5 | Table controller and rendering | Browser history, same-route navigation, refresh, restored preferences, pending searches, paged responses, and exports agree. Hydration errors fail the browser suite. Valid/unknown repository response statuses are asserted over HTTP. |
| 6 | Documentation, full regression, and review handoff | Update contracts and operations to the actual implementation. Run `check:all`, inspect individual machine results, refresh the PR head/review state, and reconcile every finding. Record deployment prerequisites separately. |

Introduce each regression test with its corresponding remedy. Enable the browser-wide unexpected-page-error failure gate in the same package as the known hydration repair so the final package remains coherent. Package 3 includes the existing password-navigation correction because provider removal and server-provided password-page identity change that flow; package 4 then adds expiry/reissue policy to it.

Run focused tests and relevant type/boundary/build checks per package. Run the full registered pipeline after composition is complete, and repeat it only for subsequent relevant changes or failures. Do not repeatedly run all tests merely to accumulate green runs.

## Finding ledger

The rows below record intended outcomes; current completion status is in the verification report. "Accept" does not imply that a GitHub thread is resolved. Compound comments retain separate rows.

| ID | Disposition and owner | Required regression or acceptance evidence |
| --- | --- | --- |
| 01 | Accept; viewer service, page composition, reporting loaders | New anonymous/revoked server requests cannot obtain report rows through HTML, RSC, direct loader use, or sibling navigation. Allowed requests return expected rows. Separate this from redisplay of already-delivered browser data. |
| 02 | Accept; account record reader and preflight | Documented numeric/string timestamps support sign-in/list/create/inspect/migrate. Include whitelist-only records, invalid metadata, identity conflicts, failure before writes, partial-apply interruption, and safe rerun. |
| 03 | Accept packaging robustness; runtime writer | Both configuration files have readable final modes under restrictive umask and overwrite cases. Private credential-file modes remain private. Unreadable-file errors preserve safe diagnostic causes. Live Amplify impact remains unverified. |
| 04 | Accept operational gap; deployment administrator | Ordered maintenance/preflight/role/configuration/deploy/migration/acceptance/rollback procedure. Verify actual deployment triggers before merging to a deployment-connected branch. Live execution deferred. |
| 05 | Accept; password-change flow | Production browser completes first-login change, lands on `/repos`, and navigates onward without a full reload. Cover prefetched/dwelled routes and failed automatic sign-in fallback. |
| 06 | Accept; viewer/session adapter and account reader | Store outage/conflict does not expire a valid cookie or reveal protected data; recovery works with the original cookie. Revocation denies access without cookie renewal. Preserve CSRF, expiry, chunked-cookie forwarding and invalid-token cleanup. Conflict retries stop at their bound. |
| 07 | Accept; app launcher and scripts | Ordinary build/start use production auth; explicit preview works without AWS; mismatched modes fail; preview defaults to loopback. Test actual child invocation and HTTP identities. |
| 08 | Accept; authenticated shell and password page | Authenticated initial HTML shows the correct viewer. Both former useSession consumers use server props; hard loads do not require a client session-fetch cycle. Cross-tab auth-transition refresh and password changes remain functional. |
| 09a | Accept; application table controller | Sort survives router refresh, and browser/router/query state agree without copying private Next history markers. |
| 09b | Accept; application table controller | Same-route links, tabs, back, and forward update displayed search/sort/page state to the effective destination query. |
| 09c | Accept; search interaction | Rapid typing commits the intended final query without Safari history errors. Pending writes cannot overwrite a later navigation or viewer/table change. |
| 10 | Accept; presentation formatting and browser harness | Chromium and WebKit hard loads match server date output and emit no unexpected hydration/page errors. The error detector itself is exercised by a controlled failing page. |
| 11a | Accept; HTTP input boundary | Oversized JSON/form/chunked bodies are rejected before parsing or credential verification, including absent/incorrect Content-Length. Normal CSRF/sign-in/change/reset still work. |
| 11b | Accept; credential input policy | Password verification inputs are bounded separately from body size; new passwords retain the 72-byte rule. No silent trimming or truncation is introduced. |
| 12 | Accept; secret loader | Valid raw brace-prefixed values and valid JSON envelopes load; invalid envelope values fail; missing/expired service results do not become a preview secret or stale-key fallback. |
| 13a | Accept; credential policy | Unknown/disallowed/incorrect-password paths use generic outcomes and appropriate hash work. Test branch behavior deterministically; do not equate matching call counts with proven constant-time latency. |
| 13b | Accept; deployed authentication boundary | Shared hosting-level throttling is documented and verified before production release. The deployment administrator owns activation/measurement. Remains a release prerequisite while live AWS work is deferred. |
| 14 | Accept; runtime target resolver | Managed builds reject missing explicit account region; packaged/override precedence is tested. Unconfigured builds do not bake an accidental region; operator targets remain explicit and isolated. |
| 15 | Accept application HTTP contract; repository route | Authenticated unknown repositories return 404 with not-found content; valid repositories remain 200. Treat streaming as the cause, not a framework defect. |
| 16 | Accept; coverage configuration | A deliberate low-covered file causes the real per-file gate to fail despite a passing group aggregate. Current relevant files satisfy the intended thresholds. |
| 17a | Accept; admin credential presentation | Temporary passwords never enter mailto URLs, navigation URLs, persistent browser storage, or logs. Copy failures are visible within the dialog. |
| 17b | Accept; shared issuance and authorization policy | Creation and every reset set expiry atomically. Operator files and records share the same prepared expiry. Test file-write failure, exact expiry, reissue/reset races, expired change attempts, legacy missing expiry, and permanent-password change. |
| 17c | Accept; admin recovery interaction | Escape/outside dismissal cannot silently lose the only delivery opportunity. Accessible reissue works after dismissal/reload, and the old credential stops working. No plaintext retrieval is added. |

## Release boundary and completion criteria

Local implementation uses synthetic accounts, DynamoDB Local, and a controlled secret-service fixture. No test reads or mutates production accounts. Preserve the actual failing scenarios as automated behavior tests; copy only the needed probe behavior into maintainable shared fixtures.

Code completion requires the full registered quality pipeline, individual results with no skipped/empty required suites, and a finding-by-finding final-head review. Changes to test infrastructure must prove that intended files/cases are selected. Do not replace a missing browser or HTTP assertion with a source-string check.

The final composition review specifically checks these cross-package cases:

- A compatible legacy account still produces a current viewer after the session adapter change, and a whitelist-only incompatible record prevents migration apply before any write.
- A temporary credential expires while its form is open; submission cannot use a previously rendered viewer to bypass the current expiry/revision check.
- A reset races a password change or another reset; conditional writes prevent an obsolete credential from winning silently.
- A store outage after Auth.js has prepared renewal headers still returns no account data and no outgoing cookie mutation; subsequent recovery uses the original cookie.
- Sign-in/out/password transitions clear stale router state, including another open tab, while a forged browser notification can cause only a fresh server check.
- A user types a search and immediately sorts, exports, changes repository, or uses browser Back; no delayed callback resurrects the old scope/query.
- A fresh production artifact runs without source files or local `.env`; preview identities cannot be enabled by runtime request input, and the instruction/CI/build commands agree on mode.

The production fixture must not acquire public debug endpoints or request-controlled clocks. Inject clocks at policy/store boundaries for deterministic expiry tests, and seed expired records directly in isolated DynamoDB for HTTP/browser cases. Expected denied/invalid-input cases must be asserted deliberately rather than hidden by a broad browser-error allowlist.

The hosting throttling mechanism is a deployment responsibility. Prefer managed edge enforcement on the credential endpoints for Amplify; define its scope and acceptance procedure without claiming it is enabled. Shared-counter behavior, trusted client-address handling, and legitimate-user traffic must be checked before rollout. Do not add a speculative reporting database or an in-memory limiter to claim this item closed.

The deployment administrator must verify the actual Amplify app/branch, auto-build configuration, compute-role permissions, file packaging, configured account tables, and live record preflight before rollout. Use the approved maintenance window to stop old writers, preserve recovery material, apply the controlled transition, verify authentication and account administration, and retire legacy credentials only when rollback implications are understood. Health HTTP 200 alone is not authentication readiness.

The code may be ready for another review while these live checks remain pending. It must not be described as production accepted. No merge, deployment, credential retirement, review reply, or thread resolution is authorized by the existence of this plan.
