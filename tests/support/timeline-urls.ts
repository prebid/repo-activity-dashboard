// Timeline addresses for tests. Tests state a view in the old Timeline query form, which reads as
// the controls compute it; `canonicalHref` is the address the page helper answers that old link
// with (no saved values), and `addressQuery` reads the current address back in that form.
import { viewHref } from '@/lib/presentation/url/back';
import { parseQuery, isEntry } from '@/lib/presentation/url/codec';
import { legacyDecode } from '@/lib/presentation/url/legacy/decode';
import { matchRoute } from '@/lib/presentation/url/registry';
import { timelineQuery } from '@/lib/presentation/url/timeline';
import { contributionSampleAsOf } from '@/mocks/contributions';
import { legacyContext } from '@/server/legacy-context';

const origin = 'https://dashboard.invalid';
/** The canonical href of an old link, as the page helper's 307 writes it. */
export function canonicalHref(legacy: string): string {
  const url = new URL(legacy, origin);
  const matched = matchRoute(url.pathname);
  if (!matched) throw Error('Not a report route: ' + legacy);
  const parsed = parseQuery(matched.route, url.search);
  if (parsed.kind === 'canonical') return legacy;
  const decoded = legacyDecode(matched.route, matched.segments, url.search, legacyContext());
  if (decoded.kind !== 'values') throw Error('Invalid legacy link: ' + legacy);
  return viewHref({ ...matched, values: decoded.values }, 'level')!;
}
/** The Timeline query form of a canonical Timeline href. */
export function timelineQueryOf(href: string): URLSearchParams {
  const url = new URL(href, origin);
  const matched = matchRoute(url.pathname);
  const parsed = matched && parseQuery(matched.route, url.search);
  if (!matched || parsed?.kind !== 'canonical') throw Error('Not a canonical Timeline: ' + href);
  return new URLSearchParams(
    timelineQuery(matched.route, parsed.values, contributionSampleAsOf, {
      entry: isEntry(matched.route, parsed.values),
    })!,
  );
}
/** The current address in the Timeline query form. */
export function addressQuery(): URLSearchParams {
  return timelineQueryOf(window.location.pathname + window.location.search);
}
