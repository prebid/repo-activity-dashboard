import type {
  PreferenceBinding,
  PreferenceCookieName,
  PreferenceSectionKey,
  SavedPreference,
} from '@/models/preferences';
import { preferenceCookieNames } from '@/models/preferences';
import {
  cookieValue,
  decodePreferenceCookie,
  encodePreferenceDocument,
  preferenceCookieString,
  preferenceSectionCookie,
  type PreferenceDocument,
} from '@/lib/presentation/preference-cookie';

export const alice: PreferenceBinding = { accountId: 'alice', authVersion: 0 };

/** Write sections into the jsdom cookie jar, oldest first, replacing what the cookie held. */
export function seedPreferences(
  binding: PreferenceBinding,
  sections: Partial<Record<PreferenceSectionKey, unknown>>,
) {
  const documents = new Map<PreferenceCookieName, PreferenceDocument>();
  let updated = 0;
  for (const [section, value] of Object.entries(sections) as [PreferenceSectionKey, unknown][]) {
    const cookie = preferenceSectionCookie(section);
    const document = documents.get(cookie) ?? { cookie, binding, sections: {} };
    document.sections[section] = { updated: updated++, value };
    documents.set(cookie, document);
  }
  for (const [cookie, document] of documents)
    window.document.cookie = preferenceCookieString(
      cookie,
      encodePreferenceDocument(document),
      false,
    );
}

/** The raw cookie value the current document can read. */
export function rawPreferenceCookie(cookie: PreferenceCookieName): string | undefined {
  return cookieValue(window.document.cookie, cookie);
}

/** The sections the current document's cookie holds for a session, or null when none is bound. */
export function preferenceSections(
  cookie: PreferenceCookieName,
  binding: PreferenceBinding = alice,
): Partial<Record<PreferenceSectionKey, unknown>> | null {
  const read = decodePreferenceCookie(cookie, rawPreferenceCookie(cookie), binding);
  return read.status === 'bound'
    ? Object.fromEntries(
        Object.entries(read.document.sections).map(([key, entry]) => [key, entry.value]),
      )
    : null;
}

/** What route composition would hand a hook for one section; without a value, any section type. */
export function savedSection(
  section: PreferenceSectionKey,
  value?: null,
  invalid?: string,
  binding?: PreferenceBinding,
): SavedPreference<never>;
export function savedSection<T>(
  section: PreferenceSectionKey,
  value: T,
  invalid?: string,
  binding?: PreferenceBinding,
): SavedPreference<T>;
export function savedSection<T>(
  section: PreferenceSectionKey,
  value: T | null = null,
  invalid?: string,
  binding: PreferenceBinding = alice,
): SavedPreference<T> {
  return { section, binding, value, ...(invalid === undefined ? {} : { invalid }) };
}

/** Expire both preference cookies at their own paths. */
export function clearPreferenceCookies() {
  for (const cookie of preferenceCookieNames)
    window.document.cookie = preferenceCookieString(cookie, null, false);
}
