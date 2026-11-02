// Frozen pre-codec URL readers, moved unchanged. They decode old links for the 307 to the
// canonical form and serve callers that have not moved to the codec yet.
import { z } from 'zod';
import {
  timelineViewSchema,
  timelineViewKeys,
  type TimelineArea,
} from '@/models/timeline-controls';
import { dateRangeSchema } from '@/models/reporting-period';
import {
  repositoryTimelineMetricSchema,
  repositoryTimelineMetricIds,
  repositoryTimelineMetricScope,
  repositoryTimelineFamilyMetrics,
} from '@/models/repository-timeline';
import { reportMetricIds } from '@/models/contribution-metrics';
import { contributionSampleScenarios } from '@/models/contribution-page';
import { repositoryTimelineMatrixWindowSize } from '@/models/repository-timeline-matrix';
import { resolveReportingPeriod } from '../../reporting-period';
import { buildTimelineIntervals, rangeContains } from '../../reporting-timeline';
import { contributionUrlFits } from '../../contribution-return';
import { safeReturnPath } from '../../navigation';
import { readContributionPeriod } from './contribution';
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
const fields = [
  'timeline.detail',
  'timeline.interval',
  'timeline.revision',
  'timeline.clock',
  'support.origin',
  'support.author',
];
export function timelineParentQuery(params: URLSearchParams) {
  const next = new URLSearchParams(params);
  for (const key of [...next.keys()])
    if (fields.includes(key) || key.startsWith('support.')) next.delete(key);
  return next;
}
export const timelineSupportValueLimit = 200;
export function readTimelineSupportQuery(params: URLSearchParams) {
  for (const key of params.keys())
    if (/^support\.(authors|records)\./.test(key)) {
      const values = params.getAll(key);
      if (
        values.some((value) => value.length > timelineSupportValueLimit) ||
        (!key.endsWith('.columns') && values.length !== 1)
      )
        return null;
      if (key.endsWith('.page') && !/^[1-9]\d{0,5}$/.test(values[0])) return null;
      if (key.endsWith('.dir') && !['asc', 'desc'].includes(values[0])) return null;
    }
  if (
    fields.some((key) => params.getAll(key).length > 1) ||
    [...params.keys()].some(
      (key) =>
        key.startsWith('support.') &&
        !['support.origin', 'support.author'].includes(key) &&
        !/^support\.(authors|records)\.(q|sort|dir|page|columns)$/.test(key),
    )
  )
    return null;
  const parsed = z
    .object({
      metric: z.string().min(1).max(100),
      interval: z.string().min(1).max(150),
      revision: z.string().min(1).max(500),
      clock: z.iso.datetime(),
      origin: z.enum(['timeline', 'matrix']),
      author: z.string().trim().min(1).max(500).optional(),
    })
    .safeParse({
      metric: params.get('timeline.detail'),
      interval: params.get('timeline.interval'),
      revision: params.get('timeline.revision'),
      clock: params.get('timeline.clock'),
      origin: params.get('support.origin') ?? 'timeline',
      author: params.get('support.author') ?? undefined,
    });
  return parsed.success ? parsed.data : null;
}
export function safeTimelineParent(value: string | null, path: string): string | null {
  if (!value) return null;
  if (!contributionUrlFits(value) || safeReturnPath(value) !== value) return null;
  const url = new URL(value, 'https://dashboard.invalid');
  if (url.searchParams.has('timelineParent')) return null;
  const author = url.pathname.startsWith(path + '/authors/')
    ? url.pathname.slice(path.length + '/authors/'.length)
    : null;
  return url.pathname === '/repos' ||
    url.pathname === path ||
    (author !== null && author !== '' && !author.includes('/'))
    ? value
    : null;
}
/** The repositories a matrix URL selects: its repo values, or every available one if none is named. */
export function matrixRepositoryIds(params: URLSearchParams, available: readonly string[]) {
  return [
    ...new Set(params.has('repo') ? params.getAll('repo').filter(Boolean) : available),
  ].sort();
}
