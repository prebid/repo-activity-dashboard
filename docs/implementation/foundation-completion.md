# Foundation implementation completion

**Current verification:** the [second self-review](foundation-second-review.md) records additional fixes and the newer `203efc5` checkpoint. The completion evidence below remains the preceding checkpoint, not a substituted claim about the new code.

The four implementation findings from the self-audit are resolved in the repository. The handoff describes implemented behavior and executable evidence; it does not assign repairs to the reviewer. Final layouts and the future reporting database remain outside this milestone.

Code checkpoint: `c4d11b51c3d78c7e48ae5de78a1c0911397ef0af`. Branch: `codex/quality-foundation`. This is implementation-author verification, not independent approval or a deployed-environment result.

## Closed findings

| Finding | Implemented result | Executable evidence |
| --- | --- | --- |
| AUTH-01 — public first-admin registration | Public setup is closed. An IAM-authorized operator targets named tables, saves a private generated credential before mutation, and creates the initial user/email claim/bootstrap marker atomically. The first password must actually change. Recovery and inspection commands are implemented. | Public-endpoint tests; operator file/argument tests; concurrent bootstrap and lost-response integration cases; production reset/change flow. |
| AUTH-02 — stale session authority | Each production session use reads an atomic account/whitelist snapshot. Current roles are intersected, disabled/mismatched accounts are refused, and password/access revisions invalidate prior cookies. Admin writes recheck authority in their transaction. | Real Auth.js cookie tests; independent active/role/identity/version race cases; production HTTP old-cookie rejection. |
| AUTH-03 — duplicate/partial account creation | A conditional email claim and UUID user commit together. Failed claims cannot leave partial new accounts. Password/access writes use revisions and guarded updates. The legacy-link migration validates first, preserves existing IDs/hashes/explicit access, and is repeatable. | DynamoDB Local tests for same-email races, rollback, duplicate legacy identities, disabled/unlisted accounts, self-resets, and migration/recovery. |
| HOST-01 — missing server-runtime configuration | An allowlisted non-secret manifest is generated, traced, and packaged with the server. Managed builds require complete configuration. The signing key is loaded at runtime through Secrets Manager and SDK credentials, with bounded service requests and cache expiry. | Manifest rejection/secret-canary tests; managed-secret tests; copied-artifact smoke test with no source tree or `.env`. |

The production smoke test exercises the compiled server over HTTP, not an imported handler alone. It verifies signing-key retrieval through a signed SDK request, CSRF/login cookies, protected account creation, self-reset, mandatory password change, and restored access with a new session. The account service is real DynamoDB Local; the secret service is a controlled HTTP fixture. Actual AWS IAM enforcement is outside this local test.

## Verified deliverable

The final receipt records a clean locked install and `npm run check:all`, with live-service environment settings removed. Required reports are nonempty and their individual outcomes are checked; skipped, pending, expected-failure and flaky cases do not count as a complete pass.

- Strict application/test/tool types, type-aware lint, formatting and resolved architecture/removal checks.
- Unit/component tests, focused account-store integration coverage gates, and local concurrent/failure cases.
- Production-auth and preview builds, packaged-production HTTP verification, Storybook and Chromium/WebKit tests.
- Full npm dependency audit, including development packages.
- Pinned Secrets Manager SDK and TypeScript operator runtime; pinned Java setup action and checksum/object-version-pinned DynamoDB Local 3.3.2. Java is a test dependency, not an application runtime.

[Verification receipt](evidence/completion/verification.json) · [Source manifest](evidence/completion/source-manifest.json) · [Review inventory](evidence/completion/review-inventory.json) · [Account operations](account-operations.md)

## Preservation and scope

The selected Next/React/TypeScript/Tailwind/Radix/Recharts stack and Amplify target remain. The repository catalog and agreed product definitions are unchanged. Reporting still uses prepared samples; the retired ingestion/storage pipeline has not returned. Existing account data is not deleted or recreated by the migration. Previously issued cookies require sign-in after the versioned-session upgrade.

No live account mutation, cloud deployment, remote push, or review-team message was performed. Hosted Linux CI, live IAM/resource configuration and Amplify acceptance remain separate environment verification. The implementation and its local proof are complete; those limits are not claims of independent approval or comprehensive future-product coverage.
