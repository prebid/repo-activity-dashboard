'use client';
import { useCallback, useSyncExternalStore } from 'react';
import type { PreferenceSectionKey } from '@/models/preferences';
import type { TimelineArea } from '@/models/timeline-controls';
import { readTimelinePreferences } from '@/lib/presentation/timeline-controls';
import { readPreference } from './use-preference-cookie';
import { usePreferenceBinding } from './preference-binding';
import { subscribePreferences } from './use-entry-href';

/**
 * The viewer's saved presentation of a Timeline, in its query form, for the links that open that
 * Timeline (decision C3). Null on the server and on the first client render, and when nothing
 * readable is saved; links then open the Timeline's v1 presentation for the fields they leave out.
 */
export function useSavedTimelinePresentation(
  section: PreferenceSectionKey,
  area: TimelineArea,
): string | null {
  const binding = usePreferenceBinding();
  const snapshot = useCallback(() => {
    const saved = binding && readTimelinePreferences(readPreference(binding, section), area);
    return saved?.size ? saved.toString() : null;
  }, [binding, section, area]);
  return useSyncExternalStore(subscribePreferences, snapshot, serverSnapshot);
}
const serverSnapshot = () => null;
