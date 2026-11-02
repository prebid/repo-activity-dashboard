import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth/viewer', () => ({
  requireViewer: () => Promise.resolve({ id: 'golden-viewer', authVersion: 0 }),
}));
import {
  derive,
  resolveBack,
  viewHref,
  viewPairs,
  type UrlView,
} from '@/lib/presentation/url/back';
import { isEntry, parseQuery, urlHref } from '@/lib/presentation/url/codec';
import {
  columnTableOf,
  contributionTableOf,
  visibleColumns,
} from '@/lib/presentation/url/defaults';
import { legacyDecode } from '@/lib/presentation/url/legacy/decode';
import { legacyState, type LegacyState } from '@/lib/presentation/url/legacy/state';
import {
  matchRoute,
  screenOf,
  type UrlRoute,
  type UrlValues,
} from '@/lib/presentation/url/registry';
import { readBoundTableQuery, type TableFields } from '@/lib/presentation/url/table-binding';
import { timelineParams } from '@/lib/presentation/url/timeline';
import { contributionColumnVisibility } from '@/lib/presentation/contribution-url';
import { companyFocus } from '@/lib/presentation/contribution-navigation';
import { readOverviewValues } from '@/lib/presentation/overview-settings';
import { withOverviewSort } from '@/lib/presentation/overview-sort';
import { repositoryPageDefaultSort } from '@/lib/presentation/repository-page';
import { repositoryValuesAt } from '@/lib/presentation/repository-page-navigation';
import { repositoryColumnDefaults } from '@/lib/presentation/repository-page-preferences';
import { readRepositoryFilters } from '@/lib/presentation/repository-page-query';
import type { TableController } from '@/lib/presentation/table-controller';
import { contributionMetricBasis, isReportMetric } from '@/models/contribution-metrics';
import { contributionDefaultSort, type ContributionFocus } from '@/models/contributions';
import type { RepositoryPageSource } from '@/models/repository-page';
import type { TableQuery } from '@/models/table-query';
import { loadContributionValues } from '@/server/contribution-data';
import { legacyContext } from '@/server/legacy-context';
import { repositoryAuthorDetail, repositoryDetail } from '@/server/reporting';
import { linkKindParts, stableJson, type GoldenUrls } from '../support/golden-urls';

// The P5a golden set: every link and address the inventory showed before the codec. Each URL
// resolves through the frozen readers to the state its page rendered on a first visit (the
// recorded states must never change), decodes to registry values, and round-trips: the screens'
// own readers render the canonical URL as the recorded state.

const golden = JSON.parse(
  readFileSync('tests/fixtures/golden/legacy-urls.json', 'utf8'),
) as GoldenUrls;
const recordedStates = JSON.parse(
  readFileSync('tests/fixtures/golden/golden-url-states.json', 'utf8'),
) as Record<string, { route: string; state: Record<string, unknown> }>;
const context = legacyContext();
const origin = 'https://dashboard.invalid';

/** Every recorded URL with the route pattern that served it. */
function goldenUrls(): Map<string, string> {
  const urls = new Map<string, string>();
  const add = (route: string, href: string) => {
    if (!urls.has(href)) urls.set(href, route);
  };
  for (const view of Object.values(golden.views)) {
    add(view.route, view.requested);
    add(view.route, view.address);
    for (const [kind, link] of Object.entries(view.links))
      add(linkKindParts(kind).route, link.example);
  }
  add('/repos', golden.scopeChange.address);
  return urls;
}
const urls = goldenUrls();

