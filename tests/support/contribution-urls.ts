// Reading canonical contribution addresses in browser specs: comma-joined lists and the parent a
// `back` frame (or the derived parent) names.
import { contributionViewOf } from '../../src/lib/presentation/contribution-url';
import { resolveBack } from '../../src/lib/presentation/url/back';

/** A comma-joined list parameter's items; an absent parameter has none. */
export function listParam(href: string, name: string): string[] {
  const value = new URL(href, 'https://dashboard.test').searchParams.get(name);
  return value === null || value === '' ? [] : value.split(',');
}
/** The href "Back to report" opens for a contribution address, or null when unavailable. */
export function parentHref(href: string): string | null {
  const url = new URL(href, 'https://dashboard.test');
  const view = contributionViewOf(url.pathname + url.search);
  if (!view) throw Error('Expected a canonical contribution address: ' + href);
  const [parent] = resolveBack(view);
  return parent?.available ? parent.href : null;
}
