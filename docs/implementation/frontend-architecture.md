# Frontend architecture and foundation implementation plan

Status: proposed implementation architecture, 2026-10-24. Based on the [source audit](source-audit-2026-10-24.md), the [agreed pages](../product/README.md), and the user's priorities: **composability, testability, future expansion, and visual completion before real data integration**. Keep Amplify hosting. The first foundation implementation exists and is awaiting hardening/review; see [verified scope and limits](quality-foundation-status.md). This blueprint also covers later product/design work.

## Recommendation and scope

Keep the stack and modernize its compatible versions. Rebuild the reporting feature layer page by page rather than preserving the current aggregation-heavy pages. Repair the shared styling foundation first, reuse suitable UI primitives, and retain production authentication behavior behind a separate boundary.

The deliverable is an interactive, visually reviewed frontend using prepared values. It must support the defined filters, sorting, paging, drill-downs, and exports against mock records. It does not require a fake database, full historical calculation engine, universal dashboard builder, or agent launcher.

The immediate foundation milestone follows the [frontend-only cutover plan](frontend-only-cutover.md): remove the old reporting layer after replacing its consumers with minimal typed mock-backed views, while keeping authentication isolated. Final page design and full product acceptance still follow; removing reporting is not deferred until that design work ends.

### Preserve, adapt, replace

| Area | Decision | Why |
| --- | --- | --- |
| Next.js App Router and TypeScript | Keep; upgrade to the compatible target set | No identified framework blocker; existing routing/auth conventions can be retained. |
| Tailwind | Keep v4; repair and normalize configuration and tokens | Missing utility output is reproduced. Styling must be trustworthy before design work. |
| Local shadcn/Radix primitives | Reuse or migrate individually | Semantic primitives are useful; stale tokens and intentional local modifications need review. |
| Reporting routes/views | Rebuild around the agreed page definitions | Current routes mix raw storage, calculations, state, and rendering, and do not implement the new product. |
| Repository table | Reuse basic table primitives; replace feature behavior | New counts, controlled filters, 100-row paging, links, and availability differ from current behavior. |
| Shared chart implementation | Retain Recharts; replace the six-repository-specific wrapper | Graphs now belong on repository pages, and series must come from typed inputs. |
| Navigation and theme handling | Refactor | One repository catalog, link semantics, consistent access, accessible controls, and immediate shell rendering. |
| Authentication | Isolate and make compatible | Preserve sign-in behavior while avoiding server credentials/imports in presentation components. |
| Existing ingestion/storage | Separate from frontend development; later retire only unused paths | The new data layer is later work; some AWS dependencies also support auth. |
| Existing tests | Preserve with explicit scope/disposition | 32 unit and 9 integration cases pass; 5 integration cases fail. Do not disguise those failures. |

## Composition model

Use four responsibilities with narrow interfaces:

1. **Route/composition:** identifies the route and viewer, resolves URL/default preferences, and supplies a prepared page model.
2. **Feature controller:** manages the feature's interaction state and composes its sections; delegates request/loading behavior when an actual provider exists.
3. **Feature view:** renders the supplied model through shared controls, tables, metrics, and charts.
4. **Shared UI/presentation:** renders typed values and emits user intent. It knows nothing about storage layouts, company attribution calculations, or GitHub ingestion.

For mock development, a route/controller can read a local sample module. Later, a loader or adapter supplies the same presentation model. This keeps the rendering surface stable; the actual adapter must still be verified against the same meanings and availability rules.

```text
app route
  └─ feature controller
       ├─ local sample values now / reporting loader later
       └─ feature view
            ├─ shared table and filter parts
            ├─ typed metric cells and links
            └─ repository chart parts where applicable
```

A single controller/view component is fine while simple. Split when it has a distinct responsibility, independent test setup, or meaningful reuse. Do not create a file or hook for every line.

### Suggested structure

```text
src/
  app/                         # Thin Next route/layout/error/loading boundaries
  features/
    repositories/
      all-repositories/        # View, columns, state, sample scenarios, tests
      repository-detail/       # PR/issue views, columns, graphs, tests
    contributions/             # Shared report mechanics; entity-specific views
    automation/                # Catalog and tracking only
    authentication/            # Login presentation/controller
  components/
    ui/                        # Adopted primitive components
    tables/                    # Table rendering, sorting headers, column menu, paging
    filters/                   # Search/select/range controls and active-filter display
    metrics/                   # Value, delta, duration, actor indicators
    feedback/                  # Loading, empty, error, partial-data presentation
    layout/                    # App shell and navigation
    charts/                    # Reusable repository chart presentation
  models/                      # Shared display types and stable identities
  lib/
    navigation/                # URL parsing/building and route context
    formatting/                # Numbers, dates, duration, availability
    preferences/               # Versioned per-account display preferences
  mocks/                       # Fixed prepared data and named states, no event engine
  server/                      # Server-only auth/config; real reporting integration later
  styles/                      # Tokens and small global rules
.storybook/
tests/e2e/
```

