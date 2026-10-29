# Product acceptance matrix

This matrix describes product acceptance scenarios, not a record of passed test runs. The foundation has executable checks for representative presentation and interactions; historical calculation and real-data integration cases remain future work. See [current contracts](foundation-contracts.md) for implemented boundaries.

Scenario definitions and numerical answers are in the [test-data plan](test-data-plan.md). Gate/evidence rules are in the [quality foundation](foundation-contracts.md).

Retired ingestion tests do not establish correctness for the product cases below. The [foundation contracts](foundation-contracts.md) describe current composition, state ownership and verification boundaries.

## Verification phases

The frontend is first designed and implemented with fixed display samples. At that stage, verify rendering, navigation, controls, paging of sample rows, export interactions, accessible states, and visual consistency. Expected metric values can be supplied directly. This proves presentation and interaction for those samples, not historical calculation correctness.

Historical first-credit calculation, merge-time reconstruction, generic reporting queries, and real-source/database reconciliation remain planned for the later data layer. Cases below that span both layers need separate frontend and reporting results; showing the expected static number does not pass the calculation case. Mock request checks apply only where a request interface is actually implemented.

Before data integration, complete a user-reviewed visual baseline for all pages and important states as described in the [delivery plan](foundation-contracts.md#what-visually-locked-means). Run those visual/interaction checks again when replacing mocks with real adapters.

## Foundation and data

| ID | Requirement | Scenario/check | Expected result | Planned level |
| --- | --- | --- | --- | --- |
| QF-01 | Required checks really execute | Registered bootstrap suites and CI jobs | Expected suites/tests are selected; an empty or skipped required selection is incomplete/failing, not green. | Tooling/CI |
| QF-02 | Fixture boundary is actually used | Known mock response plus unexpected external request | The known response is received through the reporting client; unexpected real reporting calls fail visibly. | Contract/browser |
| QF-03 | Invalid data cannot become plausible results | Valid zero, unavailable value, malformed count/date/ID | Valid cases retain their meaning; malformed input is rejected with an appropriate error, not converted to zero. | Contract |
| QF-04 | UI/data responsibilities stay separated | New page/feature imports and request paths | Page components do not import storage dumps or fetch full activity to calculate global reports. | Static/architecture |
| QF-05 | Fixture builds do not require real services | Clean fixture-mode install/build/start | Reporting credentials and data synchronization are unnecessary; production authentication is not weakened. | Build/browser |
| QF-06 | Tailwind utilities and theme tokens actually render | Shared style/component specimen | Standard spacing, typography, background, focus, and adopted semantic tokens produce the expected computed styles in light/dark themes. | CSS/browser |
| QF-07 | Test and tool files are typechecked | App/test/tool TypeScript configuration | All three intended source scopes are included; an app-only pass is not reported as whole-repository type safety. | Static/config |
| QF-08 | Shared UI is independently composable | Same table/control parts in two feature views and catalog stories | Views render from typed mock inputs without importing server auth, raw storage, or another feature's internals. | Component/static |
| DATA-01 | Stable generated data | Same scenario/version/seed/clock twice | IDs, dates, counts, and pagination boundaries are identical. | Fixture contract |
| DATA-02 | Known answers are independent | REF-01 against handwritten expected tables | Each contributor, company, group, and repository answer matches the specified values. | Contract |
| DATA-03 | Date and age boundaries are exact | TIME-01, LOAD-01 | October-to-date contains 2 boundary records; the future record is excluded. A PR exactly 30 days old is excluded from >30 days. | Contract |
| DATA-04 | Change indicators retain baseline meaning | TIME-01 / REF-01 | R1 created-PR change = +2 and R2 = +3; zero baseline gives an absolute difference and missing baseline gives a dash. | Contract/component |

## Login and preferences

| ID | Requirement | Scenario | Expected result | Planned level |
| --- | --- | --- | --- | --- |
| LOGIN-01 | Normal sign-in destination | Controlled fixture identity | Successful fixture sign-in opens All Repos. | Browser |
| LOGIN-02 | Preserve intended context | Filtered repository URL before sign-in | Return to that list with repository, filters, date basis, and supplied navigation context retained. | Browser |
| PREF-01 | Preferences belong to the account | Two fixture users | Saved columns/sorting/selections for one account do not silently become the other account's preferences. | Contract/browser |
| PREF-02 | Explicit links override defaults | Saved current/open defaults plus a historical filtered URL | The explicit URL's scope wins; returning to an unfiltered page restores the specified default behavior. | Browser |

Fixture identities exercise routing and state. The separate packaged-production suite exercises retained authentication against local synthetic account services; live AWS acceptance is a deployment check.

## Repository pages

| ID | Requirement | Scenario | Expected result | Planned level |
| --- | --- | --- | --- | --- |
| REPO-01 | Current backlog and period activity differ | REF-01, October | Open PRs R1/R2 = 2/1; PRs created = 3/3; merged = 2/2; current open issues = 2/3. Date selection does not erase older open I201. | Contract/browser |
| REPO-02 | Count-to-record navigation reconciles | REF-01, R1 zero current approvals | Opens exactly P105 and P107; excludes drafts and unrelated records. | Browser |
| REPO-03 | Bounded pages with older records reachable | LOAD-01 | Issues: 50 rows on page 1 and 34 on page 17. PRs: 50, 50, then 37. Full counts remain 834 and 137. | Contract/browser |
| REPO-04 | Search/sort apply before pagination | LOAD-01, oldest issue title | Search finds ID 1 even from initial page 1; changing sort/query resets the page and returns correctly ordered identities. | Contract/browser |
| REPO-05 | Graph totals are not page totals | LOAD-01 | Graph/current counts use the full matching set. Non-draft age >30 days yields 90 matching PRs, IDs 18–107. | Contract/browser |
| REPO-06 | Feedback and approvals remain independent | LOAD-01 | Human-feedback buckets = 40/40/40; approvals = 60/40/20. Approval-only PRs do not become feedback participants. | Contract/component |
| REPO-07 | Record clicks go to GitHub | REF-01 | PR/issue links point to the matching synthetic GitHub record URL; no in-app description/comment viewer is introduced. | Browser |
| REPO-08 | Empty/error states are meaningful | EMPTY-01, ERROR-01, LOADING-01 | Empty selection, no matches, loading, and failure remain distinct; retry restores the right scenario. | Component/browser |

Browser checks validate link destinations without relying on real third-party page loads.

## Contribution reports and exports

| ID | Requirement | Scenario | Expected result | Planned level |
| --- | --- | --- | --- | --- |
| CONTRIB-01 | Separate actor roles | REF-01 October | Alice = 1/1/1/2/0/0; Bob = 2/1/0/0/1/1; Carol = 1/1/1/0/1/1, in the documented metric order. | Contract/browser |
| CONTRIB-02 | No repeat credit across months | REF-01 P101 and monthly totals | Bob's repeated September actions on P101 add no new credit. Combined totals = 8/5/9/7/5/6 and equal the three monthly credit totals under the same scope. | Contract |
| CONTRIB-03 | Current state does not erase first credit | REF-01 P107 | Alice retains one approval credit for P107; its current human-approval count is zero after dismissal. | Contract/browser |
| CONTRIB-04 | Company units stay correct | REF-01 September P102 | Acme has 2 feedback contributions and 2 approval contributions across 1 PR. Supporting records preserve that unit distinction. | Contract/browser |
| CONTRIB-05 | Groups overlap without duplicating a union | REF-01 October | Core union Review = 4/3/2/2/2/2; compared group rows can both include Bob and cannot be summed into a unique combined population. | Contract/browser |
| CONTRIB-06 | Exclusion changes report, not membership | REF-01 Core excluding Alice | Result = 2/1/0/0/1/1; Core membership is still Alice/Bob/Eve. | Contract/browser |
| CONTRIB-07 | Current company mapping is explicit | MAP-01 | Alice's individual credits stay fixed; Acme October PR authorship changes 3->2, Beacon 1->2, and Core remains 3. | Contract/browser |
| CONTRIB-08 | Issue-only and zero-contribution members | REF-01 Finn/Eve | Finn is eligible through Issues authored. Eve is visible in the member list with known zero; hiding a metric column does not change eligibility. | Contract/browser |
| CONTRIB-09 | Missing early history is not a new first event | GAP-01 | The affected first-credit total shows incomplete availability, not an invented new credit or known zero. | Contract/component |
| EXPORT-01 | Export is not capped to the visible page | LOAD-02 | 250 filtered contributors export as 250 rows; excluding one gives 249. UI remains capped at 50 per page. | Contract/browser download |
| EXPORT-02 | Breakdown rows preserve dimensions | LOAD-02 | Flat rows identify entity and repository; all 20 repositories are represented without one column per repository. | Contract/download |
| EXPORT-03 | Mapping, groups, and missing values survive export | REF-01, GAP-01, DISPLAY-01 | Filters/attribution context are retained; missing values are not numeric zero; labels with punctuation/Unicode are encoded correctly. | Contract/download |

## Historical merge status and agent tracking

| ID | Requirement | Scenario | Expected result | Planned level |
| --- | --- | --- | --- | --- |
| MERGE-01 | Feedback and approvals at merge are separate by category | REF-01 October | No-human-feedback = 3; no-human-approval = 2; none from any category = 1. P106 keeps agent/bot signals separate. | Contract/browser |
| MERGE-02 | Evaluate the state at the event time | MERGE-01 and MERGE-02 variants | A dismissal before merge gives zero effective approval at merge; dismissal after merge does not erase the earlier approval-at-merge state. | Contract |
| MERGE-03 | Direct-push units and uncertainty | PUSH-01 | Replayed event counted once; multiple commits do not become multiple pushes; unclassified update remains unknown and actor is not guessed. | Contract/component |
| TRACK-01 | Independent runs remain independent | RUN-01 | Repeated instances on one PR remain separate runs; contribution credits remain once per account/PR/metric. | Contract/browser |
| TRACK-02 | Account activity is not a fabricated run | RUN-01 | GitHub-only activity remains labeled as such; run ID, model, duration, and cost are not invented. | Contract/browser |
| TRACK-03 | Execution/result/publication differ | RUN-01 | Completed execution with failed publication remains distinguishable from a fully published result. | Component/browser |
| TRACK-04 | Tracking-first scope | All tracking scenarios | Tables/filters/detail are usable without a launcher; no Run/Cancel/Retry workflow is required or accidentally connected. | Browser/isolation |

## Presentation and accessibility

| ID | Requirement | Scenario | Expected result | Planned level |
| --- | --- | --- | --- | --- |
| UI-01 | Table controls are usable without a pointer | REF-01 / LOAD-01 | Keyboard users can reach and operate sorting, filters, pagination, and links with visible focus and useful labels. | Component/browser/manual |
| UI-02 | Realistic density remains readable | LOAD-01 / DISPLAY-01 | Long titles and many labels do not obscure controls; selected filters remain apparent at supported viewport widths. | Visual/manual |
| UI-03 | Data remains available without interpreting color | Repository graph scenario | Labels/text/table values communicate the same values and scope as graph colors. | Accessibility/browser |

Each case must later record its test location, execution result, source revision, and any residual scope. Current status for every case in this file is **Planned — not implemented or run**.
