## Grounding

Review date: 2026-10-28. Scope: the All Repositories work on `codex/all-repositories`, compared with the refreshed `codex/frontend-rebuild` base `ae0eb52ee571fdb0b6b348ca9e2416b52530aadc`. The base has no commits missing from the feature branch. Production `main` is not the review target.

| Claim | Evidence and scope |
| --- | --- |
| [V] The large issue sample could discard its server-rendered dashboard during hydration. | The production visual matrix reported React #418 on the 12,345-issue Documentation sample. An isolated copy of the shipped bundle captured a dashboard `div` being matched against its first skip-link child. The failure was reproduced without editing the repository or suppressing diagnostics. |
| [V] The application and bundled renderer have different versions. | Installed manifests identify Next 15.5.28 and application React 19.3.1. The Next-vendored development renderer and the served production React chunk identify `19.2.0-canary-0bdb9206-20250818`. The known-present `replayBeginWork` implementation was read directly; its host replay path does not contain the later cursor restoration. |
| [I] The observed mismatch belongs to the upstream host-replay hydration issue. | React's [upstream fix #35494](https://github.com/react/react/pull/35494), merged January 2026, describes a cursor offset when a suspended host component resumes. The local trace is consistent with that mechanism; this is not a claim about every React hydration error or later singleton/parser issues. |
| [V] The final local checks pass. | `npm run check:all`: 465 unit/component, 31 account integration, eight packaged-production, and 112 Chromium/WebKit cases; 616 total. Individual-result validators report no skipped, pending, expected-failure, or flaky cases. Dependency audit reports zero vulnerabilities. Both application builds and Storybook pass. |

The renderer correlation would be contradicted by a restored cursor in the installed replay path or by a different failing node mechanism. The local fix would be falsified by the dashboard root being replaced, missing SSR rows, another hydration error, or failed account isolation in the regression scenarios. These checks remain enabled.

Renderer artifact: `node_modules/next/dist/compiled/react-dom/cjs/react-dom-client.development.js`, SHA-256 `14c33685b88f2e39827dc6f0515f9d44411958758aef6573686468163465f6bb`. The same-path positive control was `replayBeginWork`; its complete switch was read, including the host case and the subsequent unwind/reset/begin path. The built production React chunk reports the same vendored version.

## Finding

The hydration finding is addressed by making the presentational dashboard frame a client boundary and resolving its server-provided navigation/content through small DOM-free slot components. This avoids resolving streamed children during a host element's hydration. It adds no visual wrapper, disables neither SSR nor diagnostics, and keeps authorization in the existing server layout and route guards. The tested client-boundary-only and navigation-Suspense-only experiments did not resolve the failure and were not adopted.

The regression verifies real SSR table markup for 100 visible rows and retains the first server-created dashboard DOM element through initial navigation, a saved-theme reload, and cross-route navigation. The complete browser suite passes with strict browser-error observation. The production suite also verifies authenticated rendering and anonymous HTML/RSC denial.

The enlarged-layout test initially used an instantaneous key tap and measured a moving popup before positioning settled. It now waits for visible focus and uses a held arrow until scrolling is observed, releasing it in `finally`. Both browsers pass without application keyboard workarounds.

Visual coverage includes:

- Overview at 320, 768, 1280, and 1440 CSS pixels in dark/light themes, including grouped headers, pinned identities, dividers, selected age columns, and two-period comparisons.
- PR, issue, author, contribution, and duration details at desktop, laptop, tablet, and narrow widths; compact author rows and paginated author-specific records; full-list search/sort/pagination; and preserved return context.
- Empty selection, no merges, missing samples, partial coverage, invalid filters, and shared loading/retry examples.
- 200%-equivalent reflow at 640×480 CSS pixels with device pixel ratio 2, including menu keyboard focus and horizontal table access. This models a 1280×960 physical canvas at 200%; it does not claim to drive a native browser zoom menu.

The code audit retains the approved metric definitions and fake-data boundary. Current/period filters, exact merge branch, first-credit units, author uniqueness within each repository, and median/sample-size reconciliation are tested. Shared table mechanics remain independent of reporting models and navigation. No reporting database, ingestion service, dependency upgrade, authentication-policy change, or graph was added.

The local review gallery contains 102 captures with browser/theme/viewport selectors and full-resolution images. The reproducible captures are in `test-results/browser-artifacts/visual-review-*`; the focused entry point is `tests/e2e/visual-review.spec.ts`. Existing browser cases supply the complementary 320/1440 detail captures. Screenshots are review evidence, not platform-independent pixel-diff goldens.

## Residuals

- The user approved the final visual baseline and requested the PR on 2026-10-28. Independent reviewer acceptance remains separate.
- Hosted checks and independent reviewer acceptance are tracked on the review PR. Handoff targets `codex/frontend-rebuild`.
- Reporting rows and record URLs remain invented samples. Prepared periods are independent display scenarios, not a global event-history simulation. Real GitHub metric correctness and future database performance are outside this review.
- Native zoom-menu behavior, assistive-technology user testing, and live Amplify/IAM acceptance are not certified by the automated reflow/accessibility checks.
- The local hydration workaround should be revisited when the hosting-compatible Next renderer includes the upstream replay correction. The regression must remain; removing the workaround requires evidence, not merely a version label.

No deployment or production merge is part of this review.

The user's final visual review requested bounded handling for high-volume authors. Inline record expansion was replaced with the paginated author-record flow described in the implementation plan. The earlier technical review predates that refinement; its final verification is recorded below. The user subsequently approved the updated flow for PR handoff.

The high-volume-author interaction test also exposed cell remounting when a column callback changed during search blur. Shared columns are render callbacks, not React component types; the table now invokes them inside the stable keyed cell, preserving the returned child component's state and DOM identity. A focused counter/focus regression failed before the change, and the standard suite verifies it afterward. Draft markers are included in the searchable PR title value. The visual matrix is parameterized by view so its bounded per-view work fits the ordinary test timeout.

Final verification after the requested author refinement: `npm run check:all` passes 616 cases (465 unit/component, 31 account, eight production, 112 browser), all builds/coverage/architecture checks, and zero dependency advisories. All result validators are clean. The author overview carries counts only; selected records are filtered by account and creation period before reaching the client table. Browser checks verify paging/search for 240 PRs and 350 issues, preserved parent context, all current statuses, and invalid-scope rejection. The updated visual gallery supersedes the inline-expansion captures. User visual sign-off is recorded; the draft review handoff targets `codex/frontend-rebuild`.
