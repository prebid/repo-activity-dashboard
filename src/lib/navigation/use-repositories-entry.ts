'use client';
import { useCallback } from 'react';
import type { PreferenceSectionKey } from '@/models/preferences';
import { overviewEntryValues } from '@/lib/presentation/overview-settings';
import { readRepositoryPresentation } from '@/lib/presentation/repository-page-preferences';
import { drilldownPresentation } from '@/lib/presentation/repository-url';
import { readSavedTableSort } from '@/lib/presentation/table-query';
import type { SavedViewValues } from '@/lib/presentation/url/entry';
import { recordPrColumnIds } from '@/models/table-columns';
import { useEntryHref } from './use-entry-href';

type Read = (section: PreferenceSectionKey) => string | null;

/**
 * The All repositories entry link in the viewer's saved explicit form, for the masthead and for the
 * "All repositories" crumb of a page whose address names no Summary to return to. It is bare on
 * the server and on the first client render, while a saved custom range needs the server, and
 * without `asOf`, the reporting snapshot saved periods are checked against.
 */
export function useRepositoriesEntryHref(asOf: string | undefined, viewerId?: string): string {
  const saved = useCallback(
    (read: Read) => (asOf === undefined ? null : overviewEntryValues(read, asOf)),
    [asOf],
  );
  return useEntryHref('/repos', saved, { viewerId });
}

/** A repository's pull request list entry with the viewer's saved list presentation (C2). */
function savedListEntry(read: Read): SavedViewValues {
  const presentation = drilldownPresentation(
    { scope: 'current', metric: 'totalOpenPrs' },
    {
      prs: {
        sort: readSavedTableSort(read('repository.prs.sort'), recordPrColumnIds),
        presentation: readRepositoryPresentation(read('repository.prs.columns')),
      },
    },
  );
  return { presentation };
}
const placeholder = { slug: ['_'] };
/**
 * The query (`''` or `?…`) that opens any repository's pull request list in the viewer's saved
 * explicit form; the lists of every repository share their saved presentation.
 */
export function useRepositoryListEntryQuery(viewerId?: string): string {
  const href = useEntryHref('/repos/[slug]', savedListEntry, { viewerId, segments: placeholder });
  const query = href.indexOf('?');
  return query < 0 ? '' : href.slice(query);
}
