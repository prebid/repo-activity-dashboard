import { act, renderHook } from '@testing-library/react';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { useRepositoryPageControls } from '@/lib/navigation/use-repository-page-controls';
import { useTableController } from '@/lib/navigation/use-table-controller';
import { repositoryPageSample } from '@/mocks/repository-page';
import { repositoryOverviewSamples } from '@/mocks/repository-overview';
import {
  repositoryColumnsKey,
  serializeRepositoryColumns,
  type RepositoryPresentation,
} from '@/lib/presentation/repository-page-preferences';
import type { SavedPreference } from '@/models/preferences';
import {
  alice,
  preferenceSections,
  savedSection,
  seedPreferences,
} from '../support/preference-cookies';
import { defaultRepositoryFilters } from '@/lib/presentation/repository-page-query';
import { repositoryPageFiltersSchema } from '@/models/repository-page';
vi.mock('next/navigation', async () => {
  const { useSyncExternalStore } = await import('react');
  const subscribe = (notify: () => void) => {
    window.addEventListener('test-navigation', notify);
    window.addEventListener('popstate', notify);
    return () => {
      window.removeEventListener('test-navigation', notify);
      window.removeEventListener('popstate', notify);
    };
  };
  return {
    usePathname: () =>
      useSyncExternalStore(
        subscribe,
        () => window.location.pathname,
        () => '/repos',
      ),
    useSearchParams: () =>
      new URLSearchParams(
        useSyncExternalStore(
          subscribe,
          () => window.location.search,
          () => '',
        ),
      ),
  };
});

const repo = repositoryOverviewSamples().repositories[0].repository;
const prs = repositoryPageSample(repo, {
  selection: { scope: 'current', metric: 'totalOpenPrs' },
  returnTo: '/repos?age=60',
});
const issues = repositoryPageSample(repo, {
  selection: { scope: 'current', metric: 'openIssues' },
  returnTo: '/repos',
});
const columns = ['ageDays', 'createdAt'],
  sorts = ['createdAt', 'number'];
const defaultSort = { sort: 'createdAt', descending: true };
const bob = { accountId: 'bob', authVersion: 0 };
const history: { action: string; href: string }[] = [];
beforeEach(() => {
  history.length = 0;
  window.history.replaceState(null, '', '/repos/prebidjs');
  for (const action of ['replaceState', 'pushState'] as const) {
    const native = window.history[action].bind(window.history);
    vi.spyOn(window.history, action).mockImplementation(
      (data: unknown, unused: string, url?: string | URL | null) => {
        native(data, unused, url);
        history.push({ action, href: window.location.href });
        window.dispatchEvent(new Event('test-navigation'));
      },
    );
  }
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});
type SavedSort = SavedPreference<{ sort: string; descending: boolean }>;
/** The sections route composition hands a record list; by default Alice's, with nothing saved. */
function sections(kind: 'prs' | 'issues' = 'prs', binding = alice) {
  return {
    sort: savedSection(`repository.${kind}.sort`, null, undefined, binding) as SavedSort,
    presentation: savedSection(
      `repository.${kind}.columns`,
      null,
      undefined,
      binding,
    ) as SavedPreference<RepositoryPresentation>,
  };
}
/** A section value, exactly as the existing serializer writes it. */
const stored = (overrides: Record<string, boolean>, chartsVisible = false) =>
  JSON.parse(serializeRepositoryColumns(overrides, chartsVisible)) as unknown;
function useControls(
  viewerId = 'alice',
  source = prs,
  saved: ReturnType<typeof sections> | null = sections(source.kind),
) {
  const table = useTableController({
    queryKey: source.kind,
    scopeKey: 'repository:' + source.repository.slug + ':' + source.kind,
    viewerId,
    columnIds: sorts,
    defaultSort,
    historyMode: 'push',
    savedSort: saved?.sort,
  });
  const settings = useRepositoryPageControls(viewerId, source, columns, table, saved?.presentation);
  return { table, settings };
}

