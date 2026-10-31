import {
  timelineViewSchema,
  timelineViewKeys,
  type TimelineArea,
  type TimelineControlContext,
  type TimelineViewState,
} from '@/models/timeline-controls';
import { dateRangeSchema, type PeriodSelection } from '@/models/reporting-period';
import { readContributionPeriod } from './contribution-settings';
import { resolveReportingPeriod } from './reporting-period';
import { buildTimelineIntervals } from './reporting-timeline';
import {
  repositoryTimelineMetricSchema,
  repositoryTimelineMetricIds,
  repositoryTimelineMetricScope,
  repositoryTimelineActivityMetrics,
  repositoryTimelineSnapshotMetrics,
} from '@/models/repository-timeline';
import { reportMetricIds } from '@/models/contribution-metrics';
import { contributionActorTypes } from '@/models/contributions';
import { z } from 'zod';
import { contributionUrlFits } from './contribution-return';
import { readRepositoryFilterValues } from './repository-page-query';
import { validateRepositoryTimelineFilters } from './repository-timeline';
import {
  repositoryTimelineMatrixCellLimit,
  repositoryTimelineMatrixWindowSize,
} from '@/models/repository-timeline-matrix';
export { timelineViewKeys };
export function timelineMetricIds(kind: 'prs' | 'issues', family: 'activity' | 'snapshot') {
  return (
    family === 'activity' ? repositoryTimelineActivityMetrics : repositoryTimelineSnapshotMetrics
  )[kind];
}
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
    const outer = resolveReportingPeriod(period, asOf).range;
    if (
      exactRange.start < outer.start ||
      exactRange.end > outer.end ||
      (exactRange.end === outer.end && exactRange.endInclusive && !outer.endInclusive)
    )
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
  const statistics =
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
  if (statistics && statistics.length > repositoryTimelineMetricIds.length)
    throw Error('Too many metrics.');
  const rank = params.get('timeline.rank');
  if (rank !== null && (area !== 'matrix' || !statistics?.includes(rank as never)))
    throw Error('Choose a selected metric for sorting.');
  const matrixMetric = statistics ? (rank ?? statistics[0] ?? 'prsOpened') : null;
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
    statistics,
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
        ? statistics!
        : timelineMetricIds(base.kind, base.family);
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
  if (
    (area !== 'matrix' && params.has('timeline.window')) ||
    (area === 'matrix' && (params.has('timeline.columns') || params.has('timeline.chart'))) ||
    base.window > windows
  )
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
    const statistics = view.statistics ?? [view.metric];
    if (!statistics.length) params.set('timeline.metric', '');
    else {
      for (const id of statistics) params.append('timeline.metric', id);
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
export function validateTimelineProposal(search: string, context: TimelineControlContext) {
  if (!contributionUrlFits(context.path + '?' + search))
    throw Error('This view is too large for a link. Reduce the selection.');
  const params = new URLSearchParams(search),
    parsed = readTimelineView(params, context.area, context.asOf);
  if (context.area === 'repository') {
    const opposite = parsed.view.kind === 'prs' ? 'issues' : 'prs';
    if ([...params.keys()].some((key) => key.startsWith(opposite + '.')))
      throw Error('Record filters must match the selected kind.');
    const filters = readRepositoryFilterValues(search, parsed.view.kind);
    if (!filters) throw Error('Choose valid repository filters.');
    validateRepositoryTimelineFilters(filters, parsed.view.family);
  }
  const selected = params.getAll('repo').filter(Boolean);
  if (selected.some((id) => !context.repositories.some((row) => row.id === id)))
    throw Error('A selected repository is no longer available.');
  if (
    context.area === 'matrix' &&
    (params.has('repo') ? new Set(selected).size : context.repositories.length) *
      parsed.intervals.length *
      parsed.metricIds.length >
      repositoryTimelineMatrixCellLimit
  )
    throw Error(
      'Matrix exceeds 10000 cells; select fewer repositories/metrics or a coarser grouping.',
    );
  return parsed;
}
export function readTimelinePreferences(
  raw: string | null,
  area: TimelineArea,
): URLSearchParams | null {
  if (raw === null) return new URLSearchParams();
  try {
    const stored = z
      .object({ version: z.literal(1), query: z.string().max(7500) })
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
  for (const name of new Set(stored.keys())) {
    if (
      explicit.has(name) ||
      (name === 'timeline.rank' &&
        explicit.has('timeline.metric') &&
        !explicit.getAll('timeline.metric').includes(stored.get(name) ?? '')) ||
      (period && ['period', 'from', 'through'].includes(name)) ||
      (filters && /^(prs|issues)\./.test(name)) ||
      (differentFamily &&
        ['timeline.metric', 'timeline.columns', 'timeline.sort', 'timeline.dir'].includes(name))
    )
      continue;
    for (const value of stored.getAll(name)) result.append(name, value);
  }
  return result;
}
/** Presentation-only history can update immediately; data-scope changes must wait for their model. */
function timelineDataKey(search: string, context: TimelineControlContext) {
  const params = new URLSearchParams(search);
  const list = (key: string, fallback: readonly string[] = []) =>
    [...new Set(params.has(key) ? params.getAll(key).filter(Boolean) : fallback)].sort();
  const kind = params.get('timeline.kind') ?? 'prs';
  const base = {
    sample: params.get('sample') ?? 'reference',
    gap: params.get('timeline.gap') ?? '0',
    group: params.get('timeline.group') ?? 'month',
    period: params.get('period') ?? 'this-year',
    from: params.get('from'),
    through: params.get('through'),
    exact: ['timeline.from', 'timeline.to', 'timeline.inclusive'].map((key) => params.get(key)),
  };
  if (context.area === 'repository')
    return JSON.stringify({
      ...base,
      kind,
      family: params.get('timeline.family') ?? 'activity',
      filters: readRepositoryFilterValues(params.toString(), kind as 'prs' | 'issues'),
    });
  const repositories = list(
    'repo',
    context.repositories.map((row) => row.id),
  );
  return JSON.stringify(
    context.area === 'matrix'
      ? {
          ...base,
          repositories,
          metrics: [
            ...new Set(
              params.has('timeline.metric')
                ? params.getAll('timeline.metric').filter(Boolean)
                : ['prsOpened'],
            ),
          ],
        }
      : {
          ...base,
          repositories,
          types: list('type', contributionActorTypes),
          population:
            params.get('population') ??
            (params.has('account') || params.has('company') ? 'selected' : 'all'),
          accounts: list('account'),
          companies: [...new Set(params.getAll('company'))].sort(),
          exclude: list('exclude'),
        },
  );
}
export function resolveTimelinePresentation(
  path: string,
  search: string,
  context: TimelineControlContext,
) {
  const source = new URL(context.href, 'https://dashboard.invalid');
  if (
    path === context.path &&
    timelineDataKey(search, context) === timelineDataKey(source.search, context)
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
