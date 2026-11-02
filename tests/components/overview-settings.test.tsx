import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  overviewPreferencesInvalidNotice,
  useOverviewSettings,
} from '@/lib/navigation/use-overview-settings';
import { useTableController } from '@/lib/navigation/use-table-controller';
import {
  defaultOverviewSettings,
  overviewCatalogDefinition,
  overviewPreferenceKey,
  serializeOverviewPreferences,
} from '@/lib/presentation/overview-settings';
import type { TableFields } from '@/lib/presentation/url/table-binding';
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
  const router = { push: () => {} };
  return {
    useRouter: () => router,
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
// The catalog's repositories, which the URL names by slug; an absent `repo` means all of them.
const definition = {
  repositoryIds: overviewCatalogDefinition.repositoryIds,
  backlogColumns: ['name', 'totalOpenPrs', 'draftPrs'],
  activityColumns: ['name', 'prsOpened', 'prsMerged'],
  defaultBacklogColumns: ['name', 'totalOpenPrs'],
  defaultActivityColumns: ['name', 'prsOpened'],
};
const asOf = '2026-10-24T12:00:00.000Z';
const defaults = defaultOverviewSettings(definition);
const backlogFields: TableFields = {
  route: '/repos',
  sort: 'bsort',
  page: 'bpage',
  peers: ['asort', 'apage'],
};
const activityFields: TableFields = {
  route: '/repos',
  sort: 'asort',
  page: 'apage',
  peers: ['bsort', 'bpage'],
};
const bob = { accountId: 'bob', authVersion: 0 };
const history: { action: string; href: string }[] = [];
beforeEach(() => {
  history.length = 0;
  window.history.replaceState(null, '', '/repos');
  for (const action of ['replaceState', 'pushState'] as const) {
    const native = window.history[action].bind(window.history);
    vi.spyOn(window.history, action).mockImplementation(
      (data: unknown, unused: string, url?: string | URL | null) => {
        native(data, unused, url);
        history.push({ action, href: window.location.pathname + window.location.search });
        window.dispatchEvent(new Event('test-navigation'));
      },
    );
  }
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});
/** Back to an earlier address, as the browser restores it. */
function back(href: string) {
  act(() => {
    window.history.replaceState(null, '', href);
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
}

/** A section value, exactly as the existing serializer writes it. */
const stored = (settings: OverviewSettings) =>
  JSON.parse(serializeOverviewPreferences(settings)) as unknown;
/** What route composition hands the hook after the server read this session's cookie. */
function serverSaved(binding = alice) {
  const raw = rawPreferenceCookie('repositories');
  return savedOverviewSettings(preferenceSnapshot('repositories', binding, raw), definition, asOf);
}

it('shows the address’s scope with the saved columns and saves only the fields a change makes', () => {
  const saved = {
    ...defaults,
    repositoryIds: ['repo-prebidserver'],
    ageThresholds: [90 as const],
    backlogColumns: ['name'],
  };
  seedPreferences(alice, { overview: stored(saved) });
  const { result } = renderHook(() =>
    useOverviewSettings('alice', definition, asOf, serverSaved()),
  );
  // The server redirects a bare entry to the saved scope; this address is the defaults.
  expect(result.current.value).toEqual({ ...defaults, backlogColumns: ['name'] });
  expect(result.current.notice).toBeUndefined();
  expect(history).toEqual([]);
  act(() => result.current.update({ ageThresholds: [60] }));
  expect(result.current.value.ageThresholds).toEqual([60]);
  // The bare entry is pinned to the defaults before the change is pushed.
  expect(history).toEqual([
    { action: 'replaceState', href: '/repos?v=1' },
    { action: 'pushState', href: '/repos?age=60' },
  ]);
  expect(preferenceSections('repositories')).toEqual({
    overview: stored({ ...saved, ageThresholds: [60] }),
  });
  back('/repos?v=1');
  expect(result.current.value.ageThresholds).toEqual([30]);
  const location = window.location.href;
  act(() => result.current.update({ activityColumns: ['name'] }));
  expect(window.location.href).toBe(location);
  expect(result.current.value).toMatchObject({
    backlogColumns: ['name'],
    activityColumns: ['name'],
  });
});

it('applies an explicit link to this view only, and a change there saves just its own field', () => {
  seedPreferences(alice, {
    overview: stored({ ...defaults, repositoryIds: ['repo-prebidjs'] }),
  });
  window.history.replaceState(null, '', '/repos?repo=prebidserver');
  const { result } = renderHook(() =>
    useOverviewSettings('alice', definition, asOf, serverSaved()),
  );
  expect(result.current.value).toMatchObject({ repositoryIds: ['repo-prebidserver'] });
  act(() => result.current.update({ backlogColumns: ['name'] }));
  expect(result.current.value).toMatchObject({
    repositoryIds: ['repo-prebidserver'],
    backlogColumns: ['name'],
  });
  // The linked repository was shown, not chosen, so the saved selection is unchanged.
  expect(preferenceSections('repositories')?.overview).toEqual(
    stored({ ...defaults, repositoryIds: ['repo-prebidjs'], backlogColumns: ['name'] }),
  );
});

it('keeps another account on its own saved settings', () => {
  seedPreferences(alice, { overview: stored({ ...defaults, backlogColumns: ['name'] }) });
  // The server ignores a cookie bound to another account, so Bob starts from the defaults.
  const { result } = renderHook(() =>
    useOverviewSettings('bob', definition, asOf, serverSaved(bob)),
  );
  expect(result.current.value).toEqual(defaults);
  act(() => result.current.update({ ageThresholds: [120] }));
  expect(preferenceSections('repositories', bob)).toEqual({
    overview: stored({ ...defaults, ageThresholds: [120] }),
  });
  expect(preferenceSections('repositories', alice)).toBeNull();
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
  window.history.replaceState(null, '', '/repos?bpage=2&apage=3');
  const { result } = renderHook(() =>
    useOverviewSettings('alice', definition, asOf, savedSection('overview')),
  );
  act(() => result.current.update({ periods: [{ kind: 'preset', preset: 'last-week' }] }));
  expect(window.location.search).toBe('?period=last-week&bpage=2');
  act(() => result.current.update({ repositoryIds: [] }));
  expect(result.current.value.repositoryIds).toEqual([]);
  expect(window.location.search).toBe('?repo=&period=last-week');
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
  const saved = { ...defaults, repositoryIds: ['repo-prebidserver'] };
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

it('keeps column changes in memory when the browser refuses the cookie', () => {
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
  act(() => result.current.update({ ageThresholds: [180], repositoryIds: ['repo-prebidserver'] }));
  expect(result.current.value).toMatchObject({
    ageThresholds: [180],
    repositoryIds: ['repo-prebidserver'],
  });
  expect(window.location.search).toBe('?repo=prebidserver&age=180');
  act(() => result.current.reset());
  expect(result.current.value).toEqual(defaults);
  expect(window.location.search).toBe('?v=1');
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
    savedSort: backlogSort,
    fields: backlogFields,
  });
  const activity = useTableController({
    queryKey: 'activity',
    scopeKey: 'all-repositories:activity',
    viewerId: 'alice',
    columnIds: definition.activityColumns,
    fields: activityFields,
  });
  return { page, backlog, activity };
}
it('keeps each table’s sort apart and restarts a table’s pages when the scope shortens it', () => {
  const { result } = renderHook(() => usePageControls());
  expect(result.current.backlog.query).toMatchObject({ sort: 'totalOpenPrs', descending: true });
  expect(result.current.activity.query).toMatchObject({ sort: 'prsOpened', descending: true });
  act(() => result.current.activity.update({ sort: 'prsMerged', descending: true }));
  act(() => result.current.backlog.update({ page: 2 }));
  expect(window.location.search).toBe('?bpage=2&asort=-prsMerged');
  expect(result.current.backlog.query.sort).toBe('totalOpenPrs');
  act(() => result.current.page.update({ repositoryIds: ['repo-prebidserver'] }));
  expect(window.location.search).toBe('?repo=prebidserver&asort=-prsMerged');
  expect(result.current.page.value.repositoryIds).toEqual(['repo-prebidserver']);
});
it('reset clears only this page, including table sorts, and retains return history', () => {
  localStorage.setItem('dashboard-theme', 'light');
  const saved = { ...defaults, repositoryIds: ['repo-prebidserver'] };
  const savedSort = { sort: 'draftPrs', descending: true };
  const scope = { version: 1, retained: true };
  seedPreferences(alice, {
    overview: stored(saved),
    'overview.backlog.sort': savedSort,
    'contributions.scope': scope,
  });
  // The saved explicit form a bare entry redirects to.
  window.history.replaceState(null, '', '/repos?repo=prebidserver&bsort=-draftPrs');
  const { result } = renderHook(() =>
    usePageControls(savedSection('overview.backlog.sort', savedSort), serverSaved()),
  );
  expect(result.current.page.value).toEqual(saved);
  expect(result.current.backlog.query).toMatchObject({ sort: 'draftPrs', descending: true });
  act(() => {
    result.current.backlog.clearSavedSort();
    result.current.activity.clearSavedSort();
    result.current.page.reset();
  });
  expect(result.current.page.value).toEqual(defaults);
  expect(result.current.backlog.query).toMatchObject({ sort: 'totalOpenPrs', descending: true });
  expect(preferenceSections('repositories')).toBeNull();
  expect(preferenceSections('contributions')).toEqual({ 'contributions.scope': scope });
  expect(localStorage.getItem('dashboard-theme')).toBe('light');
  expect(window.location.search).toBe('?v=1');
  back('/repos?repo=prebidserver&bsort=-draftPrs');
  expect(result.current.page.value.repositoryIds).toEqual(['repo-prebidserver']);
  expect(result.current.backlog.query).toMatchObject({ sort: 'draftPrs', descending: true });
});
it('does not write history merely for flushing an untouched default sort', () => {
  const { result } = renderHook(() => usePageControls());
  history.length = 0;
  act(() => {
    result.current.backlog.flushSearch();
    result.current.activity.flushSearch();
  });
  expect(history).toEqual([]);
  expect(result.current.backlog.query.sort).toBe('totalOpenPrs');
});
it('keeps a sort in the address when table storage is denied', () => {
  vi.spyOn(Document.prototype, 'cookie', 'set').mockImplementation(() => {});
  const { result } = renderHook(() => usePageControls(savedSection('overview.backlog.sort')));
  act(() => result.current.backlog.update({ sort: 'draftPrs', descending: false }));
  expect(result.current.backlog.storageAvailable).toBe(false);
  expect(result.current.backlog.query.sort).toBe('draftPrs');
  expect(window.location.search).toBe('?bsort=draftPrs');
  const anonymous = renderHook(() =>
    useTableController({ queryKey: 'items', columnIds: definition.backlogColumns }),
  );
  act(() => anonymous.result.current.clearSavedSort());
  expect(anonymous.result.current.query.sort).toBe('');
});
