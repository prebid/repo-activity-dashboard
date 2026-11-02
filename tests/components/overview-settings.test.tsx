import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  overviewPreferencesInvalidNotice,
  useOverviewSettings,
} from '@/lib/navigation/use-overview-settings';
import { useTableController } from '@/lib/navigation/use-table-controller';
import {
  defaultOverviewSettings,
  overviewPreferenceKey,
  serializeOverviewPreferences,
  writeOverviewTableQueries,
} from '@/lib/presentation/overview-settings';
import type { SavedPreference } from '@/models/preferences';
import type { OverviewSettings } from '@/models/overview-settings';
import {
  alice,
  preferenceSections,
  rawPreferenceCookie,
  savedSection,
  seedPreferences,
} from '../support/preference-cookies';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth/viewer', () => ({ requireViewer: vi.fn() }));
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
import { preferenceSnapshot, savedOverviewSettings } from '@/server/preferences';
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
const bob = { accountId: 'bob', authVersion: 0 };
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

/** A section value, exactly as the existing serializer writes it. */
const stored = (settings: OverviewSettings) =>
  JSON.parse(serializeOverviewPreferences(settings)) as unknown;
/** What route composition hands the hook after the server read this session's cookie. */
function serverSaved(binding = alice) {
  const raw = rawPreferenceCookie('repositories');
  return savedOverviewSettings(preferenceSnapshot('repositories', binding, raw), definition, asOf);
}

