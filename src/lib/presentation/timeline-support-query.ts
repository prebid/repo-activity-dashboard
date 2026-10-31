import { z } from 'zod';
import { contributionUrlFits } from './contribution-return';
import { safeReturnPath } from './navigation';
import type { TimelineSourceIdentity } from '@/models/reporting-timeline';
const fields = [
  'timeline.detail',
  'timeline.interval',
  'timeline.revision',
  'timeline.clock',
  'support.origin',
  'support.author',
];
export function timelineParentQuery(params: URLSearchParams) {
  const next = new URLSearchParams(params);
  for (const key of [...next.keys()])
    if (fields.includes(key) || key.startsWith('support.')) next.delete(key);
  return next;
}
export function readTimelineSupportQuery(params: URLSearchParams) {
  for (const key of params.keys())
    if (/^support\.(authors|records)\./.test(key)) {
      const values = params.getAll(key);
      if (
        values.some((value) => value.length > 200) ||
        (!key.endsWith('.columns') && values.length !== 1)
      )
        return null;
      if (key.endsWith('.page') && !/^[1-9]\d{0,5}$/.test(values[0])) return null;
      if (key.endsWith('.dir') && !['asc', 'desc'].includes(values[0])) return null;
    }
  if (
    fields.some((key) => params.getAll(key).length > 1) ||
    [...params.keys()].some(
      (key) =>
        key.startsWith('support.') &&
        !['support.origin', 'support.author'].includes(key) &&
        !/^support\.(authors|records)\.(q|sort|dir|page|columns)$/.test(key),
    )
  )
    return null;
  const parsed = z
    .object({
      metric: z.string().min(1).max(100),
      interval: z.string().min(1).max(150),
      revision: z.string().min(1).max(500),
      clock: z.iso.datetime(),
      origin: z.enum(['timeline', 'matrix']),
      author: z.string().trim().min(1).max(500).optional(),
    })
    .safeParse({
      metric: params.get('timeline.detail'),
      interval: params.get('timeline.interval'),
      revision: params.get('timeline.revision'),
      clock: params.get('timeline.clock'),
      origin: params.get('support.origin') ?? 'timeline',
      author: params.get('support.author') ?? undefined,
    });
  return parsed.success ? parsed.data : null;
}
export function timelineSupportScopeKey(href: string) {
  const url = new URL(href, 'https://dashboard.invalid');
  for (const key of [...url.searchParams.keys()])
    if (/^support\.(authors|records)\./.test(key)) url.searchParams.delete(key);
  url.searchParams.sort();
  return url.pathname + '?' + url.searchParams.toString();
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
