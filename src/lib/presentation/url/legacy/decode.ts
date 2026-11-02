// Legacy link decoding: a pre-codec URL, resolved by the frozen readers, as registry values. The
// page helper answers it with a 307 to `urlHref(...)` of these values.
import { repositoryCatalog } from '@/config/repositories';
import type { ContributionSettings } from '@/models/contribution-settings';
import type { DateRange, PeriodSelection } from '@/models/reporting-period';
import type { DrilldownSelection } from '@/models/repository-drilldown';
import type { RepositoryPageFilters } from '@/models/repository-page';
import type { TableQuery } from '@/models/table-query';
import type { TimelineViewState } from '@/models/timeline-controls';
import { queryPairs, type QueryInput } from '../codec';
import { columnTableOf, columnTokens, defaultValue } from '../defaults';
import { instantIso, instantValue, periodAt, periodRange, periodValue } from '../period';
import {
  matchRoute,
  routePath,
  type UrlRoute,
  type UrlSegments,
  type UrlValue,
  type UrlValues,
} from '../registry';
import type { UrlView } from '../back';
import { legacyBackFrames, legacyTrailKeys } from './back';
import { readTableQuery } from './table-query';
import { readTimelineView } from './timeline';
import { legacyState, type LegacyContext } from './state';

export type LegacyDecoded =
  | { kind: 'values'; values: UrlValues }
  /** The frozen readers reject the link: the page renders its invalid view at that address. */
  | { kind: 'invalid'; message: string };
const invalidLink: LegacyDecoded = { kind: 'invalid', message: 'This link is invalid.' };

type Values = Record<string, UrlValue>;
type TimelineState = { period: PeriodSelection; exactRange?: DateRange; view: TimelineViewState };
type TimelineRead = TimelineState | { invalid: string };
type Source = { sample: string; gap: boolean } | null;

const slugOf = (id: string) => repositoryCatalog.find((row) => row.id === id)?.slug ?? id;
const sortToken = (query: Pick<TableQuery, 'sort' | 'descending'>) =>
  query.sort ? (query.descending ? '-' : '') + query.sort : undefined;
const pageValue = (page: number) => (page > 1 ? String(page) : undefined);
function assign(values: Values, entries: Record<string, UrlValue | undefined>) {
  for (const [name, value] of Object.entries(entries))
    if (value !== undefined) values[name] = value;
}
/** The snapshot a range pins when its own period resolves to it there; false when none does. */
function pinnedAt(period: PeriodSelection, range: DateRange): string | false {
  const at = range.end;
  const resolved = periodRange(period, at);
  return resolved &&
    resolved.start === range.start &&
    resolved.end === range.end &&
    resolved.endInclusive === range.endInclusive
    ? instantValue(at)
    : false;
}
/** A drilldown's exact range as period plus snapshot. */
function drilldownPeriod(range: DateRange): Values | null {
  const period = periodAt(range, range.end);
  return period ? { period: periodValue(period), at: instantValue(range.end) } : null;
}

/** The full instant a view's event filters resolve against: its snapshot, else the as-of. */
const filterInstant = (values: Values, asOf: string) =>
  typeof values.at === 'string' ? (instantIso(values.at) ?? asOf) : asOf;
