import { beforeEach, afterEach, it, expect, vi, type MockInstance } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTableController } from '@/lib/navigation/use-table-controller';
import { preferenceKey } from '@/lib/presentation/table-query';
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
        () => '/',
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
const columnIds = ['name'],
  initial = { search: '', sort: '', descending: false, page: 1 };
const options = { queryKey: 'items', scopeKey: 'items', columnIds };
it('migrates entity sorts into a shared table scope without overwriting current choices or other preferences', () => {
  localStorage.clear();
  window.history.replaceState(null, '', '/contributors/alice');
  const old = preferenceKey('alice', 'old-alice'),
    next = preferenceKey('alice', 'shared-table');
  const untouched = preferenceKey('bob', 'old-alice');
  localStorage.setItem(old, JSON.stringify({ sort: 'name', descending: true }));
  localStorage.setItem(untouched, 'keep');
  localStorage.setItem('columns:alice', 'keep-columns');
  const { result, rerender } = renderHook(
    ({ legacy }) =>
      useTableController({
        ...options,
        viewerId: 'alice',
        scopeKey: 'shared-table',
        legacyScopeKey: legacy,
      }),
    { initialProps: { legacy: 'old-alice' } },
  );
  expect(result.current.query).toMatchObject({ sort: 'name', descending: true });
  expect(localStorage.getItem(old)).toBeNull();
  expect(localStorage.getItem(next)).toBe(JSON.stringify({ sort: 'name', descending: true }));
  act(() => result.current.update({ sort: 'name', descending: false }));
  localStorage.setItem(
    preferenceKey('alice', 'old-bob'),
    JSON.stringify({ sort: 'name', descending: true }),
  );
  rerender({ legacy: 'old-bob' });
  expect(result.current.query.descending).toBe(false);
  expect(localStorage.getItem(preferenceKey('alice', 'old-bob'))).toBeNull();
  expect(localStorage.getItem(untouched)).toBe('keep');
  expect(localStorage.getItem('columns:alice')).toBe('keep-columns');
});
it('retains a readable legacy sort and its old copy when migration storage is unavailable', () => {
  localStorage.clear();
  window.history.replaceState(null, '', '/contributors/alice');
  const old = preferenceKey('alice', 'legacy');
  localStorage.setItem(old, JSON.stringify({ sort: 'name', descending: true }));
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw Error('full');
  });
  const { result } = renderHook(() =>
    useTableController({
      ...options,
      viewerId: 'alice',
      scopeKey: 'shared',
      legacyScopeKey: 'legacy',
    }),
  );
  expect(result.current.query).toMatchObject({ sort: 'name', descending: true });
  expect(result.current.storageAvailable).toBe(false);
  expect(localStorage.getItem(old)).not.toBeNull();
});
it('keeps the legacy copy when the shared sort is invalid instead of deleting both recovery paths', () => {
  localStorage.clear();
  window.history.replaceState(null, '', '/contributors/alice');
  const old = preferenceKey('alice', 'legacy');
  localStorage.setItem(old, JSON.stringify({ sort: 'name', descending: true }));
  localStorage.setItem(preferenceKey('alice', 'shared'), '{invalid');
  const { result } = renderHook(() =>
    useTableController({
      ...options,
      viewerId: 'alice',
      scopeKey: 'shared',
      legacyScopeKey: 'legacy',
    }),
  );
  expect(result.current.query.sort).toBe('');
  expect(localStorage.getItem(old)).toBe(JSON.stringify({ sort: 'name', descending: true }));
});
let historySpy: MockInstance<History['replaceState']>;
let pushSpy: MockInstance<History['pushState']>;
beforeEach(() => {
  const push = window.history.pushState.bind(window.history);
  pushSpy = vi
    .spyOn(window.history, 'pushState')
    .mockImplementation((data: unknown, unused: string, url?: string | URL | null) => {
      push(data, unused, url);
      window.dispatchEvent(new Event('test-navigation'));
    });
  const native = window.history.replaceState.bind(window.history);
  historySpy = vi
    .spyOn(window.history, 'replaceState')
    .mockImplementation((data: unknown, unused: string, url?: string | URL | null) => {
      native(data, unused, url);
      window.dispatchEvent(new Event('test-navigation'));
    });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});
