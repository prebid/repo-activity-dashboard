# Display mocks for frontend design

These are invented, ready-to-display values. They allow the frontend to be designed before the new reporting layer and database are built. They are not real repository measurements, an API implementation, or a proposed database schema.

The exception is [repository-catalog.ts](repository-catalog.ts): it contains real metadata for the complete **18-repository list supplied by the user**, verified against GitHub on 2026-10-24. This path now re-exports the application-owned catalog from src/config/repositories.ts, which drives mock navigation and reporting views. Existing IDs and route slugs are preserved. The [verification snapshot](../../docs/implementation/evidence/2026-10-24/repository-catalog-metadata.json) records the identities and branches. Activity counts in the other files are still synthetic, and their fictional repository IDs must not be silently joined to these real entries.

## First sample: All Repos

[all-repositories.json](all-repositories.json) supplies 20 repository rows with:

- Current backlog: draft/non-draft totals, issues, age >60 days, separate human feedback/approval distributions, agent/bot coverage, and latest-actor categories.
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

Load this file at the page/composition level and pass typed values to table components. Application display types live in `src/models/reporting.ts`. Keep numbers out of JSX. The sample file is allowed to evolve as the design becomes concrete; it does not freeze an HTTP API.

Display numeric zero as `0`. Display `null` as a dash, with the corresponding availability note when needed. Compute an absolute change only when both period values are known. Format durations from the supplied day values. Keep the current backlog independent of the selected activity period.

The reviewer and approval buckets are independent; do not combine them. Coverage counts can overlap. Latest-actor counts are disjoint for this sample. A count greater than two is represented separately so the component does not assume the three visible buckets exhaust all possible data.

Local sorting, repository selection, column selection, and Show change can use this complete set of rows. It supplies only one period and one aging threshold initially. Add prepared values for other presets when implementing their interactions; do not relabel unchanged numbers as a different period. Add supporting mock PR/issue records before claiming a summary-to-list drill-down works.

## Next display samples

As each page is designed, add only the display data it needs:

- Repository page: top-level PR/issue rows, full matching counts, prepared graph series, and repeatable pages for large lists.
- Contributors/companies/groups: prepared report rows, overlapping membership examples, exclusions, and enough sample rows to exercise exports beyond the visible page.
- Agents/bots: catalog rows, separate recorded-run and GitHub-only activity rows, multiple runs per PR, and known/unknown model and harness metadata.
- Shared states: explicit loading, error, empty, no matches, partial data, long text, and fixture login identities/preferences.

Direct values and small local helpers are sufficient. Historical event reconstruction, ingestion, database tables, and agent execution belong to later work.

## Visual completion

Use the [visual baseline checklist](../../docs/implementation/foundation-contracts.md#what-visually-locked-means) to review the actual rendered frontend. Creating this file does not complete or approve a page design. Preserve the reviewed screenshots and interaction behavior when the real data adapter is added later.
