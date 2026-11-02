import 'server-only';
import { contributionUrlFits } from '@/lib/presentation/contribution-return';
import type { UrlView } from '@/lib/presentation/url/back';
import { parseQuery, queryPairs } from '@/lib/presentation/url/codec';
import { legacyTrailKeys } from '@/lib/presentation/url/legacy/back';
import { legacyDecode } from '@/lib/presentation/url/legacy/decode';
import { matchRoute, screenOf, type UrlValues } from '@/lib/presentation/url/registry';
import { legacyContext } from './legacy-context';
import { timelineView } from './timeline-preview';

const origin = 'https://dashboard.invalid';
const timelineScreens = ['matrix', 'repositoryTimeline', 'contributionTimeline'];

/** One authorized Timeline loader for a view: the matrix, a repository's or a contribution one. */
export async function loadTimelineView(view: UrlView) {
  const screen = screenOf(view.route, view.values);
  if (!timelineScreens.includes(screen)) return { status: 'invalid' as const };
  const result = await timelineView(view);
  if (result.status !== 'ready') return result;
  if ('matrix' in result) return { ...result, category: 'matrix' as const };
  if ('omitted' in result) return { ...result, category: 'repository' as const };
  return { ...result, category: 'contribution' as const };
}
/**
 * A Timeline href for downloads: the canonical form, or a link in the pre-codec form, which exports
 * accept without a redirect (decision 14). Only Timeline views of report routes load, and their
 * return context is ignored.
 */
export async function loadTimelineReport(href: string) {
  if (!contributionUrlFits(href)) return { status: 'invalid' as const };
  let url: URL;
  try {
    url = new URL(href, origin);
  } catch {
    return { status: 'invalid' as const };
  }
  const matched = url.origin === origin ? matchRoute(url.pathname) : null;
  if (!matched || !href.startsWith('/')) return { status: 'invalid' as const };
  // Return context never changes a download, so an old or unusable trail is not read (P5d).
  const pairs = queryPairs(url.search).filter(
    ([key]) => key !== 'back' && !(legacyTrailKeys as readonly string[]).includes(key),
  );
  const parsed = parseQuery(matched.route, pairs);
  let values: UrlValues;
  if (parsed.kind === 'canonical') values = parsed.values;
  else if (parsed.kind === 'invalid') return { status: 'invalid' as const };
  else {
    const decoded = legacyDecode(matched.route, matched.segments, pairs, legacyContext());
    if (decoded.kind !== 'values') return { status: 'invalid' as const };
    values = decoded.values;
  }
  return loadTimelineView({ ...matched, values });
}
