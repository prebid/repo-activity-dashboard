import {
  repositoryTimelineSourceSchema,
  repositoryTimelineActivityMetrics,
  repositoryTimelineSnapshotMetrics,
  repositoryTimelineMetricScope,
  type RepositoryTimelineSource,
  type RepositoryTimeline,
  type RepositoryTimelineMetric,
  type RepositoryTimelineValues,
  type RepositoryTimelineDetail,
} from '@/models/repository-timeline';
import {
  repositoryPageFiltersSchema,
  type RepositoryPageFilters,
  type RepositoryPageSource,
} from '@/models/repository-page';
import {
  timelineRequestSchema,
  type TimelineRequest,
  type TimelineInterval,
} from '@/models/reporting-timeline';
import type { DateRange } from '@/models/reporting-period';
import { agingThresholdSchema } from '@/models/repository-overview';
import type { Count, Measurement } from '@/models/reporting-measurement';
import {
  buildTimelineIntervals,
  validateTimelineAvailability,
  withTimelineAvailability,
  timelineIntervalIndex,
} from './reporting-timeline';
import { matchesRepositoryPageRow } from './repository-page-filters';
import { usesReviewFilters } from './repository-page-rules';
import { matchesCurrentPr } from './repository-records';
import { subsetCount } from './repository-page-values';
import { mergeElapsedDays } from './repository-insights';
import { inDateRange } from './reporting-period';

