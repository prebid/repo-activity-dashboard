import { z } from 'zod';
import {
  preferenceSectionKeys,
  type PreferenceBinding,
  type PreferenceCookieName,
  type PreferenceSectionKey,
} from '@/models/preferences';

/**
 * Per-viewer preferences live in two cookies the server reads, so the first render is final. Both
 * are site-wide: a browser matches `document.cookie` against the address the document was loaded
 * at, not the one client navigation moved it to, so a /repos-only cookie would be unreadable to a
 * page reached from sign-in or another report, and a field-wise write there would drop its other
 * sections.
 */
export const preferenceCookies = {
  repositories: { name: 'dashboard-repositories', path: '/' },
  contributions: { name: 'dashboard-contributions', path: '/' },
} as const satisfies Record<PreferenceCookieName, { name: string; path: string }>;

/** A value written by another format version is ignored, never migrated in place. */
export const preferenceCookieVersion = 1;
/** The most `name=value` may take in the Cookie header, in UTF-8 bytes. */
export const preferenceCookieByteLimit = 3072;
const maxAgeSeconds = 31_536_000;

export interface PreferenceSectionEntry {
  /** Write sequence within the cookie; the lowest is the least recently updated. */
  updated: number;
  /** The section's JSON value, exactly as the existing serializer produced it. */
  value: unknown;
}
export interface PreferenceDocument {
  cookie: PreferenceCookieName;
  binding: PreferenceBinding;
  sections: Partial<Record<PreferenceSectionKey, PreferenceSectionEntry>>;
}
export type PreferenceCookieRead =
  | { status: 'absent' }
  | { status: 'malformed' }
  | { status: 'ignored'; reason: 'version' | 'account' | 'revision' }
  | { status: 'bound'; document: PreferenceDocument };
export type PreferenceCookieFit =
  | {
      status: 'fits';
      /** The cookie value to write, or null to delete the cookie because no section remains. */
      value: string | null;
      document: PreferenceDocument;
      /** Sections removed to fit, least recently updated first. */
      evicted: PreferenceSectionKey[];
    }
  | { status: 'too-large' };

export function preferenceSectionCookie(section: PreferenceSectionKey): PreferenceCookieName {
  return (preferenceSectionKeys.repositories as readonly string[]).includes(section)
    ? 'repositories'
    : 'contributions';
}
function isSection(cookie: PreferenceCookieName, key: string): key is PreferenceSectionKey {
  return (preferenceSectionKeys[cookie] as readonly string[]).includes(key);
}
export function samePreferenceBinding(a: PreferenceBinding, b: PreferenceBinding): boolean {
  return a.accountId === b.accountId && a.authVersion === b.authVersion;
}

