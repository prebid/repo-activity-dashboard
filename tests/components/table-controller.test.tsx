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
let historySpy: MockInstance<History['replaceState']>;
beforeEach(() => {
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
  const changes = vi.fn();
  const { result, rerender } = renderHook(() =>
    useTableController({
      ...options,
      columnIds: [...columnIds],
      onChange: (q) => {
        changes(q);
      },
    }),
  );
  expect(changes).toHaveBeenCalledExactlyOnceWith({ ...initial, page: 2 });
  rerender();
  expect(changes).toHaveBeenCalledTimes(1);
  act(() => result.current.update({ search: 'needle', page: 1 }));
  expect(changes).toHaveBeenLastCalledWith({ ...initial, search: 'needle' });
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
it('cancels a pending draft on same-URL link intent, browser history, and scope changes', () => {
  vi.useFakeTimers();
  const { result, rerender } = renderHook(
    ({ scope }) => useTableController({ ...options, scopeKey: scope }),
    { initialProps: { scope: 'one' } },
  );
  act(() => result.current.setSearch('discard'));
  const link = document.createElement('a');
  link.href = '/';
  document.body.append(link);
  act(() => {
    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
  act(() => {
    vi.runAllTimers();
  });
  expect(result.current.draftSearch).toBe('');
  link.remove();
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
it('notifies changed namespaces and normalizes pages in memory until the next action', () => {
  window.history.replaceState(null, '', '/?items.page=9');
  const first = vi.fn(),
    second = vi.fn();
  const { result, rerender } = renderHook(
    ({ key, notify }) => useTableController({ ...options, queryKey: key, onChange: notify }),
    { initialProps: { key: 'items', notify: first } },
  );
  act(() => result.current.reconcilePage(2));
  expect(result.current.query.page).toBe(2);
  expect(window.location.search).toBe('?items.page=9');
  act(() => result.current.update({ descending: true }));
  expect(new URLSearchParams(window.location.search).get('items.page')).toBe('2');
  rerender({ key: 'issues', notify: second });
  expect(second).toHaveBeenCalledExactlyOnceWith(initial);
});