/** Reject incompatible explicit predicates; entry transitions can explain and remove them separately. */
export function validateRepositoryTimelineFilters(
  input: RepositoryPageFilters,
  family: 'activity' | 'snapshot',
): RepositoryPageFilters {
  const filters = repositoryPageFiltersSchema.parse(input);
  if (filters.eventRange)
    throw Error('Use the exact timeline range instead of an eventRange predicate');
  if (family === 'activity' && (filters.ageBand !== undefined || usesReviewFilters(filters)))
    throw Error('Current age and review filters require snapshot scope');
  return filters;
}
export function repositoryTimelineValue(
  values: RepositoryTimelineValues,
  metric: RepositoryTimelineMetric,
): Measurement {
  const value = values[metric];
  if (!value) throw Error('Metric is not part of this repository timeline family');
  return value;
}
function sourceOf(input: RepositoryTimelineSource) {
  const source = repositoryTimelineSourceSchema.parse(input);
  const available = validateTimelineAvailability(source.availableRanges, source.asOf);
  if (
    new Set(source.rows.map((row) => row.id)).size !== source.rows.length ||
    new Set(source.rows.map((row) => row.number)).size !== source.rows.length
  )
    throw Error('Duplicate repository timeline record');
  const identities = new Map(source.rows.map((row) => [row.id, row]));
  const cutoffs = new Set<string>();
  for (const snapshot of source.snapshots) {
    const key = JSON.stringify(snapshot.cutoff);
    if (cutoffs.has(key) || snapshot.cutoff.at > source.asOf)
      throw Error('Invalid or duplicate historical cutoff');
    cutoffs.add(key);
    if (snapshot.coverage.status === 'missing' && snapshot.rows.length)
      throw Error('Unavailable snapshot cannot contain known rows');
    if (new Set(snapshot.rows.map((row) => row.id)).size !== snapshot.rows.length)
      throw Error('Duplicate historical record');
    for (const row of snapshot.rows) {
      const original = identities.get(row.id);
      if (
        !original ||
        original.number !== row.number ||
        original.createdAt !== row.createdAt ||
        row.state !== 'Open' ||
        row.createdAt > snapshot.cutoff.at ||
        (!snapshot.cutoff.inclusive && row.createdAt === snapshot.cutoff.at)
      )
        throw Error('Invalid historical snapshot membership');
      if (
        row.latestActivity &&
        (row.latestActivity.at > snapshot.cutoff.at ||
          (!snapshot.cutoff.inclusive && row.latestActivity.at === snapshot.cutoff.at))
      )
        throw Error('Historical metadata is newer than its cutoff');
    }
  }
  const allRows: RepositoryTimelineSource['rows'][number][] = [...source.rows];
  for (const snapshot of source.snapshots) allRows.push(...snapshot.rows);
  for (const row of allRows) {
    if (row.createdAt > source.asOf || (row.latestActivity && row.latestActivity.at > source.asOf))
      throw Error('Record is newer than the reporting clock');
    if ('mergedAt' in row) {
      if (
        (row.state === 'Merged' && (!row.mergedAt || row.draft)) ||
        (row.state !== 'Merged' && row.mergedAt !== null)
      )
        throw Error('Invalid PR merge metadata');
      if (row.mergedAt && (row.mergedAt < row.createdAt || row.mergedAt > source.asOf))
        throw Error('Invalid merge date');
    } else if (
      (row.state === 'Closed') !== (row.closedAt !== null) ||
      (row.closedAt && (row.closedAt < row.createdAt || row.closedAt > source.asOf))
    )
      throw Error('Invalid issue closure metadata');
  }
  return { ...source, availableRanges: available };
}
function pageSource(source: RepositoryTimelineSource): RepositoryPageSource {
  const common = {
    repository: source.repository,
    asOf: source.asOf,
    measurement: { status: 'complete' as const, value: source.rows.length },
    drilldown: {
      selection: {
        scope: 'current' as const,
        metric: source.kind === 'prs' ? ('totalOpenPrs' as const) : ('openIssues' as const),
      },
      returnTo: '/repos',
    },
  };
  return source.kind === 'prs'
    ? { ...common, kind: 'prs', rows: source.rows }
    : { ...common, kind: 'issues', rows: source.rows };
}
function missing(reason: string): Measurement {
  return { status: 'missing', value: null, reason };
}
function snapshotMetricMatch(
  row: RepositoryTimelineSource['rows'][number],
  metric: RepositoryTimelineMetric,
): boolean | 'unknown' {
  let match: boolean | 'unknown' = metric === 'openIssues';
  if ('draft' in row) {
    const selection = metric.startsWith('agedPrs')
      ? {
          scope: 'current' as const,
          metric: 'agedPrs' as const,
          ageDays: agingThresholdSchema.parse(Number(metric.slice(7))),
        }
      : {
          scope: 'current' as const,
          metric: metric as Exclude<
            RepositoryTimelineMetric,
            | `agedPrs${number}`
            | 'prsOpened'
            | 'prsMerged'
            | 'issuesOpened'
            | 'issuesClosed'
            | 'prAuthors'
            | 'issueAuthors'
            | 'medianMergeDays'
          >,
        };
    match = matchesCurrentPr(row, selection);
    if (
      !row.draft &&
      ((metric.startsWith('humanReviewers') && row.humanReviewers === null) ||
        (metric.startsWith('humanApprovals') && row.approvals === null) ||
        (metric === 'agentFeedbackPrs' && row.agentReviewer === null) ||
        (metric === 'botFeedbackPrs' && row.botReviewer === null))
    )
      match = 'unknown';
  }
  return match;
}
function activityDate(
  source: RepositoryTimelineSource,
  row: RepositoryTimelineSource['rows'][number],
  metric: RepositoryTimelineMetric,
) {
  return metric === 'prsMerged' || metric === 'medianMergeDays'
    ? 'mergedAt' in row && row.baseBranch === source.repository.primaryBranch
      ? row.mergedAt
      : null
    : metric === 'issuesClosed'
      ? 'closedAt' in row
        ? row.closedAt
        : null
      : row.createdAt;
}
function snapshotValues(
  source: RepositoryTimelineSource,
  filters: RepositoryPageFilters,
  at: string,
  inclusive: boolean,
  metrics: RepositoryTimelineMetric[],
): RepositoryTimelineValues {
  const snapshot = source.snapshots.find(
    (row) => row.cutoff.at === at && row.cutoff.inclusive === inclusive,
  );
  if (!snapshot)
    return Object.fromEntries(
      metrics.map((metric) => [
        metric,
        missing('No prepared historical snapshot at this exact cutoff.'),
      ]),
    );
  const base: Count =
    snapshot.coverage.status === 'complete'
      ? { status: 'complete', value: 0 }
      : snapshot.coverage.status === 'partial'
        ? { ...snapshot.coverage, value: 0 }
        : { ...snapshot.coverage, value: null };
  const context = pageSource(source);
  return Object.fromEntries(
    metrics.map((metric) => {
      let known = 0,
        uncertain = 0;
      for (const row of snapshot.rows) {
        const filter = matchesRepositoryPageRow(row, filters, context);
        if (!filter) continue;
        const match = snapshotMetricMatch(row, metric);
        if (!match) continue;
        if (filter === 'unknown' || match === 'unknown') uncertain++;
        else known++;
      }
      return [metric, subsetCount(base, known, uncertain)];
    }),
  );
}
function projectRepositoryTimeline(
  input: RepositoryTimelineSource,
  request: TimelineRequest,
  intervals: readonly TimelineInterval[],
  family: 'activity' | 'snapshot' = 'activity',
  requestedFilters?: RepositoryPageFilters,
  requestedMetrics?: readonly RepositoryTimelineMetric[],
): RepositoryTimeline {
  if (family !== 'activity' && family !== 'snapshot') throw Error('Unknown timeline family');
  const source = sourceOf(input);
  const filters = validateRepositoryTimelineFilters(
    requestedFilters ?? repositoryPageFiltersSchema.parse({ kind: source.kind }),
    family,
  );
  if (filters.kind !== source.kind) throw Error('Timeline filters do not match record kind');
  const allowedMetrics: readonly RepositoryTimelineMetric[] =
    family === 'activity'
      ? repositoryTimelineActivityMetrics[source.kind]
      : repositoryTimelineSnapshotMetrics[source.kind];
  const metrics = [...new Set(requestedMetrics ?? allowedMetrics)];
  if (!metrics.length || metrics.some((metric) => !allowedMetrics.includes(metric)))
    throw Error('Selected metric does not match the repository timeline family');
  let rows: RepositoryTimeline['rows'], summary: RepositoryTimelineValues;
  if (family === 'snapshot') {
    rows = intervals.map((interval) => ({
      interval,
      values: snapshotValues(
        source,
        filters,
        interval.covered.end,
        interval.covered.endInclusive,
        metrics,
      ),
    }));
    summary = snapshotValues(
      source,
      filters,
      request.range.end,
      request.range.endInclusive,
      metrics,
    );
  } else {
    const context = pageSource(source),
      selected = source.rows
        .map((row) => ({ row, verdict: matchesRepositoryPageRow(row, filters, context) }))
        .filter((item) => item.verdict !== false);
    rows = intervals.map((interval) => ({ interval, values: {} }));
    summary = {};
    for (const metric of metrics) {
      const buckets = intervals.map(() => ({
          known: [] as (typeof source.rows)[number][],
          uncertain: 0,
        })),
        whole = { known: [] as (typeof source.rows)[number][], uncertain: 0 };
      for (const { row, verdict } of selected) {
        const at = activityDate(source, row, metric);
        if (!at || !inDateRange(at, request.range)) continue;
        const index = timelineIntervalIndex(intervals, at);
        for (const bucket of [whole, buckets[index]])
          if (verdict === 'unknown') bucket.uncertain++;
          else bucket.known.push(row);
      }
      const measurement = (bucket: typeof whole): Measurement => {
        if (metric === 'medianMergeDays') {
          const days = bucket.known
            .map((row) => mergeElapsedDays(row.createdAt, 'mergedAt' in row ? row.mergedAt : null)!)
            .sort((a, b) => a - b);
          if (!days.length)
            return bucket.uncertain
              ? missing('Merge population is incomplete.')
              : {
                  status: 'not-applicable',
                  value: null,
                  reason: 'No merged PRs in the covered range.',
                };
          const half = Math.floor(days.length / 2),
            value = days.length % 2 ? days[half] : (days[half - 1] + days[half]) / 2;
          return bucket.uncertain
            ? { status: 'partial', value, reason: 'Median of the known matching merged PRs.' }
            : { status: 'complete', value };
        }
        const count =
          metric === 'prAuthors' || metric === 'issueAuthors'
            ? new Set(bucket.known.map((row) => row.author.toLowerCase())).size
            : bucket.known.length;
        return subsetCount({ status: 'complete', value: 0 }, count, bucket.uncertain);
      };
      rows.forEach((row, index) => {
        row.values[metric] = withTimelineAvailability(
          measurement(buckets[index]),
          row.interval.covered,
          source.availableRanges,
        );
      });
      summary[metric] = withTimelineAvailability(
        measurement(whole),
        request.range,
        source.availableRanges,
      );
    }
  }
  return {
    kind: 'repository',
    source: { source: source.source, scenarioId: source.scenarioId, asOf: source.asOf },
    request,
    scope: { repository: source.repository, recordKind: source.kind, family, filters },
    metrics,
    rows,
    summary,
  };
}
/** Share one owned, immutable calendar across projections without accepting unchecked intervals. */
export function createRepositoryTimelineProjection(requested: TimelineRequest, asOf: string) {
  const parsed = timelineRequestSchema.parse(requested);
  const request = Object.freeze({ ...parsed, range: Object.freeze(parsed.range) });
  const intervals = Object.freeze(
    buildTimelineIntervals(request, asOf).map((interval) =>
      Object.freeze({
        ...interval,
        calendar: Object.freeze(interval.calendar),
        covered: Object.freeze(interval.covered),
      }),
    ),
  );
  return Object.freeze({
    request,
    intervals,
    select(
      input: RepositoryTimelineSource,
      family: 'activity' | 'snapshot' = 'activity',
      filters?: RepositoryPageFilters,
      metrics?: readonly RepositoryTimelineMetric[],
    ) {
      if (input.asOf !== asOf)
        throw Error('Repository timeline snapshot does not match the shared calendar');
      return projectRepositoryTimeline(input, request, intervals, family, filters, metrics);
    },
  });
}
export function selectRepositoryTimeline(
  input: RepositoryTimelineSource,
  requested: TimelineRequest,
  family: 'activity' | 'snapshot' = 'activity',
  requestedFilters?: RepositoryPageFilters,
): RepositoryTimeline {
  return createRepositoryTimelineProjection(requested, input.asOf).select(
    input,
    family,
    requestedFilters,
  );
}

