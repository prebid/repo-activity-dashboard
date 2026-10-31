'use client';
import type {
  ContributionSettings,
  ContributionControlDirectory,
} from '@/models/contribution-settings';
import {
  defaultContributionSettings,
  mergeContributionPreferences,
  readContributionPreferenceCandidate,
  serializeContributionPreferences,
  type ContributionSettingField,
} from '@/lib/presentation/contribution-settings';
import { contributionPreferencesChanged } from './use-contribution-entry';

/** Saved account and company lookups give up after this long and leave the requested view. */
export const savedScopeLookupTimeoutMs = 15_000;

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
