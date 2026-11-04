// Timelines in the URL codec. The Timeline screens keep their view state in the form the P5b
// screens and the preference cookie use (decision C9): a query of `timeline.*`, `period`, `repo`,
// record-filter and contribution-scope keys, validated by the frozen readers. Addresses and links
// carry registry values only; this module writes values in that form for the readers, and
// `timelineStateValues` (in `legacy/decode.ts`) reads them back.
import { repositoryCatalog } from '@/config/repositories';
import { readRepositoryFilterFields } from '../repository-page-query';
import { contributionScopeInput } from '../contribution-url';
import { writeContributionSettings } from './legacy/contribution';
import { writeRepositoryFilters } from './legacy/repository';
import { queryPairs, type QueryPair } from './codec';
import {
  contributionTimelineColumnTable,
  lensOf,
  repositoryTimelineColumnTable,
  visibleColumns,
} from './defaults';
import { instantIso, periodRange, periodSelection } from './period';
import { screenOf, timelineScreen, type UrlRoute, type UrlValue, type UrlValues } from './registry';

const idBySlug = new Map(repositoryCatalog.map((row) => [row.slug, row.id]));
const text = (value: UrlValue | undefined) => (typeof value === 'string' ? value : undefined);
const list = (value: UrlValue | undefined) => (typeof value === 'object' ? [...value] : undefined);
/** Fields a supporting view adds to its Timeline. */
const supportFields = [
  'detail',
  'interval',
  'snap',
  'origin',
  'author',
  'dq',
  'dsort',
  'dpage',
  'dcols',
  'listq',
  'listsort',
  'listpage',
];

export interface TimelineQueryOptions {
  /**
   * An entry (decision C1): the query leaves out `timeline.state`, so the Timeline resolves the
   * viewer's saved presentation against it.
   */
  entry?: boolean;
}

function sortPairs(prefix: string, token: string | undefined): QueryPair[] {
  if (!token) return [];
  return [
    [prefix + 'sort', token.replace(/^-/, '')],
    [prefix + 'dir', token.startsWith('-') ? 'desc' : 'asc'],
  ];
}
function listPairs(key: string, items: readonly string[]): QueryPair[] {
  return items.length ? items.map((item) => [key, item] as const) : [[key, '']];
}

/**
 * A Timeline view's values in the Timeline screens' query form, or null when a value cannot be
 * written there: a snapshot (`at`) its period does not resolve at, a `cols` column the table
 * lacks, or a malformed supporting interval or snapshot. `asOf` is the reporting as-of that record
 * filter periods resolve against when the view is not pinned.
 */