This is one application, not a monorepo or microfrontend. Final paths should respect the checked-out source. Do not move retained auth/ingestion simply to make the tree look tidy.

### Import rules

- Shared components may import shared types/utilities and other shared components; they do not import feature internals, mocks, storage, or server modules.
- Feature code owns its columns, metric meanings, and drill-down intent. Features do not reach into another feature's internal files.
- Route/composition code can assemble features and select mock or real inputs.
- Server modules cannot be imported into client presentation code. Protect this with framework server-only boundaries and lint rules.
- Mock selection belongs at composition boundaries. A failed real request must not silently become sample data.
- Avoid broad barrel exports across client/server boundaries; they can pull unwanted dependencies into the wrong bundle.

Enforce supported imports with ESLint configuration rather than relying solely on folder names or comments.

## Shared design foundation

### Styling and tokens

Use the complete Tailwind v4 import and PostCSS setup. Keep one set of semantic colors for background, surface, foreground, muted text, border, accent, destructive actions, focus, and chart series. Use complete CSS colors consistently; consumers should not wrap an OKLCH value in hsl().

Review the locally owned primitives alongside token changes. Address missing foreground tokens, focus/outline behavior, shadow/radius changes, and animation classes. Remove duplicate HSL/OKLCH declarations and global important-link overrides after verifying their replacements. Remove redundant/stale configuration only after checking its consumers.

Static spacing, typography, colors, and breakpoints should come from the design system. Inline styles remain appropriate for genuinely dynamic values such as calculated chart dimensions, rather than as a blanket workaround for missing utilities.

Provide a small component specimen first: buttons in every adopted variant, inputs/selects, menus/dialogs, numeric cells, links, a table, focus states, and light/dark themes. Check actual compiled CSS and computed browser styles. A successful CSS build alone did not catch the current defect.

### Reusable components and states

| Component family | Owns | Does not own |
| --- | --- | --- |
| AppShell / navigation | Layout, current route, repository menu, viewer controls | Duplicated auth policy or hardcoded repository-specific JSX |
| MetricValue / MetricDelta | Numeric/duration formatting, zero/dash, comparison labels | Historical counting or treating a missing value as zero |
| DataTable and table parts | Semantic markup, controlled state, visible columns, keyboard controls | Domain-specific counts, storage requests, or hidden aggregation |
| Filter controls | Selection and visible active scope | Independent copies of the authoritative URL/query state |
| Page feedback | Loading, empty, error/retry, partial information | Swallowing errors as empty arrays |
| Repository chart parts | Typed points/series, labels, theme, textual alternatives | Fixed repository keys or calculations from the current table page |