/** Record filters that differ from their defaults, as registry values. */
function filterValues(filters: RepositoryPageFilters, at: string): Values | null {
  const values: Values = {};
  if (filters.search) values.q = filters.search;
  for (const [field, value] of Object.entries(filters)) {
    if (field === 'kind' || field === 'search' || value === undefined) continue;
    if (Array.isArray(value)) {
      if (value.length) values[field] = [...new Set(value as string[])];
    } else if (field === 'eventRange') {
      const range = value as DateRange;
      const period = periodAt(range, at);
      if (!period) return null;
      values.events = periodValue(period);
    } else if (
      !(field === 'draft' && value === 'all') &&
      !(field === 'assignment' && value === 'any')
    )
      values[field] = typeof value === 'number' ? String(value) : (value as string);
  }
  return values;
}
/** A Timeline view's shared fields: period and snapshot, grouping, table sort and page. */
function timelineValues(timeline: TimelineState, values: Values): boolean {
  values.timeline = true;
  const { period, exactRange, view } = timeline;
  values.period = periodValue(period);
  if (exactRange) {
    const at = pinnedAt(period, exactRange);
    if (!at) return false;
    values.at = at;
  }
  assign(values, {
    group: view.grouping,
    sort: sortToken({ sort: view.sort, descending: view.descending }),
    page: pageValue(view.page),
  });
  return true;
}
function sourceValues(source: Source, values: Values) {
  if (source?.sample !== 'reference') values.sample = source!.sample;
  if (source?.gap) values.gap = true;
}
function scopeValues(settings: ContributionSettings, values: Values) {
  const { selection } = settings;
  values.period = periodValue(settings.period);
  values.repo = selection.repositoryIds.map(slugOf);
  values.type = [...selection.actorTypes];
  if (selection.population.kind === 'selected') {
    const { accountIds, companyIds } = selection.population;
    if (accountIds.length || !companyIds.length) values.account = [...accountIds];
    if (companyIds.length) values.company = companyIds.map((id) => id ?? 'unmapped');
  }
  if (selection.excludedAccountIds.length) values.exclude = [...selection.excludedAccountIds];
}
function columnsValue(route: UrlRoute, values: Values, visible: readonly string[] | undefined) {
  const table = visible && columnTableOf(route, values);
  if (table) values.cols = columnTokens(table, visible);
}
/** Supporting-view fields; the supporting table's state keeps its own namespace. */
function supportValues(params: URLSearchParams, support: SupportQuery, values: Values) {
  const split = support.interval.indexOf(':');
  assign(values, {
    detail: support.metric,
    interval:
      split > 0
        ? support.interval.slice(0, split) + ':' + instantValue(support.interval.slice(split + 1))
        : support.interval,
    snap: support.revision + '@' + instantValue(support.clock),
    origin: support.origin === 'matrix' ? 'matrix' : undefined,
    author: support.author,
  });
  for (const [prefix, names] of [
    ['support.records.', ['dq', 'dsort', 'dpage']],
    ['support.authors.', ['listq', 'listsort', 'listpage']],
  ] as const) {
    const query = readTableQuery(params.toString(), prefix.slice(0, -1), [
      ...params.getAll(prefix + 'sort'),
    ]);
    assign(values, {
      [names[0]]: query.search || undefined,
      [names[1]]: sortToken(query),
      [names[2]]: pageValue(query.page),
    });
  }
}
type SupportQuery = {
  metric: string;
  interval: string;
  revision: string;
  clock: string;
  origin: string;
  author?: string;
};

/** The legacy href a route's pairs form (the readers take a whole URL). */
function legacyHref(route: UrlRoute, segments: UrlSegments, pairs: URLSearchParams) {
  return routePath(route, segments) + (pairs.size ? '?' + pairs.toString() : '');
}

/**
 * Decode a legacy link into registry values through the frozen readers. Return context (`returnTo`,
 * `summary`, `timelineParent`, `nav`) is translated separately, into `back` frames.
 */
export function legacyDecode(
  route: UrlRoute,
  segments: UrlSegments,
  input: QueryInput,
  context: LegacyContext,
): LegacyDecoded {
  const params = new URLSearchParams(queryPairs(input) as [string, string][]);
  const href = legacyHref(route, segments, params);
  const values = decodeValues(route, segments, params, context);
  if (!values) return invalidLink;
  const back = legacyBackFrames({ route, segments, values }, href, (ancestor) =>
    ancestorView(ancestor, context),
  );
  return { kind: 'values', values: back.length ? { ...values, back } : values };
}
/** A view's values from its legacy query, without return context. */
function decodeValues(
  route: UrlRoute,
  segments: UrlSegments,
  params: URLSearchParams,
  context: LegacyContext,
): Values | null {
  const href = legacyHref(route, segments, params);
  const state = legacyState(route, href, context).state as Record<string, unknown>;
  const values: Values = {};
  return decodeState(route, segments, params, state, values, context) ? values : null;
}
/** An ancestor's legacy href as a view; its own trail keys belong to the chain, not to it. */
function ancestorView(href: string, context: LegacyContext): UrlView | null {
  const url = new URL(href, 'https://dashboard.invalid');
  const matched = matchRoute(url.pathname);
  if (!matched) return null;
  for (const key of legacyTrailKeys) url.searchParams.delete(key);
  const values = decodeValues(matched.route, matched.segments, url.searchParams, context);
  return values && { ...matched, values };
}

