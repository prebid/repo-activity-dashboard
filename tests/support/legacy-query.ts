// The legacy (pre-codec) query that renders the same view as canonical values: the inverse of
// `legacyDecode`, used to prove the decode round trip through the frozen readers.
import { repositoryCatalog } from '@/config/repositories';
import { columnTableOf, recordKindOf, visibleColumns } from '@/lib/presentation/url/defaults';
import { instantIso, periodRange, periodSelection } from '@/lib/presentation/url/period';
import {
  screenOf,
  type UrlRoute,
  type UrlValue,
  type UrlValues,
} from '@/lib/presentation/url/registry';
import { backlogMetricIds } from '@/models/repository-overview';

const idOf = (slug: string) => repositoryCatalog.find((row) => row.slug === slug)?.id ?? slug;
const list = (value: UrlValue | undefined): readonly string[] =>
  typeof value === 'object' ? value : [];
const one = (value: UrlValue | undefined) => (typeof value === 'string' ? value : undefined);

function writeList(params: URLSearchParams, key: string, items: readonly string[]) {
  if (!items.length) params.set(key, '');
  else for (const item of items) params.append(key, item);
}
function writePeriod(params: URLSearchParams, value: string | undefined, suffix = '') {
  if (value === undefined) return;
  const selection = periodSelection(value)!;
  params.set('period' + suffix, selection.kind === 'preset' ? selection.preset : 'custom');
  if (selection.kind === 'custom') {
    params.set('from' + suffix, selection.from);
    params.set('through' + suffix, selection.through);
  }
}
function writeTable(
  params: URLSearchParams,
  key: string,
  q?: string,
  sort?: string,
  page?: string,
) {
  if (q) params.set(key + '.q', q);
  if (sort) {
    params.set(key + '.sort', sort.replace(/^-/, ''));
    params.set(key + '.dir', sort.startsWith('-') ? 'desc' : 'asc');
  }
  if (page) params.set(key + '.page', page);
}
function writeColumns(params: URLSearchParams, key: string, route: UrlRoute, values: UrlValues) {
  if (!values.cols) return;
  writeList(params, key, visibleColumns(columnTableOf(route, values)!, list(values.cols))!);
}
const filterLists = [
  'labels',
  'authors',
  'authorTypes',
  'states',
  'latestActors',
  'branches',
  'assignees',
];
const filterScalars = [
  'draft',
  'assignment',
  'ageBand',
  'reviewers',
  'approvals',
  'agentReviewer',
  'botReviewer',
];
function writeFilters(params: URLSearchParams, kind: string, values: UrlValues, at: string) {
  const prefix = kind + '.filter.';
  for (const field of filterLists)
    for (const item of list(values[field])) params.append(prefix + field, item);
  for (const field of filterScalars)
    if (one(values[field]) !== undefined) params.set(prefix + field, one(values[field])!);
  if (values.events) {
    const range = periodRange(periodSelection(one(values.events)!)!, at)!;
    params.set(prefix + 'eventFrom', range.start);
    params.set(prefix + 'eventTo', range.end);
    params.set(prefix + 'eventInclusive', range.endInclusive ? '1' : '0');
  }
  if (values.q) params.set(kind + '.q', one(values.q)!);
}
/** The exact range a period plus snapshot pins. */
function exactRange(values: UrlValues, asOf: string) {
  return periodRange(
    periodSelection(one(values.period) ?? 'this-year')!,
    instantIso(one(values.at) ?? asOf)!,
  )!;
}
function writeDrilldown(params: URLSearchParams, values: UrlValues, asOf: string, branch: string) {
  const metric = one(values.metric)!;
  const current = metric === 'agedPrs' || (backlogMetricIds as readonly string[]).includes(metric);
  params.set('scope', current ? 'current' : 'period');
  params.set('metric', metric);
  if (values.age) params.set('age', one(values.age)!);
  if (!current) {
    const range = exactRange(values, asOf);
    params.set('from', range.start);
    params.set('to', range.end);
    params.set('inclusive', range.endInclusive ? '1' : '0');
    if (metric === 'prsMerged' || metric === 'medianMergeDays') params.set('branch', branch);
  }
}
function writeTimeline(
  params: URLSearchParams,
  values: UrlValues,
  asOf: string,
  key: { sort: string; columns: boolean },
) {
  params.set('timeline', '1');
  if (values.sample) params.set('sample', one(values.sample)!);
  if (values.gap) params.set('timeline.gap', '1');
  writePeriod(params, one(values.period));
  if (values.at) {
    const range = exactRange(values, asOf);
    params.set('timeline.from', range.start);
    params.set('timeline.to', range.end);
    params.set('timeline.inclusive', range.endInclusive ? '1' : '0');
  }
  if (values.group) params.set('timeline.group', one(values.group)!);
  writeTable(params, 'timeline', undefined, one(values.sort), one(values.page));
  if (!key.columns && values.cols) throw Error('No columns on this Timeline');
}
function writeScope(params: URLSearchParams, values: UrlValues) {
  params.set('scope', '1');
  writePeriod(params, one(values.period) ?? 'this-year');
  if (values.repo) writeList(params, 'repo', list(values.repo).map(idOf));
  if (values.type) writeList(params, 'type', list(values.type));
  if (values.account || values.company) {
    params.set('population', 'selected');
    for (const id of list(values.account)) params.append('account', id);
    for (const id of list(values.company)) params.append('company', id === 'unmapped' ? '' : id);
  }
  for (const id of list(values.exclude)) params.append('exclude', id);
}

