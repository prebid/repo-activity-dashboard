import type {
  ContributionTimeline,
  ContributionTimelineSource,
} from '@/models/contribution-timeline';
import type { ContributionContext } from '@/models/contributions';
import type { RepositoryTimeline, RepositoryTimelineSource } from '@/models/repository-timeline';
import type { TimelineSupport, TimelineSupportContext } from '@/models/timeline-support';
import type { ReportMetric } from '@/models/contribution-metrics';
import { contributionScope } from './contribution-scope';
import { contributionDetailRows } from './contribution-detail-rows';
import { contributionTimelineDetail } from './contribution-timeline';
import { repositoryTimelineDetail, repositoryTimelineSupportingRows } from './repository-timeline';
import { normalizeGithubLogin } from '@/models/github-account';
import { customPeriodForRange } from './reporting-period';

export function selectContributionTimelineSupport(
  source: ContributionTimelineSource,
  report: ContributionTimeline,
  context: TimelineSupportContext,
): TimelineSupport {
  const descriptor = contributionTimelineDetail(
    report,
    context.metric as ReportMetric,
    context.interval.id,
  );
  if (
    !descriptor ||
    source.contributions.scenarioId !== descriptor.source.scenarioId ||
    source.contributions.asOf !== descriptor.source.asOf
  )
    throw Error('Supporting contribution source is unavailable or stale.');
  const scope = contributionScope(source.contributions, descriptor.selection, descriptor.focus);
  const detailContext: ContributionContext = {
    ...descriptor.source,
    period: customPeriodForRange(context.interval.covered),
    range: context.interval.covered,
    companyAttribution: 'current-mapping',
    selection: scope.selection,
    focus: scope.focus,
    includedAccountCount: scope.accounts.length,
  };
  const rows = contributionDetailRows(
    scope.source,
    detailContext,
    descriptor.metric,
    scope.accounts,
  );
  return {
    kind: 'contribution',
    context,
    title:
      report.scope.subject?.name ??
      (report.scope.focus.kind === 'company' ? 'Unmapped company' : 'Contributions'),
    details: {
      context: detailContext,
      metric: descriptor.metric,
      basis: descriptor.basis,
      measurement: context.measurement,
      rows,
      distinctRecords: new Set(rows.map((row) => row.record.id)).size,
    },
  };
}
export function selectRepositoryTimelineSupport(
  source: RepositoryTimelineSource,
  report: RepositoryTimeline,
  context: TimelineSupportContext,
  author?: string,
): TimelineSupport {
  const descriptor = repositoryTimelineDetail(
    report,
    context.metric as import('@/models/repository-timeline').RepositoryTimelineMetric,
    context.interval.id,
  );
  if (!descriptor) throw Error('No supporting records for an unavailable value.');
  const rows = repositoryTimelineSupportingRows(source, descriptor);
  const base = { context, repository: source.repository, recordKind: source.kind, descriptor };
  if (descriptor.basis === 'distinct-authors') {
    const groups = new Map<string, import('@/models/timeline-support').TimelineAuthorRow>();
    for (const row of rows) {
      const id = normalizeGithubLogin(row.author),
        prior = groups.get(id);
      if (prior) prior.recordCount++;
      else
        groups.set(id, {
          id,
          account: row.author,
          profileUrl: row.authorUrl,
          recordCount: 1,
          accountType: row.authorType ?? 'unknown',
        });
    }
    if (!author) return { ...base, kind: 'authors', rows: [...groups.values()] };
    const match = groups.get(normalizeGithubLogin(author));
    if (!match) throw Error('Unknown author in this interval.');
    // Titles and exports show the observed login, whatever casing the URL used.
    return {
      ...base,
      kind: 'repository',
      author: match.account,
      rows: rows.filter((row) => normalizeGithubLogin(row.author) === match.id),
    };
  }
  if (author) throw Error('Author drilldowns require a unique-author metric.');
  return { ...base, kind: 'repository', rows };
}
