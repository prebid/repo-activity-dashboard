'use client';
import { useCallback } from 'react';
import type { PreferenceSectionKey } from '@/models/preferences';
import { overviewEntryValues } from '@/lib/presentation/overview-settings';
import { useEntryHref } from './use-entry-href';

/**
 * The All repositories entry link in the viewer's saved explicit form, for the masthead and for the
 * "All repositories" crumb of a page whose address names no Summary to return to. It is bare on
 * the server and on the first client render, and while a saved custom range needs the server.
 * `asOf` is the reporting snapshot saved periods are checked against.
 */
export function useRepositoriesEntryHref(asOf: string, viewerId?: string): string {
  const saved = useCallback(
    (read: (section: PreferenceSectionKey) => string | null) => overviewEntryValues(read, asOf),
    [asOf],
  );
  return useEntryHref('/repos', saved, { viewerId });
}