function decodeState(
  route: UrlRoute,
  segments: UrlSegments,
  params: URLSearchParams,
  state: Record<string, unknown>,
  values: Values,
  context: LegacyContext,
): boolean {
  if ('support' in state && 'parent' in state) {
    const support = state.support as SupportQuery | null;
    const parent = state.parent as { href: string; state: Record<string, unknown> };
    if (!support) return false;
    const parentParams = new URL(parent.href, 'https://dashboard.invalid').searchParams;
    if (!decodeState(route, segments, parentParams, parent.state, values, context)) return false;
    supportValues(params, support, values);
    return true;
  }
  switch (route) {
    case '/repos':
      return params.has('timeline')
        ? matrixValues(params, state, values, context)
        : summaryValues(params, state, values, context);
    case '/repos/[slug]':
      return params.has('timeline')
        ? repositoryTimelineValues(params, state, values, context.asOf)
        : repositoryPageValues(state, values, route, context.asOf);
    case '/repos/[slug]/authors/[account]':
      return authorValues(state, values, route, context.asOf);
    default:
      return contributionValues(route, params, state, values);
  }
}

function summaryValues(
  params: URLSearchParams,
  state: Record<string, unknown>,
  values: Values,
  context: LegacyContext,
): boolean {
  const { settings } = state as {
    settings: { repositoryIds: string[]; periods: PeriodSelection[]; ageThresholds: number[] };
  };
  values.repo = settings.repositoryIds.map(slugOf);
  values.period = periodValue(settings.periods[0]);
  if (settings.periods[1]) values.period2 = periodValue(settings.periods[1]);
  values.age = settings.ageThresholds.map(String);
  // Raw sorts: the fallback for a hidden column is applied at render with the viewer's columns.
  for (const [key, sort, page] of [
    ['backlog', 'bsort', 'bpage'],
    ['activity', 'asort', 'apage'],
  ] as const) {
    const query = readTableQuery(
      params.toString(),
      key,
      context.overviewDefinition[`${key}Columns`],
    );
    assign(values, { [sort]: sortToken(query), [page]: pageValue(query.page) });
  }
  return true;
}

function matrixValues(
  params: URLSearchParams,
  state: Record<string, unknown>,
  values: Values,
  context: LegacyContext,
): boolean {
  const { source, timeline, repositoryIds, summary } = state as {
    source: Source;
    timeline: TimelineRead;
    repositoryIds: string[];
    summary: string | null;
  };
  if (!source || 'invalid' in timeline || summary === null) return false;
  sourceValues(source, values);
  if (params.has('repo')) values.repo = repositoryIds.map(slugOf);
  if (!timelineValues(timeline, values)) return false;
  const { view } = timeline;
  values.metric = view.selectedMetrics ?? [view.metric];
  values.rank = view.metric;
  // The last window is the default; it moves with the period, so only another window is kept.
  const withoutWindow = new URLSearchParams(params);
  withoutWindow.delete('timeline.window');
  if (readTimelineView(withoutWindow, 'matrix', context.asOf).view.window !== view.window)
    values.window = String(view.window);
  return true;
}

function repositoryTimelineValues(
  params: URLSearchParams,
  state: Record<string, unknown>,
  values: Values,
  asOf: string,
): boolean {
  const { source, timeline, filters, parent } = state as {
    source: Source;
    timeline: TimelineRead;
    filters: RepositoryPageFilters | null;
    parent: string | null;
  };
  // The frozen loader rejects a Timeline whose parent link it cannot use.
  if (!source || 'invalid' in timeline || !filters) return false;
  if (params.has('timelineParent') && parent === null) return false;
  sourceValues(source, values);
  if (!timelineValues(timeline, values)) return false;
  const { view } = timeline;
  assign(values, {
    view: view.kind,
    family: view.family,
    metric: view.metric,
    chart: view.chart || undefined,
    omitted: params.get('timeline.omitted') === 'current' || undefined,
  });
  const filterFields = filterValues(filters, filterInstant(values, asOf));
  if (!filterFields) return false;
  Object.assign(values, filterFields);
  columnsValue('/repos/[slug]', values, view.columns);
  return true;
}

