'use client';
import type {
  ContributionSettings,
  ContributionControlDirectory,
} from '@/models/contribution-settings';
import type { ContributionOptions } from '@/models/contribution-options';
import {
  contributionPreferenceNeedsLookup,
  defaultContributionSettings,
  mergeContributionPreferences,
  readContributionPreferenceCandidate,
  serializeContributionPreferences,
  type ContributionSettingField,
} from '@/lib/presentation/contribution-settings';
import { contributionPreferencesChanged } from './use-contribution-entry';

/** Saved account and company lookups give up after this long and leave the requested view. */
export const savedScopeLookupTimeoutMs = 15_000;
/** Why a saved report scope was not applied, in the report and in Over time alike. */
export const savedScopeNotices = {
  changed:
    'Saved filters changed before they could be restored. Reload to use the latest settings.',
  unchecked: 'Saved filters could not be checked. The requested view is shown; reload to retry.',
} as const;
/**
 * Look up a saved scope's accounts and companies when it names any. The lookup is abandoned after
 * savedScopeLookupTimeoutMs or when `signal` aborts. Resolves to the checked scope, or to null when
 * it no longer resolves; rejects when the lookup fails or times out.
 */
export function lookupSavedScope(
  options: Pick<ContributionOptions, 'validate'>,
  scope: ContributionSettings,
  signal: AbortSignal,
): Promise<ContributionSettings | null> {
  if (!contributionPreferenceNeedsLookup(scope)) return Promise.resolve(scope);
  const lookup = new AbortController();
  const abort = () => lookup.abort();
  signal.addEventListener('abort', abort, { once: true });
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      lookup.abort();
      reject(Error(savedScopeNotices.unchecked));
    }, savedScopeLookupTimeoutMs);
    options
      .validate(scope, lookup.signal)
      .then(resolve, reject)
      .finally(() => {
        clearTimeout(timeout);
        signal.removeEventListener('abort', abort);
      });
  });
}
/** Whether the saved scope is still the value read before an asynchronous check. Storage errors throw. */
export function savedScopeUnchanged(key: string, raw: string | null): boolean {
  return localStorage.getItem(key) === raw;
}

/**
 * Merge one changed field into the saved report scope, shared by report and Over time edits.
 * A stored value already rejected as invalid is replaced rather than merged. Storage errors throw.
 */
export function saveContributionScope(
  key: string,
  directory: ContributionControlDirectory,
  asOf: string,
  next: ContributionSettings,
  field: ContributionSettingField,
  rejectedRaw?: string | null,
) {
  const raw = localStorage.getItem(key);
  const prior =
    (rejectedRaw !== undefined && raw === rejectedRaw
      ? null
      : readContributionPreferenceCandidate(raw, directory, asOf)) ??
    defaultContributionSettings(directory);
  localStorage.setItem(
    key,
    serializeContributionPreferences(mergeContributionPreferences(prior, next, field)),
  );
  window.dispatchEvent(new Event(contributionPreferencesChanged));
}
/** Remove the saved scope only if it is still the value that was checked. Storage errors throw. */
export function discardContributionScope(key: string, checked: string | null): boolean {
  if (localStorage.getItem(key) !== checked) return false;
  if (checked !== null) {
    localStorage.removeItem(key);
    window.dispatchEvent(new Event(contributionPreferencesChanged));
  }
  return true;
}
export function clearContributionScope(key: string) {
  localStorage.removeItem(key);
  window.dispatchEvent(new Event(contributionPreferencesChanged));
}
