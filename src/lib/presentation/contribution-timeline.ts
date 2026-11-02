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
import type { ContributionArea, ContributionSampleScenario } from '@/models/contribution-page';
import type { ContributionSettings } from '@/models/contribution-settings';
import {
  contributionReturnHref,
  contributionUrlFits,
  withContributionReturn,
} from './contribution-return';
import { contributionHref } from './contribution-navigation';
import { writeContributionSettings } from './contribution-settings';
import { contributionColumnVisibility, contributionScopeInput } from './contribution-url';
import { writeTableColumns } from './table-column-preferences';
import { writeTableQuery } from './table-query';
import { contributionTimelineEntry } from './timeline-navigation';
import { resolveBack, type UrlView } from './url/back';
import { encodeQueryValue, legacySearchParams, queryPairs } from './url/codec';
import { columnTableOf, contributionTableOf } from './url/defaults';
import { routePath, screenOf } from './url/registry';

const origin = 'https://dashboard.invalid';

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
  const account =
    selectedFocus.kind === 'contributor'
      ? source.accounts.find((row) => row.id === selectedFocus.accountId)!
      : null;
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
        account ??
        (selectedFocus.kind === 'company' ? scope.companyFor(selectedFocus.companyId) : null),
      ...(account ? { company: scope.companyFor(account.companyId) } : {}),
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

/**
 * An overview's Over time in another area: the same scope and Timeline view, without the return
 * trail, whose report belongs to the area being left. Null when the URL does not fit.
 */
export function contributionTimelineAreaHref(href: string, area: ContributionArea): string | null {
  const query = legacySearchParams(
    queryPairs(new URL(href, origin).search).filter(
      ([key]) => key !== 'nav' && key !== 'returnTo' && key !== 'back',
    ),
  ).toString();
  const result = '/' + area + (query ? '?' + query : '');
  return contributionUrlFits(result) ? result : null;
}

/** A report view in the legacy form the Over time screens read, or null for another view. */
function legacyReportHref(view: UrlView): string | null {
  const { route, segments, values } = view;
  const screen = screenOf(route, values);
  if (screen !== 'contributionOverview' && screen !== 'contributionDetail') return null;
  // A rendered report's period, columns and scope are valid, or the page is the invalid view.
  const table = columnTableOf(route, values)!;
  const settings = contributionScopeInput(values)!;
  const kind = contributionTableOf(route, values);
  const text = (name: string) => (typeof values[name] === 'string' ? values[name] : '');
  let query = writeContributionSettings(
    (['sample', 'view', 'metric'] as const)
      .filter((name) => text(name))
      .map((name) => name + '=' + encodeQueryValue(text(name)))
      .join('&'),
    settings,
  );
  const sort = text('sort');
  query = writeTableQuery(
    query,
    kind === 'contributors' || kind === 'companies' ? 'report' : kind,
    {
      search: text('q'),
      ...(sort && { sort: sort.replace(/^-/, ''), descending: sort.startsWith('-') }),
      page: Number(text('page') || 1),
    },
  );
  if (values.cols)
    query = writeTableColumns(query, kind, contributionColumnVisibility(route, values)!, table.ids);
  if (values.zero === 'hide') query += '&members.zero=hide';
  return routePath(route, segments) + '?' + query;
}
/**
 * The Over time link of a report view. The Over time screens still read legacy keys, so the link
 * is their legacy form, carrying the report and the reports above it as its return trail; the
 * report's Report tab and "Back to report" links are answered with a 307 to the canonical form.
 * Null when the link does not fit.
 */
export function contributionTimelineHref(
  view: UrlView,
  settings: ContributionSettings,
): string | null {
  const report = legacyReportHref(view);
  if (!report) return null;
  const chain: string[] = [];
  for (const ancestor of resolveBack(view)) {
    const legacy = ancestor.available ? legacyReportHref(ancestor.view) : null;
    if (!legacy) break;
    chain.push(legacy);
  }
  let parent: string | undefined;
  for (const href of chain.reverse()) parent = withContributionReturn(href, parent) ?? href;
  const trailed = withContributionReturn(report, parent) ?? withContributionReturn(report);
  return trailed && contributionTimelineEntry(trailed, settings);
}

/**
 * "Back to report" on a contributor or company Over time: where the report its Report tab opens
 * returns to, which is the parent in that report's trail, or else its area with the same scope.
 */
export function contributionTimelineReturnHref(
  reportHref: string,
  area: ContributionArea,
  sample: ContributionSampleScenario,
  settings: ContributionSettings,
): string {
  return contributionReturnHref(
    new URL(reportHref, origin).searchParams,
    contributionHref(area, sample, undefined, settings) ?? '/' + area,
  );
}