it('observes router changes, uses null external state, and preserves unrelated query values', () => {
  window.history.replaceState({ __NA: true }, '', '/?items.page=2&view=issues&repo=a&repo=b');
  const { result } = renderHook(() =>
    useTableController({ ...options, columnIds: [...columnIds] }),
  );
  expect(result.current.query).toEqual({ ...initial, page: 2 });
  act(() => result.current.update({ search: 'needle', page: 1 }));
  expect(result.current.query).toEqual({ ...initial, search: 'needle' });
  expect(historySpy).toHaveBeenLastCalledWith(null, '', expect.any(URL));
  expect(new URLSearchParams(window.location.search).getAll('repo')).toEqual(['a', 'b']);
  act(() => window.history.replaceState(null, '', '/'));
  expect(result.current.query).toEqual(initial);
  expect(result.current.draftSearch).toBe('');
});
it('restores scoped preferences in memory, gives the URL precedence, and survives new column-array identities', () => {
  localStorage.setItem(
    preferenceKey('alice', 'items'),
    JSON.stringify({ sort: 'name', descending: true }),
  );
  const { result, rerender, unmount } = renderHook(() =>
    useTableController({ ...options, columnIds: [...columnIds], viewerId: 'alice' }),
  );
  expect(result.current.query).toEqual({ ...initial, sort: 'name', descending: true });
  expect(window.location.search).toBe('');
  rerender();
  act(() => result.current.update({ sort: 'name', descending: false }));
  expect(result.current.query.descending).toBe(false);
  unmount();
  window.history.replaceState(null, '', '/?items.sort=name&items.dir=asc');
  const next = renderHook(() => useTableController({ ...options, viewerId: 'alice' }));
  expect(next.result.current.query.descending).toBe(false);
});
it.each(['{', '{"sort":"retired","descending":true}', 'null', '{"sort":"name"}'])(
  'ignores malformed preference %s',
  (value) => {
    localStorage.setItem(preferenceKey('alice', 'items'), value);
    const { result } = renderHook(() => useTableController({ ...options, viewerId: 'alice' }));
    expect(result.current.query).toEqual(initial);
  },
);
it('works when preference storage is denied', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('denied');
  });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('denied');
  });
  const { result } = renderHook(() => useTableController({ ...options, viewerId: 'alice' }));
  act(() => result.current.update({ sort: 'name', descending: true }));
  expect(result.current.query.sort).toBe('name');
});
it('debounces typing and captures the latest draft when sorting or exporting immediately', () => {
  vi.useFakeTimers();
  const { result } = renderHook(() => useTableController(options));
  act(() => result.current.setSearch('latest'));
  expect(result.current.draftSearch).toBe('latest');
  expect(window.location.search).toBe('');
  act(() => {
    vi.advanceTimersByTime(249);
  });
  expect(window.location.search).toBe('');
  act(() => {
    vi.advanceTimersByTime(1);
  });
  expect(result.current.query.search).toBe('latest');
  act(() => result.current.setSearch('sort now'));
  act(() => result.current.update({ sort: 'name', page: 3 }));
  expect(result.current.query).toEqual({
    search: 'sort now',
    sort: 'name',
    descending: false,
    page: 1,
  });
  act(() => result.current.setSearch('export now'));
  let captured;
  act(() => {
    captured = result.current.flushSearch();
  });
  expect(captured).toEqual({ search: 'export now', sort: 'name', descending: false, page: 1 });
  act(() => {
    vi.runAllTimers();
  });
  expect(result.current.query.search).toBe('export now');
});
it('cancels a pending draft on browser history and scope changes', () => {
  vi.useFakeTimers();
  const { result, rerender } = renderHook(
    ({ scope }) => useTableController({ ...options, scopeKey: scope }),
    { initialProps: { scope: 'one' } },
  );
  act(() => result.current.setSearch('old scope'));
  rerender({ scope: 'two' });
  act(() => {
    vi.runAllTimers();
  });
  expect(window.location.search).toBe('');
  act(() => result.current.setSearch('old page'));
  act(() => {
    window.history.replaceState(null, '', '/?items.q=destination');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  act(() => {
    vi.runAllTimers();
  });
  expect(result.current.draftSearch).toBe('destination');
});
it('normalizes pages in memory and changes namespaces without callback state', () => {
  window.history.replaceState(null, '', '/?items.page=9');
  const { result, rerender } = renderHook(
    ({ key }) => useTableController({ ...options, queryKey: key }),
    { initialProps: { key: 'items' } },
  );
  act(() => result.current.reconcilePage(2));
  expect(result.current.query.page).toBe(2);
  expect(window.location.search).toBe('?items.page=9');
  act(() => result.current.update({ descending: true }));
  expect(new URLSearchParams(window.location.search).get('items.page')).toBe('2');
  rerender({ key: 'issues' });
  expect(result.current.query).toEqual(initial);
});
it('does not write history when flushing an untouched default query', () => {
  const { result } = renderHook(() => useTableController(options));
  historySpy.mockClear();
  act(() => {
    result.current.flushSearch();
  });
  expect(window.location.search).toBe('');
  expect(historySpy).not.toHaveBeenCalled();
});

it('coalesces paused search bursts into one history entry and preserves the pre-search page', () => {
  vi.useFakeTimers();
  const before = '/?items.page=2&items.sort=name&items.dir=desc&retained=yes';
  window.history.replaceState(null, '', before);
  const { result } = renderHook(() => useTableController({ ...options, historyMode: 'push' }));
  for (const value of ['Sa', 'Samp', 'Sample']) {
    act(() => result.current.setSearch(value));
    act(() => {
      vi.advanceTimersByTime(250);
    });
  }
  expect(pushSpy).toHaveBeenCalledTimes(1);
  expect(result.current.query).toEqual({
    search: 'Sample',
    sort: 'name',
    descending: true,
    page: 1,
  });
  expect(new URLSearchParams(window.location.search).get('retained')).toBe('yes');
  const finished = window.location.href;
  act(() => {
    window.history.replaceState(null, '', before);
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  expect(result.current.query).toEqual({ search: '', sort: 'name', descending: true, page: 2 });
  act(() => {
    window.history.replaceState(null, '', finished);
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  expect(result.current.query.search).toBe('Sample');
  act(() => result.current.setSearch('Next search'));
  act(() => {
    vi.advanceTimersByTime(250);
  });
  expect(pushSpy).toHaveBeenCalledTimes(2);
});
it('starts a separate search entry after table, filter and account/scope changes', () => {
  vi.useFakeTimers();
  const { result, rerender } = renderHook(
    ({ scope }) => useTableController({ ...options, historyMode: 'push', scopeKey: scope }),
    { initialProps: { scope: 'one' } },
  );
  const type = (value: string) => {
    act(() => result.current.setSearch(value));
    act(() => {
      vi.advanceTimersByTime(250);
    });
  };
  type('first');
  act(() => result.current.update({ sort: 'name', page: 1 }));
  type('second');
  expect(pushSpy).toHaveBeenCalledTimes(3);
  act(() => window.history.pushState(null, '', window.location.href + '&filter=changed'));
  type('third');
  expect(pushSpy).toHaveBeenCalledTimes(5);
  rerender({ scope: 'two' });
  type('fourth');
  expect(pushSpy).toHaveBeenCalledTimes(6);
  act(() => {
    result.current.flushSearch();
  });
  expect(pushSpy).toHaveBeenCalledTimes(6);
});
