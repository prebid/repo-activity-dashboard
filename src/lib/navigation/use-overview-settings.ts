'use client';
import { useCallback, useMemo, useRef, useState } from 'react';
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
  overviewScopeValues,
  readOverviewPreferences,
  readOverviewValues,
  serializeOverviewPreferences,
} from '@/lib/presentation/overview-settings';
import { mergeValues } from '@/lib/presentation/repository-url';
import { readPreference, usePreferenceCookie } from './use-preference-cookie';
import { useUrlState } from './use-url-state';

export const overviewPreferencesInvalidNotice =
  'Saved All repositories preferences are invalid. Defaults are shown.';

/**
 * All repositories settings. The scope (repositories, periods, PR ages) is the address's: an absent
 * field is its v1 default, and the server has already redirected a bare entry to the viewer's saved
 * view. Column choices stay viewer-only and come from the server-validated `saved` value. A
 * deliberate change pushes the next address and saves only the fields it changed; without `saved`,
 * changes last for this page only.
 */
export function useOverviewSettings(
  viewerId: string,
  definition: OverviewSettingsDefinition,
  asOf: string,
  saved?: SavedPreference<OverviewSettings>,
): OverviewSettingsControl {
  const url = useUrlState('/repos');
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
  const columns = useMemo(() => {
    const { backlogColumns, activityColumns } = current ?? defaultOverviewSettings(definition);
    return { backlogColumns, activityColumns };
  }, [current, definition]);
  const read = useMemo(
    () => readOverviewValues(url.values ?? {}, columns, definition, asOf),
    [url.values, columns, definition, asOf],
  );
  // The server renders an invalid address as the invalid view, so only an address being replaced
  // reads as null here.
  const value = useMemo(
    () => read ?? { ...defaultOverviewSettings(definition), ...columns },
    [read, columns, definition],
  );
  const binding = saved?.binding;

  /** The saved settings a change applies to: the live cookie, so another tab's fields survive. */
  const prior = useCallback((): OverviewSettings | null => {
    if (!binding || !persisted.current) return currentRef.current;
    return readOverviewPreferences(readPreference(binding, 'overview'), definition, asOf);
  }, [binding, definition, asOf]);
  const remember = useCallback(
    (next: OverviewSettings | null) => {
      currentRef.current = next;
      setChanged({ viewerId, value: next });
      const result = write(next && (JSON.parse(serializeOverviewPreferences(next)) as unknown));
      if (result && result.status !== 'too-large') persisted.current = result.status === 'saved';
    },
    [viewerId, write],
  );

  const update = useCallback(
    (patch: Partial<OverviewSettings>) => {
      const next = normalizeOverviewSettings({ ...value, ...patch }, definition, asOf);
      if (changesOverviewScope(patch))
        url.push(
          mergeValues(
            { ...url.values, v: '1' },
            {
              ...overviewScopeValues(next),
              // A changed scope can shorten either table, so each starts on its first page.
              bpage:
                'repositoryIds' in patch || 'ageThresholds' in patch
                  ? undefined
                  : url.values?.bpage,
              apage: 'repositoryIds' in patch || 'periods' in patch ? undefined : url.values?.apage,
            },
          ),
        );
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
    [value, definition, asOf, url, prior, remember],
  );

  const reset = useCallback(() => {
    // The defaults, pinned so Back and a reload show them whatever is saved later.
    url.push({ v: '1' });
    remember(null);
  }, [url, remember]);

  // The server rejected the saved section and rendered defaults; a deliberate change replaces it.
  const rejected = saved?.invalid !== undefined && changed?.viewerId !== viewerId;
  return {
    value,
    notice: rejected ? overviewPreferencesInvalidNotice : undefined,
    update,
    reset,
    storageAvailable,
  };
}
