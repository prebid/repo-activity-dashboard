# Example data and fixtures — design specification

All accounts, records, counts and scenarios below are invented for development and testing. They are not measurements of real repositories. Display samples and representative frontend tests exist; the detailed reference-event scenarios below define later reporting/data-integration verification and are not a claim that those calculations are implemented.

Custom-group scenarios below are retained for the post-database milestone (scope decision 2026-10-29). They do not require group UI, membership storage or group-specific samples/tests during the initial Contributors/Companies frontend.

## What a fixture means here

**Display-first scope:** start with ready-to-display mock numbers and records to lock the frontend visually. The starter [All Repos mock](../../design/mocks/all-repositories.json) is for that purpose. The detailed reference events and expected answers below are retained for later reporting/data-layer verification. They do not require building an event simulator, a mock database, or a reporting engine before designing pages.

A fixture is a named, repeatable set of example data with known expected answers. It gives designers realistic content and gives tests an independent answer to compare against.

For example, a repository with 834 open issues should show 834 in its summary, 50 rows on its first page, and 34 on its seventeenth page. Search must find an issue that was not in the first 50 rows. Those answers are defined before implementing the table.

The **fixture data** describes the example world or prepared display results. A local module can supply it directly to a page. A **mock API**, if needed later, delivers responses across a request interface. **Expected results** state what should be returned/displayed/exported. These are separate responsibilities; starting with a local file is sufficient.

Fixtures are not random placeholder numbers in components, a proposed database schema, or a substitute for checking real data later.

## Shared rules

- Every scenario has a stable ID/version and a fixed reporting clock. Use **2026-10-24T12:00:00Z** and UTC unless a scenario explicitly states otherwise.
- A selected date interval has explicit start/end boundaries. Completed periods include the start and exclude the next period's start. Current periods include events through the fixed as-of instant, but never events after it. October-to-date starts at 2026-10-01T00:00:00Z.
- Use stable repository, account, PR/issue, run, and contribution identities. Display names are not keys.
- Use fictional repository names and clearly synthetic GitHub-link targets; do not present invented counts as real Prebid activity.
- Every page in a selected scenario must use the same identities, company mapping, groups, and underlying facts.
- New fixture requests must not silently fall back to unrelated responses. Unsupported scenarios/queries are errors during development/testing.
- Known zero and incomplete data are distinct. Generated data never replaces unknown historical facts with plausible guesses.
- Fixed seeds and explicit date rules are required for generated datasets. Do not use unseeded random values or the wall clock during rendering.
- The reference expectation tables below must remain independent of the report implementation being checked.

## REF-01: small complete reference world

Use two fictional repositories: **R1 / Example JS**, primary branch `main`, and **R2 / Example Server**, primary branch `master`.

Use these accounts and the current company mapping:

| Account | Category | Current company |
| --- | --- | --- |
| Alice | Human | Acme |
| Bob | Human | Acme |
| Carol | Human | Beacon |
| Drew | Human | Unmapped company |
| Eve | Human | Acme |
| Finn | Human | Beacon |
| Agent | Mapped Prebid agent | Prebid |
| Bot | Other bot | Unmapped company |

Groups: **Core = Alice, Bob, Eve**; **Review = Bob, Carol**. Bob overlaps. Eve has known zero contributions. Finn is an issue-only contributor. Two fixture login identities have separate saved preferences; one is a designated group editor. No production credentials or permissions are implied.

### PR records and events

All dates below are in 2026 at 12:00 UTC unless an ordering time is needed. Comments described here mean event metadata for counting; actual comment bodies are not required in reporting responses.

