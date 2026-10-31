import { safeReturnPath } from './navigation';
import { contributionUrlFits } from './contribution-return';
import { overviewSummarySearch } from './overview-settings';

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
