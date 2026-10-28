import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useOverviewSettings } from '@/lib/navigation/use-overview-settings';
import { useTableController } from '@/lib/navigation/use-table-controller';
import {
  defaultOverviewSettings,
  overviewPreferenceKey,
  serializeOverviewPreferences,
  writeOverviewTableQueries,
} from '@/lib/presentation/overview-settings';
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
const definition = {
  repositoryIds: ['a', 'b'],
  backlogColumns: ['name', 'total'],
  activityColumns: ['name', 'merged'],
  defaultBacklogColumns: ['name', 'total'],
  defaultActivityColumns: ['name', 'merged'],
};
const asOf = '2026-10-24T12:00:00.000Z';
const defaults = defaultOverviewSettings(definition);
const defaultSort = { sort: 'name', descending: false };
const backlogPeers = ['activity'],
  activityPeers = ['backlog'];
const history: { action: string; href: string; state: unknown }[] = [];
beforeEach(() => {
  history.length = 0;
  window.history.replaceState(null, '', '/repos');
  for (const action of ['replaceState', 'pushState'] as const) {
    const native = window.history[action].bind(window.history);
    vi.spyOn(window.history, action).mockImplementation(
      (data: unknown, unused: string, url?: string | URL | null) => {
        native(data, unused, url);
        history.push({ action, href: window.location.href, state: data });
        window.dispatchEvent(new Event('test-navigation'));
      },
    );
  }
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it('restores preferences without history writes and materializes the previous view before a filter change', () => {
  const saved = { ...defaults, repositoryIds: ['b'], ageDays: 90 as const };
  localStorage.setItem(overviewPreferenceKey('alice'), serializeOverviewPreferences(saved));
  const { result } = renderHook(() => useOverviewSettings('alice', definition, asOf));
  expect(result.current.value).toEqual(saved);
  expect(history).toEqual([]);
  act(() => result.current.update({ ageDays: 60 }));
  expect(result.current.value.ageDays).toBe(60);
  expect(history.map((item) => item.action)).toEqual(['replaceState', 'pushState']);
  expect(history.every((item) => item.state === null)).toBe(true);
  const before = history[0].href;
  expect(new URL(before).searchParams.get('age')).toBe('90');
  act(() => {
    window.history.replaceState(null, '', before);
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  expect(result.current.value.ageDays).toBe(90);
  const location = window.location.href;
  act(() => result.current.update({ backlogColumns: ['name'] }));
  expect(window.location.href).toBe(location);
  expect(result.current.value.backlogColumns).toEqual(['name']);
  expect(result.current.value.activityColumns).toEqual(['name', 'merged']);
});

it('uses explicit URLs and keeps accounts isolated when returning directly to the page', () => {
  localStorage.setItem(
    overviewPreferenceKey('alice'),
    serializeOverviewPreferences({ ...defaults, repositoryIds: ['a'], showChange: true }),
  );
  window.history.replaceState(null, '', '/repos?repo=b&change=0');
  const { result, rerender } = renderHook(
    ({ viewerId }) => useOverviewSettings(viewerId, definition, asOf),
    { initialProps: { viewerId: 'alice' } },
  );
  expect(result.current.value).toMatchObject({ repositoryIds: ['b'], showChange: false });
  act(() => window.history.replaceState(null, '', '/repos'));
  rerender({ viewerId: 'bob' });
  expect(result.current.value).toEqual(defaults);
  act(() => result.current.update({ ageDays: 120 }));
  act(() => window.history.replaceState(null, '', '/repos'));
  rerender({ viewerId: 'alice' });
  expect(result.current.value).toMatchObject({
    repositoryIds: ['a'],
    showChange: true,
    ageDays: 30,
  });
});

it('keeps empty selections, relative periods and table pagination scopes distinct', () => {
  window.history.replaceState(null, '', '/repos?backlog.page=2&activity.page=3');
  const { result } = renderHook(() => useOverviewSettings('alice', definition, asOf));
  act(() => result.current.update({ period: { kind: 'preset', preset: 'last-week' } }));
  expect(new URLSearchParams(window.location.search).get('backlog.page')).toBe('2');
  expect(new URLSearchParams(window.location.search).has('activity.page')).toBe(false);
  act(() => result.current.update({ repositoryIds: [] }));
  expect(result.current.value.repositoryIds).toEqual([]);
  expect(new URLSearchParams(window.location.search).get('repo')).toBe('');
  expect(new URLSearchParams(window.location.search).has('backlog.page')).toBe(false);
  const stored: unknown = JSON.parse(localStorage.getItem(overviewPreferenceKey('alice'))!);
  expect(stored).toMatchObject({
    version: 1,
    settings: { repositoryIds: [], period: { kind: 'preset', preset: 'last-week' } },
  });
  const writes = history.length;
  act(() => result.current.update({ repositoryIds: [] }));
  expect(history).toHaveLength(writes);
});

it('survives denied storage without treating malformed JSON as an outage', () => {
  localStorage.setItem(overviewPreferenceKey('alice'), '{');
  const first = renderHook(() => useOverviewSettings('alice', definition, asOf));
  expect(first.result.current.storageAvailable).toBe(true);
  expect(first.result.current.value).toEqual(defaults);
  first.unmount();
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('denied');
  });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('denied');
  });
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
    throw new Error('denied');
  });
  const { result } = renderHook(() => useOverviewSettings('alice', definition, asOf));
  expect(result.current.storageAvailable).toBe(false);
  act(() => result.current.update({ ageDays: 180, repositoryIds: ['b'] }));
  expect(result.current.value).toMatchObject({ ageDays: 180, repositoryIds: ['b'] });
  act(() => result.current.reset());
  expect(result.current.value).toEqual(defaults);
  expect(result.current.storageAvailable).toBe(false);
});