/** Return context becomes `back` frames; until then the states are compared without it. */
function withoutReturnContext(state: LegacyState): unknown {
  const strip = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(strip);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(
      Object.entries(value)
        .filter(
          ([key, item]) =>
            !['trail', 'returnTo', 'summary', 'href'].includes(key) &&
            !(key === 'parent' && (item === null || typeof item === 'string')),
        )
        .map(([key, item]) => [key, strip(item)]),
    );
  };
  return strip(state);
}
function canonicalFor(route: UrlRoute, href: string) {
  const url = new URL(href, origin);
  const { segments } = matchRoute(url.pathname)!;
  const decoded = legacyDecode(route, segments, url.search, context);
  return decoded.kind === 'values'
    ? {
        segments,
        values: decoded.values,
        href: viewHref({ route, segments, values: decoded.values }, 'level')!,
      }
    : { segments, invalid: decoded.message };
}
/** The return chain the frozen readers recorded for a URL: absolute legacy hrefs, nearest first. */
function recordedChain(state: Record<string, unknown>, href: string): string[] {
  const params = new URL(href, origin).searchParams;
  if ('support' in state)
    return recordedChain(
      (state.parent as { state: Record<string, unknown> }).state,
      (state.parent as { href: string }).href,
    );
  if (Array.isArray(state.trail)) return state.trail as string[];
  if (params.has('summary')) return [state.summary as string];
  if (params.has('timelineParent')) return [state.parent as string];
  if (params.has('returnTo')) {
    const entry = (state.entry ?? state.drilldown) as {
      drilldown?: { returnTo: string };
      value?: { returnTo: string };
    };
    return [(entry.drilldown ?? entry.value)!.returnTo];
  }
  return [];
}
/** Ancestors past the inherited ones (supporting views and author records keep their parent's). */
function inheritedLevels(view: UrlView): number {
  let levels = 0;
  for (let derivation = derive(view); derivation.kind === 'inherit'; levels++)
    derivation = derive(derivation.parent);
  return levels;
}

