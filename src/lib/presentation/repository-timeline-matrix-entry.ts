import { safeReturnPath } from './navigation';
import { contributionUrlFits } from './contribution-return';
import { overviewSummarySearch } from './overview-settings';
import { readTimelineView } from './timeline-controls';
import { matrixRepositoryTimelineHref } from './timeline-navigation';
import { timelineSupportHref } from './timeline-support-query';
import { repositoryTimelineMetricIds } from '@/models/repository-timeline';
import type { TimelineSourceIdentity } from '@/models/reporting-timeline';

/** One bounded Summary snapshot, reduced to what the Summary page reads; never a Timeline URL. */
export function repositoryMatrixSummaryHref(value: string | null | undefined): string | null {
  if (!value) return '/repos';
  if (!contributionUrlFits(value) || safeReturnPath(value) !== value) return null;
  const url = new URL(value, 'https://dashboard.invalid');
  if (
    url.pathname !== '/repos' ||
    url.searchParams.has('timeline') ||
    url.searchParams.has('summary')
  )
    return null;
  const kept = overviewSummarySearch(url.search);
  return kept ? '/repos?' + kept : '/repos';
}
/**
 * The matrix entry for the selected repositories. Child links nest this URL, so when the longest
 * child would not fit, the Summary return context is dropped first; no entry is offered only when
 * even the bare entry leaves no room for its child links.
 */
export function repositoryMatrixEntryHref(
  repositories: readonly { id: string; slug: string }[],
  summaryHref: string,
  source: TimelineSourceIdentity,
): string | null {
  const summary = repositoryMatrixSummaryHref(summaryHref);
  if (summary === null) return null;
  const params = new URLSearchParams({ timeline: '1' });
  const ids = [...new Set(repositories.map((row) => row.id))].sort();
  if (!ids.length) params.set('repo', '');
  else for (const id of ids) params.append('repo', id);
  for (const kept of summary === '/repos' ? [summary] : [summary, '/repos']) {
    const entry = new URLSearchParams(params);
    if (kept !== '/repos') entry.set('summary', kept);
    const href = '/repos?' + entry.toString();
    if (contributionUrlFits(href) && childLinksFit(href, repositories, source)) return href;
  }
  return null;
}
/**
 * Whether the longest repository Timeline link built from a matrix entry, and its supporting-record
 * link, fit the URL budget. The Summary's data identity stands in for the matrix's, since both read
 * one data revision.
 */
function childLinksFit(
  href: string,
  repositories: readonly { slug: string }[],
  source: TimelineSourceIdentity,
): boolean {
  if (!repositories.length) return true;
  const longest = (values: readonly string[]) =>
    values.reduce((a, b) => (encodeURIComponent(b).length > encodeURIComponent(a).length ? b : a));
  const { view } = readTimelineView(new URLSearchParams(href.split('?')[1]), 'matrix', source.asOf);
  const metric = longest(repositoryTimelineMetricIds);
  const child = matrixRepositoryTimelineHref(
    { view },
    longest(repositories.map((row) => row.slug)),
    href,
    metric,
  );
  // 'two-months' names the longest interval id of any grouping.
  const interval = 'two-months:' + source.asOf.slice(0, 8) + '01T00:00:00.000Z';
  return child !== null && timelineSupportHref(child, source, metric, interval, 'matrix') !== null;
}
