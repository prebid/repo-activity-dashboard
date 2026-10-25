# Foundation self-audit and adversarial review

**Historical audit checkpoint.** The four open implementation findings below have been addressed. Read [foundation implementation completion](foundation-completion.md) for the current code, behavior and evidence. The original findings/reproductions are preserved here rather than rewritten as if the earlier code passed.

Date: 2026-10-25. Reviewed baseline: `672860670ca91d8f5cf515332f208bafc9daf368`. Remediated code: **ef41880f722d56e7719cee3a3a6d40e610582c03**. This is a self-review by the implementation author, not independent approval. No push, pull request, deployment, or review-team message was performed.

**Verdict:** the frontend foundation is materially stronger and its confirmed local defects are fixed. It is ready for an independent **frontend-foundation review with explicit production-authentication blockers**. It is not approved for production deployment, and page layouts remain on hold pending review acceptance.

## Open production findings

These are source findings in the retained account integration, not claims about an inspected live deployment. They must not be obscured by the passing frontend checks.

| ID / priority | Finding and consequence | Disposition |
| --- | --- | --- |
| AUTH-01 / P1 | `api/auth/setup/route.ts` accepts an active admin whitelist address and a chosen password without proving ownership. Its scan-before-create also is not an atomic one-time operation. A new environment can expose an account-claiming path. | **Open.** The user requested a clearer decision before changing bootstrap. The [decision brief](account-bootstrap-decision.md) remains pending. Preview rejects this endpoint. |
| AUTH-02 / P1 | `base-config.ts` captures role and password-change claims at sign-in; `api-access.ts` and layouts trust those claims. Changing whitelist/account state or resetting a password does not invalidate an already-issued session. | **Open before production.** Define current-account/session-version checks and verify disablement, privilege changes, reset, and recovery against the actual auth store. No immediate-revocation guarantee is claimed. |
| HOST-01 / P1 conditional deployment blocker | `amplify.yml` builds production auth, but has no runtime configuration handoff. If deployment relies solely on Amplify console build variables, SSR will not automatically receive the auth secret/table configuration. | **Open integration work.** Use an explicit server-runtime secret/configuration mechanism and verify it on Amplify. Prefer IAM-based resource access; do not restore secret values to Next's public `env` map. No live configuration was inspected. |
| AUTH-03 / P2 | `adminCreateUser` checks existence then writes a UUID-keyed user and a separate whitelist record. Concurrent requests can create duplicate email identities; a second-write failure can leave a partial account. Email lookup remains a scan. | **Open before broader production account use.** Requires an atomic uniqueness/provisioning strategy and partial-failure recovery, not another frontend check. |

