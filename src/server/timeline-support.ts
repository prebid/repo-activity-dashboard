import 'server-only';
import { requireViewer } from '@/lib/auth/viewer';
import { loadTimelineReport } from './timeline-report';
import {
  timelineParentQuery,
  readTimelineSupportQuery,
} from '@/lib/presentation/timeline-support-query';
import {
  selectContributionTimelineSupport,
  selectRepositoryTimelineSupport,
} from '@/lib/presentation/timeline-support';
import { contributionTimelineSample } from '@/mocks/contribution-timeline';
import { repositoryTimelineSample } from '@/mocks/repository-timeline';
import { readTimelineView } from '@/lib/presentation/timeline-controls';
import { repositoryCatalog } from '@/config/repositories';
import { safeTimelineParent } from '@/lib/presentation/timeline-navigation';
import type { ContributionSampleScenario } from '@/models/contribution-page';
import type { RepositoryTimelineScenario } from '@/mocks/repository-timeline';
import type { TimelineSupportContext } from '@/models/timeline-support';
import { contributionUrlFits } from '@/lib/presentation/contribution-return';
import { defaultRepositoryFilters } from '@/lib/presentation/repository-page-query';
import type { Measurement } from '@/models/reporting-measurement';
const invalid = (
  message = 'This supporting view is invalid, unavailable or no longer matches its timeline.',
  parentHref?: string,
) => ({ status: 'invalid' as const, message, parentHref });
export async function loadTimelineSupport(path: string, params: URLSearchParams) {
  const viewer = await requireViewer(),
    query = readTimelineSupportQuery(params);
  if (!query || !contributionUrlFits(path + '?' + params.toString())) return invalid();
  const parentParams = timelineParentQuery(params),
    parentHref = path + '?' + parentParams.toString();
  const loaded = await loadTimelineReport(parentHref);
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
    const candidate = safeTimelineParent(parentParams.get('timelineParent'), path);
    if (!candidate || new URL(candidate, 'https://dashboard.invalid').pathname !== '/repos')
      return unavailable();
    const matrixParams = new URL(candidate, 'https://dashboard.invalid').searchParams;
    try {
      const matrix = readTimelineView(matrixParams, 'matrix', report.source.asOf),
        ids = matrixParams.has('repo')
          ? matrixParams.getAll('repo')
          : repositoryCatalog.filter((row) => row.enabled).map((row) => row.id);
      if (
        !matrix.metricIds.includes(query.metric) ||
        matrix.request.grouping !== report.request.grouping ||
        JSON.stringify(matrix.request.range) !== JSON.stringify(report.request.range) ||
        !ids.includes(loaded.report.scope.repository.id) ||
        (matrixParams.get('sample') ?? 'reference') !==
          (parentParams.get('sample') ?? 'reference') ||
        (matrixParams.get('timeline.gap') ?? '0') !== (parentParams.get('timeline.gap') ?? '0')
      )
        return unavailable();
    } catch {
      return unavailable();
    }
    back = candidate;
  }
  const context: TimelineSupportContext = {
    source: report.source,
    interval: interval.interval,
    metric: query.metric,
    measurement,
    scope: parentHref,
    parentHref: back,
    href: path + '?' + params.toString(),
  };
  const gap = parentParams.get('timeline.gap') === '1';
  if (loaded.category === 'contribution') {
    if (query.author) return unavailable();
    const source = contributionTimelineSample(
      (parentParams.get('sample') ?? 'reference') as ContributionSampleScenario,
      gap,
    );
    return {
      status: 'ready' as const,
      viewerId: viewer.id,
      detail: selectContributionTimelineSupport(source, loaded.report, context),
    };
  }
  const source = repositoryTimelineSample(
    loaded.report.scope.recordKind,
    loaded.report.scope.repository.id,
    (parentParams.get('sample') ?? 'reference') as RepositoryTimelineScenario,
    gap,
  );
  if (query.author) {
    const authors = selectRepositoryTimelineSupport(source, loaded.report, context);
    if (
      authors.kind !== 'authors' ||
      !authors.rows.some((row) => row.account === query.author!.toLowerCase())
    )
      return unavailable();
  }
  return {
    status: 'ready' as const,
    viewerId: viewer.id,
    detail: selectRepositoryTimelineSupport(source, loaded.report, context, query.author),
  };
}
