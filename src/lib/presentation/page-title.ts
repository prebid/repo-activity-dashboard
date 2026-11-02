import type { ContributionArea } from '@/models/contribution-page';
import { isReportMetric, reportMetricLabel } from '@/models/contribution-metrics';
import type { OverviewRepository } from '@/models/repository-overview';
import { repositoryTimelineMetricSchema } from '@/models/repository-timeline';
import { companyBreakdownLabels } from './contribution-navigation';
import type { DrilldownSelection } from '@/models/repository-drilldown';
import { readDrilldownSelection, readRepositoryDrilldown } from './repository-drilldown';
import { isRecordSelection } from './repository-records';
import { parseQuery } from './url/codec';
import {
  authorRecordSelection,
  isAuthorSelection,
  readAuthorAccountSegment,
} from './repository-author-records';
import { insightTitles } from './repository-insights';
import type { InsightSelection } from '@/models/repository-insights';
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

/** A list's or insight's title, unless it is the repository's default open-PR list. */
function drilldownTitle(repository: OverviewRepository, selection: DrilldownSelection): string {
  if (isRecordSelection(selection))
    return selection.scope === 'current' && selection.metric === 'totalOpenPrs'
      ? repository.name
      : titleFrom(recordListTitle(selection), repository.name);
  // Every other drilldown is a period insight.
  return titleFrom(insightTitles[(selection as InsightSelection).metric], repository.name);
}
/**
 * Names the list or supporting view only when it is not the repository's default open-PR list. A
 * canonical address's period resolves at `asOf`; a legacy link is read by the frozen readers, as
 * its redirect body is titled.
 */
/** A Timeline supporting view's metric: `detail`, or the old `timeline.detail` of a legacy link. */
function supportDetail(params: URLSearchParams): string | null {
  return params.get('detail') ?? params.get('timeline.detail');
}
export function repositoryPageTitle(
  repository: OverviewRepository,
  params: URLSearchParams,
  asOf: string,
): string {
  if (params.has('timeline')) {
    const metric = repositoryTimelineMetricSchema.safeParse(supportDetail(params));
    return metric.success
      ? titleFrom(repositoryMetricName(metric.data), 'Timeline', repository.name)
      : titleFrom('Timeline', repository.name);
  }
  const parsed = parseQuery('/repos/[slug]', params);
  if (parsed.kind === 'canonical') {
    const selection = readDrilldownSelection(parsed.values, repository, asOf);
    return selection ? drilldownTitle(repository, selection) : repository.name;
  }
  const entry = readRepositoryPageEntry(params, repository);
  if (entry.status === 'records' || entry.status === 'supporting')
    return drilldownTitle(repository, entry.drilldown.selection);
  return repository.name;
}

export function repositoryAuthorPageTitle(
  repository: OverviewRepository,
  accountSegment: string,
  params: URLSearchParams,
  asOf: string,
): string {
  const author = readAuthorAccountSegment(accountSegment);
  const parsed = parseQuery('/repos/[slug]/authors/[account]', params);
  const legacy = parsed.kind === 'canonical' ? null : readRepositoryDrilldown(params, repository);
  const selection =
    parsed.kind === 'canonical'
      ? readDrilldownSelection(parsed.values, repository, asOf)
      : legacy?.status === 'valid'
        ? legacy.value.selection
        : null;
  if (author === null || !selection || !isAuthorSelection(selection)) return repository.name;
  return titleFrom(recordListTitle(authorRecordSelection(selection), author), repository.name);
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
    const metric = supportDetail(params);
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
