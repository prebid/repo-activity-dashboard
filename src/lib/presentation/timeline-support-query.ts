import { timelineParentQuery } from './url/legacy/timeline';
export {
  readTimelineSupportQuery,
  timelineParentQuery,
  timelineSupportValueLimit,
} from './url/legacy/timeline';
import { canonicalRoutePath } from './navigation';

import { contributionUrlFits } from './contribution-return';
import { safeReturnPath } from './navigation';
import type { TimelineSourceIdentity } from '@/models/reporting-timeline';
export function timelineSupportScopeKey(href: string) {
  const url = new URL(href, 'https://dashboard.invalid');
  for (const key of [...url.searchParams.keys()])
    if (/^support\.(authors|records)\./.test(key)) url.searchParams.delete(key);
  url.searchParams.sort();
  return canonicalRoutePath(url.pathname) + '?' + url.searchParams.toString();
}
export function timelineSupportHref(
  parent: string,
  source: TimelineSourceIdentity,
  metric: string,
  interval: string,
  origin: 'timeline' | 'matrix' = 'timeline',
) {
  if (safeReturnPath(parent) !== parent || !contributionUrlFits(parent)) return null;
  const url = new URL(parent, 'https://dashboard.invalid');
  url.search = timelineParentQuery(url.searchParams).toString();
  url.searchParams.set('timeline.detail', metric);
  url.searchParams.set('timeline.interval', interval);
  url.searchParams.set('timeline.revision', source.scenarioId);
  url.searchParams.set('timeline.clock', source.asOf);
  if (origin === 'matrix') url.searchParams.set('support.origin', 'matrix');
  return contributionUrlFits(url.pathname + url.search) ? url.pathname + url.search : null;
}
/** Author detail retains its parent table state in a separate namespace; no recursive return URLs. */
export function timelineAuthorHref(href: string, author: string | null) {
  if (safeReturnPath(href) !== href || !contributionUrlFits(href)) return null;
  const url = new URL(href, 'https://dashboard.invalid');
  url.searchParams.delete('support.author');
  for (const key of [...url.searchParams.keys()])
    if (key.startsWith('support.records.')) url.searchParams.delete(key);
  if (author !== null) url.searchParams.set('support.author', author);
  return contributionUrlFits(url.pathname + url.search) ? url.pathname + url.search : null;
}