export function repositoryTimelineDetail(
  report: RepositoryTimeline,
  metric: RepositoryTimelineMetric,
  intervalId?: string,
): RepositoryTimelineDetail | null {
  const row =
    intervalId === undefined
      ? undefined
      : report.rows.find((row) => row.interval.id === intervalId);
  if (intervalId !== undefined && !row) throw Error('Unknown timeline interval');
  const range = row?.interval.covered ?? report.request.range;
  return repositoryTimelineMeasurementDetail(
    report,
    metric,
    range,
    repositoryTimelineValue(row?.values ?? report.summary, metric),
  );
}
/** The same typed destination serves an individual interval and a matrix cell. */
export function repositoryTimelineMeasurementDetail(
  report: Pick<RepositoryTimeline, 'source' | 'scope'>,
  metric: RepositoryTimelineMetric,
  range: DateRange,
  measurement: Measurement,
): RepositoryTimelineDetail | null {
  const definition = repositoryTimelineMetricScope(metric);
  if (
    definition.recordKind !== report.scope.recordKind ||
    definition.family !== report.scope.family
  )
    throw Error('Detail metric does not match repository timeline scope');
  if (measurement.value === null) return null;
  const common = {
    kind: 'repository' as const,
    source: report.source,
    repositoryId: report.scope.repository.id,
    metric,
    filters: report.scope.filters,
  };
  return report.scope.family === 'snapshot'
    ? { ...common, basis: 'snapshot', cutoff: { at: range.end, inclusive: range.endInclusive } }
    : {
        ...common,
        basis:
          metric === 'medianMergeDays'
            ? 'duration'
            : metric === 'prAuthors' || metric === 'issueAuthors'
              ? 'distinct-authors'
              : 'event',
        range,
      };
}