// The screens' own readers of canonical values. Each projection below names the fields of a
// recorded state that a screen renders, read from the canonical URL the way that screen reads it.
const summaryFields: Record<'backlog' | 'activity', TableFields> = {
  backlog: { route: '/repos', sort: 'bsort', page: 'bpage' },
  activity: { route: '/repos', sort: 'asort', page: 'apage' },
};
const listFields = (route: UrlRoute): TableFields => ({
  route,
  search: 'q',
  sort: 'sort',
  page: 'page',
});
const timelineScreens = ['matrix', 'repositoryTimeline', 'contributionTimeline', 'support'];
const tableState = (query: Partial<TableQuery>) => ({
  search: query.search,
  sort: query.sort,
  descending: query.descending,
  page: query.page,
});
const insightColumns = {
  authors: context.columnIds.authors,
  duration: context.columnIds.mergedPrs,
  contributions: context.columnIds.credits,
};
/** A record list's filters, table, columns and charts, as its screen reads them from values. */
function recordList(
  route: UrlRoute,
  values: UrlValues,
  search: string,
  source: RepositoryPageSource,
) {
  const columnIds = context.columnIds[source.kind];
  const table = columnTableOf(route, values)!;
  const visible = visibleColumns(table, (values.cols as string[] | undefined) ?? []);
  const defaults = repositoryColumnDefaults(source);
  return {
    kind: source.kind,
    filters: readRepositoryFilters(values, source, repositoryValuesAt(values, source.asOf)),
    table: tableState(
      readBoundTableQuery(listFields(route), search, columnIds, repositoryPageDefaultSort),
    ),
    // Every column the codec's table names takes the URL's choice; the others keep the list's own
    // default (fixed columns).
    columns: columnIds.filter((id) =>
      table.ids.includes(id) ? visible?.includes(id) : defaults[id] !== false,
    ),
    charts: values.charts === true,
  };
}
async function screenState(
  view: UrlView,
  pathname: string,
  search: string,
): Promise<Record<string, unknown>> {
  const { route, segments, values } = view;
  const screen = screenOf(route, values);
  if (screen === 'summary') {
    const definition = context.overviewDefinition;
    const settings = readOverviewValues(
      values,
      {
        backlogColumns: [...definition.defaultBacklogColumns],
        activityColumns: [...definition.defaultActivityColumns],
      },
      definition,
      context.asOf,
    )!;
    const table = (key: 'backlog' | 'activity') =>
      withOverviewSort(
        {
          query: readBoundTableQuery(summaryFields[key], search, definition[`${key}Columns`]),
        } as TableController,
        key,
        settings,
      ).query;
    return { settings, backlog: table('backlog'), activity: table('activity') };
  }
  if (timelineScreens.includes(screen)) {
    // The Timeline screens keep their view in the query form the frozen readers take (decision
    // C9): `timelineParams` writes the values in it, as the Timeline loaders do.
    const params = timelineParams(route, values, context.asOf, { entry: isEntry(route, values) });
    if (!params) return { invalid: 'timelineParams' };
    return withoutReturnContext(
      legacyState(route, pathname + '?' + params.toString(), context).state,
    ) as Record<string, unknown>;
  }
  if (screen === 'records' || screen === 'insight') {
    const result = await repositoryDetail(segments.slug[0], values);
    if (result.status === 'insight') {
      const { insight } = result;
      return {
        selection: insight.drilldown.selection,
        insight: insight.kind,
        table: tableState(
          readBoundTableQuery(listFields(route), search, insightColumns[insight.kind]),
        ),
      };
    }
    if (result.status !== 'page') return { invalid: result.status };
    return {
      selection: result.source.drilldown.selection,
      ...recordList(route, values, search, result.source),
    };
  }
  if (screen === 'authorRecords') {
    const result = await repositoryAuthorDetail(segments.slug[0], segments.account[0], values);
    if (result.status !== 'list') return { invalid: result.status };
    return {
      author: segments.account[0],
      // The author list the page returns to, which its inherited parent opens: an absent sort is
      // that list's own default, as the frozen reader left it.
      authors: tableState(
        readBoundTableQuery(
          { route, search: 'listq', sort: 'listsort', page: 'listpage' },
          search,
          context.columnIds.authors,
        ),
      ),
      ...recordList(route, values, search, result.source),
    };
  }
  const area = route.startsWith('/companies') ? 'companies' : 'contributors';
  const focus: ContributionFocus =
    route === '/contributors/[accountId]'
      ? { kind: 'contributor', accountId: segments.accountId[0] }
      : route === '/companies/[...identity]'
        ? companyFocus([...segments.identity])!
        : { kind: 'overview' };
  const loaded = await loadContributionValues(area, values, focus);
  if (loaded.status !== 'ready') return { invalid: loaded.status };
  const table = contributionTableOf(route, values);
  const metric = typeof values.metric === 'string' ? values.metric : null;
  const columnIds =
    table !== 'details'
      ? context.columnIds[table]
      : metric !== null && isReportMetric(metric) && contributionMetricBasis(metric) === 'comments'
        ? context.columnIds.details
        : context.columnIds.details.filter((id) => id !== 'lastAt');
  const visibility = contributionColumnVisibility(route, values)!;
  return {
    layout: loaded.options,
    scope: loaded.settings,
    metric,
    table: {
      kind: table,
      ...tableState(
        readBoundTableQuery(
          listFields(route),
          search,
          columnIds,
          table === 'details' ? { sort: 'creditedAt', descending: true } : contributionDefaultSort,
        ),
      ),
      columns: columnIds.filter((id) => visibility[id] !== false),
      hideZeroMembers: table === 'members' && values.zero === 'hide',
    },
  };
}
/** A screen state without the columns its recorded state leaves out. */
function withRecordedColumns(
  rendered: Record<string, unknown>,
  recorded: Record<string, unknown>,
): Record<string, unknown> {
  const table = recorded.table as { columns?: unknown } | undefined;
  if ('kind' in recorded && 'columns' in rendered && recorded.columns === undefined)
    return { ...rendered, columns: undefined };
  if ('layout' in recorded && table?.columns === undefined)
    return {
      ...rendered,
      table: { ...(rendered.table as Record<string, unknown>), columns: undefined },
    };
  return rendered;
}
/**
 * The same fields of a recorded P5a state. Columns the legacy URL did not name are left out: a
 * record list recorded none (its defaults depend on the prepared list), and a contribution table's
 * defaults are the v1 lens columns now (decision C5), not the P5a ones.
 */