/** A legacy href for canonical values on a route. */
export function legacyQuery(
  route: UrlRoute,
  pathname: string,
  values: UrlValues,
  context: { asOf: string; branch: (pathname: string) => string },
): string {
  const params = new URLSearchParams();
  const screen = screenOf(route, values);
  const { asOf } = context;
  const base = screen === 'support' ? undefined : screen;
  switch (screen === 'support' ? screenOf(route, { timeline: true }) : base) {
    case 'summary':
      if (values.repo) writeList(params, 'repo', list(values.repo).map(idOf));
      // The legacy reader reads a second period only beside an explicit first one.
      writePeriod(params, one(values.period) ?? (values.period2 ? 'this-month' : undefined));
      writePeriod(params, one(values.period2), '2');
      if (values.age) writeList(params, 'age', list(values.age));
      writeTable(params, 'backlog', undefined, one(values.bsort), one(values.bpage));
      writeTable(params, 'activity', undefined, one(values.asort), one(values.apage));
      break;
    case 'matrix':
      writeTimeline(params, values, asOf, { sort: 'repository', columns: false });
      if (values.repo) writeList(params, 'repo', list(values.repo).map(idOf));
      if (values.metric) writeList(params, 'timeline.metric', list(values.metric));
      if (values.rank) params.set('timeline.rank', one(values.rank)!);
      if (values.window) params.set('timeline.window', one(values.window)!);
      break;
    case 'repositoryTimeline': {
      writeTimeline(params, values, asOf, { sort: 'period', columns: true });
      const kind = values.view === 'issues' ? 'issues' : 'prs';
      if (values.view) params.set('timeline.kind', kind);
      if (values.family) params.set('timeline.family', one(values.family)!);
      if (values.metric) params.set('timeline.metric', one(values.metric)!);
      if (values.chart) params.set('timeline.chart', '1');
      if (values.omitted) params.set('timeline.omitted', 'current');
      writeColumns(params, 'timeline.columns', route, values);
      writeFilters(params, kind, values, instantIso(one(values.at) ?? asOf)!);
      break;
    }
    case 'records':
    case 'insight': {
      if (values.metric) writeDrilldown(params, values, asOf, context.branch(pathname));
      else if (values.view === 'issues') params.set('view', 'issues');
      if (screen === 'insight') {
        const metric = one(values.metric)!;
        const key = metric.endsWith('Authors')
          ? 'authors'
          : metric === 'medianMergeDays'
            ? 'prs'
            : 'credits';
        writeTable(params, key, one(values.q), one(values.sort), one(values.page));
        break;
      }
      const kind = recordKindOf(values);
      writeFilters(params, kind, values, instantIso(one(values.at) ?? asOf)!);
      writeTable(params, kind, undefined, one(values.sort), one(values.page));
      writeColumns(params, kind + '.columns', route, values);
      if (values.charts) params.set(kind + '.charts', '1');
      break;
    }
    case 'authorRecords': {
      writeDrilldown(params, values, asOf, context.branch(pathname));
      writeTable(params, 'authors', one(values.listq), one(values.listsort), one(values.listpage));
      const kind = one(values.metric) === 'prAuthors' ? 'prs' : 'issues';
      writeFilters(params, kind, values, instantIso(one(values.at) ?? asOf)!);
      writeTable(params, kind, undefined, one(values.sort), one(values.page));
      writeColumns(params, kind + '.columns', route, values);
      if (values.charts) params.set(kind + '.charts', '1');
      break;
    }
    case 'contributionTimeline':
      writeScope(params, values);
      writeTimeline(params, values, asOf, { sort: 'period', columns: true });
      writeColumns(params, 'timeline.columns', route, values);
      break;
    default: {
      writeScope(params, values);
      if (values.sample) params.set('sample', one(values.sample)!);
      if (values.view) params.set('view', one(values.view)!);
      if (values.metric) params.set('metric', one(values.metric)!);
      const table = values.metric
        ? 'details'
        : route === '/contributors'
          ? 'contributors'
          : route === '/companies'
            ? 'companies'
            : route === '/contributors/[accountId]' || values.view === 'repositories'
              ? 'repositories'
              : 'members';
      const key = table === 'contributors' || table === 'companies' ? 'report' : table;
      writeTable(params, key, one(values.q), one(values.sort), one(values.page));
      writeColumns(params, table + '.columns', route, values);
      if (values.zero) params.set('members.zero', 'hide');
    }
  }
  if (screen === 'support') {
    const interval = one(values.interval)!;
    const split = interval.indexOf(':');
    const snap = one(values.snap)!;
    const at = snap.lastIndexOf('@');
    params.set('timeline.detail', one(values.detail)!);
    params.set(
      'timeline.interval',
      interval.slice(0, split) + ':' + instantIso(interval.slice(split + 1))!,
    );
    params.set('timeline.revision', snap.slice(0, at));
    params.set('timeline.clock', instantIso(snap.slice(at + 1))!);
    if (values.origin) params.set('support.origin', one(values.origin)!);
    if (values.author) params.set('support.author', one(values.author)!);
    writeTable(params, 'support.records', one(values.dq), one(values.dsort), one(values.dpage));
    writeTable(
      params,
      'support.authors',
      one(values.listq),
      one(values.listsort),
      one(values.listpage),
    );
  }
  return pathname + (params.size ? '?' + params.toString() : '');
}
