import { act, renderHook } from '@testing-library/react';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { useRepositoryPageControls } from '@/lib/navigation/use-repository-page-controls';
import { useTableController } from '@/lib/navigation/use-table-controller';
import { repositoryPageSample } from '@/mocks/repository-page';
import { repositoryOverviewSamples } from '@/mocks/repository-overview';
import {
  repositoryColumnsKey,
  serializeRepositoryColumns,
} from '@/lib/presentation/repository-page-preferences';
import { preferenceKey } from '@/lib/presentation/table-query';
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
function useControls(viewerId = 'alice', source = prs) {
  const table = useTableController({
    queryKey: source.kind,
    scopeKey: 'repository:' + source.repository.slug + ':' + source.kind,
    viewerId,
    columnIds: sorts,
    defaultSort,
    historyMode: 'push',
  });
  const settings = useRepositoryPageControls(viewerId, source, columns, table);
  return { table, settings };
}
it('restores presentation only, gives explicit URLs precedence, and isolates account/repository/tab preferences', () => {
  localStorage.setItem(
    repositoryColumnsKey('alice', repo.id, 'prs'),
    serializeRepositoryColumns({ ageDays: false }),
  );
  localStorage.setItem(
    preferenceKey('alice', 'repository:' + repo.slug + ':prs'),
    JSON.stringify({ sort: 'number', descending: false }),
  );
  const { result, rerender } = renderHook(({ viewerId, source }) => useControls(viewerId, source), {
    initialProps: { viewerId: 'alice', source: prs },
  });
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
  rerender({ viewerId: 'bob', source: prs });
  expect(result.current.settings.visibility.value.ageDays).toBe(true);
  expect(result.current.table.query.sort).toBe('createdAt');
  rerender({ viewerId: 'alice', source: issues });
  expect(result.current.settings.filters?.kind).toBe('issues');
  expect(result.current.settings.visibility.value.ageDays).toBe(true);
  rerender({
    viewerId: 'alice',
    source: { ...prs, repository: { ...repo, id: 'another', slug: 'another' } },
  });
  expect(result.current.settings.visibility.value.ageDays).toBe(true);
  rerender({ viewerId: 'alice', source: prs });
  expect(result.current.settings.visibility.value.ageDays).toBe(false);
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
  expect(localStorage.length).toBe(0);
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
  expect(JSON.parse(localStorage.getItem(repositoryColumnsKey('alice', repo.id, 'prs'))!)).toEqual({
    version: 1,
    columns: { createdAt: true },
    chartsVisible: false,
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
  expect(localStorage.length).toBe(0);
  act(() => result.current.settings.resetPresentation());
  expect(localStorage.length).toBe(0);
  act(() => result.current.settings.visibility.onChange(result.current.settings.visibility.value));
  act(() => {
    window.history.replaceState(null, '', beforeSort);
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  expect(result.current.table.query.sort).toBe('createdAt');
  expect(result.current.settings.visibility.value.ageDays).toBe(false);
});
it('recovers invalid filters and survives denied storage for reading, saving and resetting', () => {
  for (const method of ['getItem', 'setItem', 'removeItem'] as const)
    vi.spyOn(Storage.prototype, method).mockImplementation(() => {
      throw new Error('denied');
    });
  window.history.replaceState(null, '', '/repos/prebidjs?prs.filter.bad=1');
  const { result } = renderHook(() => useControls());
  expect(result.current.settings.filters).toBeNull();
  expect(result.current.settings.storageAvailable).toBe(false);
  act(() => result.current.settings.clearFilters());
  expect(result.current.settings.filters).toEqual(defaultRepositoryFilters('prs'));
  act(() => result.current.settings.visibility.onChange({ ageDays: false, createdAt: true }));
  act(() => result.current.table.update({ sort: 'number' }));
  expect(result.current.settings.visibility.value.ageDays).toBe(false);
  expect(result.current.settings.storageAvailable).toBe(false);
  act(() => result.current.settings.resetPresentation());
  expect(result.current.settings.visibility.value.ageDays).toBe(true);
  expect(result.current.settings.storageAvailable).toBe(false);
});

it('saves chart visibility separately from filters and restores it through history, scope changes and reset', () => {
  const { result, rerender } = renderHook(({ viewerId }) => useControls(viewerId), {
    initialProps: { viewerId: 'alice' },
  });
  expect(result.current.settings.chartsVisible).toBe(false);
  act(() => result.current.settings.changeCharts(true));
  expect(result.current.settings.chartsVisible).toBe(true);
  const hidden = window.location.href;
  act(() =>
    result.current.settings.visibility.onChange({
      ...result.current.settings.visibility.value,
      createdAt: true,
    }),
  );
  act(() => window.history.replaceState(null, '', '/repos/prebidjs'));
  expect(result.current.settings.chartsVisible).toBe(true);
  rerender({ viewerId: 'bob' });
  expect(result.current.settings.chartsVisible).toBe(false);
  rerender({ viewerId: 'alice' });
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