Amplify explicitly distinguishes build variables from SSR runtime variables. The hosting finding is conditional on how the real environment is configured; a local production build cannot settle it. [AWS runtime environment guidance](https://docs.aws.amazon.com/amplify/latest/userguide/ssr-environment-variables.html)

The retained credential flow also has no application-level login throttling. Whether an appropriate deployment control exists was not inspected. Include that in the production-auth acceptance work rather than claiming it is covered locally.

## Fixed findings and regression evidence

| ID | Defect or enforcement gap | Fix and verification |
| --- | --- | --- |
| SA-01 | The admin form offered `user`, but the new create schema allowed only `viewer`/`admin`, returning 400 for a visible option. | Shared role vocabulary now preserves all three existing choices. Each role is tested through the actual route; privilege checks remain independent. Role/password/copy controls now have associated labels. |
| SA-02 | Next search parameters can be arrays. A repeated `callbackUrl` reached string-only navigation code and left successful sign-in at the login screen. Repository view/age parsing also assumed scalar values. | Correct page-boundary types and a shared first-value reader. Actual repeated-parameter browser login now reaches Contributors. Multi-value filters remain preserved by serialization. |
| SA-03 | Reusing a table with a different query namespace but identical values did not notify its new controller. | Query namespace and viewer identity participate in notifications; callback/column identity alone still does not loop. Regression changes PR to issue scope in one mounted hook. |
| SA-04 | Sort/page buttons defaulted to submitting an enclosing form, weakening safe composition. | Explicit non-submit controls, including retry/export. A real enclosing-form component test verifies sorting/paging without submission. |
| SA-05 | Architecture rules covered components/features paths but missed `use client` route entry points and their indirect server imports. | AST-discovered client entry points feed the resolved graph. The same source inventory supports retirement checks; a real client-route → helper → auth fixture now fails, while normal route composition remains allowed. |
| SA-06 | Retained select/menu classes used old bare CSS-variable syntax. The built select had `max-height: none` despite a 350px available-height variable; menu transform origins were invalid too. | Explicit `var(...)` utilities. Browser tests assert the actual available-height bound and exercise selection, Escape, focus restoration, menus, and switches in both engines. |
| SA-07 | Recharts' keyboard accessibility layer placed a focusable chart inside `aria-hidden`, alongside its accessible text alternative. | Disable the hidden chart's keyboard layer. Axe reported the original `aria-hidden-focus` failure and passes on the repaired chart. The textual distribution remains available. |
| SA-08 | CSV formula-prefix handling missed line feeds, full-width formula characters, and leading whitespace before formula markers. | Preserve CSV quoting while escaping those string prefixes; numeric and missing values retain their meanings. Tests assert emitted bytes. This is not a claim about every spreadsheet import/re-save behavior. |
| SA-09 | New passwords longer than bcrypt's 72-byte limit passed validation although suffix bytes were silently ignored. Forms and server also maintained separate copies of the policy. | Shared pure new-password policy and a byte-limit check before hashing. ASCII/Unicode overflow and the exact boundary are tested. Existing credential verification is unchanged; legacy overlength-password migration remains an auth follow-up. Removed an unused generic user-creation helper. |
| SA-10 | The stated no-skips verification policy depended on manual report reading. A real all-skipped Vitest fixture returned exit 0 and `success: true`. | Full test commands clear old reports and validate individual results/counts. The same probe is rejected by the new gate. Empty, skipped, pending, expected-failure, inconsistent and flaky reports have negative tests. Native focused-test protection is enabled. |
| SA-11 | Storybook's dark class was scoped to a wrapper, while dialogs/menus portal into `body`, giving misleading light popovers in dark previews. | Apply the selected catalog theme at the document root. Both engines verify dark dialog colors and accessibility after its opening animation completes. |

CSV sanitization has application-specific limits, especially after editing/re-saving in spreadsheet software. [OWASP CSV injection guidance](https://community.owasp.org/attacks/CSV_Injection). Bcrypt documents its byte limit and requires callers to check truncation. [bcrypt.js security considerations](https://github.com/dcodeIO/bcrypt.js#security-considerations)

The original unit adversarial run had **10 failing cases** across roles, table namespace/form behavior, client graph rules and CSV prefixes. Separate browser probes reproduced the chart, callback, and select CSS defects; two password-overflow cases also failed before repair. The [reproduction record](evidence/self-audit/reproductions.json) distinguishes these observations from source-only findings and newly added checks.

## Review scope and architecture conclusions

The [scope inventory](evidence/self-audit/review-scope.json) records source hashes for 124 application, test, build, configuration and verification files. It covers the current application sources, all registered tests, shared primitives, route/auth composition, sample models/catalog, styles, build modes, dependency/retirement rules, test gates, CI and Storybook. Vendor source was not exhaustively audited. Deleted generated reporting datasets were assessed through removal/consumer checks, not historical data correctness.

- Keep Next/React/TypeScript/Tailwind/Radix/Recharts. The evidence does not justify a framework rewrite or another abstraction layer. Feature views accept display models; route composition supplies samples; server account code remains separate.
- The table has an explicit paged-result contract and renders a maximum of 100 supplied rows. A new test uses a **1,000,000-item total with only 100 loaded rows**. This establishes the rendering contract, not backend throughput. Local sample filtering remains proportional to the supplied sample set. Future adapters still need server filtering/paging, request ordering, authorization, indexes and full-scope export.
- URL namespace is not a complete repository/report identity. Controllers changing repository/filter/actor scope must clear obsolete results or remount with a scope key and mark the new request pending. `paging.query` must never be relabeled to make old rows appear current.
- Runtime validation is present at retained account/API boundaries. No reporting database, ingestion simulator, full metric engine, or finalized page layout was introduced.
- The new critical behaviors have executable failure cases. Coverage remains selective enforcement rather than a claim of complete application coverage. The audit found defects despite the earlier green suite, which is why independent review remains necessary.

Two apparent browser failures during test development were synchronization issues, not retained product findings: Radix moves keyboard focus through a deferred callback, and contrast measured during a fade-in reflects intermediate opacity. The final tests wait for the intended focused option and completed dialog opacity, preserving the selection/focus/contrast assertions. A suspected disabled-repository inconsistency was also ruled out: the prepared summary collection already filters the canonical catalog's enabled entries.

## Dependencies and hosting

The refreshed full npm audit reports **zero advisories**. Six direct entries differ from npm's `latest` tag, matching the existing documented holds: Next/config, Node types, ESLint, TypeScript, and the Auth.js release-channel difference. No further compatible-package upgrade was required in this pass. Lockfile and repository catalog were unchanged.

AWS currently documents Next.js through 15 and Node 24 for this hosting target. Those holds remain grounded in the selected host. [Next.js support](https://docs.aws.amazon.com/amplify/latest/userguide/ssr-amplify-support.html), [Node runtime support](https://docs.aws.amazon.com/amplify/latest/userguide/ssr-supported-features.html). ESLint 9's deprecated status and the existing Auth.js beta remain explicit maintenance risks, not hidden upgrades.

The three pinned GitHub Actions were read at their configured SHAs; their action manifests exist and use Node 24. This verifies the pins, not an actual hosted workflow. Upstream was refreshed and the branch was missing zero upstream commits.

## Final verification

- **135 unit/component cases passed**, no failed/pending/skipped cases; critical per-file coverage gates passed.
- **18 browser cases passed** across Chromium/WebKit, no failed/skipped/flaky cases.
- Formatting, type-aware lint, strict application/test/tool types, graph and retired-reporting checks passed.
- Production-auth and preview builds, Storybook and full dependency audit passed. After the final Storybook-only change, static/coverage checks, Storybook and the full browser suite were rerun; application source/build configuration were unchanged from the complete pipeline run.
- Whole-application unit line coverage is **43.06% across 75 TS/TSX files**. UI scaffolds are not comprehensively covered, and browser execution is not folded into this percentage.
- No hosted Linux CI, real AWS sign-in, deployment, or independent approval was performed.

[Verification receipt](evidence/self-audit/verification.json) · [Source manifest](evidence/self-audit/source-manifest.json) · [Unit cases](evidence/self-audit/vitest.json) · [Browser cases](evidence/self-audit/playwright.json) · [Coverage](evidence/self-audit/coverage-summary.json) · [Audit](evidence/self-audit/audit-all.json)

Before handoff, use this report together with the [review packet](foundation-hardening-review.md). Reviewers should assess both the repaired frontend contracts and the explicitly open production-auth boundaries. No claim is made that self-review found every possible defect.
