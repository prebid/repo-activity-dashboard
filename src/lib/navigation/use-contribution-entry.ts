'use client';
import { useCallback, useSyncExternalStore } from 'react';
import {
  readStoredContributionPreferences,
  contributionPreferenceNeedsLookup,
  writeContributionSettings,
} from '@/lib/presentation/contribution-settings';
import { contributionUrlFits } from '@/lib/presentation/contribution-return';
import { preferenceChangeEvent, readPreference } from './use-preference-cookie';
import { usePreferenceBinding } from './preference-binding';

function subscribe(notify: () => void) {
  window.addEventListener(preferenceChangeEvent, notify);
  return () => window.removeEventListener(preferenceChangeEvent, notify);
}
const serverSnapshot = () => null;
/**
 * Resolve the saved report scope before in-app navigation, so an ordinary click opens the saved view
 * in one request; the destination remains a real shareable URL. Scopes that need the directory (a
 * named account or company, a custom range, an unknown repository) use the bare entry, which the
 * server validates and redirects.
 */
export function useContributionEntry(
  viewerId: string | undefined,
  enabledRepositories: readonly { id: string }[],
): string {
  const binding = usePreferenceBinding();
  const read = useCallback(() => {
    // A value saved for another account or authentication revision is ignored.
    if (!binding || binding.accountId !== viewerId) return null;
    try {
      return readPreference(binding, 'contributions.scope');
    } catch {
      return null;
    }
  }, [binding, viewerId]);
  const raw = useSyncExternalStore(subscribe, read, serverSnapshot);
  const settings = readStoredContributionPreferences(raw);
  const knownRepositories = new Set(enabledRepositories.map((repo) => repo.id));
  const safe =
    settings &&
    settings.period.kind === 'preset' &&
    !contributionPreferenceNeedsLookup(settings) &&
    settings.selection.repositoryIds.every((id) => knownRepositories.has(id));
  const href = safe ? '/contributors?' + writeContributionSettings('', settings) : '/contributors';
  return contributionUrlFits(href) ? href : '/contributors';
}
