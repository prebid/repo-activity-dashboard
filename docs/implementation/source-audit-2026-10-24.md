## Grounding

Audit date: **2026-10-24**. Scope: frontend architecture, styling, dependencies, and the preparation needed for visual-first development. The user confirmed **keep AWS Amplify hosting**. The application stack stays TypeScript, React, Next.js, Tailwind, Radix/shadcn-style primitives, and Recharts.

GitHub main resolved to **fba4d04b588a01149df2c8b5bd8a02f55a709cc2**. A temporary source archive was checked against the live recursive Git tree: **994 file blobs matched**, with **no original source changes after verification**. The working project still contains planning and display mocks; no application upgrade or feature implementation was performed there.

The source inventory contains 77 TypeScript/TSX files and three test files. Inspection concentrated on the four reporting routes, layout/providers/navigation, repository table/data helpers, shared UI primitives, styling/configuration, test setup and suites, build scripts, and authentication imports that affect the frontend build. This is not an exhaustive security or ingestion audit.

The [baseline manifest](evidence/2026-10-24/baseline.json) identifies commands, environment, outcomes, and limits. Package candidates were read from public npm metadata on the audit date; they have **not** been installed or validated together in the application.

| ID / type | Instrument and authoritative artifact | Result |
| --- | --- | --- |
| G1 — styling behavior | Tailwind 4.1.13/PostCSS 4.1.13 from the lockfile; compile [src/app/globals.css:2](https://github.com/prebid/repo-activity-dashboard/blob/fba4d04b588a01149df2c8b5bd8a02f55a709cc2/src/app/globals.css#L2); inspect both standalone output and CSS emitted by Next. | [V] Standard utilities are missing from the original output. A fresh-process compile of an in-memory corrected import restores the sampled utilities. |
| G2 — theme structure | [src/app/globals.css:11](https://github.com/prebid/repo-activity-dashboard/blob/fba4d04b588a01149df2c8b5bd8a02f55a709cc2/src/app/globals.css#L11), [src/components/HorizontalBarChart.tsx:82](https://github.com/prebid/repo-activity-dashboard/blob/fba4d04b588a01149df2c8b5bd8a02f55a709cc2/src/components/HorizontalBarChart.tsx#L82), [src/components/ui/button.tsx:15](https://github.com/prebid/repo-activity-dashboard/blob/fba4d04b588a01149df2c8b5bd8a02f55a709cc2/src/components/ui/button.tsx#L15) and badge implementation. | [V] Mixed HSL-channel and complete OKLCH tokens, obsolete HSL consumers, and an undefined destructive-foreground token. Browser appearance remains untested. |
| G3 — version alignment | [package.json](https://github.com/prebid/repo-activity-dashboard/blob/fba4d04b588a01149df2c8b5bd8a02f55a709cc2/package.json), [package-lock.json](https://github.com/prebid/repo-activity-dashboard/blob/fba4d04b588a01149df2c8b5bd8a02f55a709cc2/package-lock.json), [.nvmrc](https://github.com/prebid/repo-activity-dashboard/blob/fba4d04b588a01149df2c8b5bd8a02f55a709cc2/.nvmrc). | [V] React 18.3.1 with React type packages 19.1.x; Node major 20 declared; Next 14.2.32 locked. |
| G4 — composition | [src/app/page.tsx:25](https://github.com/prebid/repo-activity-dashboard/blob/fba4d04b588a01149df2c8b5bd8a02f55a709cc2/src/app/page.tsx#L25), [src/app/contributors/page.tsx:16](https://github.com/prebid/repo-activity-dashboard/blob/fba4d04b588a01149df2c8b5bd8a02f55a709cc2/src/app/contributors/page.tsx#L16), [src/app/companies/page.tsx:16](https://github.com/prebid/repo-activity-dashboard/blob/fba4d04b588a01149df2c8b5bd8a02f55a709cc2/src/app/companies/page.tsx#L16), [src/lib/repoData.ts:145](https://github.com/prebid/repo-activity-dashboard/blob/fba4d04b588a01149df2c8b5bd8a02f55a709cc2/src/lib/repoData.ts#L145). | [V] Client routes own storage imports, period logic, aggregation, interaction state, and rendering. |
| G5 — extension points | [src/config/repositories.ts](https://github.com/prebid/repo-activity-dashboard/blob/fba4d04b588a01149df2c8b5bd8a02f55a709cc2/src/config/repositories.ts), [src/components/layout/toolbar.tsx:87](https://github.com/prebid/repo-activity-dashboard/blob/fba4d04b588a01149df2c8b5bd8a02f55a709cc2/src/components/layout/toolbar.tsx#L87), [src/components/HorizontalBarChart.tsx:15](https://github.com/prebid/repo-activity-dashboard/blob/fba4d04b588a01149df2c8b5bd8a02f55a709cc2/src/components/HorizontalBarChart.tsx#L15), [src/components/repos/OpenPRsTable.tsx:31](https://github.com/prebid/repo-activity-dashboard/blob/fba4d04b588a01149df2c8b5bd8a02f55a709cc2/src/components/repos/OpenPRsTable.tsx#L31). | [V] Repository lists/keys are repeated; chart shape names six repositories; PR table owns its sorting and renders the complete input array. |
| G6 — verification coverage | Full source-tree/test-path inventory, manifest scripts/dependencies, [vitest.config.ts](https://github.com/prebid/repo-activity-dashboard/blob/fba4d04b588a01149df2c8b5bd8a02f55a709cc2/vitest.config.ts), [tests/setup.ts](https://github.com/prebid/repo-activity-dashboard/blob/fba4d04b588a01149df2c8b5bd8a02f55a709cc2/tests/setup.ts), machine-readable test execution. | [V] Three data/storage suites; 46 cases executed serially, 41 passed and 5 failed. No frontend/browser test files or GitHub workflow files in the audited tree. Known-present controls: all three test paths and Vitest/TypeScript manifest entries. |
| G7 — test/config scope | [tsconfig.json:38](https://github.com/prebid/repo-activity-dashboard/blob/fba4d04b588a01149df2c8b5bd8a02f55a709cc2/tsconfig.json#L38), [vitest.config.ts:9](https://github.com/prebid/repo-activity-dashboard/blob/fba4d04b588a01149df2c8b5bd8a02f55a709cc2/vitest.config.ts#L9) and installed Vitest 3.2.4 coverage implementation. | [V] Root typecheck excludes tests/tool configs; the four 80% values are outside the supported coverage.thresholds object. No coverage measurement is claimed. |
| G8 — build separation | [package.json](https://github.com/prebid/repo-activity-dashboard/blob/fba4d04b588a01149df2c8b5bd8a02f55a709cc2/package.json), [src/scripts/syncMappingFromS3.ts:1](https://github.com/prebid/repo-activity-dashboard/blob/fba4d04b588a01149df2c8b5bd8a02f55a709cc2/src/scripts/syncMappingFromS3.ts#L1), [src/lib/auth/get-secret.ts:1](https://github.com/prebid/repo-activity-dashboard/blob/fba4d04b588a01149df2c8b5bd8a02f55a709cc2/src/lib/auth/get-secret.ts#L1), sanitized build execution. | [V] Build invokes mapping synchronization and fails without the auth secret during page-data collection. AWS/bcrypt imports produce Edge-runtime warnings. |
| G9 — configuration boundary | [next.config.mjs:7](https://github.com/prebid/repo-activity-dashboard/blob/fba4d04b588a01149df2c8b5bd8a02f55a709cc2/next.config.mjs#L7), [src/middleware.ts](https://github.com/prebid/repo-activity-dashboard/blob/fba4d04b588a01149df2c8b5bd8a02f55a709cc2/src/middleware.ts), [src/components/layout/toolbar.tsx:29](https://github.com/prebid/repo-activity-dashboard/blob/fba4d04b588a01149df2c8b5bd8a02f55a709cc2/src/components/layout/toolbar.tsx#L29). | [V] Sensitive environment names are in Next's build-time env map; route publicity/navigation rules differ; callback capture uses pathname without query parameters. No production credential exposure was tested. |

### Reproduced baseline

Environment: macOS, Node **20.17.0**, npm **10.8.2**, original lockfile. Verification subprocesses received a restricted environment without credentials. Lifecycle scripts were disabled during installation.

| Check | Outcome | Practical meaning |
| --- | --- | --- |
| Locked dependency install, without lifecycle scripts | Passed | The current lockfile installed without legacy-peer-deps or force. This does not validate upgrade targets. |
| Repository TypeScript check | Passed, zero diagnostics | Existing strict checking passes for its configured source scope. Explicit any and excluded tests/configs remain gaps. |
| Existing tests, one worker/no file parallelism | 41 passed, 5 failed, 0 skipped | Both unit suites pass (12 storage + 20 validation). Integration suite: 9 pass, 5 fail. This is not frontend coverage. |
| Existing build, no credentials | Failed after compilation | Missing NEXTAUTH_SECRET at page-data collection. Prebuild also reports missing local mapping and AWS credentials. Edge warnings name AWS SDK/bcrypt imports. |
| Original stylesheet compilation | Missing p-4, gap-2, text-sm, bg-gray-900 | The compiler succeeds but the expected CSS is absent. flex and bg-background are positive controls. |
| Corrected import, fresh process, no source edits | Those four utilities appear | Supports an incomplete Tailwind 4 migration as the cause of this sampled failure. It does not fix every token or component. |
| Browser, visual, hosted CI, deployment | Not run | The frontend is not visually approved or production verified. |

The first sandboxed build attempt stopped at a tsx local-IPC permission error. The recorded application failure is from the subsequent permitted run. A same-process stylesheet comparison reused Tailwind's source-path cache and was discarded; the reported comparison uses separate processes. Source files stayed unchanged.

The five integration failures concern stored-schema validation, an unhandled mocked merged-PR request, missing incremental-sync state, a missing expected boolean, and a validation-report mismatch. Preserve these results and classify the tests when separating the outgoing ingestion layer. Do not make a whole-repository green claim by hiding them.

### Current and proposed dependency set

These are concrete **implementation candidates**, not a verified upgrade lockfile. Re-resolve patches at implementation time, review release notes, then validate installation, types, tests, CSS, and the build.

| Area | Current source | Candidate / decision |
| --- | --- | --- |
| Node | .nvmrc = 20; audit ran 20.17.0 | Node **24 LTS**, currently 24.22.1 in official release metadata; pin local/CI/Amplify consistently. AWS documents Node 24 support. |
| Next.js | 14.2.32 | **15.5.28**, the audited latest 15.x candidate, with matching eslint-config-next. Keep Amplify. Do not choose 16 until its deployment support is established. |
| React / React DOM | 18.3.1 | **19.3.1** together; matching **19.3.0** React/DOM types. Next 15's declared peers accept React 19; application/SSR compatibility still needs verification. |
| TypeScript | 5.9.2 | **6.0.3** candidate. TypeScript 7.0.2 is newer, but the audited TypeScript ESLint parser supports less than 6.1.0. Do not bypass that constraint. |
| Tailwind / PostCSS plugin | 4.1.13 | **4.3.3** together, with a complete CSS-first v4 configuration. tailwind-merge **3.7.0** candidate. |
| UI primitives | Local Radix/shadcn-style source | Keep the approach; review/migrate local files for v4 tokens and React 19. Do not blindly overwrite customized components. |
| Animation | tailwindcss-animate 1.0.7 | Follow shadcn's v4 direction toward **tw-animate-css 1.4.0**, checking adopted animation classes. |
| Recharts | 2.15.4 | **3.10.1** candidate before repository charts are implemented; include compatible react-is. Retain charting only on repository pages. |
| Table behavior | Handwritten per-table state | Add **@tanstack/react-table 9.3.1** for typed columns and controlled table behavior. Use v9 documentation; do not copy v8 snippets unchanged. |
| ESLint | Not configured | **9.39.5**, matching Next 15 config and compatible typed/React/accessibility plugins. Current React and JSX-a11y peers do not accept ESLint 10. |
| Formatting | Not configured | Prettier **3.9.10** candidate; one formatter and explicit check command. |
| Unit/component tests | Vitest 3.2.4, node environment | Vitest **5.0.5**, matching companion packages, and React Testing Library **16.3.3**. Separate pure-unit, component, and legacy-ingestion scope. Choose/pin the DOM environment and Vite peer during setup. |
| Browser/visual tests | Not configured | Playwright **1.64.1** candidate, fixed browser/environment for visual baselines. |
| Component catalog | Not configured | Storybook **10.6.3** with matching nextjs-vite adapter, for shared components and feature-view states. This is a development tool, not a Vite application migration. |
| Theme behavior | Custom mounted gate | Prefer a small next-themes **0.4.6** integration, validated with the app's theme behavior; stop withholding the entire page tree until mount. |
| Validation | Zod 4.1.5 | Retain Zod 4; **4.6.7** candidate. Use for real boundaries when present, not a mandatory fake backend. |
| Authentication | NextAuth 5.0.0-beta.29 | Retain existing auth behavior behind an isolated adapter; beta.32 is a compatible-line candidate. npm latest currently points to v4, so a blanket latest update would change major lines. Review separately. |

Sources: [npm package metadata snapshot](evidence/2026-10-24/registry-metadata.json), [compatibility constraints](evidence/2026-10-24/compatibility-metadata.json), [selected supported versions](evidence/2026-10-24/selected-compatibility.json), [AWS Next.js support](https://docs.aws.amazon.com/amplify/latest/userguide/ssr-amplify-support.html), [AWS Node support](https://docs.aws.amazon.com/amplify/latest/userguide/ssr-supported-features.html), [Node releases](https://nodejs.org/en/about/previous-releases), [Next support policy](https://nextjs.org/support-policy), [TypeScript ESLint support](https://typescript-eslint.io/users/dependency-versions/).

## Finding

**Keep the stack and rebuild the reporting page structure around small typed components. Correct styling and quality infrastructure first.** Framework replacement is not supported by the findings; retaining the current page implementations unchanged is also not a good fit for the agreed product.

### 1. Tailwind is installed at v4, but the migration is incomplete

The original stylesheet still uses the three v3 entry directives instead of the v4 import. The emitted CSS lacks common classes that source components use. This is reproduced in both a standalone PostCSS compile and the CSS produced by the application build. A fresh compile with the import corrected restores the sampled standard utilities.

There are additional defects to address together: duplicate color systems, HSL wrappers around complete color values, missing destructive-foreground, a stale config reference in components.json, redundant prefixing, and global important-link overrides. The empty legacy config is not itself proof of lost custom settings; inspect it rather than assuming all JavaScript configuration is invalid.

**Plan:** finish the v4 migration, establish one semantic token system, review adopted primitives, and add a rendered style specimen that verifies spacing, typography, colors, focus, and light/dark states. Sources: [Tailwind upgrade guidance](https://tailwindcss.com/docs/upgrade-guide), [shadcn v4 guidance](https://ui.shadcn.com/docs/tailwind-v4).

**Falsifier:** the original pinned stylesheet, with the locked compiler and the same source scan, emits the missing selectors; or the cited consumers/tokens differ. Neither occurred in this audit. The proposed full visual repair remains unverified.

### 2. The expensive architectural problem is mixed responsibilities

The main page is 641 lines; contributor and company pages are 326 and 366. Size alone is not the defect: all three import the generated timeline and perform reporting calculations within UI effects. Contributor/company code repeats period and metric selection, repository maps, aggregation, and ranking. The timeline source file is about 4.95 MB uncompressed; its import ties frontend compilation to that storage format. This is source size, not a measured browser bundle.

Repository detail has some useful composition already, but its loader fetches raw store files and derives counts/dates. The table displays all supplied rows, owns sorting, and uses older reviewer semantics. These do not implement the newly agreed 100-row, missing-value, feedback-versus-approval rules.

**Plan:** thin routes, feature controllers/views, reusable table parts, prepared display models, and local samples. Historical calculations move to the later reporting layer. Preserve semantic HTML/Radix primitives where suitable.

**Falsifier:** the cited routes consume ready-to-display models without storage/aggregation knowledge, or the shared table already supports the agreed controlled query/paging contracts. The inspected code does not.

### 3. Extensibility needs explicit ownership

A new repository currently touches multiple arrays, mappings, navigation buttons, and chart fields. Repository identity belongs in one catalog; table columns should represent metrics, not repository-specific object properties. Shared table behavior should accept typed columns and controlled state, while feature code owns metric semantics and links.

**Plan:** apply the [frontend architecture blueprint](frontend-architecture.md), including examples for adding a metric, repository, and page. Use TanStack Table for the shared mechanics while retaining application-owned markup and styling. Its current documentation describes a headless model with typed data/columns and composable features. [Table model](https://tanstack.com/table/latest/docs/guide/tables)

**Falsifier:** a new repository can be introduced through one catalog without changing shared chart/table implementations, or the repeated source lists do not exist. At this source revision they do.

### 4. A clean typecheck is not an adequate quality gate

The current typecheck passes, but tests and root tool configuration are outside its include list, and important page paths use any. The test suites cover storage/sync/validation, not UI interactions. The apparent 80% coverage settings are at the wrong configuration level: the installed coverage implementation reads coverage.thresholds. No measured coverage result is claimed.

**Plan:** app/test/tool typechecking, compatible lint/formatting, pure and component suites, browser flows, visual states, and real CI jobs. Register meaningful checks; retain known legacy failures as explicit work or retirement dispositions. Async server boundaries need browser/integration testing, while synchronous/client components can use Vitest/Testing Library. [Next testing guidance](https://nextjs.org/docs/app/guides/testing/vitest)

**Falsifier:** configured typecheck inputs include the omitted files, frontend suites exist in the complete tree, or the installed runner consumes the top-level coverage values. The audited evidence contradicts those alternatives.

### 5. Mock frontend development must be independent of storage and live auth setup

The build script initiates S3 mapping sync. The credential-free build later fails because auth reads its secret at module import. Middleware also imports an auth chain that produces Node-in-Edge warnings. The theme provider returns null until mounted, withholding the toolbar and page content. These are distinct problems, not a reason to replace authentication wholesale.

Next's env map contains auth/AWS secret names. That setting is a build-time replacement mechanism, not a server-secret boundary. Remove sensitive values from that map during foundation work; inspect actual deployed bundles separately if required. This audit did not load live credentials or prove a deployed leak. [Next env behavior](https://nextjs.org/docs/app/api-reference/config/next-config-js/env)

**Plan:** explicit local sample/viewer context, separated server auth configuration, consistent route access and callback query preservation, a shell that can render independently, and separate commands for ingestion. Mock mode must not silently weaken the production route/auth policy.

**Falsifier:** the unmodified app starts/builds in the documented mock environment without importing required live configuration, or the cited source paths are not reachable. The current credential-free build fails before achieving that.

### 6. Upgrade compatibility is part of the foundation

The chosen hosting constraint narrows the Next target to the documented 15.x support. Node 24 is a candidate supported by both current Node LTS policy and AWS's runtime list. Align React and types, then use compatible lint/compiler/test versions. Keep the lockfile deterministic and stop using force/legacy-peer-deps as normal build policy.

**Falsifier:** AWS documents/verifies the required Next 16 features for this deployment, or the candidate peer constraints change. Refresh before implementation; metadata alone does not establish a working deployment.

## Residuals

- No target-version upgrade, feature implementation, database integration, or authentication replacement was performed.
- No browser/visual/accessibility pass or real deployment was run. CSS selector probes establish generated rules, not every computed browser style.
- The serialized existing test run does not establish parallel-suite isolation. Shared test-store setup deserves separation before enabling broader parallel execution.
- Root typechecking and the build did not verify every tool/test file; those scopes must be added explicitly.
- Proposed dependency versions are metadata-compatible candidates, not a successfully built application set. Transitive constraints and TypeScript 6 migration details remain installation/build tasks.
- AWS documentation establishes a supported target family, not this account's deployed configuration. Confirm Amplify runtime/build settings during implementation; keep Amplify as requested.
- Historical correctness and completeness of GitHub data, mappings, approvals, and runs were not audited.
- The five legacy integration failures remain unresolved. They must be retained, repaired within retained scope, or retired with the outgoing code and an explicit disposition.
- The original source archive is an audit copy; establishing the actual working checkout must preserve the planning documents and mock samples.

