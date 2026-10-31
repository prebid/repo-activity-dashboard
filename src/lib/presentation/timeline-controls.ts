import {
  timelineViewSchema,
  timelineViewKeys,
  type TimelineArea,
  type TimelineControlContext,
  type TimelineViewState,
} from '@/models/timeline-controls';
import { dateRangeSchema, type PeriodSelection } from '@/models/reporting-period';
import type { RepositoryPageFilters } from '@/models/repository-page';
import { readContributionPeriod, readContributionScopeInput } from './contribution-settings';
import { resolveReportingPeriod } from './reporting-period';
import { buildTimelineIntervals, rangeContains } from './reporting-timeline';
import {
  repositoryTimelineMetricSchema,
  repositoryTimelineMetricIds,
  repositoryTimelineMetricScope,
  repositoryTimelineFamilyMetrics,
} from '@/models/repository-timeline';
import { reportMetricIds } from '@/models/contribution-metrics';
import { contributionSampleScenarios } from '@/models/contribution-page';
import { z } from 'zod';
import { contributionUrlFits } from './contribution-return';
import { canonicalRoutePath } from './navigation';
import { readRepositoryFilterValues } from './repository-page-query';
import { validateRepositoryTimelineFilters } from './repository-timeline';
import {
  repositoryTimelineMatrixCellLimit,
  repositoryTimelineMatrixWindowSize,
} from '@/models/repository-timeline-matrix';
export { timelineViewKeys };
export function readTimelineView(params: URLSearchParams, area: TimelineArea, asOf: string) {
  if (params.getAll('timeline').length !== 1 || params.get('timeline') !== '1')
    throw Error('Invalid Timeline view.');
  if (params.has('timeline.state') && params.get('timeline.state') !== '1')
    throw Error('Invalid Timeline state.');
  for (const key of params.keys())
    if (
      key.startsWith('timeline.') &&
      !([...timelineViewKeys, 'timeline.gap', 'timeline.omitted'] as string[]).includes(key)
    )
      throw Error('Unknown Timeline option.');
  for (const key of [
    ...timelineViewKeys,
    'timeline',
    'timeline.gap',
    'timeline.omitted',
    'sample',
    'period',
    'from',
    'through',
  ])
    if (
      key !== 'timeline.columns' &&
      !(area === 'matrix' && key === 'timeline.metric') &&
      params.getAll(key).length > 1
    )
      throw Error('Repeated Timeline option.');
  const period = readContributionPeriod(params, asOf);
  if (!period) throw Error('Choose a valid reporting period.');
  let exactRange;
  if (['timeline.from', 'timeline.to', 'timeline.inclusive'].some((key) => params.has(key))) {
    const inclusive = params.get('timeline.inclusive');
    exactRange = dateRangeSchema.parse({
      start: params.get('timeline.from'),
      end: params.get('timeline.to'),
      endInclusive: inclusive === '1' ? true : inclusive === '0' ? false : undefined,
    });
    if (!rangeContains(resolveReportingPeriod(period, asOf).range, exactRange))
      throw Error('Exact timeline dates must stay inside the selected period.');
  }
  const integer = (key: string, fallback: number) => {
    const raw = params.get(key);
    if (raw === null) return fallback;
    if (!/^[1-9]\d*$/.test(raw)) throw Error('Invalid Timeline page.');
    return Number(raw);
  };
  const bool = (key: string, fallback: boolean) => {
    const raw = params.get(key);
    if (raw === null) return fallback;
    if (raw !== '0' && raw !== '1') throw Error('Invalid Timeline visibility.');
    return raw === '1';
  };
  const direction = params.get('timeline.dir');
  if (direction !== null && direction !== 'asc' && direction !== 'desc')
    throw Error('Invalid Timeline ordering.');
  const selectedMetrics =
    area === 'matrix'
      ? [
          ...new Set(
            (params.has('timeline.metric')
              ? params.getAll('timeline.metric').filter(Boolean)
              : ['prsOpened']
            ).map((id) => repositoryTimelineMetricSchema.parse(id)),
          ),
        ]
      : undefined;
  if (selectedMetrics && selectedMetrics.length > repositoryTimelineMetricIds.length)
    throw Error('Too many metrics.');
  const rank = params.get('timeline.rank');
  if (rank !== null && (area !== 'matrix' || !selectedMetrics?.includes(rank as never)))
    throw Error('Choose a selected metric for sorting.');
  const matrixMetric = selectedMetrics ? (rank ?? selectedMetrics[0] ?? 'prsOpened') : null;
  const scope = matrixMetric
    ? repositoryTimelineMetricScope(repositoryTimelineMetricSchema.parse(matrixMetric))
    : null;
  if (area !== 'repository' && (params.has('timeline.kind') || params.has('timeline.family')))
    throw Error('This view does not accept repository family options.');
  const kind = scope?.recordKind ?? params.get('timeline.kind') ?? 'prs',
    family = scope?.family ?? params.get('timeline.family') ?? 'activity';
  const base = timelineViewSchema.parse({
    grouping: params.get('timeline.group') ?? 'month',
    kind,
    family,
    metric:
      matrixMetric ??
      params.get('timeline.metric') ??
      (kind === 'prs'
        ? family === 'activity'
          ? 'prsOpened'
          : 'totalOpenPrs'
        : family === 'activity'
          ? 'issuesOpened'
          : 'openIssues'),
    selectedMetrics,
    chart: bool('timeline.chart', false),
    sort: params.get('timeline.sort') ?? (area === 'matrix' ? 'repository' : 'period'),
    descending: direction === 'desc',
    page: integer('timeline.page', 1),
    window: 1,
    columns: params.has('timeline.columns')
      ? params.getAll('timeline.columns').filter(Boolean)
      : undefined,
  });
  if (area === 'contribution') {
    base.metric = 'prsAuthored';
    if (params.has('timeline.metric') || params.has('timeline.chart'))
      throw Error('Contribution timelines are tables.');
  }
  const metricIds: readonly string[] =
    area === 'contribution'
      ? reportMetricIds
      : area === 'matrix'
        ? selectedMetrics!
        : repositoryTimelineFamilyMetrics(base.kind, base.family);
  if (
    (area !== 'matrix' && !metricIds.includes(base.metric)) ||
    base.columns?.some((id) => !metricIds.includes(id))
  )
    throw Error('The chosen metric or column does not belong to this timeline.');
  const request = {
    range: exactRange ?? resolveReportingPeriod(period, asOf).range,
    grouping: base.grouping,
  };
  const intervals = buildTimelineIntervals(request, asOf);
  const windows = Math.ceil(intervals.length / repositoryTimelineMatrixWindowSize);
  base.window = integer('timeline.window', windows);
  if (area === 'matrix' && (params.has('timeline.columns') || params.has('timeline.chart')))
    throw Error('The repository matrix has no chart or column choices.');
  if ((area !== 'matrix' && params.has('timeline.window')) || base.window > windows)
    throw Error('Invalid Timeline period window.');
  if (
    !(
      area === 'matrix' ? ['repository', ...intervals.map((i) => i.id)] : ['period', ...metricIds]
    ).includes(base.sort)
  )
    throw Error('Invalid Timeline sort column.');
  return { period, exactRange, view: base, request, intervals, metricIds };
}
export function writeTimelineView(
  search: string,
  area: TimelineArea,
  view: TimelineViewState,
): string {
  const params = new URLSearchParams(search);
  for (const key of timelineViewKeys)
    if (!['timeline.from', 'timeline.to', 'timeline.inclusive'].includes(key)) params.delete(key);
  params.set('timeline', '1');
  params.set('timeline.state', '1');
  params.set('timeline.group', view.grouping);
  if (area === 'repository') {
    params.set('timeline.kind', view.kind);
    params.set('timeline.family', view.family);
  }
  if (area === 'matrix') {
    const selectedMetrics = view.selectedMetrics ?? [view.metric];
    if (!selectedMetrics.length) params.set('timeline.metric', '');
    else {
      for (const id of selectedMetrics) params.append('timeline.metric', id);
      params.set('timeline.rank', view.metric);
    }
  } else if (area === 'repository') params.set('timeline.metric', view.metric);
  if (area === 'repository') params.set('timeline.chart', view.chart ? '1' : '0');
  params.set('timeline.sort', view.sort);
  params.set('timeline.dir', view.descending ? 'desc' : 'asc');
  params.set('timeline.page', String(view.page));
  if (area === 'matrix') params.set('timeline.window', String(view.window));
  else if (view.columns) {
    if (!view.columns.length) params.set('timeline.columns', '');
    else for (const id of view.columns) params.append('timeline.columns', id);
  }
  return params.toString();
}
export function writeTimelinePeriod(search: string, period: PeriodSelection) {
  const params = new URLSearchParams(search);
  for (const key of [
    'period',
    'from',
    'through',
    'timeline.from',
    'timeline.to',
    'timeline.inclusive',
  ])
    params.delete(key);
  params.set('period', period.kind === 'preset' ? period.preset : 'custom');
  if (period.kind === 'custom') {
    params.set('from', period.from);
    params.set('through', period.through);
  }
  return params.toString();
}
export function timelinePreferenceKey(
  viewer: string,
  context: Pick<TimelineControlContext, 'sample' | 'preferenceScope'>,
) {
  return (
    'dashboard:timeline:v1:' +
    encodeURIComponent(viewer) +
    ':' +
    encodeURIComponent(context.sample) +
    ':' +
    context.preferenceScope
  );
}
/** Only deliberate preference fields are stored; links, exact intervals and row/window pages are never defaults. */
export function timelinePreferenceFields(area: TimelineArea) {
  return [
    'timeline.group',
    'timeline.kind',
    'timeline.family',
    'timeline.metric',
    'timeline.rank',
    'timeline.chart',
    'timeline.sort',
    'timeline.dir',
    'timeline.columns',
    ...(area === 'contribution' ? [] : ['period', 'from', 'through', 'repo', 'prs.q', 'issues.q']),
  ];
}
export function timelinePreferenceParameters(params: URLSearchParams, area: TimelineArea) {
  const result = new URLSearchParams();
  for (const [key, value] of params)
    if (
      timelinePreferenceFields(area).includes(key) ||
      (area === 'repository' && /^(prs|issues)\.filter\./.test(key))
    )
      result.append(key, value);
  return result;
}
/** Scope rules shared by client proposals and server loaders; errors carry user-facing text. */
export function validateTimelineScope(
  params: URLSearchParams,
  parsed: ReturnType<typeof readTimelineView>,
  area: TimelineArea,
  repositories: readonly { id: string }[],
): RepositoryPageFilters | undefined {
  let filters: RepositoryPageFilters | undefined;
  if (area === 'repository') {
    const opposite = parsed.view.kind === 'prs' ? 'issues' : 'prs';
    if ([...params.keys()].some((key) => key.startsWith(opposite + '.')))
      throw Error('Record filters must match the selected kind.');
    filters = readRepositoryFilterValues(params.toString(), parsed.view.kind) ?? undefined;
    if (!filters) throw Error('Choose valid repository filters.');
    validateRepositoryTimelineFilters(filters, parsed.view.family);
  }
  const selected = params.getAll('repo').filter(Boolean);
  if (selected.some((id) => !repositories.some((row) => row.id === id)))
    throw Error('A selected repository is no longer available.');
  if (
    area === 'matrix' &&
    (params.has('repo') ? new Set(selected).size : repositories.length) *
      parsed.intervals.length *
      parsed.metricIds.length >
      repositoryTimelineMatrixCellLimit
  )
    throw Error(
      `Matrix exceeds ${repositoryTimelineMatrixCellLimit} cells; select fewer repositories/metrics or a coarser grouping.`,
    );
  return filters;
}
export function validateTimelineProposal(search: string, context: TimelineControlContext) {
  if (!contributionUrlFits(context.path + '?' + search))
    throw Error('This view is too large for a link. Reduce the selection.');
  const params = new URLSearchParams(search),
    parsed = readTimelineView(params, context.area, context.asOf);
  validateTimelineScope(params, parsed, context.area, context.repositories);
  return parsed;
}
const timelinePreferenceVersion = 1;
export function serializeTimelinePreferences(params: URLSearchParams, area: TimelineArea) {
  return JSON.stringify({
    version: timelinePreferenceVersion,
    query: timelinePreferenceParameters(params, area).toString(),
  });
}
export function readTimelinePreferences(
  raw: string | null,
  area: TimelineArea,
): URLSearchParams | null {
  if (raw === null) return new URLSearchParams();
  try {
    const stored = z
      .object({ version: z.literal(timelinePreferenceVersion), query: z.string().max(7500) })
      .strict()
      .parse(JSON.parse(raw));
    const params = new URLSearchParams(stored.query);
    return timelinePreferenceParameters(params, area).toString() === params.toString()
      ? params
      : null;
  } catch {
    return null;
  }
}
// Saved presentation choices that depend on the record kind, family, grouping or period.
const dependentPreferenceGroups = [
  ['timeline.sort', 'timeline.dir'],
  ['timeline.metric', 'timeline.rank'],
  ['timeline.columns'],
];
/**
 * Merged restoration first, then the same merge without each saved dependent group that no longer
 * fits, so one stale choice does not discard every other saved preference. A saved grouping, saved
 * record filters and a saved matrix repository selection are dropped only after every presentation
 * fallback has failed: a report scope outranks a grouping or filter that cannot cover it.
 */