it('starts from the saved list-kind presentation for every repository, with explicit URLs taking precedence', () => {
  const saved = {
    sort: savedSection('repository.prs.sort', { sort: 'number', descending: false }),
    presentation: savedSection<RepositoryPresentation>('repository.prs.columns', {
      columns: { ageDays: false },
      chartsVisible: false,
    }),
  };
  const { result, rerender } = renderHook(
    ({ viewerId, source, saved }) => useControls(viewerId, source, saved),
    { initialProps: { viewerId: 'alice', source: prs, saved } },
  );
  expect(result.current.settings.visibility.value.ageDays).toBe(false);
  expect(result.current.table.query.sort).toBe('number');
  expect(result.current.settings.filters).toEqual(defaultRepositoryFilters('prs'));
  expect(history).toEqual([]);
  act(() =>
    window.history.replaceState(
      null,
      '',
      '/repos/prebidjs?prs.columns=ageDays&prs.sort=createdAt&prs.dir=desc',
    ),
  );
  expect(result.current.settings.visibility.value.ageDays).toBe(true);
  expect(result.current.table.query.sort).toBe('createdAt');
  act(() => window.history.replaceState(null, '', '/repos/prebidjs'));
  // Another account's sections arrive empty from the server.
  rerender({ viewerId: 'bob', source: prs, saved: sections('prs', bob) });
  expect(result.current.settings.visibility.value.ageDays).toBe(true);
  expect(result.current.table.query.sort).toBe('createdAt');
  rerender({ viewerId: 'alice', source: issues, saved: sections('issues') });
  expect(result.current.settings.filters?.kind).toBe('issues');
  expect(result.current.settings.visibility.value.ageDays).toBe(true);
  // One saved pull request presentation serves every repository.
  rerender({
    viewerId: 'alice',
    source: { ...prs, repository: { ...repo, id: 'another', slug: 'another' } },
    saved,
  });
  expect(result.current.settings.visibility.value.ageDays).toBe(false);
  expect(result.current.table.query.sort).toBe('number');
});
it('captures pending search before applying filters, resets pages, preserves context and does not save filters', () => {
  vi.useFakeTimers();
  window.history.replaceState(
    null,
    '',
    '/repos/prebidjs?scope=current&metric=agedPrs&age=60&prs.page=2&returnTo=%2Frepos%3Fage%3D60',
  );
  const { result } = renderHook(() => useControls());
  act(() => result.current.table.setSearch('sample'));
  act(() =>
    result.current.settings.updateFilters(
      repositoryPageFiltersSchema.parse({ kind: 'prs', authorTypes: ['agent'] }),
    ),
  );
  expect(result.current.settings.filters).toMatchObject({
    search: 'sample',
    authorTypes: ['agent'],
  });
  expect(result.current.table.query.page).toBe(1);
  expect(new URLSearchParams(window.location.search).get('age')).toBe('60');
  expect(new URLSearchParams(window.location.search).get('returnTo')).toBe('/repos?age=60');
  expect(preferenceSections('repositories')).toBeNull();
  const after = window.location.href;
  act(() => result.current.table.update({ page: 2 }));
  expect(result.current.table.query.page).toBe(2);
  act(() => {
    window.history.replaceState(null, '', after);
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  expect(result.current.table.query.page).toBe(1);
  expect(result.current.settings.filters?.authorTypes).toEqual(['agent']);
  act(() => result.current.table.setSearch('cancel this'));
  act(() => result.current.settings.clearFilters());
  act(() => {
    vi.runAllTimers();
  });
  expect(result.current.settings.filters).toEqual(defaultRepositoryFilters('prs'));
  expect(result.current.table.draftSearch).toBe('');
  expect(preferenceSections('repositories')).toBeNull();
});
it('saves deliberate column overrides and resets presentation without clearing cohort filters', () => {
  window.history.replaceState(null, '', '/repos/prebidjs?prs.filter.draft=drafts');
  const { result } = renderHook(() => useControls());
  act(() =>
    result.current.settings.visibility.onChange({
      ...result.current.settings.visibility.value,
      createdAt: true,
    }),
  );
  expect(preferenceSections('repositories')).toEqual({
    'repository.prs.columns': stored({ createdAt: true }),
  });
  const columnsBefore = history.at(-2)!.href;
  expect(new URL(columnsBefore).searchParams.getAll('prs.columns')).toEqual(['ageDays']);
  act(() =>
    result.current.settings.visibility.onChange({
      ...result.current.settings.visibility.value,
      ageDays: false,
    }),
  );
  act(() => result.current.table.update({ sort: 'number', descending: false, page: 1 }));
  expect(preferenceSections('repositories')).toEqual({
    'repository.prs.columns': stored({ createdAt: true, ageDays: false }),
    'repository.prs.sort': { sort: 'number', descending: false },
  });
  const beforeSort = history.at(-2)!.href;
  expect(new URL(beforeSort).searchParams.get('prs.sort')).toBe('createdAt');
  expect(new URL(beforeSort).searchParams.get('prs.dir')).toBe('desc');
  act(() => result.current.settings.resetPresentation());
  expect(result.current.table.query).toMatchObject({
    sort: 'createdAt',
    descending: true,
    page: 1,
  });
  expect(result.current.settings.visibility.value).toMatchObject({
    ageDays: true,
    createdAt: false,
  });
  expect(result.current.settings.filters).toMatchObject({ draft: 'drafts' });
  expect(preferenceSections('repositories')).toBeNull();
  act(() => result.current.settings.resetPresentation());
  expect(preferenceSections('repositories')).toBeNull();
  act(() => result.current.settings.visibility.onChange(result.current.settings.visibility.value));
  act(() => {
    window.history.replaceState(null, '', beforeSort);
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  expect(result.current.table.query.sort).toBe('createdAt');
  expect(result.current.settings.visibility.value.ageDays).toBe(false);
});
it('recovers invalid filters and keeps changes in memory when the browser refuses the cookie', () => {
  vi.spyOn(Document.prototype, 'cookie', 'set').mockImplementation(() => {});
  window.history.replaceState(null, '', '/repos/prebidjs?prs.filter.bad=1');
  const { result } = renderHook(() => useControls());
  expect(result.current.settings.filters).toBeNull();
  expect(result.current.settings.storageAvailable).toBe(true);
  act(() => result.current.settings.clearFilters());
  expect(result.current.settings.filters).toEqual(defaultRepositoryFilters('prs'));
  act(() => result.current.settings.visibility.onChange({ ageDays: false, createdAt: true }));
  expect(result.current.settings.storageAvailable).toBe(false);
  act(() => result.current.settings.changeCharts(true));
  act(() => result.current.table.update({ sort: 'number' }));
  expect(result.current.settings.visibility.value.ageDays).toBe(false);
  expect(result.current.settings.chartsVisible).toBe(true);
  act(() => window.history.replaceState(null, '', '/repos/prebidjs'));
  // Both choices remain for this page although neither could be saved.
  expect(result.current.settings.visibility.value.ageDays).toBe(false);
  expect(result.current.settings.chartsVisible).toBe(true);
  // A blocked jar holds no saved choice, so the reset's deletion succeeds and the defaults return.
  act(() => result.current.settings.resetPresentation());
  expect(result.current.settings.visibility.value.ageDays).toBe(true);
  expect(result.current.settings.chartsVisible).toBe(false);
});

it('saves chart visibility as its own field and restores it through history, accounts and reset', () => {
  seedPreferences(alice, { 'repository.prs.columns': stored({ ageDays: false }) });
  const saved = {
    ...sections(),
    presentation: savedSection<RepositoryPresentation>('repository.prs.columns', {
      columns: { ageDays: false },
      chartsVisible: false,
    }),
  };
  const { result, rerender } = renderHook(
    ({ viewerId, saved }) => useControls(viewerId, prs, saved),
    { initialProps: { viewerId: 'alice', saved } },
  );
  expect(result.current.settings.chartsVisible).toBe(false);
  // Another tab shows the issue charts and changes a pull request column after this page rendered.
  seedPreferences(alice, {
    'repository.issues.columns': stored({}, true),
    'repository.prs.columns': stored({ ageDays: false, createdAt: true }),
  });
  act(() => result.current.settings.changeCharts(true));
  expect(result.current.settings.chartsVisible).toBe(true);
  expect(preferenceSections('repositories')).toEqual({
    'repository.issues.columns': stored({}, true),
    'repository.prs.columns': stored({ ageDays: false, createdAt: true }, true),
  });
  const hidden = window.location.href;
  act(() => window.history.replaceState(null, '', '/repos/prebidjs'));
  expect(result.current.settings.chartsVisible).toBe(true);
  rerender({ viewerId: 'bob', saved: sections('prs', bob) });
  expect(result.current.settings.chartsVisible).toBe(false);
  rerender({ viewerId: 'alice', saved });
  expect(result.current.settings.chartsVisible).toBe(true);
  act(() => result.current.settings.changeCharts(false));
  expect(result.current.settings.chartsVisible).toBe(false);
  act(() => {
    window.history.replaceState(null, '', hidden);
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  expect(result.current.settings.chartsVisible).toBe(true);
  act(() => result.current.settings.resetPresentation());
  expect(result.current.settings.chartsVisible).toBe(false);
  act(() => result.current.settings.changeCharts(false));
  expect(result.current.settings.chartsVisible).toBe(false);
});

it('renders the defaults for a rejected section and deletes it once after hydration', () => {
  const rejected = { version: 2, columns: [] };
  seedPreferences(alice, { 'repository.prs.columns': rejected });
  const { result } = renderHook(() =>
    useControls('alice', prs, {
      ...sections(),
      presentation: savedSection('repository.prs.columns', null, JSON.stringify(rejected)),
    }),
  );
  expect(result.current.settings.visibility.value.ageDays).toBe(true);
  expect(preferenceSections('repositories')).toBeNull();
  expect(history).toEqual([]);
});

it('copies a former browser-storage value once, applying it from the next request', () => {
  const key = repositoryColumnsKey('alice', repo.id, 'prs');
  localStorage.setItem(key, serializeRepositoryColumns({ ageDays: false, retired: true }, true));
  const { result } = renderHook(() => useControls());
  expect(result.current.settings.visibility.value.ageDays).toBe(true);
  expect(result.current.settings.chartsVisible).toBe(false);
  expect(preferenceSections('repositories')).toEqual({
    'repository.prs.columns': stored({ ageDays: false }, true),
  });
  expect(localStorage.getItem(key)).toBeNull();
  expect(history).toEqual([]);
  localStorage.setItem(repositoryColumnsKey('alice', repo.id, 'issues'), '[]');
  renderHook(() => useControls('alice', issues));
  expect(preferenceSections('repositories')).not.toHaveProperty('repository.issues.columns');
});

it('keeps choices for this page only without saved sections', () => {
  const { result } = renderHook(() => useControls('alice', prs, null));
  act(() => result.current.settings.visibility.onChange({ ageDays: false, createdAt: true }));
  act(() => result.current.settings.changeCharts(true));
  expect(result.current.settings.visibility.value.ageDays).toBe(false);
  expect(result.current.settings.chartsVisible).toBe(true);
  expect(result.current.settings.storageAvailable).toBe(true);
  expect(preferenceSections('repositories')).toBeNull();
});
