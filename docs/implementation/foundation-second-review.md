# Second self-audit and adversarial review

Reviewed baseline: `ff557a6`. Remediated code: **203efc5e9366963994fae337539700f6e260779f**. Date: 2026-10-25. This is another implementation-author review; it does not replace independent review.

**Result:** five additional request, state, or composition gaps were addressed. All registered checks pass. The retained stack remains appropriate, and the account boundary is now explicitly scoped rather than coupled to mutable process-wide targets. No page layouts or reporting database were added.

## Findings and disposition

| Finding | Reproduction and practical scope | Implemented result |
| --- | --- | --- |
| R2-01 — missing custom-API request-origin protection | With a valid admin cookie, the built server accepted a `text/plain` reset from an untrusted origin. All three custom mutation handlers also accepted that shape in route tests. Exploitation depends on cookie delivery, including a same-site sibling-origin scenario; this is not a claim of a live attack or that every unrelated website receives cookies. | Custom account mutations require the configured canonical origin and `application/json`, independently of identity/role checks. Missing/null/prefix-spoofed origins and simple content types are denied before mutation. Auth.js keeps its own CSRF mechanism on its endpoints. |
| R2-02 — bootstrap race with ordinary provisioning | The previous test covered two bootstrap requests. An ordinary create committed after bootstrap's empty-table scan and the bootstrap still succeeded. Both commands are operator-authorized; this was an initialization-invariant gap. | Every first-account creation registers the initialization latch in its transaction. Bootstrap can no longer commit behind ordinary provisioning. Once initialized, normal creates avoid writing the latch again. |
| R2-03 — incomplete self-reset identity check | A stale principal with the same account ID/version but an earlier email was accepted for self-reset after a controlled identity-change interleaving. There is no public email-change endpoint; this is conditional integrity hardening, not an unprivileged-rename exploit. | Self-reset checks the authenticated email as well as ID, version and role. The transaction continues to verify current account and whitelist state. |
| R2-04 — operator/web configuration coupling | Two helper invocations with different regions reused the first regional client and changed global target variables. Invalid unrelated web-auth configuration blocked an otherwise explicit operator target. Single-command CLI processes did not share the first region across separate process launches. | Each operator invocation owns a client/store for its validated target and closes that client on success or failure. It does not change application environment variables or require web auth configuration. |
| R2-05 — stale build marker after failure | A controlled replacement-build failure left the old mode/success marker present. This was a local launcher-state gap, not an observed hosted deployment failure. | A new build invalidates the marker before configuration/build work. Failed builds cannot leave that stale wrapper success indicator. |

SameSite cookies do not distinguish sibling origins within one site, and a server accepting JSON as `text/plain` permits browser-simple requests. The fix follows configured-origin verification and rejection of simple content types. [OWASP CSRF guidance](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)

The new route, database and subprocess cases failed against the prior implementation before being repaired. The production HTTP test separately reproduced the accepted reset. [Reproduction record](evidence/second-review/reproductions.json)

## Architecture assessment

| Boundary | Responsibility and lifetime |
| --- | --- |
| `account-target` model | One validation contract for region and distinct table names. No web-auth dependency. |
| AWS client factory | Creates a transport for explicit configuration. No application target singleton or environment mutation. |
| `createAccountStore` | Account operations close over one client and a cloned, immutable target. Methods can be reused without rebinding `this` or changing global settings. |
| Server store adapter | Lazily creates the application's store, preserves preview isolation, and reuses the transport/configuration—not permission data. Configuration changes require a new server process. |
| Operator entry point | Validates explicit targets, owns/cleans up its client, and uses the same account operations. It is independently usable when web-auth settings are broken. |
| HTTP access boundary | Applies request-origin/JSON policy, authentication and current-role policy. The transaction still rechecks state before writes. |

The thin users/whitelist adapters preserve the application's existing call sites. Unused global table lookup and operator-facing adapter exports were removed. The import graph now rejects application imports of operator command scripts.

This is deliberate DynamoDB account integration, not a claim that any database can be swapped in without implementing the same transactional guarantees. Reporting remains separate behind typed presentation inputs. The existing table/paging contracts, prepared data, catalog and frontend components were preserved; the complete browser suite was rerun.

## Additional adversarial controls

- Two stores can use the same email in separate table pairs without mixing records, even after the caller mutates its original target object.
- A real whitelist scan spans more than one service page, preserves disabled state and excludes unrelated stored fields from the returned DTOs.
- Client-supplied Auth.js session-update data cannot promote a viewer or revive a revoked session. The existing session design held under these tests; it did not require weakening or replacing Auth.js.
- The production HTTP test isolates missing/null/untrusted origin failures from content-type failure and verifies that the target account revision remains unchanged.
- Existing concurrent-email, revocation, partial-write rollback, lost-response, migration and mandatory-password-change cases remain in the suite.

## Verification and limits

`npm run check:all` passed at the code checkpoint:

- **200** unit/component cases; **19** DynamoDB Local cases; **1** packaged-production HTTP scenario; **18** Chromium/WebKit cases.
- No failed, skipped, pending or flaky cases in the required reports.
- Formatting, lint, types, architecture/removal checks, coverage gates, both builds and Storybook passed.
- Full npm audit: **zero advisories**. Dependency lockfile unchanged.
- Application unit line coverage: **54.61% across 84 files**; the separate account-integration scope: **91.35% across three modules**. The account-store gate follows the moved implementation, not the thin adapter. These percentages are not combined.

This pass verified the working source and a fresh production build; it does not relabel the earlier clean-install receipt as a new clean install. Current source hashes and individual results are recorded separately. No live AWS data, deployment, remote branch, or reviewer conversation was changed. Hosted Linux CI, actual Amplify/IAM acceptance, and independent review remain separate results.

[Verification](evidence/second-review/verification.json) · [Source manifest](evidence/second-review/source-manifest.json) · [Change inventory](evidence/second-review/change-inventory.json) · [Unit cases](evidence/second-review/vitest.json) · [Database cases](evidence/second-review/accounts.json) · [Production HTTP](evidence/second-review/production.json) · [Browsers](evidence/second-review/playwright.json)

No additional unresolved implementation finding was confirmed within this pass's reviewed scope. That is a bounded review result, not a guarantee that no further defect exists.