function toBase64Url(text: string): string {
  let binary = '';
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromBase64Url(value: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw Error('Not base64url');
  const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder('utf-8', { fatal: true }).decode(
    Uint8Array.from(binary, (character) => character.charCodeAt(0)),
  );
}

const versionSchema = z.object({ v: z.number() });
const wireSchema = z
  .object({
    v: z.literal(preferenceCookieVersion),
    a: z.string().min(1).max(512),
    r: z.number().int().nonnegative().safe(),
    s: z.record(z.string(), z.tuple([z.number().int().nonnegative().safe(), z.unknown()])),
  })
  .strict();

/**
 * Decode a cookie value for the current session. A value for another format version, account or
 * authentication revision is ignored; sections this cookie cannot hold are dropped.
 */
export function decodePreferenceCookie(
  cookie: PreferenceCookieName,
  raw: string | undefined,
  binding: PreferenceBinding,
): PreferenceCookieRead {
  if (raw === undefined || raw === '') return { status: 'absent' };
  let decoded: unknown;
  try {
    decoded = JSON.parse(fromBase64Url(raw));
  } catch {
    return { status: 'malformed' };
  }
  const version = versionSchema.safeParse(decoded);
  if (!version.success) return { status: 'malformed' };
  if (version.data.v !== preferenceCookieVersion) return { status: 'ignored', reason: 'version' };
  const wire = wireSchema.safeParse(decoded);
  if (!wire.success) return { status: 'malformed' };
  if (wire.data.a !== binding.accountId) return { status: 'ignored', reason: 'account' };
  if (wire.data.r !== binding.authVersion) return { status: 'ignored', reason: 'revision' };
  const sections: PreferenceDocument['sections'] = {};
  for (const [key, [updated, value]] of Object.entries(wire.data.s))
    if (isSection(cookie, key) && value !== undefined) sections[key] = { updated, value };
  return { status: 'bound', document: { cookie, binding, sections } };
}

export function encodePreferenceDocument(document: PreferenceDocument): string {
  return toBase64Url(
    JSON.stringify({
      v: preferenceCookieVersion,
      a: document.binding.accountId,
      r: document.binding.authVersion,
      s: Object.fromEntries(
        Object.entries(document.sections).map(([key, entry]) => [
          key,
          [entry.updated, entry.value],
        ]),
      ),
    }),
  );
}

/** A section's stored JSON, the text the existing preference readers take; null when absent. */
export function preferenceSectionText(
  document: PreferenceDocument | null,
  section: PreferenceSectionKey,
): string | null {
  const entry = document?.sections[section];
  return entry ? JSON.stringify(entry.value) : null;
}

/**
 * Replace or remove one section and stamp it as the most recently updated, leaving every other
 * section as it was. A document for another session is replaced by an empty one first.
 */
export function withPreferenceSection(
  document: PreferenceDocument | null,
  binding: PreferenceBinding,
  section: PreferenceSectionKey,
  value: unknown,
): PreferenceDocument {
  const cookie = preferenceSectionCookie(section);
  const current =
    document && document.cookie === cookie && samePreferenceBinding(document.binding, binding)
      ? document.sections
      : {};
  const sections = { ...current };
  delete sections[section];
  if (value !== null && value !== undefined) {
    const updated = Math.max(0, ...Object.values(current).map((entry) => entry.updated + 1));
    sections[section] = { updated, value };
  }
  return { cookie, binding, sections };
}

export function preferenceCookieBytes(cookie: PreferenceCookieName, value: string): number {
  return new TextEncoder().encode(preferenceCookies[cookie].name + '=' + value).length;
}

/**
 * Encode a document within preferenceCookieByteLimit, evicting the least recently updated sections
 * other than `keep` until it fits. Too large when `keep` alone does not fit.
 */
export function fitPreferenceCookie(
  document: PreferenceDocument,
  keep?: PreferenceSectionKey,
): PreferenceCookieFit {
  const sections = { ...document.sections };
  const evicted: PreferenceSectionKey[] = [];
  const order = (Object.keys(sections) as PreferenceSectionKey[])
    .filter((key) => key !== keep)
    .sort((a, b) => sections[a]!.updated - sections[b]!.updated || (a < b ? -1 : 1));
  for (;;) {
    const fitted = { ...document, sections: { ...sections } };
    if (!Object.keys(sections).length)
      return { status: 'fits', value: null, document: fitted, evicted };
    const value = encodePreferenceDocument(fitted);
    if (preferenceCookieBytes(document.cookie, value) <= preferenceCookieByteLimit)
      return { status: 'fits', value, document: fitted, evicted };
    const oldest = order.shift();
    if (!oldest) return { status: 'too-large' };
    delete sections[oldest];
    evicted.push(oldest);
  }
}

/**
 * The `document.cookie` assignment for a value, or for deleting the cookie when the value is null:
 * readable by scripts (not HttpOnly), SameSite=Lax, and Secure only on HTTPS origins.
 */
export function preferenceCookieString(
  cookie: PreferenceCookieName,
  value: string | null,
  secure: boolean,
): string {
  const { name, path } = preferenceCookies[cookie];
  return (
    `${name}=${value ?? ''}; Path=${path}; Max-Age=${value === null ? 0 : maxAgeSeconds}; SameSite=Lax` +
    (secure ? '; Secure' : '')
  );
}

/** The first value for a cookie name in a `document.cookie` string; the most specific path is first. */
export function cookieValue(cookies: string, cookie: PreferenceCookieName): string | undefined {
  const name = preferenceCookies[cookie].name;
  for (const pair of cookies.split(';')) {
    const separator = pair.indexOf('=');
    if (separator > 0 && pair.slice(0, separator).trim() === name)
      return pair.slice(separator + 1).trim();
  }
  return undefined;
}

export type { PreferenceBinding, PreferenceCookieName, PreferenceSectionKey };
