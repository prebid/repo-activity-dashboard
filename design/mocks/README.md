# Display mocks for frontend design

These are invented, ready-to-display values. They allow the frontend to be designed before the new reporting layer and database are built. They are not real repository measurements, an API implementation, or a proposed database schema.

The exception is [repository-catalog.ts](repository-catalog.ts): it contains real metadata for the complete **18-repository list supplied by the user**, verified against GitHub on 2026-10-24. This path now re-exports the application-owned catalog from src/config/repositories.ts, which drives mock navigation and reporting views. Existing IDs and route slugs are preserved. The [verification snapshot](../../docs/implementation/evidence/2026-10-24/repository-catalog-metadata.json) records the identities and branches. Activity counts in the other files are still synthetic, and their fictional repository IDs must not be silently joined to these real entries.

## Runtime sample for All Repositories

Step 1 now provides the typed sample entry point [repositoryOverviewSample](../../src/mocks/repository-overview.ts), backed by [backlog values](../../src/mocks/overview-backlog.ts) and one [dated record set](../../src/mocks/repository-world.ts) per repository. It uses the 18 real catalog identities with invented records and a fixed reporting clock of `2026-10-24T12:00:00.000Z`. It is a display sample, not a database adapter.

The [display models](../../src/models/repository-overview.ts) separate current backlog, per-period activity, and complete/partial/missing/not-applicable measurements. Runtime schemas reject invalid counts and missing metric keys. [Period selection](../../src/lib/presentation/reporting-period.ts) resolves UTC dates; [drilldown helpers](../../src/lib/presentation/repository-drilldown.ts) validate and serialize destination context. These helpers do not import a table library, React, authentication, or sample data.

| Control or display | Prepared coverage |
| --- | --- |
| Repository selection | All 18, an explicit empty selection, or a subset; duplicate IDs are collapsed; unknown URL IDs are ignored without selecting all, while direct sample queries reject unknown IDs. |
| Aging | Independent 30/60/90/120/180/360-day columns; default selection 30. Selecting none hides the group. Prebid.js values are 90/60/30/0/0/0. |
| Period presets | All seven agreed presets and exact UTC ranges, each counted from the record set. Current backlog stays identical. |
| Custom range | October 6–8 and October 13–15, 2026 are bundled for a two-custom-range preview. Other valid ranges show explicit missing-sample activity on the Summary, preserving backlog. Record lists and supporting details count any range from the record set. |
| Two periods | Select one or two presets/custom ranges. Each repository group contains its two period rows and a compact automatic Difference row (Period 1 minus Period 2). Show the repository name once, without numbered row badges. Each period retains its own values; differences require complete operands. Numeric sorting uses Period 1; Swap periods changes that ranking choice and difference direction. Show change is not exposed. |
| Reviewers and approvals | Independent 0/1/2 distributions, retained above-two exceptions, agent/bot coverage, and latest-actor categories including other/unknown. |
| Durations | Median days plus sample size; no merged PRs means not applicable, not zero days. |
| Missing and partial data | Agent Skills current approvals missing; Cache Java partial agent coverage and a history gap from September 21 to October 3, 2026, which makes October and its comparison partial; GitHub Activity DB history starts October 1, 2026, so earlier periods are missing. Any range before 2024 is missing for every repository. |
| High-volume author | About 30% of Prebid.js history is authored by sample-author-2, an agent account, giving it more than 100 PRs and issues this year to date. The same history includes a bot author (sample-author-3[bot]) and a mixed-case login (Sample-Riley). |
| Table scale and text | 834 issues for Prebid.js, 12,345 for Documentation, quiet/empty rows, and the actual long catalog display names. |
| Navigation contracts | Current/period metrics, age thresholds, primary-branch merges, and safe return context round-trip through typed descriptors. |

Repeated calls return independent serializable values. Summary activity and comparisons, current and period record lists, supporting details and the repository Timeline all count the same records: opened by creation date, merged into the primary branch by merge date, distinct authors by case-insensitive login, credits on each account's first qualifying review or approval, and coverage from each repository's prepared history ranges. Per-repository volume divisors vary the invented history; they are not estimates of real activity. Today's open records are generated from the handwritten backlog values, so backlog and current lists agree. Tests recount the records by those definitions instead of calling the sample's own helpers.

