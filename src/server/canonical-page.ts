import 'server-only';
import { redirect } from 'next/navigation';
import type { PageSearchParams } from '@/lib/presentation/search-params';
import { viewHref } from '@/lib/presentation/url/back';
import {
  isEntry,
  parseQuery,
  queryPairs,
  sameQuery,
  withoutDefaults,
} from '@/lib/presentation/url/codec';
import { entryValues, type SavedViewValues } from '@/lib/presentation/url/entry';
import { legacyDecode } from '@/lib/presentation/url/legacy/decode';
import {
  screenOf,
  type ReportRoute,
  type UrlScreen,
  type UrlSegments,
  type UrlValues,
} from '@/lib/presentation/url/registry';
import { legacyContext } from './legacy-context';

/** What a report page renders after the helper has answered any redirect. */
export type CanonicalPage =
  /** A canonical address: render these values (an entry's saved values already applied). */
  | { status: 'canonical'; screen: UrlScreen; values: UrlValues; entry: boolean }
  /** An unknown parameter, a malformed value or a legacy link the frozen readers reject. */
  | { status: 'invalid'; message: string };

export interface CanonicalPageOptions {
  /**
   * The viewer's validated saved sections for an entry's screen, as registry values; null or
   * absent when nothing is saved or a section is invalid (the screen shows its notice).
   */
  saved?: (
    screen: UrlScreen,
    values: UrlValues,
  ) => SavedViewValues | null | Promise<SavedViewValues | null>;
}
export const oversizedLinkMessage = 'This link is too large to open. Reduce the selection.';

/**
 * The page-level URL helper (decisions 8 and 9), called after `await requireViewer()` at the top of
 * each report page. A legacy link is decoded by the frozen readers and answered with a 307 to its
 * canonical form; an entry whose saved view differs from the defaults is answered with a 307 to
 * the saved explicit form; a canonical view spelled another way (a default written out, a list out
 * of order) is answered with a 307 to its one spelling. One redirect at most: a legacy link whose
 * canonical form is an entry is resolved against saved values in the same pass. `redirect()` is
 * thrown before any streaming, so the response is a real 307.
 */
export async function canonicalPage(
  route: ReportRoute,
  segments: UrlSegments,
  searchParams: PageSearchParams,
  options: CanonicalPageOptions = {},
): Promise<CanonicalPage> {
  const pairs = queryPairs(searchParams);
  const parsed = parseQuery(route, pairs);
  if (parsed.kind === 'invalid') return { status: 'invalid', message: parsed.message };
  let values: UrlValues;
  if (parsed.kind === 'canonical') values = parsed.values;
  else {
    const decoded = legacyDecode(route, segments, pairs, legacyContext());
    if (decoded.kind === 'invalid') return { status: 'invalid', message: decoded.message };
    values = decoded.values;
  }
  // A default written out does not make a view explicit: entries are judged on the canonical form.
  values = withoutDefaults(route, values);
  if (isEntry(route, values) && options.saved) {
    const saved = await options.saved(screenOf(route, values), values);
    if (saved) values = entryValues(route, values, saved);
  }
  const href = viewHref({ route, segments, values }, 'level');
  if (href === null) return { status: 'invalid', message: oversizedLinkMessage };
  const query = href.includes('?') ? href.slice(href.indexOf('?') + 1) : '';
  if (parsed.kind !== 'canonical' || !sameQuery(pairs, query)) redirect(href);
  return {
    status: 'canonical',
    screen: screenOf(route, values),
    values,
    entry: isEntry(route, values),
  };
}