| PR | Repository | Author | Created | Merged / merger | Qualifying history |
| --- | --- | --- | --- | --- | --- |
| P101 | R1 | Alice | Aug 5 | Oct 5 / Carol | Bob first comments Aug 6, first approves Aug 7, and repeats both in September. |
| P102 | R1 | Carol | Sep 1 | Sep 6 / Carol | Alice first comments Sep 2 and approves Sep 3; Bob first comments Sep 4 and approves Sep 5. Carol's own reply contributes no reviewer credit. |
| P103 | R2 | Drew | Oct 2 | Oct 4 / Bob | Alice approves Oct 3 without qualifying feedback. |
| P104 | R2 | Alice | Oct 10 | Open draft | Only the author's own comment; no independent feedback or approvals. |
| P105 | R1 | Bob | Oct 11 | Open, non-draft | Carol first requests changes Oct 12. Agent first comments Oct 13, repeats comments, and first approves Oct 14. Bot first comments Oct 15. |
| P106 | R2 | Carol | Oct 16 | Oct 20 / Agent | Agent first comments Oct 17 and approves Oct 18. Bot first comments Oct 19. No human feedback or approval. |
| P107 | R1 | Drew | Oct 18 | Open, non-draft | Alice first comments Oct 19 and approves Oct 20. Drew pushes changes Oct 21; Alice's approval is dismissed before the as-of time. |
| P108 | R1 | Bob | Oct 20 | Oct 21 / Drew | No feedback or approvals from any category. |

### Issue records

| Issue | Repository | Author | Created | State/history |
| --- | --- | --- | --- | --- |
| I201 | R1 | Drew | Aug 8 | Open |
| I202 | R1 | Alice | Sep 9 | Closed Oct 7 |
| I203 | R2 | Bob | Oct 6 | Closed Oct 8, reopened Oct 9; currently open |
| I204 | R2 | Carol | Oct 6 | Open |
| I205 | R2 | Agent | Oct 9 | Open |
| I206 | R1 | Finn | Oct 10 | Open |

### Expected October contribution credits

| Account | PRs authored | Authored PRs merged | Feedback | Approvals | Merges performed | Issues authored |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Alice | 1 | 1 | 1 | 2 | 0 | 0 |
| Bob | 2 | 1 | 0 | 0 | 1 | 1 |
| Carol | 1 | 1 | 1 | 0 | 1 | 1 |
| Drew | 2 | 1 | 0 | 0 | 1 | 0 |
| Eve | 0 | 0 | 0 | 0 | 0 | 0 |
| Finn | 0 | 0 | 0 | 0 | 0 | 1 |
| Agent | 0 | 0 | 2 | 2 | 1 | 1 |
| Bot | 0 | 0 | 2 | 0 | 0 | 0 |
| **Total** | **6** | **4** | **6** | **4** | **4** | **4** |

### Expected monthly contribution totals

| Period | PRs authored | Authored PRs merged | Feedback | Approvals | Merges performed | Issues authored |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| August | 1 | 0 | 1 | 1 | 0 | 1 |
| September | 1 | 1 | 2 | 2 | 1 | 1 |
| October-to-date | 6 | 4 | 6 | 4 | 4 | 4 |
| **Combined** | **8** | **5** | **9** | **7** | **5** | **6** |

Bob's repeated September actions on P101 create no September feedback or approval credits. His September credits come from P102. Alice's dismissed approval on P107 still contributes one historical approval credit, while that PR's current human-approval count is zero.

### Expected company/group answers

October company rows, using the same metric-column order as above:

| Company | PRs authored | Authored PRs merged | Feedback | Approvals | Merges performed | Issues authored |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Acme | 3 | 2 | 1 | 2 | 1 | 1 |
| Beacon | 1 | 1 | 1 | 0 | 1 | 2 |
| Unmapped company | 2 | 1 | 2 | 0 | 1 | 0 |
| Prebid | 0 | 0 | 2 | 2 | 1 | 1 |

- September Acme feedback = 2 and approvals = 2, both across the single P102. Neither metric means two distinct PRs.
- October Core totals = **3, 2, 1, 2, 1, 1**.
- October Review totals = **3, 2, 1, 0, 2, 2**.
- October Core union Review totals = **4, 3, 2, 2, 2, 2**. It is not the sum of both group rows because Bob belongs to both.
- October Core excluding Alice totals = **2, 1, 0, 0, 1, 1**. Eve remains a zero-total member; the stored group is unchanged.

### Expected repository answers

