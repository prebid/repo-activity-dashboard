# Quality foundation — implementation status

Updated 2026-10-25. **A first foundation implementation is locally verified; hardening and independent review are still required. Layout work is on hold.** Work is on `codex/quality-foundation`. GitHub-hosted CI, Amplify deployment, and real account-store sign-in have not been executed.

See the [review-readiness assessment](foundation-review-readiness.md) for the fresh dependency audit, coverage limits, and open hardening work. The earlier local results below remain valid for their stated scope; they are not foundation approval.

## Delivered

- Compatible core upgrades: Node 24.22.1, Next 15.5.28, React/React DOM 19.3.1, TypeScript 6.0.3, Tailwind 4.3.3, and PostCSS 8.5.31. Amplify remains the hosting target.
- Formatting, ESLint, strict app/test/tool typechecking, module/removal checks, Vitest component/unit tests, Playwright browser/accessibility checks, and Storybook.
- Correct Tailwind v4 imports and a single theme-token system. Missing utility generation and destructive-foreground tokens are corrected; HSL/OKLCH mixing and global important-link overrides are removed.
- Thin route composition and typed sample-backed views for login, All Repos, repository PR/issue lists, contributors, and companies.
- The canonical 18-repository catalog in `src/config/repositories.ts`, used by navigation and page composition. The planning catalog path re-exports it.
- Shared tables with sorting, column visibility, full-set local search, at most 100 rows per page, zero versus missing rendering, URL state, and full filtered CSV output.
- Account-scoped All Repos sort defaults; explicit URL state takes precedence.
- A separate `paging` input contract for future adapters: supplied full matching count, no second local sort/filter/page, query-change callbacks, and a full-scope export callback without the page number.
- Explicit preview and production-auth build/start commands. Preview uses local synthetic accounts, refuses Amplify execution, requires a matching build mode, and keeps auth URLs local even when production URL settings exist.
- Retained account authentication is server-only. Route authorization runs in Node server layouts; lightweight middleware only preserves the requested internal destination. Production secrets are no longer embedded in the Next config env map.
- DynamoDB client creation is lazy and refused in preview. Standard AWS credentials remain with the SDK provider chain so temporary session tokens are preserved. Legacy explicit auth credentials remain supported.
- Temporary-password generation in the retained auth implementation uses Node's cryptographic random source.
- CI configuration uses pinned action commits and a fixed Ubuntu runner image. It invokes the same project verification commands.

## Reporting layer retired

The old GitHub collector, rate limiting/queue/storage services, reporting CLI/scripts, raw/generated reporting files, filesystem repository endpoint, embedded page aggregations, obsolete models/widgets, and ingestion-only dependencies have been removed from the active source tree. Amplify no longer synchronizes mappings or copies store data into public assets.

The original validation/storage/sync tests, fixtures, and global storage setup were retired with that implementation. Their historical baseline was **46 cases: 41 passed, 5 failed**. Those failures were not repaired or hidden as passing tests; that component is no longer part of this frontend. The new frontend tests cover a different scope.

Authentication's account/whitelist storage is intentionally retained, as agreed. This is **no legacy reporting data layer**, not a claim that every database-related module has been removed.

## Verification

An isolated source copy started without node_modules or generated build output. It completed `npm ci`, followed by the full frontend checks with live-service credentials removed. Final runtime/config/test files were compared with the working tree. The [machine-readable receipt](evidence/2026-10-25/verification.json) includes the source digest, versions, cases, and limits.

| Check | Result |
| --- | --- |
| Clean locked installation | Passed |
| Formatting / lint | Passed |
| App, test, and tool types, including generated route types | Passed |
| Module and retired-reporting checks | Passed |
| Unit/component tests | **41 passed; 0 failed/skipped** |
| Preview production build | Passed |
| Storybook production build | Passed |
| Browser tests | **6 passed; 0 failed/skipped/flaky** |
| Production-auth build without live credentials | Passed; actual sign-in not exercised |
| Runtime npm advisories | **0**, after the PostCSS fix |
| Hosted CI / deployment | Not run |

The browser checks exercise built artifacts: the independent component catalog, login-return context, an 834-issue sample with full-set search, 137-PR pagination, the 18-row summary, theme styles/focus/accessibility, CSV download, blocked account mutation in preview, and per-account sort isolation. Unit/component checks additionally cover 250-row pagination/export and the externally paged table contract.

Representative light-theme table and dark/narrow component renders were visually inspected. These are foundation previews, **not approved final page designs**. Automated accessibility results apply to the exercised specimen, not every future page.

## Compatibility decisions and limits

- Vitest **4.1.10** was selected after an initial resolution failure. A later clean resolution with 5.0.5 succeeded, so the earlier claim of a permanent Storybook compatibility block is not established. The full dependency audit also reports moderate advisories in the current 4.1.10 toolchain; remediation and application testing are pending.
- ESLint **9.39.5** is retained for Next 15 and React/accessibility-plugin peer compatibility. npm marks this major deprecated; revisit it when the retained stack's compatible lint options change.
- Next 15's nested PostCSS required a scoped override to the directly pinned **8.5.31**. A fresh lock resolution was necessary; an in-place install initially left the old nested copy. Clean installation and the runtime audit confirmed the patched tree. Revisit the override when the upstream dependency is fixed. [Relevant advisory](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp)
- Storybook emits notices about client directives in its client-only bundle. Its built catalog was exercised in Chromium.
- npm emits install-hook approval notices for transitive tooling; the clean installation and required builds/checks succeeded without additional hook approval.
- Real authentication, account administration against DynamoDB, Amplify runtime behavior, production configuration, and all historical reporting semantics remain separate integration work.
- The static boundary check covers the registered literal imports, computed module imports, raw-store strings, paths, and dependency/script checks. It is not a general proof against arbitrary program behavior.
- Final layouts, full activity metrics/timeframes, saved-view preferences beyond the implemented sort default, contributor/group detail flows, agent tracking, and repository graph integration remain in the product/design milestones.

## Next work

Complete the hardening work and independent review gate in [foundation review readiness](foundation-review-readiness.md). Do not advance to layout work on the strength of the first-pass test results. Final page design and real reporting/database integration remain later phases.