The All Repositories preview now consumes this sample through the guarded loader. Its reusable tables provide sorting, grouped column selection, pinned repository identities, and overflow hints. Storybook includes the full page, two-period rows, empty, loading, and error examples. Step 4 now links current PR/issue counts and period PRs opened/merged and issues opened/closed to matching metadata-only sample lists. Current records share the overview backlog; period records are selected from the same record set by event date. Author/contribution counts and available durations now open their matching supporting details; only Difference rows remain informational. Author rows count the exact opened records by account and link to separately loaded, paginated author-specific lists, contribution rows use unique account/PR/type credits with first-credit dates, and duration rows share the merged-PR cohort with a matching median and sample size. Storybook includes record and supporting-detail lists for authors, credits, durations, normal, empty, partial, and missing states. Repository selection, period/aging selectors, independent custom ranges, Reset view, and account/browser preferences are implemented. The server packages all prepared periods with a single backlog using `repositoryOverviewSamples`; the client selects from those values through `selectOverviewSample`. No reporting request interface or database was added. The new table layout uses the approved Prebid palette without following the old reporting layout. Repository selection is the summary filter; search remains inside that picker, not in either summary table.

## Earlier display reference

[all-repositories.json](all-repositories.json) supplies 20 repository rows with:

- Current backlog: draft/non-draft totals, issues, age >60 days, separate human reviewer/approval distributions, agent/bot coverage, and latest-actor categories.
- Current-period activity and comparison values, including increases, decreases, unchanged values, and unavailable comparison history.
- A repository with 834 open issues, one with a five-digit count, smaller repositories, a quiet repository, and a completely empty repository.
- A long repository name, a missing current-approval state, and no-merge cases for the median.

Examples from the fixed sample:

| Repository | Total open PRs | Drafts | Non-drafts | Open issues | PRs created this period | PRs merged this period |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Example JS | 137 | 17 | 120 | 834 | 47 | 38 |
| Example Server | 37 | 5 | 32 | 86 | 28 | 21 |
| Example Documentation | 23 | 4 | 19 | 12,345 | 32 | 26 |
| Example Sandbox | 0 | 0 | 0 | 0 | 0 | 0 |

All values are synthetic, including company/project-like names. Do not label this sample as live Prebid activity. The fixed reporting time is October 24, 2026 at 12:00 UTC. It is a separate visual scenario from REF-01 and LOAD-01 in the [test-data plan](../../docs/implementation/test-data-plan.md).

## How to use the data

The JSON below remains an earlier display reference, separate from the current 18-repository runtime sample. New table work should use the runtime entry point above at the page/composition boundary and pass typed values to components. Keep numbers out of JSX. These display types do not freeze an HTTP API.

Display numeric zero as `0`. Display `null` as a dash, with the corresponding availability note when needed. Compute an absolute change only when both period values are known. Format durations from the supplied day values. Keep the current backlog independent of the selected activity period.

The reviewer and approval buckets are independent; do not combine them. Coverage counts can overlap. Latest-actor counts are disjoint for this sample. A count greater than two is represented separately so the component does not assume the three visible buckets exhaust all possible data.

This earlier file retains comparison values as a planning reference; the active interface does not expose Show change. Use the normalized runtime samples for current period selection and column controls. It supplies only one period and one aging threshold; it is not the active multi-period fixture. Add prepared values for other presets when implementing their interactions; do not relabel unchanged numbers as a different period. Add supporting mock PR/issue records before claiming a summary-to-list drill-down works.

## Next display samples

As each page is designed, add only the display data it needs:

- Repository page: top-level PR/issue rows, full matching counts, prepared graph series, and repeatable pages for large lists.
- Contributors/companies/groups: prepared report rows, overlapping membership examples, exclusions, and enough sample rows to exercise exports beyond the visible page.
- Agents/bots: catalog rows, separate recorded-run and GitHub-only activity rows, multiple runs per PR, and known/unknown model and harness metadata.
- Shared states: explicit loading, error, empty, no matches, partial data, long text, and fixture login identities/preferences.

Direct values and small local helpers are sufficient. Historical event reconstruction, ingestion, database tables, and agent execution belong to later work.

## Visual completion

Use the [visual baseline checklist](../../docs/implementation/foundation-contracts.md#what-visually-locked-means) to review the actual rendered frontend. Creating this file does not complete or approve a page design. Preserve the reviewed screenshots and interaction behavior when the real data adapter is added later.