| Metric at the fixed as-of / October period | R1 | R2 |
| --- | ---: | ---: |
| Current open PRs | 2 | 1 |
| Current open drafts | 0 | 1 |
| Current open non-draft PRs | 2 | 0 |
| Current open issues | 2 | 3 |
| PRs created in October | 3 | 3 |
| PRs merged in October | 2 | 2 |
| Issues created in October | 1 | 3 |
| Issues closed in October | 1 | 1 |
| Unique PR authors in October | 2 | 3 |
| Unique issue authors in October | 1 | 3 |
| Median creation-to-merge days in October | 31 | 3 |

- R1's zero-current-human-approval drill-down contains **P105 and P107**. Both have exactly one qualifying human reviewer.
- R2's only open PR is a draft, so the non-draft review/approval summaries have a known empty population.
- P105's latest qualifying actor is Bot. P107's is its author Drew after the code push.
- P101's October merge has prior human feedback and approval even though Bob first provided them in August.
- P103 has no human feedback but has one human approval at merge.
- P106 has no human feedback or approval, but agent feedback/approval and bot feedback are present.
- P108 has no feedback or approval from any category.
- Across the October merged cohort, no-human-feedback count = **3**, no-human-approval count = **2**, and no-feedback-or-approval-from-any-category count = **1**. These are overlapping conditions, not additive categories.
- Drew counts among the October PR authors in both repositories. Do not allocate Drew to one repository.
- I203 counts as closed during October and also currently open after reopening.

## RUN-01: recorded runs and source-only activity

Use the reference account/PR identities. Declare these records explicitly without inventing a relationship between nearby timestamps:

- Two recorded runs of the same Agent/configuration/model on P105, each with a different run ID and its own output links. Both post feedback, but the Agent receives one lifetime feedback credit on P105.
- A third recorded run on P105 using another configured model that fails before posting anything. It remains a real recorded run.
- A completed run with a result but failed publication; execution and publication states remain separate.
- GitHub-only agent activity on P106 with no reliable run ID. It does not automatically become another recorded run.
- At least one recorded run has unknown reported model/cost. Configured metadata must not be relabeled as observed runtime metadata.

Model and harness labels are fixture metadata, not claims about installed software or available models. Tracking scenarios require no launcher or execution controls.

## LOAD-01: 20 repositories and large record lists

Use 20 stable synthetic repositories R1–R20 and the same frozen as-of time. Odd-numbered repositories use `main`; even-numbered repositories use `master`. Each repository has a distinct human author account, `load-author-rN`, mapped to ExampleCo. Two other human accounts provide the specified feedback/approvals in R1; neither is a PR author. All other review/approval activity is known absent.

For the designated large repository:

- **834 currently open issues**, stable local IDs 1–834.
- For open issue ID `i`, creation time is `asOf - (835 - i) days`. Thus ID 834 is newest and ID 1 is oldest. All times remain explicit UTC instants.
- **46 additional closed issues**, IDs 835–880, created September 15 at 12:00 UTC. For closed issue ordinal `j` from 1–46, closure is October 1 at 12:00 UTC plus `floor((j - 1) / 2)` days: two closures per day through October 23.
- **137 currently open PRs**, IDs 1–137; IDs 1–17 are drafts and IDs 18–137 are non-drafts.
- For open PR ID `i`, creation time is `asOf - (138 - i) days`.
- Non-draft human-reviewer counts: IDs 18–57 have zero, 58–97 have one, and 98–137 have two.
- Non-draft current human approvals: IDs 18–37 have two, 38–77 have one, and 78–137 have zero. These are independent of feedback counts.
- Feedback/approval events occur October 24 at 09:00/10:00 UTC respectively, with no dismissals. Drafts have neither. These PR IDs are fixture-local identities; their GitHub record numbers are `1000 + i`, so they do not collide with issue numbers.
- Include a unique searchable title on the oldest issue, which is outside the first page.

Known answers:

- Issue pagination: sixteen full pages of 50 plus a seventeenth page of **34**.
- Newest-first issue page 1 contains IDs **834 down to 785**; page 17 contains **34 down to 1**.
- PR pagination: two pages of 50 plus a third page of **37**.
- Draft PR count = **17**; non-draft count = **120**.
- Non-draft PRs older than 30/60/90/120 days = **90 / 60 / 30 / 0**.
- Feedback distribution among non-drafts = **40 / 40 / 40** for 0/1/2 reviewers.
- Approval distribution among non-drafts = **60 / 40 / 20** for 0/1/2 approvals.
- Current open issues remain **834**, while October-created open issues = **23** and October-closed issues = **46**. Closed issues in this scenario were created earlier, so total October issue creations also equal 23.
- Searching for the oldest issue returns exactly that item even while the UI was initially on page 1.
- Changing table pages does not change graph totals or full matching counts.

