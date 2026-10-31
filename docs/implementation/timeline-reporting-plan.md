# Timeline reporting implementation plan

Build a continuous timeline of repository and contribution metrics with prepared fake data, preserving the approved Prebid design and the existing reporting boundaries. Deliver each checkpoint separately for review before advancing. The [timeline product contract](../product/README.md#timeline-reporting) owns metric meanings and calendar alignment; this plan owns implementation order, component responsibilities and verification.

Status: Steps 1–4 are implemented and visually approved. Step 5 self-audit, adversarial checks, visual refinements and final local verification are complete. Ready for independent draft review against `codex/frontend-rebuild`. The user additionally approved multiple selected metrics grouped under each repository, with the selector labeled Metrics. This amendment is implemented in the final review. The starting point is the merged frontend rebuild at `d7097503e39d884e0462e63c3a07aadfba6e7920` (PR #8). Work is local on `codex/timeline-reporting`; delivery PRs target `codex/frontend-rebuild`. A production release remains separate.

## Scope and preservation

- All Repositories gains Summary and Timeline tabs; its Timeline matrix groups selected metrics as rows under each repository, with periods as columns. Individual repository pages retain a Timeline chart and multi-metric interval table. Contributors and Companies gain Over time tables for the current person, company or selected population. No contributor/company charts or repository-per-column matrix.
- Support Daily, Weekly, Monthly, Every 2 months, Quarterly, Every 6 months and Yearly. Range and grouping are independent. Preserve the existing two-period All Repositories comparison and current record-list charts.
- Keep authentication, account behavior, TypeScript, the existing dependencies, the 18-repository catalog, Prebid tokens, dark default, Light/Dark/System choices, grouped Columns/Export CSV controls and 50-row pagination.
- Reporting remains fake in preview and production-auth modes. No database, GitHub ingestion, raw review-event reconstruction, historical state engine or unused remote-pagination adapter is introduced.
- Merge-review/direct-push reporting and agent/bot tracking remain subsequent increments. Custom groups follow real data; launching, expanded export formats and calendar heatmaps retain their deferred positions.

## Starting views and defaults

These are implementation defaults to validate in the Step 2 preview; existing product decisions remain fixed.

| Area | Entry and initial presentation |
| --- | --- |
| All Repositories | Summary remains the default. Timeline reuses the repository selector for all repositories or a subset, with selected metrics, a continuous range and calendar grouping. Pin repository names; periods run left to right. Starting metric: PRs opened. |
| Repository | Add Timeline beside Pull requests and Issues within the repository. Ordinary repository visits still open current PRs. Inherit an explicit incoming activity range; entry from Current open uses This year to date. Default chart metric: PRs opened. |
| Contributors and Companies | Add Over time at report-scope level on overview and focused reports. It aggregates the selected population, with one row per interval. Preserve the current entity, repository selection, actor types, inclusions, exclusions and overall period. Existing entity/member/repository tables remain available. |
| Shared defaults | Monthly grouping when no explicit or valid saved timeline choice exists. Individual/contribution views have chronological ascending interval rows and a pinned Period column. The All Repositories matrix has chronological period columns and pinned repository names. Show covered dates and partial-period markers in both orientations. |
| Repository metrics | Start in PR activity with PRs opened/merged, unique PR authors and median merge duration. Issue activity offers issues opened/closed and unique issue authors. Existing backlog/aging/reviewer/approval measures use a separately labeled Backlog at cutoff family with supplied historical values. The table contains the compatible metric family; show one metric/unit in the chart at a time. |
| Contribution metrics | Start with the six established core columns. Keep the existing comment and authored/reviewed/approved merged-volume groups selectable, with the same definitions and units. |
| Charts | Repository chart panel starts collapsed, with an explicit Show chart control and its own saved visibility. Its series stays chronological even when the values table is sorted by a metric. Contributor/company views remain tables. |
| Whole-range context | Display the selected range, grouping, source clock and scope. Any whole-range measurement comes from its own supplied/reconciled value; do not add a generic Total row that sums every metric family. |

Over time is a report-scope view, not a transformation of whichever 50 entity rows are visible. The current Find in table query, entity ranking, member Hide zero totals setting and list page remain list presentation and are restored when returning to that list. They do not silently become population filters. Label the timeline population explicitly; use the existing account/company selection controls to choose a population. Timeline tables do not need a second text-search box.

Repository entry preserves compatible record filters and any exact activity-range intersection. Author/type, labels, title search and other compatible metadata filters keep their existing meanings for the reporting snapshot. Current age/review/approval filters cannot become historical predicates. Keep them on the originating record view and visibly explain their exclusion on an activity Timeline entry. A historical snapshot view only uses filters whose cutoff values are supplied. An incompatible explicit Timeline URL is invalid, not silently broadened. Verify this compatibility mapping in Step 1 and the transition in Step 3.

Repository timeline scope includes the PR/issue kind and activity/snapshot family. Entry from an issue report selects Issue activity; entry from a PR report selects PR activity. Switching family/kind is a deliberate scope change using the same compatibility rules. PR-only filters must not silently restrict issue metrics, and issue-only filters must not be ignored beneath a PR metric label. List search is a repository record filter where supported, unlike the contribution identity-table search described above.

## All Repositories Timeline addition

Approved 2026-10-30. Add **Summary | Timeline** inside All Repositories, preserving the single top-level Repos navigation. Summary retains its backlog table and two-period comparison. Timeline is a separate continuous-range view; it must not combine two comparison periods into an invented date range or overwrite the Summary settings.

- Select all repositories or any subset with the existing repository picker. Keep every selected repository row, including known-zero and unavailable results. No table search or combined cross-repository participant total is introduced.
- Choose one or more Metrics across chronological period columns. Each repository groups one row per selected metric. Each cell retains its measurement, unit, covered dates and coverage. Reuse the individual Timeline metric definitions and source identity; the same repository/metric/interval must produce the same answer in both views.
- Use a bounded display window for long timelines. Starting layout default: up to 12 period columns, initially the most recent window, ordered oldest to newest within it. Windows are consecutive, non-overlapping chunks from the start of the range, with one-based window pages; the final window can be short (500 intervals gives 42 windows, the last containing 8 intervals). Invalid window pages are rejected. Earlier/Later controls show a clear visible-span and full-range label. Window movement does not change the report range, grouping, metric, values or export scope. Validate the column count and narrow-screen scrolling in the visual checkpoint.
- Repository rows start in name order. A period-column sort ranks repository groups using the selected Sort metric. Pages contain at most 50 metric rows and never split a repository group (three metrics gives 48 rows per page). Keep the selected sort period explicitly named even if it moves outside the visible window; do not silently fall back to a different sort. Period-window controls and repository-row pagination have distinct labels and state.
- Period columns are managed by the window, not duplicated in a hundreds-item Columns menu. Reuse the table engine and shared column-help/measurement components; adapt its toolbar only where this matrix needs it.
- A repository name opens its individual Timeline with the same full range, grouping, metric and compatible scope. The return restores repository selection, period window, sort and row page. Metric cells later open the matching repository-specific supporting records for that interval. Names and cells have distinct destinations.
- CSV exports retain all selected repositories and the full selected range, independently of the visible period window and row page. The shared Export CSV flow must state that scope and retain repository, interval, metric/unit and coverage metadata. Export shape is completed with the Step 4 consumer; no new export format or separate options panel is introduced.
- This is a numeric comparison table, not a calendar heatmap or an additional chart dashboard. Per-repository unique authors and medians retain their existing definitions; never blend or sum them into a cross-repository total.

The matrix contract stores the interval definitions once and carries each selected metric's values and whole-range answer per repository, with no cross-repository or cross-metric total. PR and issue sources share one prepared sample, and projection is grouped by record kind and activity/snapshot family. It does not serialize one complete multi-metric individual report per row. The 500-interval guard applies to the full range, not the visible window; one metric across the current 18-repository catalog can therefore occupy 9,000 cells. A shared 10,000-cell guard counts repositories × metrics × intervals and bounds catalog/selection growth before matrix values are projected; exceeding it requires fewer repositories or a coarser grouping, never silent truncation. The measured sample payloads are recorded below. Build from coherent prepared sources, reuse calendar/filter/coverage rules, and avoid an all-repositories × all-periods × all-metrics expansion or repeated whole-source preparation per interval.

The model/sample and matrix layout checkpoints are implemented and visually approved. Step 3 now connects the filters, view state and saved preferences. The previously implemented views and their tests stay in place.

## Shared contracts and ownership

Use a small shared calendar and display contract, with feature-specific metric selection and supporting-record logic. Do not create a universal reporting framework or copy complete controllers into a new feature.

| Owner | Responsibility and reuse |
| --- | --- |
| `src/models/reporting-period.ts` and a focused timeline model | Reuse validated UTC instants, ranges, periods and measurements. Add grouping, calendar interval identity, covered range, temporal completeness and typed navigation intent. Keep types independent of React, routing and table libraries. |
| `src/lib/presentation/` calendar helpers | One pure interval builder shared by both areas. Validate and bound requests before materialization; return stable IDs, full calendar bounds and clipped covered bounds. It does not infer reporting history. |
| Repository/contribution model and presentation modules | Own existing metric IDs, units, coverage, scope and interpretation. Activity, credit, comments, merged volume, distinct/derived values and historical snapshots remain distinguishable. Share generic mechanics, not domain meaning. |
| `src/mocks/` | Fixed identities, clock, source/scenario revision, coherent prepared facts/series and explicit coverage. Select only the requested scope. Supporting details and exports use that same source identity. |
| Authenticated route/server composition | Parse the requested view once, validate scope, choose the sample source and return the active Timeline model, selected-metric matrix or requested details. Preserve anonymous denial and private/no-store downloads. Do not send unused report tables, the whole account directory or full record histories to the browser. |
| `src/lib/navigation/` and `_screens` | Own URL state, account-scoped preferences, history, scope transitions and drilldowns. Extend the existing owners or compose a small timeline helper; avoid competing effects that restore/write the same field. |
| Feature views | All Repositories matrix, individual Repository Timeline and contribution Over time receive typed values and callbacks. Reuse header/scope, metric formatting, column definitions, grouped selectors, table and export components. |
| Shared UI | Calendar grouping control, interval labels and coverage presentation only where both views consume them. Use the installed chart stack for repository series; keep metric registries, routing, sample imports and storage out of generic chart/table components. |

An interval needs both its calendar identity and exact covered range. For example, a January row selected from January 15 still identifies January but reports January 15 through the selected endpoint. A clipped period can have complete data for those covered dates: **partial calendar period and incomplete data coverage are separate states**.

Keep snapshot cutoffs explicit, including whether events at the cutoff are included. Historical backlog details must receive prepared historical membership/state; the current-open selector cannot stand in for a historical snapshot. Render missing snapshots as unavailable. Unique-author and duration details reuse their existing distinct-account and underlying-PR units.

## Calendar and metric rules

- UTC days and Monday-start weeks; calendar months, Jan–Feb two-month blocks, Jan–Mar quarters, Jan–Jun half-years and calendar years. Labels must include enough year/date context to distinguish intervals crossing years.
- Completed windows are start-inclusive/end-exclusive. Preserve the existing inclusive reporting-as-of endpoint. An event exactly at an internal boundary belongs to the next interval once; an included cutoff exactly on a boundary may create a zero-elapsed current interval. Never extend the requested window to make a full calendar period.
- Changing grouping preserves the whole range and population. Intervals tile the covered range with no overlap or missing dates. Empty periods stay present as known zero only when coverage establishes zero. Empty selections use an empty-scope state, not a fabricated series of zero measurements.
- Credit dates are supplied once per account/record/metric across the sample history. Partitioning by interval never earns another reviewer/approval credit. Comments use posted identities/dates. All three merged-volume roles use the merge date and retain separate units.
- Additive whole-range values reconcile with interval values when coverage permits it. Unique counts and medians require independent whole-range answers. Snapshot values are states at cutoffs and are never summed as activity. An unavailable duration for no merged PRs stays distinct from zero hours.
- Known and partial numeric values can open the corresponding known supporting data with coverage context. Known-zero counts open an empty matching list. Missing/not-applicable cells explain their state and do not invent a drilldown. Chart and table actions use the same typed descriptor.

## State, navigation and bounds

Use a dedicated Timeline discriminator, provisionally `timeline=1`, without overloading the existing company `view=members|repositories` or repository record scope. Namespace grouping, selected chart metric, chart visibility, interval sorting/page and columns under `timeline.*`. Validate the exact supported fields; do not add a catch-all query passthrough. Step 1 fixes the typed range, grouping and detail-intent contracts; concrete URL encoding is implemented and tested with its consumers in Step 3, with detail destinations completed in Step 4.

Explicit URL scope wins over valid saved defaults, then view defaults. Reuse existing date/population ownership instead of storing a second copy in timeline preferences. New timeline presentation preferences are versioned and isolated by viewer, sample and report area/table; repository presentation is also isolated by repository. Opening a link or drilling into one interval does not save that interval as the default report range. Relative presets remain relative. Reset affects only the intended timeline settings and explicitly changed report filters.

The return codec currently permits a fixed parameter set. Extend the existing contribution snapshots to include the new validated Timeline fields, preserving its version compatibility, independent parents and URL/expansion bounds. Repository return handling must retain its existing All Repositories origin while restoring the immediate Timeline parent with its exact range, filters, grouping, table page/sort and chart selection. Reuse the bounded snapshot mechanism where it fits; avoid recursively nesting whole URLs or broadening the existing contribution allowlist to arbitrary paths. Cover any cross-feature extraction with the existing return-link tests.

An interval drilldown requires exact start/end/inclusivity, not just a date label. The current contribution entry primarily accepts calendar-date periods, so add a validated exact-interval path where needed rather than rounding an inherited timestamp to midnight. Validate that a requested interval lies inside its parent range and reporting clock. A historical-snapshot descriptor carries its cutoff semantics separately from event-date filtering.

Filter/group/range changes reset affected table pages. Presentation changes do not change measurements. Pending search is captured through the existing navigation contract. Malformed, stale or oversized proposals show feedback and preserve current URL/preferences and editable drafts. Reuse the recently fixed saved-value compare-before-remove and picker snapshot behavior.

Keep all supported intervals in the result; 50-row pagination only limits rendered table rows. CSV covers the full matching result in table sort order; repository charts use the full chronological series, independent of table pagination/sort. Do not bridge missing chart values or plot them as zero. Axis labels may be thinned for readability, but values and drilldown targets may not be dropped or rebucketed.

Initial safety bound: **500 intervals per request**, checked before generating intervals or samples. Step 1 measured the proposed 2,000-interval contribution scenario at 9,555,398 uncompressed JSON bytes with incomplete historical coverage, so the guard was reduced before layout work. An over-limit request gets an explicit explanation to narrow the range or choose a coarser grouping; it is never silently truncated or automatically regrouped. This is a frontend sample budget, not a production capacity guarantee. Step 2 still checks chart usability at the bound. Render no thousands of hidden point controls; provide complete keyboard-accessible values through the table. Do not add virtualization or remote paging without an observed need.

## Prepared sample and verification design

Current repository period samples are prepared independently for a requested range. Do not call that generator separately for every interval: independently invented subranges cannot establish whole-range reconciliation. Timeline samples need a bounded, coherent set of prepared dated records/credits or supplied series that all groupings and their details share.

Reuse established contribution identities and fixed first-credit facts where they fit. Project the validated sample into the requested interval/report shape; do not validate and calculate the entire report once per interval or materialize account × repository × interval collections. Supplied snapshots and derived summaries remain explicit facts. Expand supporting record metadata only for a selected detail route or export that actually needs it. Unsupported sample periods/filter combinations retain their requested scope and show coverage gaps, not values borrowed from another sample.

| Scenario | Independent expected evidence |
| --- | --- |
| Calendar boundaries | Full-year dates; mid-week/month clipping; leap day; Dec/Jan rollover; exact midnight and inclusive as-of cutoffs. Handwritten expected bounds and event identities for every grouping. |
| Additive activity | One prepared year with sparse PR/issue events. All seven groupings preserve whole-range counts; created, merged and closed timestamps select different known records. |
| Contribution credit and volume | Reuse reference authors/reviewers/approvers, repeats across months and a PR reviewed before its merge interval. Pin core, comment and volume answers separately. The approval dismissal is pinned on the repository Timeline snapshot (`tests/unit/repository-timeline.test.ts`); issue-only and comment-only participants are pinned on the contribution report (`tests/unit/contributions.test.ts`, `tests/unit/contribution-activity.test.ts`), not on a Timeline fixture. |
| Non-additive values | The same author occurs in multiple intervals. Example interval durations `[1, 100]` and `[2]` have medians 50.5 and 2, while the whole-range median is 2. Pin whole-range identities/values independently. |
| Historical snapshots | At least two prepared cutoff states with changed membership/review state, plus an unavailable cutoff. Current open records must not replace these states; filtering requires matching historical attributes. |
| Coverage and empty scope | Complete zero, missing interval, partial numeric subtotal, no applicable median, unsupported range, empty repos/types/population and no matching activity. Temporal clipping alone must not add an incomplete-data asterisk. |
| Scale and context | More than 50 intervals, the 500-interval boundary and one over-limit request; large contributors and thousands of directory-only accounts; many filters and nested/copied return links. Long account names are exercised on the contribution report's large sample, not on a Timeline fixture. |
| All Repositories matrix | All 18 repositories and subsets; individual-timeline equivalence; one author active in multiple repositories; zero and missing rows; window boundaries and a short final window; per-period sorting by a selected metric, offscreen sort context and full-range CSV. Shared intervals and the combined cell budget bound serialization. Multi-metric repository groups stay together when sorting and paging. |

Use fixed clocks and stable IDs; no random values per render. Reconcile source/scenario identity through parent, interval detail and CSV. When a timeline scope matches an existing report backed by the same sample source, its whole-range answers must match that report. Extend the sample source deliberately where necessary; do not route timeline details into a legacy generator that produces different answers.

## Five checkpoints

### Step 1 — Models and coherent samples

**Implement:** shared interval/grouping types and pure calendar helper; feature-specific temporal descriptors; explicit scope/filter compatibility; prepared scenario coverage and supporting identities; minimal source composition needed to test projections. Define whole-range and interval values without adding layouts, a database API or raw-history calculations.

**Test:** all seven groupings, leap/year/week boundaries, exact inclusive endpoints, clipping versus coverage, additive/non-additive values, once-only credits, merge-date volumes and historical cutoff states. Exercise empty/malformed/oversized requests, hidden metrics, full-scope totals, sparse directory scaling and source identity. Expected dates and decisive counts come from handwritten cases rather than the builder being tested. Record payload/construction measurements without hardware-dependent timing assertions.

**Review checkpoint:** show a readable interval/sample matrix with exact covered dates, a few known metric answers and missing/partial examples. This is the model/data review; the first application layout arrives in Step 2. All relevant model/sample tests pass before layout work.

**All Repositories extension:** add a compact selected-metric matrix contract and stable repository/interval identities. Test every matrix cell against the corresponding individual model plus handwritten decisive cases; retain repository independence, explicit zero/missing rows and source provenance. Measure all 18 repositories at the 500-interval bound without carrying unrelated metrics or histories.

### Step 2 — Layouts and first visual preview

**Implement:** repository Timeline shell, collapsed chart panel and values table; contributor/company Over time tables using the approved headers, scope treatment and shared components. Build normal, zero, missing, partial-period, incomplete-data, loading/error and dense stories. Show one repository chart metric at a time; preserve distinct count/duration labels and no misleading aggregate Total row. Future route/export controls must not appear functional before they are connected.

**Test:** render from supplied models independently of the router; semantic tables, accessible labels/focus, grouped columns, overflow, stable Period column and chart/table value parity. Check long-range chart behavior and the interval bound. Verify shared selector/measurement changes do not regress existing repository/contribution layouts or login styling.

**Visual checkpoint:** review normal and focused views in dark/light at narrow and desktop widths, including partial period versus missing data, large values, and Show chart. Agree on layout and entry placement before live state wiring.

**All Repositories extension:** render Summary/Timeline placement, a pinned repository column, chronological period headers and clearly labeled local Earlier/Later window controls. Test short/full/final windows, actual horizontal scrolling and row pagination independently. Review all repositories, a subset, zero/missing cells and narrow-screen labels before Step 3.

### Step 3 — Controls, navigation and saved preferences

**Implement:** existing presets/custom dates plus the seven-choice grouping control; repository metric/family selection; report-scope and compatible filter inheritance; Timeline/list switching; URL state, safe account-scoped preferences, reset and 50-row pagination. Use the same guarded entry pattern for bookmarked and bare visits. Preserve list search/presentation on return without treating them as a new selected population.

**Test:** explicit URL precedence, valid/stale saved values, account/sample isolation, unavailable storage, empty selections, rapid edits, rejected edits retaining drafts and Back/Forward/reload. Verify daily/yearly changes keep the full date range, filters apply before all measurements, grouping never resets first-credit dates, and incompatible current/historical filters are visibly handled. Exercise pending table search and large selections with return snapshots.

**Visual checkpoint:** walk through period/group changes, filtered company/person reports, repository entry from Current open and activity, paging beyond 50, invalid/over-limit feedback and restored views. Existing direct repository visits must still default to current-open records.

**All Repositories extension:** wire repository selection, the selected metric, date/grouping and window state into validated URLs and account-scoped preferences. Keep Summary's two periods and presentation separate. Preserve matrix context through an individual-repository Timeline visit, copied links and Back/Forward; changing the display window must not change the report scope or silently change an offscreen sort.

### Step 4 — Supporting details and CSV exports

**Implement:** connect interval cells and repository chart selection to the correctly typed supporting view, preserving exact covered dates/cutoff, metric role, source revision, repository/entity scope and return context. Reuse current PR/issue, author, contribution and duration detail components where their semantics match; historical snapshots require supplied snapshot rows. PR/issue/profile links continue to open the corresponding GitHub destination.

Use the existing Export CSV dialog and column groups. Export all selected intervals, not the table page or chart viewport, with covered/calendar bounds, grouping, metric/unit, coverage, source clock and report scope. Timeline parent exports contain interval rows; detail exports retain the supporting-record units. There is no new Export options panel or file format.

**Test:** every supported metric family reconciles with details in its own unit: record counts, distinct authors, account/record credits, comment-value sums, role-volume sums or duration populations. Cover known zero and partial values, historical snapshots, multi-interval repeats, exclusions and renamed display identities. Real route/download tests compare CSV contents and supporting IDs with independent expectations; helper-generated links alone are insufficient. Test copied links in a fresh browser context and nested Back/Forward after child filter changes.

**Visual checkpoint:** click from each metric family into details and back, including historical/missing cases, and inspect downloaded CSVs for more than one UI page of intervals/records. Review the export dialog and supporting scope labels at mobile/desktop widths.

**All Repositories extension:** verify repository-specific interval cell destinations, full-range exports beyond the visible period window and row page, and exact matrix returns. Explain the export's full-range scope inside the existing CSV dialog.

### Step 5 — Final audit, visual sign-off and handoff

**Audit:** review composition of calendar boundaries, filter compatibility, saved state, independent return snapshots, eligibility/coverage, typed detail destinations and shared export order. Include matrix/individual equivalence, period-window versus report-range ownership, offscreen sorting and preservation of both Summary tables. Verify one owner per setting, bounded payloads, no hidden directory/record-history expansion and no route that substitutes unrelated current data. Recheck the fixes from PR #8 in the combined feature.

**Verify:** run the smallest relevant tests at each earlier checkpoint and `npm run check` at integration points. On the final source, run `npm run check:all`, inspect individual results and required non-empty suites, and retain coverage/architecture gates. Include packaged-production protected rendering/download checks, browser errors, keyboard/accessibility checks, both browser engines, dark/light, 375/768/1440 px and zoom/overflow checks. Bind final evidence to the submitted commit; distinguish local checks, hosted CI, visual approval and independent review.

**Visual/handoff checkpoint:** show the final gallery with the approved paths plus exceptional states. After user approval, open a draft PR against `codex/frontend-rebuild` with the implementation summary, tests, audit findings/dispositions and known sample limitations. No production merge or deployment is part of this checkpoint.

## Completion criteria

The increment is complete when the user can select a continuous range and any supported calendar grouping, understand each interval's dates and coverage, retain the intended report scope across views, inspect matching supporting data and export the full result. The existing dashboard stays usable with the approved defaults. A fake-data UI passing these checks establishes the frontend contract; actual historical collection and database correctness remain integration work.

Step 3 follows the approved All Repositories Step 2 matrix and the existing layouts. The proposed defaults, entry placement, population-scope wording and measured interval limits are reviewed at their scheduled checkpoints. Keep this file as the current plan; update checkpoint status and concise evidence as work completes, without accumulating superseded implementation narratives.

## All Repositories matrix model checkpoint

The matrix model and selection/window/sort contracts are implemented in `src/models/repository-timeline-matrix.ts` and `src/lib/presentation/repository-timeline-matrix.ts`. Repository and cell links resolve through the individual Timeline (`src/lib/presentation/timeline-navigation.ts`), so a cell's supporting records use that Timeline's descriptor. No matrix layouts, page entry, routing controller or exports are introduced by this checkpoint.

`createRepositoryTimelineProjection` owns one immutable calendar and projects only the requested metric subset. The existing individual selector delegates to the same implementation with its existing full-family defaults. Matrix cells reuse the individual detail-intent builder, preserving event dates, distinct-author/duration meanings and exact historical cutoffs. The sample provider prepares and indexes the common facts once for the requested catalog; individual and matrix sources share repository identities, scenario revision and reporting clock. Mixed revisions/clocks/kinds, duplicate source identities, unknown selections and incompatible metrics are rejected.

The `mixed` repository sample retains complete Prebid.js data, gives prebid-server incomplete January coverage and partial historical snapshots, marks prebid-server-java unavailable, and retains known-zero rows for the other repositories. Individual sources requested with that same scenario match the corresponding matrix sources. For PRs opened, a small part of the monthly matrix is:

| Repository | August 2026 | September 2026 | October through cutoff |
| --- | ---: | ---: | ---: |
| Prebid.js | 1 | 1 | 3 |
| prebid-server | 0 | 0 | 3 |
| prebid-server-java | — | — | — |
| prebid.github.io | 0 | 0 | 0 |

Per-repository distinct authors remain 4 for Prebid.js and 3 for prebid-server in the complete reference range, with shared authors counted in each repository. No combined-person total is produced. Prebid.js interval medians of 5 and 31 days retain a whole-range median of 5 days. Snapshot values remain unavailable without the exact supplied cutoff; known zero and partial-zero cells retain valid supporting-data intents.

Verification: `npm run check` passed **1,540 unit/component cases**, including **252 new matrix cases**, plus formatting, lint, strict types, architecture and coverage gates. Equivalence cases cover every supported metric across all seven groupings and all 18 repositories; independent handwritten cases pin decisive values. Other cases cover empty/subset/duplicate selections, mixed coverage, immutable calendars, exact detail context, first/middle/short-final windows, all-row/offscreen sorting and both interval/cell limits. Preview/Storybook builds and **28 existing timeline browser cases** passed in Chromium and WebKit after the shared projection refactor.

The reproducible diagnostics in `scripts/measure-timeline-reporting.ts` measured the 18 × 500 matrix at 678,007–1,025,227 uncompressed JSON bytes across large/mixed count, duration and snapshot samples. Only the selected metric and one shared interval axis are serialized. These local sample measurements do not certify future database or deployed capacity. The following layout checkpoint exercises that model; full navigation/persistence and exports remain Steps 3 and 4.

## All Repositories matrix layout checkpoint

`/repos` retains Summary as its default and exposes Timeline in the same page header. Entry carries the selected repository IDs into a monthly, year-to-date PRs-opened matrix. A bounded Summary URL preserves both comparison periods, age thresholds, columns and ordering independently. Empty repository selection stays empty. Invalid or recursive return targets are rejected; the authenticated server sends only the selected metric, shared intervals and repository identities/values.

`RepositoryTimelineMatrixView` composes the shared heading/tabs, `TimelineScope`, `DataTable`, column help and `MeasurementValue`. The table renders at most 12 period columns plus pinned Repository, initially the latest window. Its full value axis remains separate from the rendered columns so an offscreen period still governs all-row sorting. The footer names that period explicitly. Earlier/Later period windows and 50-row repository pagination have separate local state. The Columns menu, search, charts and unfinished exports are absent.

The preview includes counts, distinct authors, merge durations and exact-cutoff backlog values; zero, missing and partial data remain distinct. Partial calendar labels do not mark data as incomplete. Storybook includes monthly/weekly, mixed coverage, duration, issue activity, historical backlog, 500-period, empty-selection, known-zero and unavailable examples.

At this layout checkpoint, metric/range/grouping selectors, saved Timeline preferences and full repository navigation remained Step 3; supporting-cell drilldowns and full-range CSV remained Step 4. Repository names and values were plain text, and Earlier/Later and sorting were local preview state; Steps 3 and 4 have since connected all of these.

Verification on 2026-10-30: `npm run check` passed **1,579 unit/component cases**, formatting, lint, strict types, architecture and per-file coverage gates. Preview and Storybook builds passed. **16 matrix browser cases** passed in Chromium and WebKit, including normal Summary entry/return, both themes, 375/768/1440 px, pinned names, accessible column help, a bounded 500-period DOM, offscreen sorting, coverage/durations/snapshots and anonymous denial. **86 existing overview/preferences and individual/contribution Timeline browser cases** also passed. Individual machine-readable results were inspected. The initial matrix desktop-scroll assertion incorrectly required overflow when all columns fit; it was corrected before the successful final matrix run. Screenshots now wait for the column-help dialog to close fully. The visual review shortened weekly window labels to covered start/end dates and aligned their controls with the table heading.

Preview: `/repos` → Timeline, or `/repos?timeline=1`; `/repos?timeline=1&timeline.group=week` exercises Earlier/Later. Review artifacts and machine-readable results are saved under the task's `timeline-matrix-preview` visualization folder. The matrix layout was visually approved on 2026-10-30. No commit, PR, production deployment or real-data integration is part of this checkpoint.

## Step 1 evidence and sample review

Implemented in `src/models/*timeline.ts`, the matching pure presentation modules and `src/mocks/*timeline.ts`. The existing contribution report and new series share validated scope selection and sparse aggregation; the smaller of the requested account set and available cells is traversed, preserving focused-report efficiency. Dated facts are partitioned once per series. Existing contribution detail grouping now applies its exact context range before combining comments.

All seven groupings use the same source/scenario identity. The complete 2024 calendar sample retains the reference contribution identities and known answers with explicitly shifted dates; the normal reference uses the existing fixed 2026 reporting clock. Temporal-gap variants have distinct scenario IDs. Repository activity, author counts, merge durations and supplied historical snapshots remain separate. Neither a current record state nor a sum of interval medians establishes a historical answer.

Reference contribution sample, all accounts and repositories, January 1 through October 24, 2026 at 12:00 UTC:

| Covered period | PRs authored | Authored PRs merged | Reviewer credits | Approval credits | Merges performed | Issues authored |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| January–July, each month | 0 | 0 | 0 | 0 | 0 | 0 |
| August | 1 | 0 | 1 | 1 | 0 | 1 |
| September | 1 | 1 | 2 | 2 | 1 | 1 |
| October through the reporting cutoff | 6 | 4 | 6 | 4 | 4 | 4 |
| Whole selected range | 8 | 5 | 9 | 7 | 5 | 6 |

October is a partial calendar period with complete prepared coverage. The separate temporal-gap scenario makes February unavailable and the whole-range answer partial, without substituting zero. Bob's reviewed file volume is 0/6/10 across August/September/October while his first reviewer credits are 1/1/0. In the repository sample, September and October merge-duration medians are 5 and 31 days; the whole-range median is 5 days. At the supplied October 22 exclusive cutoff, PR 107 has one approval; its later supplied current state has zero. Missing cutoffs remain dashes.

Local verification: `npm run check` passed formatting, lint, TypeScript, architecture/retirement guards, coverage gates and **1,259 individual unit/component cases**, including **110 new timeline cases**. Preview and Storybook builds passed. **24 existing contribution boundary/detail/export/eligibility browser cases** passed in Chromium and WebKit, with individual reports checked for failures/skips. These verify preservation of the shared existing paths; new Timeline UI/interaction tests belong to the following checkpoints. No account-policy or dependency changes were made, and production-account/deployment acceptance was not rerun for this model-only step.

Reproduce diagnostics with `node --import tsx scripts/measure-timeline-reporting.ts`. On the prepared large scenario with a temporal gap, contribution reports serialized to 32,640 bytes for 10 monthly intervals, 798,572 bytes for 297 daily intervals and 1,842,398 bytes at the 500-interval bound. Adding 3,000 directory-only accounts changed each size by one byte for the included-account count. These are uncompressed local sample payloads, not deployed performance guarantees. Chart usability at the bound remains a Step 2 check.

## Step 2 visual preview and verification

The guarded `timeline=1` entry renders the Step 1 models without sending source histories or the full account directory to the browser. Repository headers now expose Timeline beside Pull requests and Issues, including on ordinary repository pages; issue entry retains its record kind and direct repository visits still default to current-open PRs. Full filter/date inheritance, contributor navigation integration, filter controls and saved preferences remain Step 3. Interval drilldowns and CSV downloads remain Step 4 and have no inactive placeholder buttons here.

| Preview | Local path |
| --- | --- |
| Repository activity | `/repos/prebidjs?timeline=1` |
| Weekly issues | `/repos/prebidjs?timeline=1&timeline.kind=issues&timeline.group=week` |
| Historical snapshots | `/repos/prebidjs?timeline=1&timeline.family=snapshot&timeline.group=day&period=custom&from=2026-10-11&through=2026-10-21` |
| Contributors and Companies | `/contributors?timeline=1` and `/companies?timeline=1` |
| Focused reports | `/contributors/account-alice?timeline=1` and `/companies/id/company-acme?timeline=1` |
| Exceptional states | Add `sample=missing`, `sample=empty`, or `timeline.gap=1&timeline.group=quarter`. Explicit empty contribution populations retain their empty-scope view. |

Shared Timeline scope/table/chart components consume supplied models and metric definitions. They reuse the existing table engine, numeric/coverage rendering, grouped Columns control and column-help pattern. Contribution headings reuse the approved header component. Core contribution headers remain flat; optional metric groups retain their sections. The Period column is pinned; daily labels avoid duplicate dates, and partial-calendar markers stay separate from data-coverage asterisks.

Repository charts start collapsed, use one metric/unit, keep missing values as gaps and show separately prepared whole-range answers. Theme-aware Prebid blue provides contrast in both themes; filled and outlined markers distinguish complete and partial values. The chart uses the whole chronological series while table sorting and 50-row pagination remain independent. Table/column/chart choices are local for this layout checkpoint and do not claim saved-state behavior. Contribution/company timelines remain table-only.

Verification on the final application source: **1,288 unit/component tests** passed with formatting, lint, TypeScript, architecture and coverage gates. Preview and Storybook builds passed. **66 browser cases** covering new Timeline layouts and existing contribution/repository-chart regressions passed in Chromium and WebKit, followed by **2 additional dense-contribution cases** on the unchanged application source. Individual reports contained no skipped, expected-failure or flaky cases. The final test addition also passed lint/types. Visual checks cover dark/light, 375/1440 px, focused identities, zero/missing/partial/snapshot states, collapsed and expanded charts, actual horizontal scrolling/pinning, weekly labels, keyboard-accessible controls and 500-interval rendering. The component test caught and verified a correction for duplicate sibling keys during model changes; navigation tests explicitly await URL completion rather than a heading shared by both views.

Storybook states live in `.storybook/timeline.stories.tsx`, including loading and recoverable error specimens. The user-facing local preview runs on port 3110. This is local visual-review readiness, not user sign-off, final Step 5 verification or deployment. Production/account integration, full application E2E and real-data reconciliation are not claimed by this checkpoint.


## Step 3 — Implemented controls and navigation

All three Timeline surfaces now use the shared calendar controls and one URL controller: preset/custom dates and all seven groupings; matrix repository/metric selection; individual PR/issue activity versus backlog-at-cutoff families and record filters; contribution repository/type/population inclusion and exclusion controls. The existing table, column picker, chart and measurement components accept controlled state while retaining standalone sample/Storybook usage. Active repository filters are removable chips. Timeline cells remain plain measurements until Step 4.

Preference ownership is explicit. Timeline presentation defaults are versioned and isolated by viewer, sample and area; individual repository defaults are additionally isolated by repository. Contribution period/population defaults reuse the existing contribution preference store, including bounded authenticated identity validation. Matrix and repository Timeline scope defaults are separate from Summary's comparison settings and current record lists. Writes persist deliberate changes and their dependent sort/column resets, not an unrelated inherited scope. Explicit incoming repository kind/range/filter scope prevents old saved predicates from reappearing, while compatible chart/column preferences can restore. Opening a copied link does not save that link as a default.

Row pages and period-window positions belong to the URL and return snapshot, not long-lived defaults. A fresh matrix starts at its latest window; copied links, reload, Back/Forward and matrix-to-repository returns restore the exact requested window, sorting and row page. Scope edits reset affected pages; range/group changes reset matrix period ordering and select the new latest window. Presentation changes leave report facts unchanged. Existing Summary settings, contribution identity-table search and source-list presentation are restored independently.

Repository entry preserves compatible metadata filters and exact activity timestamps, including exclusive ends. Ordinary current-open entry uses activity this year to date. Current age/review or additional backlog constraints remain on the original list with a visible explanation; incompatible explicit historical/activity predicates are invalid. Issue-author and merge-duration insight entry carries the appropriate record kind, supported metric and range. Pending title search, source-list sorting/page, columns and chart visibility are captured before record-list navigation. Contradictory author cohorts and oversized links do not silently broaden the timeline.

The controller binds presentation to the data scope of the supplied server model. During a router transition it keeps the loaded model's matching controls and disables edits until the requested scope arrives. This prevents a new daily window number from being applied to a cached monthly matrix. Semantically equivalent duplicate selections normalize consistently. The server sends no second interval axis in control metadata, no raw histories, and no full contribution directory. Existing 500-interval, 10,000-cell and URL bounds remain in force.

Rejected custom dates or oversized selections preserve the current URL, preferences and editable draft. Delayed preference validation is aborted/ignored after navigation; stored values are compared before removal or restoration. Unavailable storage, invalid/stale preferences and failed/timed-out identity lookups leave a usable URL-based report with feedback. Controls and tables are disabled during data-scope transitions; contributor/company timelines remain table-only.

Visual review starts at `/repos` → Timeline, `/repos/prebidjs` → Timeline, and `/contributors` or `/companies` → Over time. Exact interval supporting details and full-range CSV are Step 4; final adversarial handoff is Step 5. No database, new reporting ingestion, dependency change, commit, PR or deployment is included here.

Step 3 verification on 2026-10-30: `npm run check` passed **1,632 unit/component cases**, formatting, lint, TypeScript, architecture and per-file coverage gates. Preview and Storybook builds passed. **120 distinct browser cases** passed across the focused Timeline controls/layout/matrix, contribution navigation, repository filters and repository insights suites in Chromium and WebKit; raw per-case results and the combined case index are retained in `timeline-step3-preview`. The final controls run has 18 passing cases with no skips or expected failures. Visual inspection covered the live matrix preview and desktop/mobile screenshots; snapshot capture waits for closing dialogs.

Self-review fixed the URL/model transition race, equivalent-duplicate scope normalization, dependent saved-sort resets, safe restoration of destination presentation without leaking old record predicates, exact source-list snapshots, and correct issue-author/merge-duration entry. The unavailable-sample return case explicitly expects its existing unavailable state, not fabricated rows. User visual approval was pending at this checkpoint; Steps 1–4 are now approved (see Status). Full packaged-production/account acceptance and final `check:all` belonged to Step 5.


## Step 4 — Supporting records and CSV

Known and partial Timeline values now open supporting views from individual repository/contribution tables and the repository matrix. Repository chart points use the same metric and interval destination. Known-zero values open an empty supporting list; unavailable/not-applicable values remain unlinked. Source revision and reporting clock are carried in the link and checked against the loaded parent. Invalid/stale support is rejected, with a return to the validated Timeline scope when available.

Repository detail membership reuses the same activity-date, metadata-filter and snapshot-metric rules as the Timeline projection. Historical details use only the supplied rows at the exact cutoff, including its inclusivity. They never substitute today's records. Unique-author values open one row per account; each record count opens that author's records, paginated at 50. Merge-duration detail lists the merged PRs underlying the median. Contribution details reuse the account/record row builder: first-credit dates, grouped comment counts, and final merged role-volume values retain their distinct units and dates. No descriptions or comment bodies are included.

Supporting-table searches, sorting, pages and columns use separate `support.authors.*` and `support.records.*` namespaces. Parent Timeline scope/presentation is immutable during these edits. Nested author returns retain the author's parent-table search/page; matrix cell returns restore the original matrix selection/window/order. Pending searches are captured before following an author count, changing columns or exporting. Copied support URLs are self-contained; nested author views do not recursively duplicate parent URLs. Table actions wait when the URL belongs to a different loaded supporting scope.

Every export uses the shared **Export CSV** dialog. Series exports retain all selected intervals and selected metrics in table sort order, beyond the current 50-row page. Matrix CSV has **one repository/period row** across every selected repository and interval, independently of the visible period window and repository page; repository order follows the matrix sort and periods remain chronological. Its dialog states this full-range shape instead of presenting hundreds of period-column checkboxes. Context includes exact calendar/covered bounds, inclusivity, partial-calendar flag, metric IDs/units, coverage/reasons, source revision/clock, grouping and full report scope.

Parent Timeline CSV downloads use an authenticated read-only endpoint with `private, no-store`, bounded inputs and source-version checks. Supporting CSV uses the same already-authorized displayed record model and table export pipeline, including all matching rows beyond its page. Required record/account identities and original interval/coverage context accompany the selected columns. Snapshot exports identify their cutoff and historical state. A detail-table search narrows the exported rows; it does not replace the original Timeline interval value. Empty supporting results export headers without fabricated records.

Verification includes every repository metric and contribution metric across all seven groupings, with snapshot metrics reconciled on a range that ends at a prepared cutoff, plus independent known answers: October PRs 105/107/108, Bob's two authored PRs, the 31-day median from PRs 101/108, PR 107's historical approval of one (versus zero in its current row), and Bob's October reviewed volume of 10 files on PR 101. Real browser downloads verify field values, filters and all-row scope, including a 1,000-row matrix, 500-interval series and hundreds of supporting issues. UI review fixed duration-link accessible names, direct chart-point selection, pending-search/column/export consistency, stale-link recovery and the approved narrow pinned record-number column. CSV screenshot capture waits for dialog closure.

At this checkpoint the live preview was on port 3110. Click a Timeline value or repository chart point; use **Back to timeline** and **Back to authors** to review restoration. GitHub records and account handles keep their external destinations (sample placeholders in this phase). No real data layer, dependencies, commit, PR or deployment were added. Steps 1–4 are now approved (see Status); Step 5 performed the full final audit and handoff verification, including `check:all` and packaged-production/account acceptance.

Step 4 verification on 2026-10-30: `npm run check` passed **1,677 unit/component cases**, formatting, lint, strict types, architecture and per-file coverage gates. Preview and Storybook builds passed. **76 distinct browser cases** passed across Timeline controls/layout/matrix and supporting-record/download suites in Chromium and WebKit. Individual machine-readable results and screenshots are retained in `timeline-step4-preview`; corrected failures remain in the earlier raw reports. The final supporting suite contains 14 passing cases with no skips or expected failures. The live matrix-to-PR drilldown was visually inspected, including the final pinned-number sizing, and is open for user review. Full `check:all`, independent adversarial review and handoff remain Step 5.


## Step 5 audit and grouped-metrics amendment

The user approved a Metrics multi-select with grouped repository rows on 2026-10-30. It reuses the shared grouped selection control. Period columns remain unchanged in number; each repository has one row per metric, with count/duration units and snapshot semantics retained. Rank by any selected metric and period; the full group moves together. Empty selection remains empty. Metrics and the ranking choice are saved, legacy single-metric URLs still work, and over-budget proposals retain the editable choices. CSV remains one repository/period row, now with the selected metrics as separate columns. Each cell opens its own metric's supporting scope.

The adversarial pass identified and corrected:

| ID | Finding | Resolution and regression evidence |
| --- | --- | --- |
| T-A1 | Page reconciliation could write to a URL whose data scope was still arriving. | Reconciliation now respects the same loaded-scope guard as edits; a regression preserves the in-flight target URL. |
| T-A2 | A matrix-origin supporting URL could add repository filters and no longer match its matrix value. | Matrix-origin support requires the unfiltered repository scope of the matrix; a narrowed forged link is rejected. |
| T-A3 | A valid proposal could exceed the URL budget after presentation fields were materialized. | The final serialized URL is bounded before history/preferences writes; a near-limit grouping edit remains unchanged on rejection. |
| T-A4 | Repeated scalar scope/search parameters could silently select their first value. | Ambiguous scalar contribution scope and repository search fields are rejected. Statistic lists remain intentionally multi-valued. |

Architecture review retained one calendar/coverage layer, shared repository membership rules, sparse contribution aggregation, server-owned prepared facts, and the existing table/export components. Mixed-metric projections are bounded together and do not expand all metrics for every repository. The grouped 18-repository, three-metric, 95-week diagnostic produced 5,130 cells and 448,331 uncompressed JSON bytes; these are local sample measurements, not a production capacity claim. No reporting database, ingestion, authentication-policy or dependency changes were introduced.


Final PR-readiness verification on 2026-10-30: **`npm run check:all` passed with exit code 0 on the final application source**. This includes formatting, lint, strict types, architecture/retirement guards, coverage gates, **1,683 unit/component tests**, **31 account integration tests**, **8 source-free packaged-production tests**, zero reported dependency vulnerabilities, production/preview/Storybook builds, and **410 browser cases** in Chromium and WebKit. Individual results contain no skipped, expected-failure or flaky cases. The readiness pass corrected one stale test expectation after the Statistics-to-Metrics label change; the full command then passed. The application source remained unchanged throughout verification.

The self-review's test synchronization waits for actual menu/dialog animation completion and keyboard focus before measuring layout or contrast; the original accessibility assertions remain. Final visuals cover grouped counts/durations, the selector, light/dark, narrow mobile and keyboard/overflow at 200% equivalent reflow (640×480, DPR 2; not native browser zoom). Coverage includes missing/partial/zero/snapshot states, individual and contribution timelines, drilldowns, full-range downloads and copied navigation.

Final presentation refinements include **Metrics**, **Quarterly**, **Every 6 months**, centered repository headings with blue GitHub links and neutral branch details, and **Overview** first in the main navigation. The Repositories dropdown contains only individual repository names. These changes preserve the fake-data boundary and existing report behavior.

The target branch was verified on GitHub at `d7097503e39d884e0462e63c3a07aadfba6e7920`, matching the tested local base. Final source hashes, raw reports, retained initial failure evidence and the individual browser case index are in the task's `timeline-final-review/readiness` artifact folder. The draft handoff targets `codex/frontend-rebuild` from `codex/timeline-reporting`. Hosted CI is reported separately on the PR; independent approval and deployment are not claimed.

Label refinement after visual review (2026-10-30): the user chose **Metrics** throughout Timeline and **Quarterly** without the parenthetical. Keep **Every 2 months** to avoid the ambiguity of bimonthly. Grouping, saved-state identifiers and sample values are unchanged. Existing focused checks passed: 291 unit/component cases and 16 browser cases in Chromium/WebKit, plus changed-file formatting/lint and rebuilt preview/Storybook. The review gallery screenshots have been refreshed.


## Post-publication self-audit and CI repair

The second self-review of PR #10 began at `94cfc92bd7244ec6f29607e6c2631ebd99cf38ca`. It traced the URL controller's restoration/editing paths, calendar and coverage projections, matrix grouping/sorting, supporting-record membership, authenticated CSV boundaries, shared UI ownership and their regression tests. Reporting remains fake; no account policy, layout or metric definition was reopened.

| ID | Finding | Disposition |
| --- | --- | --- |
| T-A5 | Preference restoration validated the incoming URL before adding canonical presentation defaults, and could navigate beyond the 7,500-byte budget. | Restoration and ordinary edits now share the same final-target guard. A valid near-limit incoming URL stays unchanged with feedback. The component reproduction failed before the fix; a real server/browser regression passes in Chromium and WebKit. |
| T-A6 | Hosted CI stopped at newly reported glob/minimatch dependency advisories after unit and account tests passed. | Scoped overrides install patched glob 14.0.3 and modern minimatch 11.0.3. The approved exact minimatch 3.1.5 non-applicability exception is documented in [dependency audit disposition](dependency-audit.md), checked against lock integrity and installed source, and does not waive other advisories. |
| T-A7 | Acceptance prose still described all Timeline cases as unimplemented and the matrix as single-metric. | Updated the scope/evidence language and multi-metric contract without claiming real-data reconciliation. |

The existing repeated-summary validation was also checked at its consuming route and already rejects duplicates; no redundant validator was added. Pure projection/selection modules remain shared between tables, drilldowns and exports. The final-target guard is used by both eligible navigation writers. The audit policy stays in the tooling layer and does not enter application or reporting code.

Local verification of this repair: `npm run check` passed static/architecture/coverage gates and **1,700 unit/component tests**; `npm run audit:dependencies` reports **14 inherited package entries, one approved scoped advisory, and zero blocking findings**. Production/preview/Storybook builds and **8 packaged-production tests** passed. **32 Timeline control/grouped-metric browser cases** passed in Chromium/WebKit with no skips or flaky results. The full hosted check on the published repair head is tracked separately in the PR checks; the earlier 410-case full run remains evidence for the original head, not a claim that the repair has completed hosted CI.

Verification precision: the default Storybook build uses `react-docgen`, so it does not prove the TypeScript docgen plugin's glob call. A direct installed-consumer API test now checks the patched `globSync` include/exclude/absolute/nodir behavior against known files. The dependency note distinguishes this direct proof from the successful Storybook build. This adds one tooling regression case and changes no application source.


The completed CI run on `9d481f3` passed the repaired dependency gate and 411 of 412 browser cases. Its WebKit state-comparison test navigated away while an unnecessary RSC fetch for presentation-only restoration was in flight. Restoration now uses the existing data-scope resolver to choose native history for presentation changes and server navigation for real scope changes. Component regressions cover all three Timeline surfaces, and a browser regression verifies that canonical presentation restoration makes no redundant RSC request. The state-comparison test also waits for readiness; browser-error assertions remain unchanged. Local checks passed 1,704 unit/component cases, 8 packaged-production cases and all 92 Timeline browser cases in both engines.

CI runtime work is a separate PR against `codex/frontend-rebuild`: fast checks, reusable preview builds, complete parallel browser shards and a required aggregate gate. PR #10 retains the Timeline behavior fixes. The CI PR also carries the approved dependency repair so it can validate independently; updating this branch after that PR merges will remove the overlapping CI-only diff.
