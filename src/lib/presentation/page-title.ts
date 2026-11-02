import type { ContributionArea } from '@/models/contribution-page';
import { isReportMetric, reportMetricLabel } from '@/models/contribution-metrics';
import type { OverviewRepository } from '@/models/repository-overview';
import { repositoryTimelineMetricSchema } from '@/models/repository-timeline';
import { companyBreakdownLabels } from './contribution-navigation';
import { readRepositoryDrilldown } from './repository-drilldown';
import {
  authorRecordSelection,
  isAuthorSelection,
  readAuthorAccountSegment,
} from './repository-author-records';
import { insightTitles, isInsightSelection } from './repository-insights';
import { repositoryMetricName } from './repository-metric-text';
import { readRepositoryPageEntry } from './repository-page-entry';
import { recordListTitle } from './repository-records';

/** The document title wherever a page sets none, such as a redirect body. */
export const defaultPageTitle = 'Prebid';
const allRepositories = 'All repositories';
const titleFrom = (...parts: string[]) => parts.join(' · ');

/** A contribution report's subject: its area, a contributor or a company. */
export function contributionSubjectTitle(
  area: ContributionArea,
  subject: { name: string } | null | 'overview',
): string {
  if (subject === 'overview') return area === 'contributors' ? 'Contributors' : 'Companies';
  return subject?.name ?? 'Unmapped company';
}

export function repositoriesPageTitle(params: URLSearchParams): string {
  return params.has('timeline') ? titleFrom('Timeline', allRepositories) : allRepositories;
}

/** Names the list or supporting view only when it is not the repository's default open-PR list. */
export function repositoryPageTitle(
  repository: OverviewRepository,
  params: URLSearchParams,
): string {
  if (params.has('timeline')) {
    const metric = repositoryTimelineMetricSchema.safeParse(params.get('timeline.detail'));
    return metric.success
      ? titleFrom(repositoryMetricName(metric.data), 'Timeline', repository.name)
      : titleFrom('Timeline', repository.name);
  }
  const entry = readRepositoryPageEntry(params, repository);
  if (entry.status === 'records') {
    const { selection } = entry.drilldown;
    return selection.scope === 'current' && selection.metric === 'totalOpenPrs'
      ? repository.name
      : titleFrom(recordListTitle(selection), repository.name);
  }
  if (entry.status === 'supporting' && isInsightSelection(entry.drilldown.selection))
    return titleFrom(insightTitles[entry.drilldown.selection.metric], repository.name);
  return repository.name;
}

export function repositoryAuthorPageTitle(
  repository: OverviewRepository,
  accountSegment: string,
  params: URLSearchParams,
): string {
  const author = readAuthorAccountSegment(accountSegment);
  const parsed = readRepositoryDrilldown(params, repository);
  if (author === null || parsed.status !== 'valid' || !isAuthorSelection(parsed.value.selection))
    return repository.name;
  return titleFrom(
    recordListTitle(authorRecordSelection(parsed.value.selection), author),
    repository.name,
  );
}

/**
 * Names the view first, then its subject; only the default view of a focused report adds its
 * area.
 */
export function contributionPageTitle(
  area: ContributionArea,
  subject: { name: string } | null | 'overview',
  params: URLSearchParams,
): string {
  const subjectTitle = contributionSubjectTitle(area, subject);
  if (params.has('timeline')) {
    const metric = params.get('timeline.detail');
    return metric !== null && isReportMetric(metric)
      ? titleFrom(reportMetricLabel(metric), 'Over time', subjectTitle)
      : titleFrom('Over time', subjectTitle);
  }
  const metric = params.get('metric');
  if (metric !== null && isReportMetric(metric))
    return titleFrom(reportMetricLabel(metric), subjectTitle);
  if (subject === 'overview') return subjectTitle;
  if (area === 'companies' && params.get('view') === 'repositories')
    return titleFrom(companyBreakdownLabels.repositories, subjectTitle);
  return titleFrom(subjectTitle, contributionSubjectTitle(area, 'overview'));
}
