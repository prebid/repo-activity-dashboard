'use client';
import { useCallback, useSyncExternalStore } from 'react';
import {
  contributionPreferenceKey,
  readStoredContributionPreferences,
  writeContributionSettings,
} from '@/lib/presentation/contribution-settings';
import { contributionUrlFits } from '@/lib/presentation/contribution-return';

export const contributionPreferencesChanged = 'dashboard:contribution-preferences-changed';
function subscribe(notify: () => void) {
  window.addEventListener('storage', notify);
  window.addEventListener(contributionPreferencesChanged, notify);
  return () => {
    window.removeEventListener('storage', notify);
    window.removeEventListener(contributionPreferencesChanged, notify);
  };
}
const serverSnapshot = () => null;
/** Resolve browser defaults before in-app navigation; the destination remains a real shareable URL. */
export function useContributionEntry(viewerId?: string): string {
  const read = useCallback(() => {
    try {
      return viewerId
        ? localStorage.getItem(contributionPreferenceKey(viewerId, 'reference'))
        : null;
    } catch {
      return null;
    }
  }, [viewerId]);
  const raw = useSyncExternalStore(subscribe, read, serverSnapshot);
  const settings = readStoredContributionPreferences(raw);
  const href = settings
    ? '/contributors?' + writeContributionSettings('', settings)
    : '/contributors';
  return contributionUrlFits(href) ? href : '/contributors';
}