/** Known support only: uncertain membership remains in coverage, never invented matching records. */
export function repositoryTimelineSupportingRows(
  input: RepositoryTimelineSource,
  detail: RepositoryTimelineDetail,
) {
  const source = sourceOf(input),
    scope = repositoryTimelineMetricScope(detail.metric);
  if (
    source.scenarioId !== detail.source.scenarioId ||
    source.asOf !== detail.source.asOf ||
    source.repository.id !== detail.repositoryId ||
    source.kind !== scope.recordKind
  )
    throw Error('Supporting source does not match the timeline.');
  const filters = validateRepositoryTimelineFilters(detail.filters, scope.family);
  if (
    filters.kind !== source.kind ||
    (detail.basis === 'snapshot') !== (scope.family === 'snapshot')
  )
    throw Error('Supporting scope does not match the timeline.');
  const rows =
    detail.basis === 'snapshot'
      ? source.snapshots.find(
          (snapshot) =>
            snapshot.cutoff.at === detail.cutoff.at &&
            snapshot.cutoff.inclusive === detail.cutoff.inclusive,
        )?.rows
      : source.rows;
  if (!rows) throw Error('Historical snapshot is unavailable.');
  return rows.filter(
    (row) =>
      matchesRepositoryPageRow(row, filters, pageSource(source)) === true &&
      (detail.basis === 'snapshot'
        ? snapshotMetricMatch(row, detail.metric) === true
        : (() => {
            const at = activityDate(source, row, detail.metric);
            return !!at && inDateRange(at, detail.range);
          })()),
  );
}
