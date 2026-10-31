import type {
  ContributionTimelineSource,
  ContributionTimeline,
  ContributionTimelineDetail,
} from '@/models/contribution-timeline';
import type { ContributionSelection, ContributionFocus } from '@/models/contributions';
import {
  contributionMetricBasis,
  reportMetricIds,
  isCoreMetric,
  isReportMetric,
  type ReportMetric,
} from '@/models/contribution-metrics';
import { timelineRequestSchema, type TimelineRequest } from '@/models/reporting-timeline';
import type { Count } from '@/models/reporting-measurement';
import { contributionScope } from './contribution-scope';
import {
  buildTimelineIntervals,
  validateTimelineAvailability,
  rangeContains,
  withTimelineAvailability,
} from './reporting-timeline';
import { inDateRange } from './reporting-period';

/** Partition supplied once-attributed facts; no GitHub history or client-side report calculation. */
export function selectContributionTimeline(
  input: ContributionTimelineSource,
  requested: TimelineRequest,
  selection?: ContributionSelection,
  focus?: ContributionFocus,
): ContributionTimeline {
  const request = timelineRequestSchema.parse(requested);
  const intervals = buildTimelineIntervals(request, input.contributions.asOf);
  const scope = contributionScope(input.contributions, selection, focus),
    source = scope.source;
  const selectedFocus = scope.focus;
  const available = validateTimelineAvailability(input.availableRanges, source.asOf);
  if (available.some((range) => !rangeContains(source.range, range)))
    throw Error('Timeline availability exceeds contribution source range');
  const records = new Map(source.records.map((row) => [row.id, row]));
  const dates = [
    ...source.credits.map((row) => row.creditedAt),
    ...source.activity.comments.map((row) => row.createdAt),
    ...source.activity.volumes.map((row) => {
      const record = records.get(row.recordId)!;
      return record.kind === 'pr' ? record.mergedAt! : '';
    }),
  ];
  if (dates.some((at) => !available.some((range) => inDateRange(at, range))))
    throw Error('Known contribution facts lie outside timeline coverage');
  const empty = !scope.accounts.length || !scope.repositories.length;
  const measurements = empty
    ? []
    : scope.index.timeline(scope.accounts, scope.repositories, intervals);
  const whole = scope.index.timeline(scope.accounts, scope.repositories, [
    { id: 'whole', calendar: request.range, covered: request.range, partial: false },
  ])[0];
  const values = (measurement: typeof whole, range: TimelineRequest['range']) =>
    Object.fromEntries(
      reportMetricIds.map((metric) => {
        const value = isCoreMetric(metric)
          ? measurement.metrics[metric]
          : measurement.additionalMetrics[metric];
        return [metric, empty ? value : withTimelineAvailability(value, range, available)];
      }),
    ) as Record<ReportMetric, Count>;
  return {
    kind: 'contributions',
    source: { source: source.source, scenarioId: source.scenarioId, asOf: source.asOf },
    request,
    scope: {
      selection: scope.selection,
      focus: scope.focus,
      includedAccountCount: scope.accounts.length,
      subject:
        selectedFocus.kind === 'contributor'
          ? source.accounts.find((row) => row.id === selectedFocus.accountId)!
          : selectedFocus.kind === 'company'
            ? scope.companyFor(selectedFocus.companyId)
            : null,
      companyAttribution: source.companyAttribution,
    },
    rows: measurements.map((measurement, index) => ({
      interval: intervals[index],
      values: values(measurement, intervals[index].covered),
    })),
    summary: values(whole, request.range),
  };
}
export function contributionTimelineDetail(
  report: ContributionTimeline,
  metric: ReportMetric,
  intervalId?: string,
): ContributionTimelineDetail | null {
  if (!isReportMetric(metric)) throw Error('Unknown contribution timeline metric');
  const row =
    intervalId === undefined
      ? undefined
      : report.rows.find((row) => row.interval.id === intervalId);
  if (intervalId !== undefined && !row) throw Error('Unknown timeline interval');
  const value = (row?.values ?? report.summary)[metric];
  if (value.value === null) return null;
  return {
    kind: 'contribution',
    source: report.source,
    metric,
    basis: contributionMetricBasis(metric),
    range: row?.interval.covered ?? report.request.range,
    selection: report.scope.selection,
    focus: report.scope.focus,
  };
}
