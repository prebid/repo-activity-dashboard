import { safeReturnPath } from './navigation';
import { contributionUrlFits } from './contribution-return';
import { overviewSummarySearch } from './overview-settings';

/** One bounded Summary snapshot, never a recursively nested timeline URL. */
export function repositoryMatrixSummaryHref(value: string | null | undefined): string | null {
  if (!value) return '/repos';
  if (!contributionUrlFits(value) || safeReturnPath(value) !== value) return null;
  const url = new URL(value, 'https://dashboard.invalid');
  return url.pathname === '/repos' &&
    !url.searchParams.has('timeline') &&
    !url.searchParams.has('summary')
    ? value
    : null;
}
export function repositoryMatrixEntryHref(
  repositoryIds: readonly string[],
  summaryHref: string,
): string | null {
  const valid = repositoryMatrixSummaryHref(summaryHref);
  if (valid === null) return null;
  // Child links nest this snapshot twice, so it keeps only what the Summary page reads.
  const kept = overviewSummarySearch(new URL(valid, 'https://dashboard.invalid').search);
  const summary = kept ? '/repos?' + kept : '/repos';
  const params = new URLSearchParams({ timeline: '1' });
  const ids = [...new Set(repositoryIds)].sort();
  if (!ids.length) params.set('repo', '');
  else for (const id of ids) params.append('repo', id);
  if (summary !== '/repos') params.set('summary', summary);
  const href = '/repos?' + params.toString();
  return contributionUrlFits(href) ? href : null;
}
