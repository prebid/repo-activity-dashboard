import type { ContributionArea } from '@/models/contribution-page';
import type { ContributionLens } from '@/models/contribution-lens';
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

/**
 * A contribution report's subject: its area, a contributor or a company. The people overview is
 * "Reviewers" in the Reviewers lens.
 */
export function contributionSubjectTitle(
  area: ContributionArea,
  subject: { name: string } | null | 'overview',
  lens: ContributionLens = 'contributors',
): string {
  if (subject === 'overview')
    return area === 'companies' ? 'Companies' : lens === 'reviewers' ? 'Reviewers' : 'Contributors';
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
 * The lens a contribution request names in its raw query, valid or not, as the masthead reads it:
 * the document title and the invalid view use it, so all three agree on a rejected address.
 */
export function contributionQueryLens(params: Pick<URLSearchParams, 'get'>): ContributionLens {
  return params.get('lens') === 'reviewers' ? 'reviewers' : 'contributors';
}
/**
 * Names the view first, then its subject; only the default view of a focused report adds its
 * area. In the Reviewers lens (`lens`, else the query's `lens`) a title that does not already end
 * with "Reviewers" gains " · Reviewers" (decision D13).
 */
export function contributionPageTitle(
  area: ContributionArea,
  subject: { name: string } | null | 'overview',
  params: URLSearchParams,
  lens: ContributionLens = contributionQueryLens(params),
): string {
  const title = contributionViewTitle(area, subject, params, lens);
  return lens === 'reviewers' && !title.endsWith('Reviewers')
    ? titleFrom(title, 'Reviewers')
    : title;
}
function contributionViewTitle(
  area: ContributionArea,
  subject: { name: string } | null | 'overview',
  params: URLSearchParams,
  lens: ContributionLens,
): string {
  const subjectTitle = contributionSubjectTitle(area, subject, lens);
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
  return titleFrom(subjectTitle, contributionSubjectTitle(area, 'overview', lens));
}