For R2–R20, use these counts in repository order:

| Records | R2–R20 counts |
| --- | --- |
| Open issues | 120, 96, 75, 60, 48, 36, 24, 18, 12, 9, 6, 4, 3, 2, 1, 0, 0, 0, 0 |
| Open PRs | 40, 32, 24, 20, 16, 12, 8, 6, 4, 3, 2, 1, 1, 0, 0, 0, 0, 0, 0 |

Each has `floor(open PRs / 5)` drafts, using its lowest fixture-local PR IDs. Create these PRs September 1 at 12:00 UTC and issues September 15 at 12:00 UTC. There are no closures, merges, feedback, or approvals in these repositories. Use separate issue/PR number ranges as in R1; the author is the latest actor. All dates and totals derive from these facts, including known-zero October activity.

Across all 20 repositories: **1,348 open issues**, **306 open PRs**, **46 drafts**, and **260 non-draft PRs**. R17–R20 have no records. No PRs have merged in this scenario, so median time to merge displays a dash for an empty sample, not zero days. Do not mix in REF-01 responses to fill other pages.

## LOAD-02: contribution rankings and exports

Use 250 synthetic human accounts, each authoring one PR on Oct 1 and merging that same PR on Oct 2. Assign account `i` to repository `((i - 1) mod 20) + 1`. Dates use 12:00 UTC. No other feedback/approval/issue actions are present in this scenario.

- Each account has one PR authored, one authored PR merged, and one merge performed.
- The first 10 repositories have 13 PRs each; the remaining 10 have 12 each.
- The 250-row contributor result paginates as **five pages of 50** and exports **250** rows.
- Excluding one account produces and exports **249** rows.
- Company membership: 100 Acme, 100 Beacon, 50 Unmapped. Company totals use all members, not only the currently visible contributor page.
- Group A contains accounts 1–150; Group B contains 101–250. Each has 150 members; their union has 250 and their overlap has 50.
- Sort ties use an explicit stable secondary key so page boundaries are repeatable.

This is a separate coherent scenario, not a source of rows to mix with REF-01 or LOAD-01.

## TIME-01: dates, comparisons, and boundary conditions

Use a separate four-PR scenario with creation timestamps September 30 at 23:59:59.999 UTC, October 1 at 00:00:00 UTC, October 24 at 12:00:00 UTC, and October 24 at 12:00:00.001 UTC. At the fixed as-of time, September creation count is **1** and October-to-date creation count is **2**. The future record is excluded. A date boundary must not count the same event in both adjacent months.

For change indicators, use REF-01 R1: October-to-date PRs created = **3**; the equivalent elapsed September interval contains **1**; the absolute change is **+2**. For R2, the corresponding values are **3**, **0**, and **+3**, without an infinite percentage. An unavailable comparison baseline produces a dash for the change rather than a fabricated zero baseline.

Age boundaries use strict greater-than: in LOAD-01 R1, PR 108 is exactly 30 days old and is excluded from `>30 days`; PR 107 is 31 days old and is included. Similar exact-boundary cases apply to the other supported thresholds. All supported date presets must have explicit UTC boundaries and Monday-start weeks before their executable cases are marked ready.

## Named variants and response states

