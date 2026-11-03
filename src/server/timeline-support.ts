import 'server-only';
import { requireViewer } from '@/lib/auth/viewer';
import { loadTimelineView } from './timeline-report';
import { routeClock } from './timeline-preview';
import { readTimelineSupportQuery } from '@/lib/presentation/timeline-support-query';
import {
  selectContributionTimelineSupport,
  selectRepositoryTimelineSupport,
} from '@/lib/presentation/timeline-support';
import { repositoryTimelineSample } from '@/mocks/repository-timeline';
import { contributionRecords } from './activity-contributions';
import { repositoryRecords } from './activity-database';
import { readTimelineView } from '@/lib/presentation/timeline-controls';
import { allRepositorySlugs } from '@/lib/presentation/url/defaults';
import { resolveBack, viewHref, type UrlView } from '@/lib/presentation/url/back';
import { timelineParams, timelineParentValues } from '@/lib/presentation/url/timeline';
import type { ContributionSampleScenario } from '@/models/contribution-page';
import type { RepositoryTimelineScenario } from '@/mocks/repository-timeline';
import type { TimelineSupportContext } from '@/models/timeline-support';
import { defaultRepositoryFilters } from '@/lib/presentation/repository-page-query';
import type { Measurement } from '@/models/reporting-measurement';
import { normalizeGithubLogin } from '@/models/github-account';
const invalid = (
  message = 'This supporting view is invalid, unavailable or no longer matches its timeline.',
  parentHref?: string,
) => ({ status: 'invalid' as const, message, parentHref });
const text = (value: unknown) => (typeof value === 'string' ? value : undefined);
/**
 * A Timeline supporting view: one cell's records, from the view's registry values. It inherits its
 * Timeline's values and frames; a matrix-origin view also needs its Timeline's matrix frame.
 */
export async function loadTimelineSupport(view: UrlView) {
  const viewer = await requireViewer();
  const params = timelineParams(view.route, view.values, routeClock(view.route)),
    query = params && readTimelineSupportQuery(params),
    href = viewHref(view, 'level');
  if (!query || href === null) return invalid();
  const parent: UrlView = { ...view, values: timelineParentValues(view.values) };
  // The Timeline holds a subset of the supporting view's values and its frames, so it fits.
  const parentHref = viewHref(parent, 'level')!;
  const loaded = await loadTimelineView(parent);
  if (loaded.status !== 'ready') return invalid();
  const unavailable = () => invalid(undefined, parentHref);
  if (loaded.category === 'matrix') return unavailable();
  const { report } = loaded,
    interval = report.rows.find((row) => row.interval.id === query.interval);
  if (
    !interval ||
    report.source.scenarioId !== query.revision ||
    report.source.asOf !== query.clock
  )
    return unavailable();
  const values = interval.values as Partial<Record<string, Measurement>>;
  // Only the report's own metrics; inherited names such as `constructor` are not metrics.
  const measurement = Object.hasOwn(values, query.metric) ? values[query.metric] : undefined;
  if (!measurement || measurement.value === null) return unavailable();
  let back = parentHref;
  if (query.origin === 'matrix') {
    if (loaded.category !== 'repository') return unavailable();
    if (
      JSON.stringify(loaded.report.scope.filters) !==
      JSON.stringify(defaultRepositoryFilters(loaded.report.scope.recordKind))
    )
      return unavailable();
    const [matrix] = resolveBack(parent);
    if (!matrix?.available || matrix.view.route !== '/repos') return unavailable();
    const matrixParams = timelineParams('/repos', matrix.view.values, report.source.asOf);
    if (!matrixParams) return unavailable();
    try {
      const read = readTimelineView(matrixParams, 'matrix', report.source.asOf);
      const slugs = matrix.view.values.repo;
      const selected = typeof slugs === 'object' ? slugs : allRepositorySlugs();
      if (
        !read.metricIds.includes(query.metric) ||
        read.request.grouping !== report.request.grouping ||
        JSON.stringify(read.request.range) !== JSON.stringify(report.request.range) ||
        !selected.includes(loaded.report.scope.repository.slug) ||
        text(matrix.view.values.sample) !== text(parent.values.sample) ||
        matrix.view.values.gap !== parent.values.gap
      )
        return unavailable();
    } catch {
      return unavailable();
    }
    back = matrix.href;
  }
  const context: TimelineSupportContext = {
    source: report.source,
    interval: interval.interval,
    metric: query.metric,
    measurement,
    scope: parentHref,
    parentHref: back,
    href,
  };
  const gap = parent.values.gap === true,
    sample = text(parent.values.sample) ?? 'reference';
  if (loaded.category === 'contribution') {
    if (query.author) return unavailable();
    const source = contributionRecords().timeline(sample as ContributionSampleScenario, gap);
    return {
      status: 'ready' as const,
      viewerId: viewer.id,
      detail: selectContributionTimelineSupport(source, loaded.report, context),
    };
  }
  const source = repositoryTimelineSample(
    loaded.report.scope.recordKind,
    loaded.report.scope.repository.id,
    sample as RepositoryTimelineScenario,
    gap,
    repositoryRecords(),
  );
  if (query.author) {
    const authors = selectRepositoryTimelineSupport(source, loaded.report, context);
    if (
      authors.kind !== 'authors' ||
      !authors.rows.some((row) => row.id === normalizeGithubLogin(query.author!))
    )
      return unavailable();
  }
  return {
    status: 'ready' as const,
    viewerId: viewer.id,
    detail: selectRepositoryTimelineSupport(source, loaded.report, context, query.author),
  };
}
