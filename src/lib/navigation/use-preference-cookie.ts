'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  PreferenceBinding,
  PreferenceSectionKey,
  SavedPreference,
} from '@/models/preferences';
import {
  cookieValue,
  decodePreferenceCookie,
  fitPreferenceCookie,
  preferenceCookieString,
  preferenceSectionCookie,
  preferenceSectionText,
  withPreferenceSection,
  type PreferenceDocument,
} from '@/lib/presentation/preference-cookie';

/** Dispatched on window after a section is written, with `{ section }` as the detail. */
export const preferenceChangeEvent = 'dashboard:preference-change';
/** Dispatched on window when a write evicted sections or could not fit, for PreferenceNotice. */
export const preferenceNoticeEvent = 'dashboard:preference-notice';
export type PreferenceNoticeDetail =
  | { kind: 'evicted'; sections: PreferenceSectionKey[] }
  | { kind: 'too-large'; section: PreferenceSectionKey };
export type PreferenceWrite =
  | { status: 'saved'; evicted: PreferenceSectionKey[] }
  /** The section alone exceeds the cookie limit, or a write that may not evict had no room. */
  | { status: 'too-large' }
  /** The browser did not keep the cookie. */
  | { status: 'unavailable' };

function liveDocument(
  binding: PreferenceBinding,
  section: PreferenceSectionKey,
): PreferenceDocument | null {
  const cookie = preferenceSectionCookie(section);
  const read = decodePreferenceCookie(cookie, cookieValue(document.cookie, cookie), binding);
  return read.status === 'bound' ? read.document : null;
}
function notify(detail: PreferenceNoticeDetail) {
  window.dispatchEvent(new CustomEvent(preferenceNoticeEvent, { detail }));
}

/** A section's stored JSON in the live cookie for this session, or null when absent. */
export function readPreference(
  binding: PreferenceBinding,
  section: PreferenceSectionKey,
): string | null {
  return preferenceSectionText(liveDocument(binding, section), section);
}

/**
 * Write one section, or delete it with null, leaving every other section as the live cookie holds
 * it. When the cookie would exceed its limit the least recently updated sections are evicted and a
 * notice is dispatched; `evict: false` refuses the write instead.
 */
export function writePreference(
  binding: PreferenceBinding,
  section: PreferenceSectionKey,
  value: unknown,
  { evict = true }: { evict?: boolean } = {},
): PreferenceWrite {
  const cookie = preferenceSectionCookie(section);
  const next = withPreferenceSection(liveDocument(binding, section), binding, section, value);
  const fit = fitPreferenceCookie(next, value === null ? undefined : section);
  if (fit.status === 'too-large' || (!evict && fit.evicted.length)) {
    if (evict) notify({ kind: 'too-large', section });
    return { status: 'too-large' };
  }
  document.cookie = preferenceCookieString(cookie, fit.value, location.protocol === 'https:');
  if (cookieValue(document.cookie, cookie) !== (fit.value ?? undefined))
    return { status: 'unavailable' };
  if (fit.evicted.length) notify({ kind: 'evicted', sections: fit.evicted });
  window.dispatchEvent(new CustomEvent(preferenceChangeEvent, { detail: { section } }));
  return { status: 'saved', evicted: fit.evicted };
}

/**
 * Delete a section the server rejected, but only while the cookie still holds the rejected value,
 * so a newer choice from another tab survives. Cookie only: no history write and no re-render.
 */
export function deleteRejectedPreference(saved: SavedPreference<unknown>): boolean {
  if (saved.invalid === undefined) return false;
  if (readPreference(saved.binding, saved.section) !== saved.invalid) return false;
  return writePreference(saved.binding, saved.section, null).status === 'saved';
}

/** Where a preference lived in localStorage before cookies, and how to validate it. */
export interface LegacyPreference {
  /** localStorage keys that may hold the value, in order of preference. */
  keys: readonly string[];
  /** The existing reader: the section's JSON value, or null when the stored value is invalid. */
  read: (raw: string) => unknown;
}
export type LegacyMigration = 'copied' | 'superseded' | 'invalid' | 'none' | 'kept';
/**
 * Copy a localStorage preference into its absent cookie section once. Invalid values are not
 * copied, no other section is evicted, and nothing rendered changes: the copy applies from the next
 * request. The localStorage keys are removed once copied, superseded by a cookie value or invalid;
 * they are kept when the cookie could not be written.
 */
export function migrateLegacyPreference(
  binding: PreferenceBinding,
  section: PreferenceSectionKey,
  legacy: LegacyPreference,
): LegacyMigration {
  let result: LegacyMigration = 'none';
  try {
    const stored = legacy.keys
      .map((key) => localStorage.getItem(key))
      .filter((raw) => raw !== null);
    if (!stored.length) return 'none';
    if (readPreference(binding, section) !== null) result = 'superseded';
    else {
      const value = stored.map((raw) => legacy.read(raw)).find((read) => read !== null);
      if (value === undefined) result = 'invalid';
      else if (writePreference(binding, section, value, { evict: false }).status === 'saved')
        result = 'copied';
      else return 'kept';
    }
    for (const key of legacy.keys) localStorage.removeItem(key);
  } catch {
    return 'kept';
  }
  return result;
}

/**
 * The client side of one server-validated section. After hydration it deletes the section if the
 * server rejected it, or copies a legacy localStorage value into it once; neither writes history or
 * changes what is rendered. `write` saves a deliberate change to this section only; null deletes it.
 */
export function usePreferenceCookie(
  saved: SavedPreference<unknown> | undefined,
  legacy?: LegacyPreference,
): { write: (value: unknown) => PreferenceWrite | null; storageAvailable: boolean } {
  const [storageAvailable, setStorageAvailable] = useState(true);
  const legacyRef = useRef(legacy);
  legacyRef.current = legacy;
  const section = saved?.section,
    accountId = saved?.binding.accountId,
    authVersion = saved?.binding.authVersion,
    invalid = saved?.invalid,
    absent = saved?.value === null && invalid === undefined;
  useEffect(() => {
    if (section === undefined || accountId === undefined || authVersion === undefined) return;
    const binding = { accountId, authVersion };
    if (invalid !== undefined) deleteRejectedPreference({ section, binding, value: null, invalid });
    else if (absent && legacyRef.current)
      migrateLegacyPreference(binding, section, legacyRef.current);
  }, [section, accountId, authVersion, invalid, absent]);
  const write = useCallback(
    (value: unknown) => {
      if (section === undefined || accountId === undefined || authVersion === undefined)
        return null;
      const result = writePreference({ accountId, authVersion }, section, value);
      if (result.status !== 'too-large') setStorageAvailable(result.status === 'saved');
      return result;
    },
    [section, accountId, authVersion],
  );
  return { write, storageAvailable };
}

const noticeText = (detail: PreferenceNoticeDetail) =>
  detail.kind === 'too-large'
    ? 'This choice is too large to save. It applies to the current view only.'
    : detail.sections.length === 1
      ? 'Saved preferences were full, so the least recently changed saved setting was removed.'
      : `Saved preferences were full, so the ${detail.sections.length} least recently changed saved settings were removed.`;

/** The latest eviction or size notice from any preference write on this page. */
export function usePreferenceNotice(): { notice: string | null; dismiss: () => void } {
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    const show = (event: Event) =>
      setNotice(noticeText((event as CustomEvent<PreferenceNoticeDetail>).detail));
    window.addEventListener(preferenceNoticeEvent, show);
    return () => window.removeEventListener(preferenceNoticeEvent, show);
  }, []);
  return { notice, dismiss: useCallback(() => setNotice(null), []) };
}