function usePageControls() {
  const page = useOverviewSettings('alice', definition, asOf);
  const backlog = useTableController({
    queryKey: 'backlog',
    scopeKey: 'all-repositories:backlog',
    viewerId: 'alice',
    columnIds: definition.backlogColumns,
    peerQueryKeys: backlogPeers,
    defaultSort,
  });
  const activity = useTableController({
    queryKey: 'activity',
    scopeKey: 'all-repositories:activity',
    viewerId: 'alice',
    columnIds: definition.activityColumns,
    peerQueryKeys: activityPeers,
    defaultSort,
  });
  return { page, backlog, activity };
}
it('preserves pending searches across peer sorting and captures both before a scope change', () => {
  vi.useFakeTimers();
  const { result } = renderHook(usePageControls);
  act(() => result.current.backlog.setSearch('prebid'));
  act(() => result.current.activity.update({ sort: 'merged', descending: true }));
  expect(result.current.backlog.draftSearch).toBe('prebid');
  act(() => {
    vi.advanceTimersByTime(250);
  });
  expect(result.current.backlog.query.search).toBe('prebid');
  expect(result.current.activity.query).toMatchObject({ sort: 'merged', descending: true });
  act(() => {
    result.current.backlog.setSearch('one');
    result.current.activity.setSearch('two');
  });
  act(() => {
    result.current.backlog.flushSearch();
    result.current.activity.flushSearch();
    result.current.page.update({ repositoryIds: ['b'] });
  });
  act(() => {
    vi.runAllTimers();
  });
  expect(result.current.backlog.query.search).toBe('one');
  expect(result.current.activity.query.search).toBe('two');
  expect(result.current.page.value.repositoryIds).toEqual(['b']);
});
it('reset clears only this page, including table sorts and drafts, and retains return history', () => {
  localStorage.setItem('dashboard-theme', 'light');
  localStorage.setItem(preferenceKey('alice', 'contributors'), 'retained');
  localStorage.setItem(
    overviewPreferenceKey('alice'),
    serializeOverviewPreferences({ ...defaults, repositoryIds: ['b'] }),
  );
  localStorage.setItem(
    preferenceKey('alice', 'all-repositories:backlog'),
    JSON.stringify({ sort: 'total', descending: true }),
  );
  const { result } = renderHook(usePageControls);
  act(() => {
    result.current.backlog.setSearch('query');
  });
  act(() => {
    const backlog = result.current.backlog.flushSearch();
    const activity = result.current.activity.flushSearch();
    const url = new URL(window.location.href);
    url.search = writeOverviewTableQueries(url.search, backlog, activity);
    window.history.replaceState(null, '', url);
    result.current.backlog.clearSavedSort();
    result.current.activity.clearSavedSort();
    result.current.page.reset();
  });
  expect(result.current.page.value).toEqual(defaults);
  expect(result.current.backlog.query).toMatchObject({
    sort: 'name',
    descending: false,
    search: '',
  });
  expect(result.current.activity.query).toMatchObject({ sort: 'name', search: '' });
  expect(localStorage.getItem(overviewPreferenceKey('alice'))).toBeNull();
  expect(localStorage.getItem(preferenceKey('alice', 'all-repositories:backlog'))).toBeNull();
  expect(localStorage.getItem('dashboard-theme')).toBe('light');
  expect(localStorage.getItem(preferenceKey('alice', 'contributors'))).toBe('retained');
  expect(window.location.search).toBe('');
  const before = history.at(-2)!.href;
  act(() => {
    window.history.replaceState(null, '', before);
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  expect(result.current.page.value.repositoryIds).toEqual(['b']);
  expect(result.current.backlog.query).toMatchObject({
    sort: 'total',
    descending: true,
    search: '',
  });
});
it('does not write history merely for flushing an untouched default sort', () => {
  const { result } = renderHook(usePageControls);
  history.length = 0;
  act(() => {
    result.current.backlog.flushSearch();
    result.current.activity.flushSearch();
  });
  expect(history).toEqual([]);
  expect(result.current.backlog.query.sort).toBe('name');
});
it('keeps a usable in-memory sort when table storage is denied, including reset', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('denied');
  });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('denied');
  });
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
    throw new Error('denied');
  });
  const { result } = renderHook(usePageControls);
  act(() => result.current.backlog.update({ sort: 'total' }));
  expect(result.current.backlog.storageAvailable).toBe(false);
  act(() => result.current.backlog.clearSavedSort());
  expect(result.current.backlog.storageAvailable).toBe(false);
  const anonymous = renderHook(() =>
    useTableController({ queryKey: 'items', columnIds: definition.backlogColumns }),
  );
  act(() => anonymous.result.current.clearSavedSort());
  expect(anonymous.result.current.query.sort).toBe('');
});
