'use client';
import { useCallback, useSyncExternalStore } from 'react';
import type { PreferenceSectionKey } from '@/models/preferences';
import { contributionUrlFits } from '@/lib/presentation/contribution-return';
import { urlHref } from '@/lib/presentation/url/codec';
import { entryValues, type SavedViewValues } from '@/lib/presentation/url/entry';
import type { UrlRoute, UrlSegments, UrlValues } from '@/lib/presentation/url/registry';
import { preferenceChangeEvent, readPreference } from './use-preference-cookie';
import { usePreferenceBinding } from './preference-binding';

/**
 * A save in this window dispatches the change event. Cookies fire no event across tabs, so the
 * cookie is also read again when this window regains focus or becomes visible.
 */
function subscribe(notify: () => void) {
  window.addEventListener(preferenceChangeEvent, notify);
  window.addEventListener('focus', notify);
  document.addEventListener('visibilitychange', notify);
  return () => {
    window.removeEventListener(preferenceChangeEvent, notify);
    window.removeEventListener('focus', notify);
    document.removeEventListener('visibilitychange', notify);
  };
}
const serverSnapshot = () => null;
const none: UrlValues = {};

export interface EntryHrefOptions {
  /** Only this account's saved sections apply; a value saved for another account is ignored. */
  viewerId?: string;
  segments?: UrlSegments;
  /** The entry's selectors, such as `{ timeline: true }`. */
  selectors?: UrlValues;
}
/**
 * An entry link (masthead, area breadcrumb) in the viewer's saved explicit form, so an ordinary
 * click opens the saved view in one request. `saved` turns the area cookie's sections into
 * registry values, or returns null when a saved value needs server validation (a custom range, a
 * named account or company, an unknown repository): the link then stays bare and the server
 * redirects. The server render and the first client render are bare; only the href changes after
 * hydration.
 */
export function useEntryHref(
  route: UrlRoute,
  saved: (read: (section: PreferenceSectionKey) => string | null) => SavedViewValues | null,
  { viewerId, segments = none as UrlSegments, selectors = none }: EntryHrefOptions = {},
): string {
  const binding = usePreferenceBinding();
  const bare = urlHref(route, segments, selectors);
  const snapshot = useCallback(() => {
    if (!binding || (viewerId !== undefined && binding.accountId !== viewerId)) return null;
    const read = (section: PreferenceSectionKey) => {
      try {
        return readPreference(binding, section);
      } catch {
        return null;
      }
    };
    const values = saved(read);
    if (!values) return null;
    const href = urlHref(route, segments, entryValues(route, selectors, values));
    return contributionUrlFits(href) ? href : null;
  }, [binding, viewerId, saved, route, segments, selectors]);
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot) ?? bare;
}