/** The drilldown fields of a repository list, insight or author page. */
function drilldownValues(selection: DrilldownSelection, values: Values): boolean {
  values.metric = selection.metric;
  if (selection.scope === 'current') {
    if (selection.metric === 'agedPrs') values.age = String(selection.ageDays);
    return true;
  }
  const period = drilldownPeriod(selection.range);
  if (!period) return false;
  Object.assign(values, period);
  return true;
}
type RecordList = {
  kind: 'prs' | 'issues';
  filters: RepositoryPageFilters | null;
  table: TableQuery;
  columns?: string[];
  charts: boolean;
};
function recordListValues(
  route: UrlRoute,
  list: RecordList,
  values: Values,
  asOf: string,
): boolean {
  if (!list.filters) return false;
  const filterFields = filterValues(list.filters, filterInstant(values, asOf));
  if (!filterFields) return false;
  Object.assign(values, filterFields);
  assign(values, {
    sort: sortToken(list.table),
    page: pageValue(list.table.page),
    charts: list.charts || undefined,
  });
  columnsValue(route, values, list.columns);
  return true;
}

function repositoryPageValues(
  state: Record<string, unknown>,
  values: Values,
  route: UrlRoute,
  asOf: string,
): boolean {
  const entry = state.entry as
    | { status: 'records' | 'supporting'; drilldown: { selection: DrilldownSelection } }
    | { status: 'invalid' | 'unsupported' }
    | undefined;
  if (!entry || !('drilldown' in entry)) return false;
  const { selection } = entry.drilldown;
  if (!drilldownValues(selection, values)) return false;
  if (entry.status === 'records') {
    const list = state as unknown as RecordList;
    // A record kind's default list is its entry view; any other metric names its kind itself.
    if (values.metric === defaultValue(route, 'metric', { view: list.kind })) {
      delete values.metric;
      if (list.kind === 'issues') values.view = 'issues';
    }
    return recordListValues(route, list, values, asOf);
  }
  const { table } = state as { table: TableQuery };
  assign(values, {
    q: table.search || undefined,
    sort: sortToken(table),
    page: pageValue(table.page),
  });
  return true;
}

function authorValues(
  state: Record<string, unknown>,
  values: Values,
  route: UrlRoute,
  asOf: string,
): boolean {
  const { authors, drilldown } = state as {
    authors?: TableQuery;
    drilldown: { status: string; value?: { selection: DrilldownSelection } };
  };
  if (!authors || !drilldown.value) return false;
  if (!drilldownValues(drilldown.value.selection, values)) return false;
  assign(values, {
    listq: authors.search || undefined,
    listsort: sortToken(authors),
    listpage: pageValue(authors.page),
  });
  return recordListValues(route, state as unknown as RecordList, values, asOf);
}

function contributionValues(
  route: UrlRoute,
  params: URLSearchParams,
  state: Record<string, unknown>,
  values: Values,
): boolean {
  if (!state.focus) return false;
  if (params.has('timeline')) {
    const { source, timeline, scope } = state as {
      source: Source;
      timeline: TimelineRead;
      scope: ContributionSettings | null;
    };
    if (!source || 'invalid' in timeline || !scope) return false;
    sourceValues(source, values);
    scopeValues(scope, values);
    if (!timelineValues(timeline, values)) return false;
    columnsValue(route, values, timeline.view.columns);
    return true;
  }
  const { layout, scope, metric, table } = state as {
    layout: { sample: string; breakdown: string } | null;
    scope: ContributionSettings | null;
    metric: string | null;
    table: TableQuery & { kind: string; columns: string[]; hideZeroMembers: boolean };
  };
  if (!layout || !scope) return false;
  if (layout.sample !== 'reference') values.sample = layout.sample;
  if (route === '/companies/[...identity]' && layout.breakdown === 'repositories')
    values.view = 'repositories';
  scopeValues(scope, values);
  assign(values, {
    metric: metric ?? undefined,
    q: table.search || undefined,
    sort: sortToken(table),
    page: pageValue(table.page),
    zero: table.hideZeroMembers ? 'hide' : undefined,
  });
  // Absent legacy columns meant the viewer's choice, never a fixed list: only named ones carry.
  if (params.has(table.kind + '.columns')) columnsValue(route, values, table.columns);
  return true;
}
