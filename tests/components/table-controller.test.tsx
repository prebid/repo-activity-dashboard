import { beforeEach, afterEach, it, expect, vi, type MockInstance } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTableController } from '@/lib/navigation/use-table-controller';
import { preferenceKey } from '@/lib/presentation/table-query';
import {
  alice,
  preferenceSections,
  savedSection,
  seedPreferences,
} from '../support/preference-cookies';
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
const sortSection = 'overview.backlog.sort' as const;
it('copies a legacy localStorage sort into an absent section once, from the next request', () => {
  window.history.replaceState(null, '', '/repos');
  const old = preferenceKey('alice', 'old-alice'),
    current = preferenceKey('alice', 'shared-table'),
    untouched = preferenceKey('bob', 'old-alice');
  localStorage.setItem(old, JSON.stringify({ sort: 'name', descending: true }));
  localStorage.setItem(untouched, 'keep');
  const { result } = renderHook(() =>
    useTableController({
      ...options,
      viewerId: 'alice',
      scopeKey: 'shared-table',
      legacyScopeKey: 'old-alice',
      savedSort: savedSection(sortSection),
    }),
  );
  // This render keeps the defaults the server rendered; the copy applies from the next request.
  expect(result.current.query).toEqual(initial);
  expect(preferenceSections('repositories')).toEqual({
    [sortSection]: { sort: 'name', descending: true },
  });
  expect(localStorage.getItem(old)).toBeNull();
  expect(localStorage.getItem(current)).toBeNull();
  expect(localStorage.getItem(untouched)).toBe('keep');
});
it('copies no invalid legacy sort and deletes an invalid cookie section after hydration', () => {
  window.history.replaceState(null, '', '/repos');
  localStorage.setItem(preferenceKey('alice', 'items'), '{"sort":"retired","descending":true}');
  renderHook(() =>
    useTableController({ ...options, viewerId: 'alice', savedSort: savedSection(sortSection) }),
  );
  expect(preferenceSections('repositories')).toBeNull();
  expect(localStorage.getItem(preferenceKey('alice', 'items'))).toBeNull();
  seedPreferences(alice, { [sortSection]: { sort: 3 }, overview: 'kept' });
  const { result } = renderHook(() =>
    useTableController({
      ...options,
      viewerId: 'alice',
      savedSort: savedSection(sortSection, null, '{"sort":3}'),
    }),
  );
  expect(result.current.query).toEqual(initial);
  expect(preferenceSections('repositories')).toEqual({ overview: 'kept' });
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
it('starts from the server-validated sort, gives the URL precedence, and saves deliberate sorts', () => {
  window.history.replaceState(null, '', '/repos');
  seedPreferences(alice, { overview: 'kept' });
  const savedSort = savedSection(sortSection, { sort: 'name', descending: true });
  historySpy.mockClear();
  const { result, rerender, unmount } = renderHook(() =>
    useTableController({ ...options, columnIds: [...columnIds], viewerId: 'alice', savedSort }),
  );
  expect(result.current.query).toEqual({ ...initial, sort: 'name', descending: true });
  expect(window.location.search).toBe('');
  expect(historySpy).not.toHaveBeenCalled();
  expect(preferenceSections('repositories')).toEqual({ overview: 'kept' });
  rerender();
  act(() => result.current.update({ sort: 'name', descending: false }));
  expect(result.current.query.descending).toBe(false);
  expect(preferenceSections('repositories')).toEqual({
    overview: 'kept',
    [sortSection]: { sort: 'name', descending: false },
  });
  // Paging is not a sort choice, so it saves nothing.
  act(() => result.current.update({ page: 2 }));
  expect(preferenceSections('repositories')![sortSection]).toEqual({
    sort: 'name',
    descending: false,
  });
  act(() => result.current.clearSavedSort());
  expect(preferenceSections('repositories')).toEqual({ overview: 'kept' });
  act(() => window.history.replaceState(null, '', '/repos'));
  expect(result.current.query).toEqual(initial);
  unmount();
  window.history.replaceState(null, '', '/repos?items.sort=name&items.dir=asc');
  const next = renderHook(() => useTableController({ ...options, viewerId: 'alice', savedSort }));
  expect(next.result.current.query.descending).toBe(false);
});
it('keeps a sort in memory when the browser keeps no cookie, and saves none without a section', () => {
  window.history.replaceState(null, '', '/repos');
  vi.spyOn(Document.prototype, 'cookie', 'set').mockImplementation(() => {});
  const { result } = renderHook(() =>
    useTableController({ ...options, viewerId: 'alice', savedSort: savedSection(sortSection) }),
  );
  act(() => result.current.update({ sort: 'name', descending: true }));
  expect(result.current.query.sort).toBe('name');
  expect(result.current.storageAvailable).toBe(false);
  vi.restoreAllMocks();
  const writes = vi.spyOn(Document.prototype, 'cookie', 'set');
  const anonymous = renderHook(() => useTableController(options));
  act(() => anonymous.result.current.update({ sort: 'name', descending: true }));
  act(() => anonymous.result.current.clearSavedSort());
  expect(writes).not.toHaveBeenCalled();
  expect(anonymous.result.current.storageAvailable).toBe(true);
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

it('commits pending search before internal link navigation and cancels its delayed history write', () => {
  vi.useFakeTimers();
  window.history.replaceState(null, '', '/source');
  const { result, unmount } = renderHook(() => useTableController(options));
  act(() => result.current.setSearch('needle'));
  const link = document.createElement('a');
  link.href = '/destination?keep=1';
  const label = document.createElement('span');
  link.append(label);
  document.body.append(link);
  let captured: string | null = null;
  link.addEventListener('click', (event) => {
    captured = new URLSearchParams(window.location.search).get('items.q');
    event.preventDefault();
    window.history.replaceState(null, '', '/destination?keep=1');
  });
  try {
    act(() => {
      label.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    expect(captured).toBe('needle');
    const writes = historySpy.mock.calls.length;
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(window.location.pathname + window.location.search).toBe('/destination?keep=1');
    expect(historySpy).toHaveBeenCalledTimes(writes);
  } finally {
    link.remove();
    unmount();
  }
});

it.each([
  { name: 'external', href: 'https://example.test/record' },
  { name: 'new tab', target: '_blank' },
  { name: 'download', download: true },
  { name: 'Meta click', event: { metaKey: true } },
  { name: 'Control click', event: { ctrlKey: true } },
  { name: 'Shift click', event: { shiftKey: true } },
  { name: 'Alt click', event: { altKey: true } },
  { name: 'non-primary click', event: { button: 1 } },
  { name: 'prevented navigation', prevented: true },
])(
  'does not flush a pending search for $name',
  ({ href, target, download, event: init, prevented }) => {
    vi.useFakeTimers();
    window.history.replaceState(null, '', '/source');
    const { result, unmount } = renderHook(() => useTableController(options));
    act(() => result.current.setSearch('needle'));
    const link = document.createElement('a');
    link.href = href ?? '/destination';
    if (target) link.target = target;
    if (download) link.download = 'records.csv';
    link.addEventListener('click', (event) => event.preventDefault());
    document.body.append(link);
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, ...init });
    if (prevented) event.preventDefault();
    try {
      act(() => {
        link.dispatchEvent(event);
      });
      expect(window.location.search).toBe('');
      expect(result.current.draftSearch).toBe('needle');
    } finally {
      link.remove();
      unmount();
    }
  },
);
