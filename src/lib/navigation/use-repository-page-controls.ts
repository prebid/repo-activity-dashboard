'use client';
import { useCallback, useMemo, useRef, useState } from 'react';
import type { ColumnVisibility } from '@/components/tables/table-columns';
import type { RepositoryPageFilters, RepositoryPageSource } from '@/models/repository-page';
import type { SavedPreference } from '@/models/preferences';
import {
  defaultRepositoryFilters,
  readRepositoryFilters,
  repositoryFilterFields,
} from '@/lib/presentation/repository-page-query';
import {
  repositoryColumnDefaults,
  repositoryColumnsKey,
  readRepositoryPresentation,
  serializeRepositoryColumns,
  type RepositoryPresentation,
} from '@/lib/presentation/repository-page-preferences';
import {
  repositoryScopeValues,
  repositoryValuesAt,
  type RepositoryActivityMode,
} from '@/lib/presentation/repository-page-navigation';
import type { DateRange } from '@/models/reporting-period';
import {
  mergeValues,
  recordColumnChoices,
  recordColumnField,
} from '@/lib/presentation/repository-url';
import { parseQuery } from '@/lib/presentation/url/codec';
import { recordColumnTable } from '@/lib/presentation/url/defaults';
import type { UrlValues } from '@/lib/presentation/url/registry';
import type { useTableController } from './use-table-controller';
import { readPreference, usePreferenceCookie } from './use-preference-cookie';
import { useUrlState } from './use-url-state';

/** The route a record list renders on: a repository's list, or one author's records. */
export function recordListRoute(source: Pick<RepositoryPageSource, 'author'>) {
  return source.author ? ('/repos/[slug]/authors/[account]' as const) : ('/repos/[slug]' as const);
}

/**
 * Record-list filters, columns and charts, all read from the address. The server applied the
 * viewer's saved columns, sort and charts to the entry or the link that opened the list, so an
 * absent field is its v1 default. A deliberate change pushes the next address; a column or chart
 * change also saves only the choice it changed, shared by every repository's list of this kind.
 * Without `saved`, changes last for this page only.
 */
export function useRepositoryPageControls(
  viewerId: string,
  source: RepositoryPageSource,
  columnIds: readonly string[],
  table: ReturnType<typeof useTableController>,
  saved?: SavedPreference<RepositoryPresentation>,
) {
  const route = recordListRoute(source);
  const url = useUrlState(route);
  const values = useMemo(() => url.values ?? {}, [url.values]);
  const { write, storageAvailable } = usePreferenceCookie(saved, {
    keys: [repositoryColumnsKey(viewerId, source.repository.id, source.kind)],
    read: (raw) => {
      const value = readRepositoryPresentation(raw, columnIds);
      return value && (JSON.parse(serializePresentation(value)) as unknown);
    },
  });
  // Choices this page saved or reset, per viewer and list kind; until then the saved value applies.
  const owner = viewerId + ':' + source.kind;
  const [changed, setChanged] = useState<{
    owner: string;
    value: RepositoryPresentation | null;
  } | null>(null);
  const current = changed?.owner === owner ? changed.value : (saved?.value ?? null);
  // Once the browser refuses the cookie, the choices saved in this page are only in memory.
  const persisted = useRef(true);
  const defaults = useMemo(() => repositoryColumnDefaults(source), [source]);
  const filters = useMemo(
    () => readRepositoryFilters(values, source, repositoryValuesAt(values, source.asOf)),
    [values, source],
  );
  // An author's own list hides its Author column by default.
  const columnTable = useMemo(
    () => recordColumnTable(source.kind, source.drilldown.selection.metric, !!source.author),
    [source],
  );
  const columns = useMemo(
    () => ({ ...defaults, ...recordColumnChoices(columnTable, values.cols) }),
    [defaults, columnTable, values.cols],
  );
  const chartsVisible = values.charts === true;
  /** The address's values now: a flushed search has already been written there. */
  const latest = useCallback((): UrlValues => {
    const parsed = parseQuery(route, window.location.search);
    return parsed.kind === 'canonical' ? parsed.values : values;
  }, [route, values]);
  /** The saved choices a change applies to: the live cookie, so another tab's field survives. */
  function prior(): RepositoryPresentation {
    const value =
      saved && persisted.current
        ? readRepositoryPresentation(readPreference(saved.binding, saved.section), columnIds)
        : current;
    return value ?? { columns: {}, chartsVisible: false };
  }
  function remember(value: RepositoryPresentation | null) {
    setChanged({ owner, value });
    const result = write(value && (JSON.parse(serializePresentation(value)) as unknown));
    if (result && result.status !== 'too-large') persisted.current = result.status === 'saved';
  }
  function changeColumns(value: Record<string, boolean>) {
    table.flushSearch();
    url.push(mergeValues(latest(), { cols: recordColumnField(columnTable, value) }));
    // Save deliberate overrides only, so context-sensitive defaults still work on another cohort.
    const saving = prior();
    const overrides = { ...saving.columns };
    for (const id of columnIds)
      if ((columns[id] !== false) !== (value[id] !== false)) overrides[id] = value[id] !== false;
    remember({ ...saving, columns: overrides });
  }
  function changeCharts(show: boolean) {
    table.flushSearch();
    url.push(mergeValues(latest(), { charts: show || undefined }));
    remember({ ...prior(), chartsVisible: show });
  }
  const updateFilters = useCallback(
    (value: RepositoryPageFilters) => {
      const captured = table.flushSearch();
      const next = latest();
      url.push(
        mergeValues(next, {
          ...repositoryFilterFields(
            { ...value, search: captured.search },
            repositoryValuesAt(next, source.asOf),
          ),
          page: undefined,
        }),
      );
    },
    [table, latest, url, source.asOf],
  );
  function clearFilters() {
    table.setSearch('');
    url.push(
      mergeValues(latest(), {
        ...repositoryFilterFields(defaultRepositoryFilters(source.kind), source.asOf),
        page: undefined,
      }),
    );
  }
  /** A record scope change loads another cohort, so the server renders it; the scroll stays. */
  function changeScope(mode: RepositoryActivityMode, range: DateRange) {
    table.flushSearch();
    const href = url.href(repositoryScopeValues(source, mode, range, latest(), columns));
    if (href) url.navigate(href, { scroll: false });
  }
  function resetPresentation() {
    table.flushSearch();
    url.push(
      mergeValues(latest(), {
        sort: undefined,
        page: undefined,
        cols: undefined,
        charts: undefined,
      }),
    );
    table.clearSavedSort();
    remember(null);
  }
  return {
    filters,
    chartsVisible,
    changeCharts,
    updateFilters,
    clearFilters,
    resetPresentation,
    changeScope,
    visibility: { value: columns, onChange: changeColumns } satisfies ColumnVisibility,
    storageAvailable: storageAvailable && table.storageAvailable,
  };
}

function serializePresentation(value: RepositoryPresentation) {
  return serializeRepositoryColumns(value.columns, value.chartsVisible);
}
