import 'server-only';
import { cookies } from 'next/headers';
import { requireViewer } from '@/lib/auth/viewer';
import type {
  PreferenceBinding,
  PreferenceCookieName,
  PreferenceSectionKey,
  SavedPreference,
} from '@/models/preferences';
import type { TableQuery } from '@/models/table-query';
import type { OverviewSettings, OverviewSettingsDefinition } from '@/models/overview-settings';
import type { ContributionDirectory, ContributionSettings } from '@/models/contribution-settings';
import type { TimelineArea } from '@/models/timeline-controls';
import {
  decodePreferenceCookie,
  preferenceCookies,
  preferenceSectionCookie,
  preferenceSectionText,
  type PreferenceCookieRead,
  type PreferenceDocument,
} from '@/lib/presentation/preference-cookie';
import { readSavedTableSort } from '@/lib/presentation/table-query';
import { readTableColumns } from '@/lib/presentation/table-column-preferences';
import { readOverviewPreferences } from '@/lib/presentation/overview-settings';
import { readTimelinePreferences } from '@/lib/presentation/timeline-controls';
import {
  readContributionPreferenceCandidate,
  validateContributionSettings,
} from '@/lib/presentation/contribution-settings';

/** One request's view of a preference cookie, already bound to the signed-in session. */
export interface PreferenceSnapshot {
  cookie: PreferenceCookieName;
  binding: PreferenceBinding;
  /** How the cookie read: only a bound value has sections; any other status reads as empty. */
  status: PreferenceCookieRead['status'];
  document: PreferenceDocument | null;
}
export type SavedTableSort = Pick<TableQuery, 'sort' | 'descending'>;

/** Bind a raw cookie value to a session without request APIs, for composition and tests. */
export function preferenceSnapshot(
  cookie: PreferenceCookieName,
  binding: PreferenceBinding,
  raw: string | undefined,
): PreferenceSnapshot {
  const read = decodePreferenceCookie(cookie, raw, binding);
  return {
    cookie,
    binding,
    status: read.status,
    document: read.status === 'bound' ? read.document : null,
  };
}

/** Read one preference cookie for the signed-in viewer. Export routes never call this. */
export async function readPreferences(cookie: PreferenceCookieName): Promise<PreferenceSnapshot> {
  const viewer = await requireViewer();
  const raw = (await cookies()).get(preferenceCookies[cookie].name)?.value;
  return preferenceSnapshot(cookie, { accountId: viewer.id, authVersion: viewer.authVersion }, raw);
}

/**
 * Validate one section through an existing reader. `read` receives the stored JSON and returns the
 * value, null when the section is invalid, or undefined when a well-formed section does not apply
 * to this view; such a section is kept for the views it fits rather than deleted.
 */
export function savedPreference<T>(
  snapshot: PreferenceSnapshot,
  section: PreferenceSectionKey,
  read: (raw: string) => T | null | undefined,
): SavedPreference<T> {
  if (preferenceSectionCookie(section) !== snapshot.cookie)
    throw Error(`The ${section} section is not in the ${snapshot.cookie} cookie.`);
  const base = { section, binding: snapshot.binding };
  let raw: string | null = null;
  let value: T | null | undefined;
  try {
    raw = preferenceSectionText(snapshot.document, section);
    if (raw === null) return { ...base, value: null };
    value = read(raw);
  } catch {
    value = null;
  }
  if (value === undefined) return { ...base, value: null };
  if (value !== null) return { ...base, value };
  // A section whose text could not be produced cannot be matched for deletion.
  return raw === null ? { ...base, value: null } : { ...base, value: null, invalid: raw };
}

/**
 * Mark a section the server read as well formed but rejected for every view it applies to, so the
 * client deletes it after hydration while the cookie still holds the same value.
 */
export function rejectedPreference<T>(
  snapshot: PreferenceSnapshot,
  saved: SavedPreference<T>,
): SavedPreference<T> {
  return saved.invalid !== undefined
    ? saved
    : savedPreference<T>(snapshot, saved.section, () => null);
}

function storedSortColumn(raw: string): string | null {
  const value: unknown = JSON.parse(raw);
  return value && typeof value === 'object' && 'sort' in value && typeof value.sort === 'string'
    ? value.sort
    : null;
}
/** A saved sort; a well-formed sort on a column this table lacks is not applicable, not invalid. */
export function savedTableSort(
  snapshot: PreferenceSnapshot,
  section: PreferenceSectionKey,
  columnIds: readonly string[],
): SavedPreference<SavedTableSort> {
  return savedPreference(snapshot, section, (raw) => {
    const sort = readSavedTableSort(raw, columnIds);
    if (sort) return sort;
    const column = storedSortColumn(raw);
    return column !== null && readSavedTableSort(raw, [column]) ? undefined : null;
  });
}

/** Saved column overrides; unknown or retired column IDs are dropped by readTableColumns. */
export function savedTableColumns(
  snapshot: PreferenceSnapshot,
  section: PreferenceSectionKey,
  columnIds: readonly string[],
): SavedPreference<Record<string, boolean>> {
  return savedPreference(snapshot, section, (raw) => {
    const value: unknown = JSON.parse(raw);
    const document =
      value &&
      typeof value === 'object' &&
      'version' in value &&
      value.version === 1 &&
      'columns' in value &&
      value.columns &&
      typeof value.columns === 'object' &&
      !Array.isArray(value.columns);
    return document ? readTableColumns(raw, columnIds) : null;
  });
}

export function savedOverviewSettings(
  snapshot: PreferenceSnapshot,
  definition: OverviewSettingsDefinition,
  asOf: string,
): SavedPreference<OverviewSettings> {
  return savedPreference(snapshot, 'overview', (raw) =>
    readOverviewPreferences(raw, definition, asOf),
  );
}

/** Saved Timeline choices as a query string of preference fields only. */
export function savedTimelinePresentation(
  snapshot: PreferenceSnapshot,
  section: PreferenceSectionKey,
  area: TimelineArea,
): SavedPreference<string> {
  return savedPreference(
    snapshot,
    section,
    (raw) => readTimelinePreferences(raw, area)?.toString() ?? null,
  );
}

/**
 * A saved report scope, checked against the directory: a scope naming an account or company that no
 * longer exists is invalid. This replaces the client's asynchronous lookup.
 */
export function savedContributionScope(
  snapshot: PreferenceSnapshot,
  directory: ContributionDirectory,
  asOf: string,
): SavedPreference<ContributionSettings> {
  return savedPreference(snapshot, 'contributions.scope', (raw) => {
    const candidate = readContributionPreferenceCandidate(raw, directory, asOf);
    return candidate && validateContributionSettings(candidate, directory, asOf);
  });
}