function recordedScreenState(
  screen: string,
  state: Record<string, unknown>,
  legacy: URL,
): Record<string, unknown> {
  const pick = <T extends object>(value: unknown) => value as T;
  if (screen === 'summary')
    return { settings: state.settings, backlog: state.backlog, activity: state.activity };
  if (timelineScreens.includes(screen))
    return withoutReturnContext(state) as Record<string, unknown>;
  const recordFields = () => ({
    kind: state.kind,
    filters: state.filters,
    table: state.table,
    columns: state.columns,
    charts: state.charts,
  });
  if (screen === 'records')
    return {
      selection: pick<{ drilldown: { selection: unknown } }>(state.entry).drilldown.selection,
      ...recordFields(),
    };
  if (screen === 'insight')
    return {
      selection: pick<{ drilldown: { selection: unknown } }>(state.entry).drilldown.selection,
      insight: state.insight,
      table: tableState(pick<TableQuery>(state.table)),
    };
  if (screen === 'authorRecords')
    return { author: state.author, authors: state.authors, ...recordFields() };
  const table = pick<Partial<TableQuery> & { kind: string } & Record<string, unknown>>(state.table);
  const named = [...legacy.searchParams.keys()].includes(table.kind + '.columns');
  return {
    layout: state.layout,
    scope: state.scope,
    metric: state.metric,
    table: {
      kind: table.kind,
      ...tableState(table),
      columns: named ? table.columns : undefined,
      hideZeroMembers: table.hideZeroMembers,
    },
  };
}

it('resolves every golden URL to the state its page renders through the frozen readers', async () => {
  const states: Record<string, ReturnType<typeof legacyState>> = {};
  for (const [href, route] of urls) states[href] = legacyState(route, href, context);
  await expect(stableJson(states)).toMatchFileSnapshot('../fixtures/golden/golden-url-states.json');
});

describe('legacy decode', () => {
  const reportUrls = [...urls].filter(([href]) => matchRoute(new URL(href, origin).pathname));

  it('records the canonical URL of every golden URL', async () => {
    const canonical: Record<string, string> = {};
    for (const [href, route] of reportUrls) {
      const result = canonicalFor(route as UrlRoute, href);
      canonical[href] = result.href ?? 'invalid: ' + result.invalid;
    }
    await expect(stableJson(canonical)).toMatchFileSnapshot(
      '../fixtures/golden/golden-url-canonical.json',
    );
  });

  it.each(reportUrls)('round-trips %s', async (href, route) => {
    const typed = route as UrlRoute;
    const result = canonicalFor(typed, href);
    expect(result.invalid).toBeUndefined();
    const url = new URL(result.href!, origin);
    // The canonical URL parses as canonical and serializes to itself (no redirect loop).
    const parsed = parseQuery(typed, url.search);
    expect(parsed.kind).toBe('canonical');
    if (parsed.kind !== 'canonical') return;
    expect(urlHref(typed, result.segments, parsed.values)).toBe(result.href);
    // The screen's own readers render it as the P5a state the legacy URL rendered.
    const view = { route: typed, segments: result.segments, values: parsed.values };
    const screen = screenOf(typed, parsed.values);
    const recorded = recordedScreenState(screen, recordedStates[href].state, new URL(href, origin));
    expect(
      withRecordedColumns(await screenState(view, url.pathname, url.search), recorded),
    ).toEqual(recorded);
    // Its back frames restore the return chain the legacy URL carried.
    const ancestors = resolveBack(view).slice(inheritedLevels(view));
    const chain = recordedChain(
      legacyState(typed, href, context).state as Record<string, unknown>,
      href,
    );
    chain.forEach((ancestor, index) => {
      const target = new URL(ancestor, origin);
      const matched = matchRoute(target.pathname)!;
      for (const key of ['returnTo', 'summary', 'timelineParent', 'nav'])
        target.searchParams.delete(key);
      const decoded = legacyDecode(matched.route, matched.segments, target.search, context);
      if (decoded.kind !== 'values') throw Error('Ancestor does not decode: ' + ancestor);
      const restored = ancestors[index];
      expect(restored?.available, ancestor).toBe(true);
      if (!restored?.available) return;
      expect(restored.view.route).toBe(matched.route);
      expect(viewPairs(restored.view)).toEqual(viewPairs({ ...matched, values: decoded.values }));
    });
  });
});