export function timelineQuery(
  route: UrlRoute,
  values: UrlValues,
  asOf: string,
  options: TimelineQueryOptions = {},
): string | null {
  return timelineParams(route, values, asOf, options)?.toString() ?? null;
}
/** `timelineQuery` as the parameters the frozen readers take. */
export function timelineParams(
  route: UrlRoute,
  values: UrlValues,
  asOf: string,
  options: TimelineQueryOptions = {},
): URLSearchParams | null {
  const pairs = timelinePairs(route, values, asOf, options);
  return pairs && new URLSearchParams(pairs as [string, string][]);
}
function timelinePairs(
  route: UrlRoute,
  values: UrlValues,
  asOf: string,
  options: TimelineQueryOptions,
): QueryPair[] | null {
  const screen = timelineScreen(route);
  const pairs: QueryPair[] = [['timeline', '1']];
  if (!options.entry) pairs.push(['timeline.state', '1']);
  const sample = text(values.sample);
  if (sample) pairs.push(['sample', sample]);
  // The Reviewers and Companies lenses keep their own Over time presentation; /reviewers is the
  // Reviewers lens without `lens`.
  const lens = lensOf(route, values);
  if (screen === 'contributionTimeline' && lens !== 'contributors') pairs.push(['lens', lens]);
  if (values.gap === true) pairs.push(['timeline.gap', '1']);
  const period = text(values.period);
  // A contribution Timeline writes its period with the rest of its scope.
  if (period && screen !== 'contributionTimeline') {
    const [from, through] = period.split('..');
    pairs.push(
      ...((through === undefined
        ? [['period', period]]
        : [
            ['period', 'custom'],
            ['from', from],
            ['through', through],
          ]) as QueryPair[]),
    );
  }
  const at = text(values.at);
  const pinned = at === undefined ? null : instantIso(at);
  if (at !== undefined) {
    const selection = periodSelection(period ?? 'this-year');
    const range = selection && pinned && periodRange(selection, pinned);
    if (!range) return null;
    pairs.push(['timeline.from', range.start], ['timeline.to', range.end]);
    if (range.endInclusive !== undefined)
      pairs.push(['timeline.inclusive', range.endInclusive ? '1' : '0']);
  }
  const group = text(values.group);
  if (group) pairs.push(['timeline.group', group]);
  if (screen === 'matrix') {
    const repo = list(values.repo);
    if (repo)
      pairs.push(
        ...listPairs(
          'repo',
          repo.map((slug) => idBySlug.get(slug) ?? slug),
        ),
      );
    const metric = list(values.metric);
    if (metric) pairs.push(...listPairs('timeline.metric', metric));
    const rank = text(values.rank);
    if (rank) pairs.push(['timeline.rank', rank]);
  }
  if (screen === 'repositoryTimeline') {
    const kind = values.view === 'issues' ? 'issues' : 'prs',
      family = values.family === 'snapshot' ? 'snapshot' : 'activity';
    if (values.view !== undefined) pairs.push(['timeline.kind', kind]);
    if (values.family !== undefined) pairs.push(['timeline.family', family]);
    const metric = text(values.metric);
    if (metric) pairs.push(['timeline.metric', metric]);
    if (values.chart === true) pairs.push(['timeline.chart', '1']);
    if (values.omitted === true) pairs.push(['timeline.omitted', 'current']);
    const cols = list(values.cols);
    if (cols) {
      const visible = visibleColumns(repositoryTimelineColumnTable(kind, family), cols);
      if (!visible) return null;
      pairs.push(...listPairs('timeline.columns', visible));
    }
    const filters = readRepositoryFilterFields(values, kind, pinned ?? asOf);
    if (!filters) return null;
    pairs.push(...queryPairs(writeRepositoryFilters('', filters)));
  }
  if (screen === 'contributionTimeline') {
    // An entry names no scope, so the viewer's saved scope can apply to it.
    if (!options.entry) {
      const settings = contributionScopeInput(values);
      if (!settings) return null;
      pairs.push(...queryPairs(writeContributionSettings('', settings)));
    }
    const cols = list(values.cols);
    if (cols) {
      const visible = visibleColumns(contributionTimelineColumnTable(lensOf(route, values)), cols);
      if (!visible) return null;
      pairs.push(...listPairs('timeline.columns', visible));
    }
  }
  pairs.push(...sortPairs('timeline.', text(values.sort)));
  const page = text(values.page);
  if (page) pairs.push(['timeline.page', page]);
  const window = text(values.window);
  if (screen === 'matrix' && window) pairs.push(['timeline.window', window]);
  if (screenOf(route, values) !== 'support') return pairs;
  return supportPairs(values, pairs);
}
function supportPairs(values: UrlValues, pairs: QueryPair[]): QueryPair[] | null {
  const interval = text(values.interval),
    snap = text(values.snap),
    detail = text(values.detail);
  if (!interval || !snap || !detail) return null;
  const split = interval.indexOf(':'),
    at = snap.lastIndexOf('@');
  const start = instantIso(interval.slice(split + 1)),
    clock = instantIso(snap.slice(at + 1));
  if (!start || !clock) return null;
  pairs.push(
    ['timeline.detail', detail],
    ['timeline.interval', interval.slice(0, split) + ':' + start],
    ['timeline.revision', snap.slice(0, at)],
    ['timeline.clock', clock],
  );
  if (values.origin === 'matrix') pairs.push(['support.origin', 'matrix']);
  const author = text(values.author);
  if (author !== undefined) pairs.push(['support.author', author]);
  for (const [prefix, q, sort, page] of [
    ['support.records.', 'dq', 'dsort', 'dpage'],
    ['support.authors.', 'listq', 'listsort', 'listpage'],
  ] as const) {
    const search = text(values[q]);
    if (search) pairs.push([prefix + 'q', search]);
    pairs.push(...sortPairs(prefix, text(values[sort])));
    const number = text(values[page]);
    if (number) pairs.push([prefix + 'page', number]);
  }
  return pairs;
}
/** A supporting view's Timeline values: the supporting fields removed. */
export function timelineParentValues(values: UrlValues): UrlValues {
  const result: Record<string, UrlValue> = { ...values };
  for (const name of supportFields) delete result[name];
  return result;
}
