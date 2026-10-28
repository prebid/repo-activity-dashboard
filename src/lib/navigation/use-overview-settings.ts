'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type {
  OverviewSettings,
  OverviewSettingsControl,
  OverviewSettingsDefinition,
} from '@/models/overview-settings';
import {
  changesOverviewScope,
  normalizeOverviewSettings,
  overviewPreferenceKey,
  readOverviewPreferences,
  resetOverviewQuery,
  resolveOverviewSettings,
  serializeOverviewPreferences,
  writeOverviewSettings,
} from '@/lib/presentation/overview-settings';

export function useOverviewSettings(
  viewerId: string,
  definition: OverviewSettingsDefinition,
  asOf: string,
): OverviewSettingsControl {
  const search = useSearchParams().toString();
  const [saved, setSaved] = useState<{ viewerId: string; value: OverviewSettings } | null>(null);
  const savedRef = useRef(saved);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const currentSaved = saved?.viewerId === viewerId ? saved.value : null;
  const resolved = useMemo(
    () => resolveOverviewSettings(search, currentSaved, definition, asOf),
    [search, currentSaved, definition, asOf],
  );

  useEffect(() => {
    try {
      const value = readOverviewPreferences(
        localStorage.getItem(overviewPreferenceKey(viewerId)),
        definition,
        asOf,
      );
      const loaded = value ? { viewerId, value } : null;
      savedRef.current = loaded;
      setSaved(loaded);
      setStorageAvailable(true);
    } catch {
      savedRef.current = null;
      setSaved(null);
      setStorageAvailable(false);
    }
  }, [viewerId, definition, asOf]);

  const update = useCallback(
    (patch: Partial<OverviewSettings>) => {
      const url = new URL(window.location.href);
      const previous = savedRef.current?.viewerId === viewerId ? savedRef.current.value : null;
      const current = resolveOverviewSettings(url.search, previous, definition, asOf).value;
      const next = normalizeOverviewSettings({ ...current, ...patch }, definition, asOf);
      if (changesOverviewScope(patch)) {
        // Materialize the prior scope before pushing: Back must not depend on newer saved defaults.
        url.search = writeOverviewSettings(url.search, current);
        if (url.href !== window.location.href) window.history.replaceState(null, '', url);
        const before = url.href;
        url.search = writeOverviewSettings(url.search, next);
        if ('repositoryIds' in patch || 'ageThresholds' in patch)
          url.searchParams.delete('backlog.page');
        if ('repositoryIds' in patch || 'period' in patch) url.searchParams.delete('activity.page');
        if (url.href !== before) window.history.pushState(null, '', url);
      }
      const memory = { viewerId, value: next };
      savedRef.current = memory;
      setSaved(memory);
      try {
        localStorage.setItem(overviewPreferenceKey(viewerId), serializeOverviewPreferences(next));
        setStorageAvailable(true);
      } catch {
        setStorageAvailable(false);
      }
    },
    [viewerId, definition, asOf],
  );

  const reset = useCallback(() => {
    const url = new URL(window.location.href);
    const previous = savedRef.current?.viewerId === viewerId ? savedRef.current.value : null;
    const current = resolveOverviewSettings(url.search, previous, definition, asOf).value;
    url.search = writeOverviewSettings(url.search, current);
    if (url.href !== window.location.href) window.history.replaceState(null, '', url);
    url.search = resetOverviewQuery(url.search);
    window.history.pushState(null, '', url);
    savedRef.current = null;
    setSaved(null);
    try {
      localStorage.removeItem(overviewPreferenceKey(viewerId));
      setStorageAvailable(true);
    } catch {
      setStorageAvailable(false);
    }
  }, [viewerId, definition, asOf]);

  return { value: resolved.value, notice: resolved.notice, update, reset, storageAvailable };
}