Use Storybook for these shared components and composed feature views, with the same sample data used by the app/tests. Stories should demonstrate states people actually need to review, not every theoretical prop permutation. It must not need production login, AWS, or a database to render them. [Provider mocking](https://storybook.js.org/docs/writing-stories/mocking-data-and-modules/mocking-providers)

## Tables that can grow

Adopt TanStack Table **v9** for behavior and keep control of the HTML and styling. The candidate package and current docs are v9; using older useReactTable examples without migration would repeat the version-mismatch problem. [Current table model](https://tanstack.com/table/latest/docs/guide/tables)

Use a small DataTable<T> rendering layer plus composable toolbar, column menu, sort header, empty state, and pagination components. Feature modules supply typed column definitions, stable row IDs, relevant controls, and click destinations. Avoid a universal table with dozens of domain-specific boolean props.

The table contract should support rows, matching total, current page/page size, sort state, visible columns, and change callbacks. For local samples, sort/filter the complete sample set before paging. For real integration, the adapter applies those operations to the complete result and returns a page. Do not filter an already paginated subset and label it a global search.

Other rules:

- Keep displayed page size at or below 100 for record lists.
- Preserve stable sorting for ties and a defined missing-value order.
- Reset paging when scope/filter/sort changes.
- Make sortable headers keyboard-operable and expose the current sort.
- Column visibility must not alter report population or counting.
- Full filtered export is a report operation, not serialization of the currently mounted rows.
- Charts use full-scope supplied aggregates; changing table pages cannot change the graph population.
- Start with normal pagination. Add virtualization only if measured interaction/rendering costs justify it; 100-row pages do not automatically need it.

## Typed presentation models

Use explicit feature records and meaningful field names. Distinguish human feedback participants, current human approvals, approvals at merge, and historical approval contribution credit. Do not carry the old reviewersAssigned field forward as a synonym.

A small shared value type can make missing data deliberate:

```ts
type MetricValue<T> =
  | { status: "known"; value: T }
  | { status: "unavailable"; reason: string }
  | { status: "not-applicable"; reason: string };
```

Known zero remains a number. Availability belongs to each affected metric; one missing field should not erase an otherwise useful row. Loading/request error is a separate page state from unavailable historical information.

Use stable IDs and ISO date strings at serialized boundaries; convert/format centrally. Tests use a fixed as-of time and explicit reporting timezone. Keep common date-preset helpers pure and test boundaries, but supply already calculated historical counts during visual development.

For fixtures authored in TypeScript, use explicit types or satisfies. If retaining JSON, validate its shape when loading it rather than casting unknown data through any. The existing [display mock](../../design/mocks/README.md) remains a starting point, not a frozen external API.

## State and navigation ownership

- **URL:** shareable report scope, repository, entity/group context, period/date basis, filters, sort, and page where applicable.
- **Per-account preferences:** default repositories, columns, density, aging threshold, and display options. Version the stored shape so later additions can be migrated.
- **Local component state:** open menus, temporary form input, hover/focus, and other ephemeral interaction.
- **Data state:** prepared sample now; request/cache state later at the loader/controller boundary.

An explicit incoming URL takes precedence over saved defaults. Back/forward navigation must restore the view. A login return must preserve the full internal path and query, with destination validation. Avoid useEffect loops that copy URL state into another competing store.

Do not introduce Redux, a global query/cache system, or a generic workflow engine merely for architectural appearance. Add a request cache when real request behavior requires it; keep the relevant loader boundary ready without implementing that layer now.

## Concrete extension examples

### Add another repository

Add one catalog entry and its sample rows. Navigation and repository selectors consume that catalog. Metric table columns and shared components stay unchanged; there is no new property named after the repository. No frontend rebuild should be needed solely because a later service returns a new repository entry.

The user supplied the complete list of **18 tracked repositories** on 2026-10-24. The [typed seed catalog](../../design/mocks/repository-catalog.ts) contains all 18 in the supplied order, with verified GitHub identities and default branches; it preserves the IDs and slugs of the original 9 entries. The prior source check found 9 entries in repos.json versus 6 in the frontend config/navigation. Navigation and the mock routes now use the single application catalog in src/config/repositories.ts; the design-path catalog re-exports it. The [metadata snapshot](evidence/2026-10-24/repository-catalog-metadata.json) records verification; the larger fictional mock scenarios remain separate for layout/scale testing.

Use this file as the initial catalog source during frontend implementation. Later, store catalog entries in the database and return them through the same display interface. Database design does not block adding entries now. Keep IDs stable across that move, preserve the existing route slugs, and avoid deriving a closed TypeScript union of repository IDs from today's file. Navigation, filters, tables, preferences, and exports must all refer to the same catalog. Enabled catalog membership and each account's selected repositories are separate concepts. Adding a catalog entry must not silently change an account's explicitly saved subset.

### Add a metric

Define its typed field, label/unit/scope, feature column, optional drill-down mapping, and representative values/states. Add checks for formatting, sorting, and the click/filter contract. The backend calculation comes later. Keep metric definitions local to their feature unless several features demonstrably share them; do not build a general formula language.

### Add a report or page

Compose the existing shell, controls, table parts, and feedback states. Create feature-specific columns and a typed model. Demonstrate normal, busy, empty, partial, and error states independently. Shared components should not need a new page-name switch.

### Add an agent or another model

Add catalog/run records. Agent definition, account, model, harness, and run IDs remain separate fields. Repeated runs are separate records; sample rows can represent them without an execution service. Existing tracking presentation should not depend on a hardcoded agent name.

## Test strategy and completion

| Level | Checks now | Checks later |
| --- | --- | --- |
| Static | Strict app/test/tool types; lint/format; import boundaries; compatible dependency resolution | Continue on every change |
| Pure helpers | Formatting, missing-value handling, URL encode/decode, preference migration, stable local sorting/date presets | Reporting adapter semantics when introduced |
| Component | Filters, keyboard operation, sorting, column visibility, paging controls, zero/dash, retry/empty states | New component behavior as features grow |
| Browser | Route navigation, login return using controlled fixture identity, saved-account separation, 100-row paging, complete sample export | Real auth/source integration as separate results |
| Styling/visual | Generated/computed styles, light/dark themes, long labels, dense tables, narrow screens, dialogs, repository graph text alternatives | Repeat reviewed baselines during data integration |
| Reporting | Prepared values remain consistent for exercised mock flows | First-credit calculations, at-merge reconstruction, real coverage, database queries |

Vitest/Testing Library cover pure and synchronous/client component behavior. Use full-app browser checks for async server composition and actual routing. [Next testing guidance](https://nextjs.org/docs/app/guides/testing/vitest)

Keep screenshot environment, browser, viewport, fonts, clock, and sample scenario consistent. Review expected images deliberately; do not auto-accept every visual change. [Playwright visual comparisons](https://playwright.dev/docs/test-snapshots)

The quality foundation must include tests and root configuration in typechecking, correct Vitest coverage configuration, and real machine-readable suite results. Select useful behavioral checks rather than an arbitrary blanket percentage. A legacy test failure is not a new frontend failure, but remains a visible repository result until addressed or retired with its code.

### Concrete first acceptance examples

- A standard spacing/typography specimen has actual expected computed styles; missing Tailwind defaults fail a check.
- The app shell renders usable content without waiting for an entire-page mounted gate.
- A missing count displays a dash; a known zero displays 0.
- Changing a sort/filter produces the expected sample identities and resets the page.
- A second feature view can compose the shared table/control parts without copying the first feature's data logic.
- Mock frontend build/start succeeds without reporting credentials and does not invoke sync scripts.
- A representative component/story renders without importing the application auth/storage modules.

## Delivery slices

| Slice | Work | Exit evidence |
| --- | --- | --- |
| A. Source baseline and preservation | The audit is recorded. Establish the actual working checkout and preserve docs/mocks. Classify legacy test failures and source to retain/replace. | Pinned source, protected planning files, baseline manifest. |
| B. Compatible toolchain | Pin Node 24 and the candidate Next 15/React 19/types/compiler/lint/test set; resolve/install without force; migrate config incrementally. | Install, app/test/tool typechecks, meaningful bootstrap checks, explicit remaining legacy results. |
| C. Mock cutover, styling, and component foundation | Replace current reporting consumers with minimal typed mock views and retire the old reporting layer. Finish Tailwind v4, tokens, adopted primitives, theme/shell, and component catalog. Add table behavior behind application-owned parts. | Removal/isolation checks, browser style checks, keyboard checks, shared component stories, mock build, CI. Final page design remains pending. |
| C2. Foundation hardening and review | Close the [readiness findings](foundation-review-readiness.md) and complete independent review before advancing layouts. | Final-head evidence, resolved findings, and explicit review acceptance. |
| D. First feature flow | All Repos and repository detail, including count links, bounded lists, and repository graphs. | Reviewed layouts and passing relevant mock interaction checks. |
| E. Remaining pages | Login presentation, contributions/company/group reports, exports, agent/bot tracking; reuse the established patterns. | Each page and its important states reviewed and tested. Login routing needed for D can be added earlier. |
| F. Visual baseline | Review all pages with the user and retain representative screenshots/interaction tests. | Approved appearance/behavior across agreed viewports and states. |
| G. Real data integration | Add reporting loaders/adapters/database behind the display models. | Real-source semantic tests plus unchanged or explicitly reviewed visual behavior. |

Agent launching stays last and outside these frontend slices.

## Architecture review checklist

Before calling a feature complete:

1. Can its view render from a small typed sample without server credentials?
2. Does each piece have a clear responsibility and a testable input/output?
3. Can another repository/metric be added without changing generic UI code?
4. Are URL scope, saved preferences, and ephemeral state owned in one place each?
5. Are known zero, unavailable, loading, empty, and error distinguishable?
6. Do the table, graph, drill-down, and export describe the same selected scope?
7. Are styles based on the agreed tokens and working Tailwind output?
8. Did the relevant checks actually run, and were visual changes reviewed?
9. Are unfinished real-data capabilities identified rather than fabricated by mocks?

The architecture is intended to make future changes small and understandable. Additional abstraction is justified by repeated behavior or a clear boundary, not by a desire to maximize the number of layers.

