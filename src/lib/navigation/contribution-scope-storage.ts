'use client';
import type {
  ContributionSettings,
  ContributionControlDirectory,
} from '@/models/contribution-settings';
import type { SavedPreference } from '@/models/preferences';
import {
  contributionPreferenceKey,
  defaultContributionSettings,
  mergeContributionPreferences,
  readContributionPreferenceCandidate,
  serializeContributionPreferences,
  type ContributionSettingField,
} from '@/lib/presentation/contribution-settings';
import { readPreference, type LegacyPreference } from './use-preference-cookie';

/**
 * The saved report scope after one deliberate report change: the changed field merged into the
 * scope the cookie holds now, so a field saved from another page or tab is kept. A stored value
 * the server already rejected is replaced rather than merged into.
 */
export function mergedContributionScope(
  saved: SavedPreference<ContributionSettings>,
  directory: ContributionControlDirectory,
  asOf: string,
  next: ContributionSettings,
  field: ContributionSettingField,
): unknown {
  const raw = readPreference(saved.binding, saved.section);
  const prior =
    (raw === saved.invalid ? null : readContributionPreferenceCandidate(raw, directory, asOf)) ??
    defaultContributionSettings(directory);
  return JSON.parse(
    serializeContributionPreferences(mergeContributionPreferences(prior, next, field)),
  );
}

/** Where a report scope was saved in localStorage before cookies, for the one-time copy. */
export function legacyContributionScope(
  viewerId: string,
  sample: string,
  directory: ContributionControlDirectory,
  asOf: string,
): LegacyPreference {
  return {
    keys: [contributionPreferenceKey(viewerId, sample)],
    read: (raw) => {
      const scope = readContributionPreferenceCandidate(raw, directory, asOf);
      return scope && (JSON.parse(serializeContributionPreferences(scope)) as unknown);
    },
  };
}
