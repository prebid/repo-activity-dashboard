import { repositoryCatalog } from '@/config/repositories';
import { contributionUrlFits } from './contribution-return';
import { parseQuery } from './url/codec';
import { periodSelection } from './url/period';
import { repositoryMatrixSummaryHref } from './repository-matrix-summary';
import { readTimelineView } from './timeline-controls';
import { matrixRepositoryTimelineHref } from './timeline-navigation';
import { timelineSupportHref } from './timeline-support-query';
import { repositoryTimelineMetricIds } from '@/models/repository-timeline';
import type { TimelineSourceIdentity } from '@/models/reporting-timeline';

export { repositoryMatrixSummaryHref };

/**
 * A canonical Summary href in the pre-codec form the matrix Timeline still reads for its Summary
 * tab: catalog IDs, period keys and table keys. The Summary answers it with a 307 to the canonical
 * form, so the round trip keeps the scope and both tables' sorts and pages. Null for an address
 * that is not a canonical Summary.
 */
export function legacySummaryHref(summaryHref: string): string | null {
  const url = new URL(summaryHref, 'https://dashboard.invalid');
  const parsed =
    url.origin === 'https://dashboard.invalid' && url.pathname === '/repos'
      ? parseQuery('/repos', url.search)
      : null;
  if (parsed?.kind !== 'canonical' || parsed.screen !== 'summary') return null;
  const { values } = parsed;
  const params = new URLSearchParams();
  const list = (name: string, items: readonly string[]) => {
    if (!items.length) params.set(name, '');
    for (const item of items) params.append(name, item);
  };
  if (typeof values.repo === 'object')
    list(
      'repo',
      values.repo.map((slug) => repositoryCatalog.find((row) => row.slug === slug)?.id ?? slug),
    );
  for (const [name, suffix] of [
    ['period', ''],
    ['period2', '2'],
  ] as const) {
    const selection = typeof values[name] === 'string' ? periodSelection(values[name]) : null;
    if (!selection) continue;
    params.set('period' + suffix, selection.kind === 'preset' ? selection.preset : 'custom');
    if (selection.kind === 'custom') {
      params.set('from' + suffix, selection.from);
      params.set('through' + suffix, selection.through);
    }
  }
  // The frozen reader takes a second period only beside an explicit first one.
  if (params.has('period2') && !params.has('period')) params.set('period', 'this-month');
  if (typeof values.age === 'object') list('age', values.age);
  for (const [table, sort, page] of [
    ['backlog', 'bsort', 'bpage'],
    ['activity', 'asort', 'apage'],
  ] as const) {
    const token = values[sort];
    if (typeof token === 'string') {
      params.set(table + '.sort', token.replace(/^-/, ''));
      params.set(table + '.dir', token.startsWith('-') ? 'desc' : 'asc');
    }
    if (typeof values[page] === 'string') params.set(table + '.page', values[page]);
  }
  return params.size ? '/repos?' + params.toString() : '/repos';
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
  const legacy = legacySummaryHref(summaryHref);
  if (legacy === null) return null;
  const summary = repositoryMatrixSummaryHref(legacy);
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
