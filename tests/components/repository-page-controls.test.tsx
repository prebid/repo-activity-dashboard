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
const query = () => new URLSearchParams(window.location.search);
const navigated = vi.hoisted(() => [] as unknown[][]);
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
  const router = { push: (...args: unknown[]) => navigated.push(args) };
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
  navigated.length = 0;
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
    fields: { route: '/repos/[slug]', search: 'q', sort: 'sort', page: 'page' },
  });
  const settings = useRepositoryPageControls(viewerId, source, columns, table, saved?.presentation);
  return { table, settings };
}

it('renders the address’s presentation, which the saved one reaches only through links and entries', () => {
  const saved = {
    sort: savedSection('repository.prs.sort', { sort: 'number', descending: false }),
    presentation: savedSection<RepositoryPresentation>('repository.prs.columns', {
      columns: { ageDays: false },
      chartsVisible: true,
    }),
  };
  const { result, rerender } = renderHook(
    ({ viewerId, source, saved }) => useControls(viewerId, source, saved),
    { initialProps: { viewerId: 'alice', source: prs, saved } },
  );
  // An absent field is its v1 default, whatever is saved.
  expect(result.current.settings.visibility.value.ageDays).toBe(true);
  expect(result.current.settings.chartsVisible).toBe(false);
  expect(result.current.table.query.sort).toBe('createdAt');
  expect(result.current.settings.filters).toEqual(defaultRepositoryFilters('prs'));
  expect(history).toEqual([]);
  act(() =>
    window.history.replaceState(null, '', '/repos/prebidjs?sort=number&cols=-ageDays&charts'),
  );
  expect(result.current.settings.visibility.value.ageDays).toBe(false);
  expect(result.current.settings.chartsVisible).toBe(true);
  expect(result.current.table.query.sort).toBe('number');
  rerender({ viewerId: 'alice', source: issues, saved: sections('issues') });
  expect(result.current.settings.filters?.kind).toBe('issues');
});
it('captures pending search before applying filters, resets pages, preserves context and does not save filters', () => {
  vi.useFakeTimers();
  window.history.replaceState(
    null,
    '',
    '/repos/prebidjs?age=60&metric=agedPrs&page=2&back=~age:60',
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
  expect(window.location.search).toBe(
    '?age=60&metric=agedPrs&authorTypes=agent&q=sample&back=~age:60',
  );
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
  expect(window.location.search).toBe('?age=60&metric=agedPrs&back=~age:60');
  expect(preferenceSections('repositories')).toBeNull();
});
it('saves deliberate column overrides and resets presentation without clearing cohort filters', () => {
  window.history.replaceState(null, '', '/repos/prebidjs?draft=drafts');
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
  expect(query().get('cols')).toBe('createdAt');
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
  expect(window.location.search).toBe('?draft=drafts&sort=number&cols=-ageDays,createdAt');
  const beforeReset = window.location.href;
  act(() => result.current.settings.resetPresentation());
  expect(window.location.search).toBe('?draft=drafts');
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
  act(() => {
    window.history.replaceState(null, '', beforeReset);
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  expect(result.current.table.query.sort).toBe('number');
  expect(result.current.settings.visibility.value.ageDays).toBe(false);
});
it('recovers invalid filters and keeps changes in the address when the browser refuses the cookie', () => {
  vi.spyOn(Document.prototype, 'cookie', 'set').mockImplementation(() => {});
  // An activity range does not apply to current open records.
  window.history.replaceState(null, '', '/repos/prebidjs?events=this-month');
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
  expect(window.location.search).toBe('?sort=-number&cols=-ageDays,createdAt&charts');
  act(() => result.current.settings.resetPresentation());
  expect(result.current.settings.visibility.value.ageDays).toBe(true);
  expect(result.current.settings.chartsVisible).toBe(false);
});

it('saves chart visibility as its own field, keeping other tabs’ fields, and restores it through history', () => {
  seedPreferences(alice, { 'repository.prs.columns': stored({ ageDays: false }) });
  const saved = {
    ...sections(),
    presentation: savedSection<RepositoryPresentation>('repository.prs.columns', {
      columns: { ageDays: false },
      chartsVisible: false,
    }),
  };
  const { result } = renderHook(() => useControls('alice', prs, saved));
  expect(result.current.settings.chartsVisible).toBe(false);
  // Another tab shows the issue charts and changes a pull request column after this page rendered.
  seedPreferences(alice, {
    'repository.issues.columns': stored({}, true),
    'repository.prs.columns': stored({ ageDays: false, createdAt: true }),
  });
  act(() => result.current.settings.changeCharts(true));
  expect(result.current.settings.chartsVisible).toBe(true);
  expect(window.location.search).toBe('?charts');
  expect(preferenceSections('repositories')).toEqual({
    'repository.issues.columns': stored({}, true),
    'repository.prs.columns': stored({ ageDays: false, createdAt: true }, true),
  });
  const shown = window.location.href;
  act(() => result.current.settings.changeCharts(false));
  expect(result.current.settings.chartsVisible).toBe(false);
  act(() => {
    window.history.replaceState(null, '', shown);
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  expect(result.current.settings.chartsVisible).toBe(true);
  act(() => result.current.settings.resetPresentation());
  expect(result.current.settings.chartsVisible).toBe(false);
});
it('changes the record scope with a server navigation that keeps the scroll and chosen columns', () => {
  window.history.replaceState(null, '', '/repos/prebidjs?draft=drafts&cols=createdAt&back=~age:60');
  const { result } = renderHook(() => useControls());
  const range = { start: '2026-10-01T00:00:00.000Z', end: prs.asOf, endInclusive: true };
  act(() => result.current.settings.changeScope('created', range));
  expect(navigated).toEqual([
    [
      '/repos/prebidjs?period=this-month&at=2026-10-24T12:00Z&metric=prsOpened&draft=drafts&cols=humanReviewers,approvals,ageDays,latestActivity&back=~age:60',
      { scroll: false },
    ],
  ]);
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
