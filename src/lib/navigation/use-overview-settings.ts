'use client';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type {
  OverviewSettings,
  OverviewSettingsControl,
  OverviewSettingsDefinition,
} from '@/models/overview-settings';
import type { SavedPreference } from '@/models/preferences';
import {
  changesOverviewScope,
  defaultOverviewSettings,
  normalizeOverviewSettings,
  overviewPreferenceKey,
  readOverviewPreferences,
  resetOverviewQuery,
  resolveOverviewSettings,
  serializeOverviewPreferences,
  writeOverviewSettings,
} from '@/lib/presentation/overview-settings';
import { readPreference, usePreferenceCookie } from './use-preference-cookie';

export const overviewPreferencesInvalidNotice =
  'Saved All repositories preferences are invalid. Defaults are shown.';

/**
 * All repositories settings. The first render uses the server-validated `saved` value when the
 * URL does not name a setting; a deliberate change saves only the fields it changed. Without
 * `saved`, changes last for this page only.
 */
export function useOverviewSettings(
  viewerId: string,
  definition: OverviewSettingsDefinition,
  asOf: string,
  saved?: SavedPreference<OverviewSettings>,
): OverviewSettingsControl {
  const search = useSearchParams().toString();
  const { write, storageAvailable } = usePreferenceCookie(saved, {
    keys: [overviewPreferenceKey(viewerId)],
    read: (raw) => {
      const value = readOverviewPreferences(raw, definition, asOf);
      return value && (JSON.parse(serializeOverviewPreferences(value)) as unknown);
    },
  });
  // Settings this page saved or reset; until then the server-validated value applies.
  const [changed, setChanged] = useState<{
    viewerId: string;
    value: OverviewSettings | null;
  } | null>(null);
  const current = changed?.viewerId === viewerId ? changed.value : (saved?.value ?? null);
  const currentRef = useRef(current);
  currentRef.current = current;
  // Once the browser refuses the cookie, the fields saved in this page are only in memory.
  const persisted = useRef(true);
  const resolved = useMemo(
    () => resolveOverviewSettings(search, current, definition, asOf),
    [search, current, definition, asOf],
  );
  const binding = saved?.binding;

  /** The saved settings a change applies to: the live cookie, so another tab's fields survive. */
  const prior = useCallback((): OverviewSettings | null => {
    if (!binding || !persisted.current) return currentRef.current;
    return readOverviewPreferences(readPreference(binding, 'overview'), definition, asOf);
  }, [binding, definition, asOf]);
  const remember = useCallback(
    (value: OverviewSettings | null) => {
      currentRef.current = value;
      setChanged({ viewerId, value });
      const result = write(value && (JSON.parse(serializeOverviewPreferences(value)) as unknown));
      if (result && result.status !== 'too-large') persisted.current = result.status === 'saved';
    },
    [viewerId, write],
  );

  const update = useCallback(
    (patch: Partial<OverviewSettings>) => {
      const url = new URL(window.location.href);
      const current = resolveOverviewSettings(
        url.search,
        currentRef.current,
        definition,
        asOf,
      ).value;
      const next = normalizeOverviewSettings({ ...current, ...patch }, definition, asOf);
      if (changesOverviewScope(patch)) {
        // Materialize the prior scope before pushing: Back must not depend on newer saved defaults.
        url.search = writeOverviewSettings(url.search, current);
        if (url.href !== window.location.href) window.history.replaceState(null, '', url);
        const before = url.href;
        url.search = writeOverviewSettings(url.search, next);
        if ('repositoryIds' in patch || 'ageThresholds' in patch)
          url.searchParams.delete('backlog.page');
        if ('repositoryIds' in patch || 'periods' in patch)
          url.searchParams.delete('activity.page');
        if (url.href !== before) window.history.pushState(null, '', url);
      }
      // Save the changed fields only; settings this link names but the viewer did not change stay
      // as they were saved.
      const fields = Object.fromEntries(
        Object.keys(patch).map((key) => [key, next[key as keyof OverviewSettings]]),
      );
      remember(
        normalizeOverviewSettings(
          { ...(prior() ?? defaultOverviewSettings(definition)), ...fields },
          definition,
          asOf,
        ),
      );
    },
    [definition, asOf, prior, remember],
  );

  const reset = useCallback(() => {
    const url = new URL(window.location.href);
    const current = resolveOverviewSettings(url.search, currentRef.current, definition, asOf).value;
    url.search = writeOverviewSettings(url.search, current);
    if (url.href !== window.location.href) window.history.replaceState(null, '', url);
    url.search = resetOverviewQuery(url.search);
    window.history.pushState(null, '', url);
    remember(null);
  }, [definition, asOf, remember]);

  // The server rejected the saved section and rendered defaults; a deliberate change replaces it.
  const rejected = saved?.invalid !== undefined && changed?.viewerId !== viewerId;
  return {
    value: resolved.value,
    notice: resolved.notice ?? (rejected ? overviewPreferencesInvalidNotice : undefined),
    update,
    reset,
    storageAvailable,
  };
}