it('starts from the saved settings without history writes and saves only the fields a change makes', () => {
  const saved = { ...defaults, repositoryIds: ['b'], ageThresholds: [90 as const] };
  seedPreferences(alice, { overview: stored(saved) });
  const { result } = renderHook(() =>
    useOverviewSettings('alice', definition, asOf, serverSaved()),
  );
  expect(result.current.value).toEqual(saved);
  expect(result.current.notice).toBeUndefined();
  expect(history).toEqual([]);
  act(() => result.current.update({ ageThresholds: [60] }));
  expect(result.current.value.ageThresholds).toEqual([60]);
  expect(history.map((item) => item.action)).toEqual(['replaceState', 'pushState']);
  expect(history.every((item) => item.state === null)).toBe(true);
  expect(preferenceSections('repositories')).toEqual({
    overview: stored({ ...saved, ageThresholds: [60] }),
  });
  const before = history[0].href;
  expect(new URL(before).searchParams.get('age')).toBe('90');
  act(() => {
    window.history.replaceState(null, '', before);
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  expect(result.current.value.ageThresholds).toEqual([90]);
  const location = window.location.href;
  act(() => result.current.update({ backlogColumns: ['name'] }));
  expect(window.location.href).toBe(location);
  expect(result.current.value.backlogColumns).toEqual(['name']);
  expect(result.current.value.activityColumns).toEqual(['name', 'merged']);
});

it('applies an explicit link to this view only, and a change there saves just its own field', () => {
  seedPreferences(alice, { overview: stored({ ...defaults, repositoryIds: ['a'] }) });
  window.history.replaceState(null, '', '/repos?repo=b&change=0');
  const { result } = renderHook(() =>
    useOverviewSettings('alice', definition, asOf, serverSaved()),
  );
  expect(result.current.value).toMatchObject({ repositoryIds: ['b'] });
  act(() => result.current.update({ backlogColumns: ['name'] }));
  expect(result.current.value).toMatchObject({ repositoryIds: ['b'], backlogColumns: ['name'] });
  // The linked repository was shown, not chosen, so the saved selection is unchanged.
  expect(preferenceSections('repositories')?.overview).toEqual(
    stored({ ...defaults, repositoryIds: ['a'], backlogColumns: ['name'] }),
  );
  act(() => window.history.replaceState(null, '', '/repos'));
  expect(result.current.value).toMatchObject({ repositoryIds: ['a'], backlogColumns: ['name'] });
});

it('keeps another account on its own saved settings', () => {
  seedPreferences(alice, { overview: stored({ ...defaults, repositoryIds: ['a'] }) });
  // The server ignores a cookie bound to another account, so Bob starts from the defaults.
  const { result, rerender } = renderHook(
    ({ viewerId, binding }) =>
      useOverviewSettings(viewerId, definition, asOf, serverSaved(binding)),
    { initialProps: { viewerId: 'bob', binding: bob } },
  );
  expect(result.current.value).toEqual(defaults);
  act(() => result.current.update({ ageThresholds: [120] }));
  expect(preferenceSections('repositories', bob)).toEqual({
    overview: stored({ ...defaults, ageThresholds: [120] }),
  });
  expect(preferenceSections('repositories', alice)).toBeNull();
  act(() => window.history.replaceState(null, '', '/repos'));
  rerender({ viewerId: 'alice', binding: alice });
  expect(result.current.value).toEqual(defaults);
});

it("keeps another tab's saved fields when this page saves a change", () => {
  seedPreferences(alice, { overview: stored(defaults) });
  const { result } = renderHook(() =>
    useOverviewSettings('alice', definition, asOf, serverSaved()),
  );
  // Another tab hides a backlog column after this page rendered.
  seedPreferences(alice, { overview: stored({ ...defaults, backlogColumns: ['name'] }) });
  act(() => result.current.update({ ageThresholds: [180] }));
  expect(preferenceSections('repositories')?.overview).toEqual(
    stored({ ...defaults, backlogColumns: ['name'], ageThresholds: [180] }),
  );
});

it('keeps empty selections, relative periods and table pagination scopes distinct', () => {
  window.history.replaceState(null, '', '/repos?backlog.page=2&activity.page=3');
  const { result } = renderHook(() =>
    useOverviewSettings('alice', definition, asOf, savedSection('overview')),
  );
  act(() => result.current.update({ periods: [{ kind: 'preset', preset: 'last-week' }] }));
  expect(new URLSearchParams(window.location.search).get('backlog.page')).toBe('2');
  expect(new URLSearchParams(window.location.search).has('activity.page')).toBe(false);
  act(() => result.current.update({ repositoryIds: [] }));
  expect(result.current.value.repositoryIds).toEqual([]);
  expect(new URLSearchParams(window.location.search).get('repo')).toBe('');
  expect(new URLSearchParams(window.location.search).has('backlog.page')).toBe(false);
  // A relative period is saved as its preset, not as the dates it resolves to today.
  expect(preferenceSections('repositories')?.overview).toMatchObject({
    version: 3,
    settings: { repositoryIds: [], periods: [{ kind: 'preset', preset: 'last-week' }] },
  });
  const writes = history.length;
  act(() => result.current.update({ repositoryIds: [] }));
  expect(history).toHaveLength(writes);
});

it('shows the defaults with the recovery notice for a rejected section and deletes it once', () => {
  const rejected = { version: 9, settings: {} };
  seedPreferences(alice, { overview: rejected });
  const saved = serverSaved();
  expect(saved).toMatchObject({ value: null, invalid: JSON.stringify(rejected) });
  const { result } = renderHook(() => useOverviewSettings('alice', definition, asOf, saved));
  expect(result.current.value).toEqual(defaults);
  expect(result.current.notice).toBe(overviewPreferencesInvalidNotice);
  // After hydration the rejected value is deleted, with no history write.
  expect(preferenceSections('repositories')).toBeNull();
  expect(history).toEqual([]);
  act(() => result.current.update({ ageThresholds: [60] }));
  expect(result.current.notice).toBeUndefined();
});

it('keeps a newer value that replaced the rejected one in another tab', () => {
  const newer = stored({ ...defaults, ageThresholds: [360] });
  seedPreferences(alice, { overview: newer });
  const rejected = JSON.stringify({ version: 9, settings: {} });
  renderHook(() =>
    useOverviewSettings('alice', definition, asOf, savedSection('overview', null, rejected)),
  );
  expect(preferenceSections('repositories')).toEqual({ overview: newer });
});

it('copies a former browser-storage value once, applying it from the next request', () => {
  const saved = { ...defaults, repositoryIds: ['b'] };
  localStorage.setItem(overviewPreferenceKey('alice'), serializeOverviewPreferences(saved));
  const { result } = renderHook(() =>
    useOverviewSettings('alice', definition, asOf, savedSection('overview')),
  );
  expect(result.current.value).toEqual(defaults);
  expect(preferenceSections('repositories')).toEqual({ overview: stored(saved) });
  expect(localStorage.getItem(overviewPreferenceKey('alice'))).toBeNull();
  expect(history).toEqual([]);
  expect(serverSaved().value).toEqual(saved);
});

it('discards a malformed former value without copying it', () => {
  localStorage.setItem(overviewPreferenceKey('alice'), '{');
  renderHook(() => useOverviewSettings('alice', definition, asOf, savedSection('overview')));
  expect(preferenceSections('repositories')).toBeNull();
  expect(localStorage.getItem(overviewPreferenceKey('alice'))).toBeNull();
});

it('keeps changes in memory when the browser refuses the cookie', () => {
  vi.spyOn(Document.prototype, 'cookie', 'set').mockImplementation(() => {});
  const { result } = renderHook(() =>
    useOverviewSettings('alice', definition, asOf, savedSection('overview')),
  );
  expect(result.current.storageAvailable).toBe(true);
  act(() => result.current.update({ backlogColumns: ['name'] }));
  expect(result.current.storageAvailable).toBe(false);
  act(() => result.current.update({ activityColumns: ['name'] }));
  expect(result.current.value).toMatchObject({
    backlogColumns: ['name'],
    activityColumns: ['name'],
  });
  act(() => result.current.update({ ageThresholds: [180], repositoryIds: ['b'] }));
  expect(result.current.value).toMatchObject({ ageThresholds: [180], repositoryIds: ['b'] });
  act(() => result.current.reset());
  expect(result.current.value).toEqual(defaults);
});

it('keeps changes for this page only without saved preferences', () => {
  const { result } = renderHook(() => useOverviewSettings('alice', definition, asOf));
  act(() => result.current.update({ backlogColumns: ['name'] }));
  act(() => result.current.update({ activityColumns: ['name'] }));
  expect(result.current.value).toMatchObject({
    backlogColumns: ['name'],
    activityColumns: ['name'],
  });
  expect(result.current.storageAvailable).toBe(true);
  expect(preferenceSections('repositories')).toBeNull();
});

function usePageControls(
  backlogSort?: SavedPreference<{ sort: string; descending: boolean }>,
  overview?: SavedPreference<OverviewSettings>,
) {
  const page = useOverviewSettings('alice', definition, asOf, overview);
  const backlog = useTableController({
    queryKey: 'backlog',
    scopeKey: 'all-repositories:backlog',
    viewerId: 'alice',
    columnIds: definition.backlogColumns,
    peerQueryKeys: backlogPeers,
    defaultSort,
    savedSort: backlogSort,
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
  const { result } = renderHook(() => usePageControls());
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
  const saved = { ...defaults, repositoryIds: ['b'] };
  const savedSort = { sort: 'total', descending: true };
  const scope = { version: 1, retained: true };
  seedPreferences(alice, {
    overview: stored(saved),
    'overview.backlog.sort': savedSort,
    'contributions.scope': scope,
  });
  const { result } = renderHook(() =>
    usePageControls(savedSection('overview.backlog.sort', savedSort), serverSaved()),
  );
  expect(result.current.page.value).toEqual(saved);
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
  expect(preferenceSections('repositories')).toBeNull();
  expect(preferenceSections('contributions')).toEqual({ 'contributions.scope': scope });
  expect(localStorage.getItem('dashboard-theme')).toBe('light');
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
  const { result } = renderHook(() => usePageControls());
  history.length = 0;
  act(() => {
    result.current.backlog.flushSearch();
    result.current.activity.flushSearch();
  });
  expect(history).toEqual([]);
  expect(result.current.backlog.query.sort).toBe('name');
});
it('keeps a usable in-memory sort when table storage is denied, including reset', () => {
  vi.spyOn(Document.prototype, 'cookie', 'set').mockImplementation(() => {});
  const { result } = renderHook(() => usePageControls(savedSection('overview.backlog.sort')));
  act(() => result.current.backlog.update({ sort: 'total' }));
  expect(result.current.backlog.storageAvailable).toBe(false);
  expect(result.current.backlog.query.sort).toBe('total');
  // A blocked cookie jar holds no saved sort, so clearing it succeeds and restores the default.
  act(() => {
    window.history.replaceState(null, '', '/repos');
    result.current.backlog.clearSavedSort();
  });
  expect(result.current.backlog.query.sort).toBe('name');
  const anonymous = renderHook(() =>
    useTableController({ queryKey: 'items', columnIds: definition.backlogColumns }),
  );
  act(() => anonymous.result.current.clearSavedSort());
  expect(anonymous.result.current.query.sort).toBe('');
});
