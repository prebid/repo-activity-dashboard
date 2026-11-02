// The Summary's Timeline tab: the matrix for the Summary's repositories, with the Summary as its
// parent. From a Summary at v1 defaults the link is `/repos?timeline`.
import { childViewHref, viewOf, type UrlView } from './url/back';
import { savedTimelineLink } from './url/legacy/timeline-state';
import type { UrlValues } from './url/registry';
import { allRepositorySlugs } from './url/defaults';
import { matrixRepositoryTimelineHref } from './timeline-navigation';
import { timelineSupportHref } from './timeline-support-query';
import { repositoryTimelineMetricIds } from '@/models/repository-timeline';
import type { TimelineSourceIdentity } from '@/models/reporting-timeline';
import type { TimelineViewState } from '@/models/timeline-controls';

/**
 * The matrix entry for the selected repositories, from the Summary at `summaryHref` (its
 * canonical href). Null when the Summary is not canonical or the matrix's own child links (a
 * repository Timeline and its supporting records) would not fit.
 */
export function repositoryMatrixEntryHref(
  repositories: readonly { id: string; slug: string }[],
  summaryHref: string,
  source: TimelineSourceIdentity,
  /** The viewer's saved matrix view (decision C3); the Summary's repositories stay explicit. */
  saved: string | null = null,
): string | null {
  const summary = viewOf(summaryHref);
  if (summary?.route !== '/repos') return null;
  const all = allRepositorySlugs();
  const slugs = all.filter((slug) => repositories.some((row) => row.slug === slug));
  const own: UrlValues = {
    timeline: true,
    ...(slugs.length === all.length ? {} : { repo: slugs }),
  };
  const matrix: UrlView = {
    route: '/repos',
    segments: {},
    // An entry (all repositories) takes the saved view where it opens; a narrower link carries it.
    values: own.repo ? savedTimelineLink('/repos', own, [], saved, source.asOf) : own,
  };
  const href = childViewHref(summary, matrix);
  return href !== null && childLinksFit(href, repositories, source) ? href : null;
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
  const metric = longest(repositoryTimelineMetricIds);
  const child = matrixRepositoryTimelineHref(
    { view: { metric } as TimelineViewState },
    longest(repositories.map((row) => row.slug)),
    href,
    metric,
  );
  // 'two-months' names the longest interval id of any grouping.
  const interval = 'two-months:' + source.asOf.slice(0, 8) + '01T00:00:00.000Z';
  return child !== null && timelineSupportHref(child, source, metric, interval, 'matrix') !== null;
}