| Scenario | Change | Expected behavior |
| --- | --- | --- |
| EMPTY-01 | No selected repositories, or a valid filter with no matching records | Explicit empty selection/no matches; never silently select all repositories. |
| GAP-01 | REF-01 cannot establish whether P107 had an earlier approval before the available history | Alice's affected period approval total is incomplete, not an invented extra first credit. Other known metrics remain usable. |
| MAP-01 | REF-01 current mapping moves Alice from Acme to Beacon | Individual credits/dates do not change. Company rows regroup Alice's values; fixed group membership does not change. |
| ERROR-01 | A declared reporting request fails; a retry returns the original scenario | Show an error and recover to the correct data. A failure is not an empty/zero result. |
| LOADING-01 | A declared response is held until released | Show loading until the explicit response arrives. Tests synchronize on state rather than sleeping for guessed durations. |
| DISPLAY-01 | REF-01 titles/group names are long and labels contain multiple tags, punctuation, and Unicode | Counts and identities stay unchanged; tables, filters, links, and CSV escaping remain usable. |
| MERGE-01 | P107 is merged after its approval was dismissed | Historical approval credit remains one; effective approval count at merge is zero. |
| MERGE-02 | P107 is merged before a later dismissal | Approval at merge remains one; current state afterward can be zero. |
| PUSH-01 | One confirmed direct-push event with several commits, replayed twice, plus one unclassified update | The confirmed push is counted once. Commit author is not substituted for the pusher; the unclassified update is not claimed as a confirmed direct push. |

Variants that change underlying facts must update every dependent response and expected answer. Text-only variants can preserve numerical answers. Availability variants must propagate incomplete totals appropriately rather than silently adding known parts into a falsely complete total.

## Files and implementation responsibilities

The actual code/file layout will follow the checked-out repository, but keep these responsibilities separate:

- Scenario manifests: IDs, version, clock, seed, scope, purpose, and provenance as invented data.
- Reference entities and event/credit facts.
- Independently maintained expected answers/query cases.
- Large-data generators and recorded count/boundary expectations.
- Mock reporting handlers/adapters that validate and answer typed queries.
- Explicit loading/error/coverage variants.

The UI imports the reporting client, not the fixture entities. The mock provider may derive a query response from its scenario, but that implementation is checked against the independent expected answers. The future real adapter must satisfy the same frontend contracts; it will additionally need real-source integration evidence.

## Timeline display scenarios

Follow the [shared timeline contract](../product/README.md#timeline-reporting). Add prepared, coherent series and supporting records when implementing that frontend increment; these scenarios do not require raw-event reconstruction now.

- One complete calendar year with daily, weekly, monthly, two-month, quarterly, half-yearly and yearly representations of the same additive activity totals. Unique-author and median summaries have their own independently prepared whole-range answers.
- A range beginning and ending inside calendar intervals, an unfinished current interval at the fixed as-of instant, leap-day/year transitions and Monday-start weeks. Boundary records belong to one interval only.
- First reviewer/approval credits with later repeated actions that do not create additional contribution credit; current approval state remains a separate supplied snapshot.
- Known-zero periods, missing periods and partial historical coverage, including historical backlog values that cannot be inferred from today's open list.
- More than 50 intervals for pagination, full-result exports and matching chart/table values; person/company exclusions and exact interval return navigation remain consistent.

Custom-group timelines remain deferred with the other group scenarios. Real integration must independently verify the series and historical coverage; matching prepared frontend values alone does not prove those calculations.

## Readiness by phase

For initial visual work, require stable ready-to-display values, realistic text/number lengths, useful empty/loading/error variants, coherent visible arithmetic, and explicit mock labeling. Supply enough supporting sample rows for the interactions under review. No full-history reconstruction or arbitrary-query engine is required.

The [approved sequence](../product/README.md#approved-delivery-sequence) permits the reviewed sample-backed frontend to be deployed before real reporting integration. That deployment continues to use production authentication and explicit sample labels. Keep deterministic samples for visual and regression tests after real sources are connected; a failed real source must not silently substitute these invented values. Custom-group scenarios become active only in the post-database milestone.

The stronger gate below applies when implementing reusable query fixtures and the reporting/data layer, after the visual frontend baseline and early hosted acceptance:

Before claiming the reporting scenario is executable and verified:

1. Its manifest, identities, relationships, clock, and relevant query coverage are explicit.
2. Its data and responses validate against the agreed contract schemas.
3. Its known-answer cases match, including cross-page totals and first-credit attribution.
4. Repeated generation with the same inputs produces the same data.
5. Queries apply scope and sorting before pagination; unsupported queries fail visibly.
6. Empty, unavailable, and error states remain distinguishable.
7. No real credentials, private source contents, or agent execution are required.

This document prepares the data design. It does not claim those executable readiness checks have run.
