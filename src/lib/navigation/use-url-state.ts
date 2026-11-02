'use client';
// The URL codec's history hook (architecture rule 6): every report history write and codec
// navigation goes through this module. Each write keeps `location.hash`, pins a rendered bare entry
// to its explicit form first (decision C4), and records in `history.state` the address the entry
// was pushed from, so a back link to that address can use `history.go(-1)` (P5d).
import { useEffect, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { rebaseBack, sameView, viewHref, type UrlView } from '@/lib/presentation/url/back';
import { isEntry, parseQuery, serializeQuery } from '@/lib/presentation/url/codec';
import { matchRoute, type UrlRoute, type UrlValues } from '@/lib/presentation/url/registry';

/** The `history.state` key holding the address an in-app push came from. */
export const historyMarkerKey = 'dashboardPrevious';
type HistoryMode = 'push' | 'replace';
interface Router {
  push(href: string): void;
}

// The last committed address, and the address a codec navigation started from.
let committed: string | null = null;
let pending: string | null = null;
const here = () => window.location.pathname + window.location.search;
function marker(): string | null {
  const state: unknown = window.history.state;
  return state && typeof state === 'object' && historyMarkerKey in state
    ? ((state as Record<string, unknown>)[historyMarkerKey] as string | null)
    : null;
}
/** An href with the current fragment kept, unless the href names its own. */
function withHash(href: string): string {
  return href.includes('#') ? href : href + window.location.hash;
}

/**
 * Push or replace the current history entry. A push records the address it leaves; a replace keeps
 * the entry's record. The fragment stays unless the href names one.
 */
export function writeHistory(mode: HistoryMode, href: string): void {
  if (mode === 'push') window.history.pushState({ [historyMarkerKey]: here() }, '', withHash(href));
  else window.history.replaceState({ [historyMarkerKey]: marker() }, '', withHash(href));
  committed = here();
}
/** Replace only the fragment, keeping the entry's state, so Back leaves the page. */
export function replaceHash(id: string): void {
  window.history.replaceState(window.history.state, '', '#' + id);
}
/**
 * Pin a rendered bare entry (a report URL holding only selectors) to its explicit form, `v=1`,
 * so Back returns to the defaults it showed rather than to a later saved view. True when pinned.
 */
export function pinCurrentEntry(): boolean {
  const matched = matchRoute(window.location.pathname);
  if (!matched) return false;
  const parsed = parseQuery(matched.route, window.location.search);
  if (parsed.kind !== 'canonical' || !isEntry(matched.route, parsed.values)) return false;
  const query = serializeQuery(matched.route, parsed.values, { explicit: true });
  writeHistory('replace', window.location.pathname + '?' + query);
  return true;
}
/** Start a server navigation (`router.push`) from a pinned entry, recording where it started. */
export function followHref(router: Router, href: string): void {
  pinCurrentEntry();
  pending = here();
  router.push(href);
}
/** Whether a back link's href is the entry this one was pushed from, so Back can restore it. */
export function shouldGoBack(previous: unknown, href: string): boolean {
  return typeof previous === 'string' && sameView(previous, href);
}
/** The address the current entry was pushed from, when recorded. */
export function previousEntry(): string | null {
  return marker();
}
/**
 * After a navigation commits, record where an entry Next pushed came from. Codec writes and
 * Back/Forward have recorded the address already; a page load writes nothing.
 */
export function markHistoryEntry(): void {
  const address = here();
  if (address === committed) return;
  const state: unknown = window.history.state;
  const from = pending ?? committed;
  if (from !== null && !(state && typeof state === 'object' && historyMarkerKey in state))
    window.history.replaceState(
      { ...(state as Record<string, unknown> | null), [historyMarkerKey]: from },
      '',
    );
  committed = address;
  pending = null;
}
/** Whether a click follows a same-origin link in this tab. */
function followsLink(event: MouseEvent): boolean {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    !(event.target instanceof Element)
  )
    return false;
  const link = event.target.closest('a[href]');
  if (!(link instanceof HTMLAnchorElement) || link.hasAttribute('download')) return false;
  if (link.target && link.target.toLowerCase() !== '_self') return false;
  return new URL(link.href).origin === window.location.origin;
}
/**
 * Mounted once in the dashboard layout: records history entries after each committed navigation,
 * follows Back/Forward, and pins a bare entry before a link click leaves it.
 */
export function useHistoryEntries(): void {
  const pathname = usePathname(),
    search = useSearchParams().toString();
  useEffect(() => {
    markHistoryEntry();
  }, [pathname, search]);
  useEffect(() => {
    const restored = () => {
      committed = here();
      pending = null;
    };
    const beforeLink = (event: MouseEvent) => {
      if (followsLink(event)) pinCurrentEntry();
    };
    window.addEventListener('popstate', restored);
    document.addEventListener('click', beforeLink, true);
    return () => {
      window.removeEventListener('popstate', restored);
      document.removeEventListener('click', beforeLink, true);
    };
  }, []);
}
/** The component form of `useHistoryEntries`, for the dashboard layout. */
export function HistoryEntryMarker(): null {
  useHistoryEntries();
  return null;
}

/** The current report view, read from the address bar at call time. */
function currentView(route: UrlRoute): UrlView | null {
  const matched = matchRoute(window.location.pathname);
  if (matched?.route !== route) return null;
  const parsed = parseQuery(route, window.location.search);
  return parsed.kind === 'canonical' ? { ...matched, values: parsed.values } : null;
}

/**
 * The codec state of a report route and its writers. `values` is null when the address is not
 * canonical (a legacy link the server has not answered yet). Writers take the next values without
 * return context: the current `back` frames are rebased so the resolved parent never moves, and a
 * write that would exceed the 7,500-byte cap is refused (false).
 */
export function useUrlState(route: UrlRoute) {
  const router = useRouter(),
    pathname = usePathname(),
    search = useSearchParams().toString();
  const values = useMemo(() => {
    if (matchRoute(pathname)?.route !== route) return null;
    const parsed = parseQuery(route, search);
    return parsed.kind === 'canonical' ? parsed.values : null;
  }, [route, pathname, search]);
  return useMemo(() => {
    /** The href of next values at this address, frames rebased; null when it exceeds the cap. */
    const href = (next: UrlValues): string | null => {
      const current = currentView(route);
      if (!current) return null;
      const view = { ...current, values: next };
      return viewHref({ ...view, values: { ...next, back: rebaseBack(current, view) } }, 'level');
    };
    const write = (mode: HistoryMode, next: UrlValues): boolean => {
      const target = href(next);
      if (target === null) return false;
      if (mode === 'push') pinCurrentEntry();
      if (target !== here()) writeHistory(mode, target);
      return true;
    };
    return {
      values,
      entry: values !== null && isEntry(route, values),
      href,
      push: (next: UrlValues) => write('push', next),
      replace: (next: UrlValues) => write('replace', next),
      /** A server navigation (data scope changes), from a pinned entry. */
      navigate: (target: string) => followHref(router, target),
      replaceHash,
    };
  }, [route, router, values]);
}