export function timelinePreferenceCandidates(
  merged: URLSearchParams,
  explicit: URLSearchParams,
): URLSearchParams[] {
  const without = (groups: string[][]) => {
    const result = new URLSearchParams(merged);
    for (const key of groups.flat()) if (!explicit.has(key)) result.delete(key);
    return result;
  };
  const isSaved = (group: string[]) => group.some((key) => merged.has(key) && !explicit.has(key));
  const saved = dependentPreferenceGroups.filter(isSaved);
  const filters = [...new Set(merged.keys())].filter((key) => /^(prs|issues)\./.test(key));
  const scope = [['timeline.group'], filters, ['repo']].filter(isSaved);
  const candidates = [
    merged,
    ...saved.map((group) => without([group])),
    ...(saved.length > 1 ? [without(saved)] : []),
    ...scope.flatMap((group) => [
      without([group]),
      ...(saved.length ? [without([...saved, group])] : []),
    ]),
    ...(scope.length > 1 ? [without([...saved, ...scope])] : []),
  ];
  return candidates.filter(
    (candidate, index) =>
      candidates.findIndex((other) => other.toString() === candidate.toString()) === index,
  );
}
/** Explicit domains win independently: a repository choice need not discard a saved date preset. */
export function mergeTimelinePreferenceParameters(
  explicit: URLSearchParams,
  stored: URLSearchParams,
) {
  const result = new URLSearchParams(explicit);
  const period = ['period', 'from', 'through'].some((key) => explicit.has(key));
  const filters =
    period ||
    explicit.has('timeline.kind') ||
    explicit.has('timeline.family') ||
    [...explicit.keys()].some((key) => /^(prs|issues)\./.test(key));
  const differentFamily = ['timeline.kind', 'timeline.family'].some(
    (key) => explicit.has(key) && stored.has(key) && explicit.get(key) !== stored.get(key),
  );
  // Records saved before filters carried their kind can hold the other kind's filters.
  const kind = explicit.get('timeline.kind') ?? stored.get('timeline.kind') ?? 'prs';
  for (const name of new Set(stored.keys())) {
    if (
      explicit.has(name) ||
      (name === 'timeline.rank' &&
        explicit.has('timeline.metric') &&
        !explicit.getAll('timeline.metric').includes(stored.get(name) ?? '')) ||
      (period && ['period', 'from', 'through'].includes(name)) ||
      (/^(prs|issues)\./.test(name) && (filters || !name.startsWith(kind + '.'))) ||
      (differentFamily &&
        ['timeline.metric', 'timeline.columns', 'timeline.sort', 'timeline.dir'].includes(name))
    )
      continue;
    for (const value of stored.getAll(name)) result.append(name, value);
  }
  return result;
}
/** Presentation-only history can update immediately; data-scope changes must wait for their model. */
/** The prepared sample and temporal-gap variant a Timeline URL reads, or null when invalid. */
export function readTimelineSource(params: URLSearchParams, area: TimelineArea) {
  const sample = z
    .enum([...contributionSampleScenarios, 'mixed'])
    .safeParse(params.get('sample') ?? 'reference');
  const gap = params.get('timeline.gap') ?? '0';
  return !sample.success ||
    (area === 'contribution' && sample.data === 'mixed') ||
    params.getAll('sample').length > 1 ||
    params.getAll('timeline.gap').length > 1 ||
    !['0', '1'].includes(gap)
    ? null
    : { sample: sample.data, gap: gap === '1' };
}
/** Facts a URL loads, read through the same decoders as the server; null means not reusable. */
function timelineDataKey(search: string, context: TimelineControlContext): string | null {
  const params = new URLSearchParams(search);
  const source = readTimelineSource(params, context.area);
  let parsed;
  try {
    parsed = readTimelineView(params, context.area, context.asOf);
  } catch {
    return null;
  }
  if (!source) return null;
  // The selection matters as well as its range: a custom period can resolve to a preset's range.
  const base = { ...source, period: parsed.period, request: parsed.request };
  if (context.area === 'repository')
    return JSON.stringify({
      ...base,
      kind: parsed.view.kind,
      family: parsed.view.family,
      filters: readRepositoryFilterValues(params.toString(), parsed.view.kind),
    });
  if (context.area === 'matrix')
    return JSON.stringify({
      ...base,
      repositories: [
        ...new Set(
          params.has('repo')
            ? params.getAll('repo').filter(Boolean)
            : context.repositories.map((row) => row.id),
        ),
      ].sort(),
      metrics: parsed.view.selectedMetrics,
    });
  const scope = readContributionScopeInput(params, context, context.asOf);
  if (!scope) return null;
  const sorted = (values: readonly (string | null)[]) => [...new Set(values)].sort();
  return JSON.stringify({
    ...base,
    repositories: sorted(scope.selection.repositoryIds),
    types: sorted(scope.selection.actorTypes),
    population:
      scope.selection.population.kind === 'all'
        ? 'all'
        : {
            accounts: sorted(scope.selection.population.accountIds),
            companies: sorted(scope.selection.population.companyIds),
          },
    exclude: sorted(scope.selection.excludedAccountIds),
  });
}
export function resolveTimelinePresentation(
  path: string,
  search: string,
  context: TimelineControlContext,
) {
  const source = new URL(context.href, 'https://dashboard.invalid');
  const key = timelineDataKey(search, context);
  if (
    canonicalRoutePath(path) === canonicalRoutePath(context.path) &&
    key !== null &&
    key === timelineDataKey(source.search, context)
  ) {
    try {
      return {
        view: readTimelineView(new URLSearchParams(search), context.area, context.asOf).view,
        awaitingData: false,
      };
    } catch {
      /* The server owns invalid-link rendering. Keep the current model coherent during navigation. */
    }
  }
  return { view: context.view, awaitingData: true };
}
