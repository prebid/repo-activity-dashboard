import { localContributionOptions } from '../support/contribution-options';
import { useMemo, useSyncExternalStore } from 'react';
import { act, renderHook, render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useContributionControls } from '@/lib/navigation/use-contribution-controls';
import { useTableController } from '@/lib/navigation/use-table-controller';
import { PopulationSelector } from '@/features/contributions/population-selector';
import { contributionToolbar } from '@/features/contributions/contribution-controls';
import { ReportToolbar } from '@/components/reporting/report-toolbar';
import { contributionSample, contributionSampleAsOf } from '@/mocks/contributions';
import { selectContributions } from '@/lib/presentation/contributions';
import { contributionChangeLimitMessage } from '@/lib/presentation/contribution-return';
import {
  contributionPreferenceKey,
  defaultContributionSettings,
  serializeContributionPreferences,
  validateContributionSettings,
} from '@/lib/presentation/contribution-settings';
import { contributionScopeInput } from '@/lib/presentation/contribution-url';
import { parseQuery } from '@/lib/presentation/url/codec';
import { matchRoute } from '@/lib/presentation/url/registry';
import type { TableFields } from '@/lib/presentation/url/table-binding';
import type { ContributionSettings } from '@/models/contribution-settings';
import type {
  ContributionReportPreferences,
  ContributionTableKind,
} from '@/models/contribution-preferences';
import type { ContributionPage } from '@/models/contribution-page';
import { contributionDefaultSort } from '@/models/contributions';
import { contributionDetailColumnIds } from '@/features/contributions/contribution-details-view';
import {
  alice,
  preferenceSections,
  savedSection,
  seedPreferences,
} from '../support/preference-cookies';
const navigation = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
const subscribe = (notify: () => void) => {
  window.addEventListener('test-navigation', notify);
  window.addEventListener('popstate', notify);
  return () => {
    window.removeEventListener('test-navigation', notify);
    window.removeEventListener('popstate', notify);
  };
};
vi.mock('next/navigation', () => ({
  useRouter: () => navigation,
  usePathname: () => useSyncExternalStore(subscribe, () => window.location.pathname),
  useSearchParams: () =>
    new URLSearchParams(useSyncExternalStore(subscribe, () => window.location.search)),
}));
const directory = contributionSample();
const ids = ['name', 'authoredPrsMerged', 'issuesAuthored', 'prComments'];
const defaults = defaultContributionSettings(directory);
const wideDirectory = {
  ...directory,
  accounts: Array.from({ length: 1000 }, (_, i) => ({
    id: 'account-extra-' + i,
    login: 'extra-' + i,
    name: 'Extra ' + i,
    actorType: 'human' as const,
    companyId: null,
  })),
};
const scopeSection = 'contributions.scope';
const notice = 'Saved filters could not be restored. Default filters are shown.';
const stored = (value: ContributionSettings): unknown =>
  JSON.parse(serializeContributionPreferences(value));
function scope(change: (value: ContributionSettings) => void) {
  const value = structuredClone(defaults);
  change(value);
  return value;
}
/** The sections route composition hands the screen; none saved unless overridden. */
function report(
  overrides: Partial<ContributionReportPreferences> = {},
  table: Exclude<ContributionTableKind, 'details'> = 'contributors',
): ContributionReportPreferences {
  return {
    scope: savedSection(scopeSection),
    presentation: savedSection(`contributions.${table}.columns`),
    sort: savedSection(`contributions.${table}.sort`),
    ...overrides,
  };
}
/** The saved sections of the contributions cookie for Alice's session, by key. */
const saved = () => preferenceSections('contributions') ?? {};
function useControls({
  viewerId = 'alice',
  pickerDirectory = directory,
  tableKey = 'contributors',
  columnIds = ids,
  preferences,
}: {
  viewerId?: string;
  pickerDirectory?: typeof directory;
  tableKey?: ContributionTableKind;
  columnIds?: readonly string[];
  preferences?: ContributionReportPreferences;
} = {}) {
  const search = useSyncExternalStore(subscribe, () => window.location.search);
  const pathname = useSyncExternalStore(subscribe, () => window.location.pathname);
  // The canonical view the server rendered for this address, and the report it loaded.
  const view = useMemo(() => {
    const matched = matchRoute(pathname)!;
    const parsed = parseQuery(matched.route, search);
    if (parsed.kind !== 'canonical') throw Error('Expected a canonical address: ' + search);
    return { ...matched, values: parsed.values };
  }, [pathname, search]);
  const page = useMemo((): ContributionPage => {
    const settings = validateContributionSettings(
      contributionScopeInput(view.values, directory),
      directory,
      contributionSampleAsOf,
    )!;
    return {
      area: 'contributors',
      sample: 'reference',
      breakdown: 'members',
      returnTo: '/contributors',
      report: selectContributions(
        contributionSample({ period: settings.period }),
        settings.selection,
      ),
    };
  }, [view]);
  const fields: TableFields = useMemo(
    () => ({ route: view.route, search: 'q', sort: 'sort', page: 'page' }),
    [view.route],
  );
  const table = useTableController({
    queryKey: tableKey === 'members' ? 'members' : 'report',
    scopeKey: 'contributions-test',
    viewerId,
    columnIds,
    defaultSort: contributionDefaultSort,
    historyMode: 'push',
    savedSort: preferences?.sort,
    fields,
  });
  return {
    controls: useContributionControls(
      viewerId,
      page,
      pickerDirectory,
      table,
      tableKey,
      columnIds,
      preferences,
      view,
    ),
    table,
  };
}
const history: string[] = [];
/** A cookie jar that keeps nothing, as when the browser blocks cookies. */
function blockCookies() {
  return vi.spyOn(Document.prototype, 'cookie', 'set').mockImplementation(() => {});
}
beforeEach(() => {
  window.history.replaceState(null, '', '/contributors');
  history.length = 0;
  for (const method of ['pushState', 'replaceState'] as const) {
    const native = window.history[method].bind(window.history);
    vi.spyOn(window.history, method).mockImplementation(
      (state: unknown, unused: string, url?: string | URL | null) => {
        native(state, unused, url);
        history.push(window.location.href);
        window.dispatchEvent(new Event('test-navigation'));
      },
    );
  }
  navigation.push.mockImplementation((url: string) => window.history.pushState(null, '', url));
  navigation.replace.mockImplementation((url: string) =>
    window.history.replaceState(null, '', url),
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

it('renders the columns, zero-member choice and sort its address names, writing nothing', () => {
  seedPreferences(alice, { 'contributions.contributors.sort': { sort: 'name', descending: true } });
  window.history.replaceState(
    null,
    '',
    '/companies/id/company-acme?sort=issuesAuthored&cols=prComments&zero=hide',
  );
  history.length = 0;
  const preferences = report(
    {
      presentation: savedSection('contributions.members.columns', {
        columns: { prComments: true, retired: true },
        hideZeroMembers: true,
      }),
      sort: savedSection('contributions.members.sort', {
        sort: 'issuesAuthored',
        descending: false,
      }),
    },
    'members',
  );
  const before = saved();
  const { result } = renderHook(() => useControls({ tableKey: 'members', preferences }));
  expect(result.current.controls.visibility.value.prComments).toBe(true);
  expect(result.current.controls.visibility.value).not.toHaveProperty('retired');
  expect(result.current.controls.hideZeroMembers).toBe(true);
  expect(result.current.table.query).toMatchObject({ sort: 'issuesAuthored', descending: false });
  expect(result.current.controls.notice).toBeUndefined();
  expect(history).toEqual([]);
  expect(navigation.replace).not.toHaveBeenCalled();
  expect(saved()).toEqual(before);
  // An absent field is its v1 default, never a saved preference: saved values reach the address
  // through the server's entry redirect or the link that opened it.
  act(() => window.history.replaceState(null, '', '/companies/id/company-acme'));
  expect(result.current.controls.visibility.value.prComments).toBe(false);
  expect(result.current.controls.visibility.value.issuesAuthored).toBe(true);
  expect(result.current.controls.hideZeroMembers).toBe(false);
  expect(result.current.table.query).toMatchObject({
    sort: 'authoredPrsMerged',
    descending: true,
  });
});

it('shows the recovery notice for a rejected scope and deletes it after hydration only while it is unchanged', () => {
  const rejected = stored(scope((value) => (value.selection.excludedAccountIds = ['removed'])));
  const raw = JSON.stringify(rejected);
  seedPreferences(alice, {
    'contributions.contributors.sort': { sort: 'name' },
    [scopeSection]: rejected,
  });
  const preferences = report({ scope: savedSection(scopeSection, null, raw), notice });
  const { result } = renderHook(() => useControls({ preferences }));
  expect(result.current.controls.notice).toBe(notice);
  expect(result.current.controls.value.selection.excludedAccountIds).toEqual([]);
  expect(saved()).toEqual({ 'contributions.contributors.sort': { sort: 'name' } });
  // A newer value saved since the server read the cookie survives.
  const newer = stored(scope((value) => (value.period = { kind: 'preset', preset: 'last-month' })));
  seedPreferences(alice, { [scopeSection]: newer });
  renderHook(() => useControls({ preferences }));
  expect(saved()).toEqual({ [scopeSection]: newer });
  // The next deliberate change clears the notice.
  act(() => {
    result.current.controls.update(
      scope((value) => (value.selection.actorTypes = ['bot'])),
      'actorTypes',
    );
  });
  expect(result.current.controls.notice).toBeUndefined();
});

it('saves a deliberate scope change field by field, keeping the other saved fields and sections', () => {
  seedPreferences(alice, {
    [scopeSection]: stored(
      scope((value) => (value.period = { kind: 'preset', preset: 'last-month' })),
    ),
    'contributions.details.sort': { sort: 'creditedAt', descending: false },
  });
  const preferences = report();
  const { result } = renderHook(() => useControls({ preferences }));
  act(() => {
    result.current.controls.update(
      scope((value) => (value.selection.repositoryIds = ['repo-prebidjs'])),
      'repositoryIds',
    );
  });
  expect(navigation.push).toHaveBeenCalledOnce();
  expect(new URLSearchParams(window.location.search).get('repo')).toBe('prebidjs');
  expect(saved()).toEqual({
    'contributions.details.sort': { sort: 'creditedAt', descending: false },
    [scopeSection]: stored(
      scope((value) => {
        value.period = { kind: 'preset', preset: 'last-month' };
        value.selection.repositoryIds = ['repo-prebidjs'];
      }),
    ),
  });
});

it('merges a change into defaults rather than another account’s saved scope', () => {
  seedPreferences(
    { accountId: 'bob', authVersion: 0 },
    {
      [scopeSection]: stored(
        scope((value) => (value.period = { kind: 'preset', preset: 'last-month' })),
      ),
    },
  );
  const preferences = report();
  const { result } = renderHook(() => useControls({ preferences }));
  act(() => {
    result.current.controls.update(
      scope((value) => (value.selection.actorTypes = ['bot'])),
      'actorTypes',
    );
  });
  const { settings } = saved()[scopeSection] as { settings: ContributionSettings };
  expect(settings.period).toEqual(defaults.period);
  expect(settings.selection.actorTypes).toEqual(['bot']);
  expect(preferenceSections('contributions', { accountId: 'bob', authVersion: 0 })).toBeNull();
});

it('does not save a repository drilldown when only the period changes', () => {
  seedPreferences(alice, { [scopeSection]: stored(defaults) });
  window.history.replaceState(null, '', '/contributors/account-alice?repo=prebidjs');
  const preferences = report();
  const { result } = renderHook(() => useControls({ preferences }));
  act(() => {
    result.current.controls.update(
      {
        ...result.current.controls.value,
        period: { kind: 'preset', preset: 'this-month' },
      },
      'period',
    );
  });
  const { settings } = saved()[scopeSection] as { settings: ContributionSettings };
  expect(settings.period).toEqual({ kind: 'preset', preset: 'this-month' });
  expect(settings.selection.repositoryIds).toEqual([...defaults.selection.repositoryIds].sort());
  expect(result.current.controls.value.selection.repositoryIds).toEqual(['repo-prebidjs']);
});

it('leaves a saved scope alone on an explicit link and when nothing is saved for the page', () => {
  const savedScope = stored(scope((value) => (value.selection.repositoryIds = ['retired'])));
  seedPreferences(alice, { [scopeSection]: savedScope });
  window.history.replaceState(null, '', '/contributors?period=this-month');
  const preferences = report();
  const { result } = renderHook(() => useControls({ preferences }));
  expect(result.current.controls.value.period).toEqual({ kind: 'preset', preset: 'this-month' });
  expect(result.current.controls.notice).toBeUndefined();
  expect(saved()).toEqual({ [scopeSection]: savedScope });
  // Without server preferences a change applies to the URL and saves nothing.
  const unsaved = renderHook(() => useControls());
  act(() => {
    unsaved.result.current.controls.update(defaults, 'population');
  });
  act(() => {
    unsaved.result.current.controls.visibility.onChange({ prComments: true });
  });
  expect(unsaved.result.current.controls.visibility.value.prComments).toBe(true);
  act(() => {
    unsaved.result.current.controls.reset();
  });
  expect(saved()).toEqual({ [scopeSection]: savedScope });
});

it('copies legacy localStorage scope and columns into absent sections once, changing nothing rendered', () => {
  const key = contributionPreferenceKey('alice', 'reference');
  const legacy = scope((value) => (value.period = { kind: 'preset', preset: 'last-month' }));
  localStorage.setItem(key, serializeContributionPreferences(legacy));
  localStorage.setItem(
    key + ':columns:contributors',
    JSON.stringify({ version: 1, columns: { prComments: true, retired: true } }),
  );
  localStorage.setItem(key + ':columns:members', '{invalid');
  localStorage.setItem('dashboard-theme', 'light');
  const preferences = report();
  const { result } = renderHook(() => useControls({ preferences }));
  expect(result.current.controls.value.period).toEqual(defaults.period);
  expect(result.current.controls.visibility.value.prComments).toBe(false);
  expect(history).toEqual([]);
  const sections = saved();
  expect((sections[scopeSection] as { settings: ContributionSettings }).settings.period).toEqual(
    legacy.period,
  );
  expect(sections['contributions.contributors.columns']).toEqual({
    version: 1,
    columns: { prComments: true },
    hideZeroMembers: false,
  });
  expect(localStorage.getItem(key)).toBeNull();
  expect(localStorage.getItem(key + ':columns:contributors')).toBeNull();
  // An unreadable legacy value is dropped, not copied.
  renderHook(() => useControls({ tableKey: 'members', preferences: report({}, 'members') }));
  expect(saved()).not.toHaveProperty('contributions.members.columns');
  expect(localStorage.getItem(key + ':columns:members')).toBeNull();
  expect(localStorage.getItem('dashboard-theme')).toBe('light');
});

it('rejects an oversized filter change before navigation or preference persistence', () => {
  const preferences = report();
  const { result } = renderHook(() => useControls({ pickerDirectory: wideDirectory, preferences }));
  act(() => {
    result.current.controls.update(
      {
        ...defaults,
        selection: {
          ...defaults.selection,
          population: {
            kind: 'selected',
            accountIds: wideDirectory.accounts.map((account) => account.id),
            companyIds: [],
          },
        },
      },
      'population',
    );
  });
  expect(result.current.controls.notice).toBe(contributionChangeLimitMessage);
  expect(window.location.pathname + window.location.search).toBe('/contributors');
  expect(navigation.push).not.toHaveBeenCalled();
  expect(saved()).toEqual({});
  expect(result.current.controls.value.selection.population).toEqual({ kind: 'all' });
});
it('refuses presentation writes that would turn a bounded incoming URL into an oversized one', () => {
  // A parent frame that fits the 7,500-byte cap with too little room for another column.
  window.history.replaceState(
    null,
    '',
    '/contributors/account-alice?back=~account:' + 'a'.repeat(7450),
  );
  const preferences = report();
  const { result } = renderHook(() => useControls({ preferences }));
  const before = window.location.href;
  act(() => {
    result.current.controls.visibility.onChange({ prComments: true });
  });
  expect(result.current.controls.notice).toBe(contributionChangeLimitMessage);
  expect(window.location.href).toBe(before);
  expect(saved()).toEqual({});
});
it('flushes pending search, resets every page and freezes the previous scope for Back', () => {
  vi.useFakeTimers();
  window.history.replaceState(null, '', '/contributors?page=4');
  const { result } = renderHook(() => useControls());
  act(() => result.current.table.setSearch('Bob'));
  act(() => {
    result.current.controls.update(
      {
        ...result.current.controls.value,
        selection: {
          ...result.current.controls.value.selection,
          excludedAccountIds: ['account-alice'],
        },
      },
      'population',
    );
  });
  expect(window.location.search).toBe('?exclude=account-alice&q=Bob');
  const before = history.at(-2)!;
  expect(new URL(before).searchParams.has('exclude')).toBe(false);
  act(() => {
    window.history.replaceState(null, '', before);
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  act(() => {
    vi.advanceTimersByTime(300);
  });
  expect(result.current.controls.value.selection.excludedAccountIds).toEqual([]);
  expect(window.location.href).toBe(before);
});
it('saves columns independently, restores explicit column history and resets filters without losing presentation', () => {
  const preferences = report();
  const { result } = renderHook(() => useControls({ preferences }));
  act(() => {
    result.current.controls.visibility.onChange({ prComments: true, issuesAuthored: false });
  });
  // The bare entry was pinned to its explicit defaults before the push (decision C4).
  const columnHistory = history.at(-2)!;
  expect(new URL(columnHistory).search).toBe('?v=1');
  expect(window.location.search).toBe('?cols=-issuesAuthored,prComments');
  expect(result.current.controls.visibility.value.prComments).toBe(true);
  expect(result.current.controls.visibility.value.issuesAuthored).toBe(false);
  expect(saved()['contributions.contributors.columns']).toEqual({
    version: 1,
    columns: { prComments: true, issuesAuthored: false },
    hideZeroMembers: false,
  });
  act(() => window.history.replaceState(null, '', columnHistory));
  expect(result.current.controls.visibility.value.prComments).toBe(false);
  act(() => {
    result.current.controls.update(
      {
        ...defaults,
        selection: { ...defaults.selection, repositoryIds: [] },
      },
      'repositoryIds',
    );
  });
  expect(saved()).toHaveProperty(scopeSection);
  act(() => result.current.table.setSearch('Alice'));
  act(() => {
    result.current.controls.reset();
  });
  expect(result.current.controls.value.selection.repositoryIds).toHaveLength(18);
  expect(result.current.table.draftSearch).toBe('');
  expect(Object.keys(saved())).toEqual(['contributions.contributors.columns']);
});
it('keeps every change working when the browser refuses the cookie, until a save succeeds', () => {
  const stablePreferences = report();
  const { result, rerender } = renderHook(
    ({ pickerDirectory }) => useControls({ pickerDirectory, preferences: stablePreferences }),
    { initialProps: { pickerDirectory: directory } },
  );
  const blocked = blockCookies();
  act(() => {
    result.current.controls.update(
      scope((value) => (value.selection.excludedAccountIds = ['account-alice'])),
      'population',
    );
  });
  expect(result.current.controls.value.selection.excludedAccountIds).toEqual(['account-alice']);
  expect(result.current.controls.storageAvailable).toBe(false);
  // A server navigation that supplies fresh picker props keeps the warning.
  rerender({ pickerDirectory: { ...directory } });
  expect(result.current.controls.storageAvailable).toBe(false);
  act(() => {
    result.current.controls.visibility.onChange({ issuesAuthored: false });
  });
  expect(result.current.controls.visibility.value.issuesAuthored).toBe(false);
  expect(result.current.controls.storageAvailable).toBe(false);
  blocked.mockRestore();
  act(() => {
    result.current.controls.update(defaults, 'population');
  });
  expect(result.current.controls.storageAvailable).toBe(false);
  act(() => {
    result.current.controls.visibility.onChange({ issuesAuthored: true });
  });
  expect(result.current.controls.storageAvailable).toBe(true);
  expect(saved()).toHaveProperty(scopeSection);
});
it('replaces only its own columns in a section that another table of the same kind shares', () => {
  // Credit details render no last-activity column; comment details do.
  const creditIds = contributionDetailColumnIds.filter((id) => id !== 'lastAt');
  const stored = { version: 1, columns: { lastAt: true, state: false }, hideZeroMembers: false };
  seedPreferences(alice, { 'contributions.details.columns': stored });
  const preferences: ContributionReportPreferences = {
    scope: savedSection(scopeSection),
    presentation: savedSection('contributions.details.columns', {
      columns: stored.columns,
      hideZeroMembers: false,
    }),
    sort: savedSection('contributions.details.sort'),
  };
  window.history.replaceState(null, '', '/contributors?metric=prsAuthored&cols=-state');
  const { result } = renderHook(() =>
    useControls({ tableKey: 'details', columnIds: creditIds, preferences }),
  );
  expect(result.current.controls.visibility.value).not.toHaveProperty('lastAt');
  expect(result.current.controls.visibility.value.state).toBe(false);
  act(() => {
    result.current.controls.visibility.onChange({
      ...result.current.controls.visibility.value,
      repository: false,
    });
  });
  // Every column this table renders is replaced; the comment details' Last activity stays.
  expect(saved()['contributions.details.columns']).toEqual({
    version: 1,
    columns: {
      ...Object.fromEntries(creditIds.map((id) => [id, true])),
      lastAt: true,
      state: false,
      repository: false,
    },
    hideZeroMembers: false,
  });
  expect(window.location.search).toBe('?metric=prsAuthored&cols=-repository,-state');
});
it('restores and toggles zero-member visibility without dropping column preferences or prior pages', () => {
  const preferences = report(
    {
      presentation: savedSection('contributions.members.columns', {
        columns: { prComments: true },
        hideZeroMembers: true,
      }),
    },
    'members',
  );
  window.history.replaceState(
    null,
    '',
    '/companies/id/company-acme?page=2&cols=prComments&zero=hide',
  );
  const { result } = renderHook(() => useControls({ tableKey: 'members', preferences }));
  expect(result.current.controls.hideZeroMembers).toBe(true);
  expect(result.current.controls.visibility.value.prComments).toBe(true);
  act(() => {
    result.current.controls.changeHideZeroMembers(false);
  });
  expect(result.current.controls.hideZeroMembers).toBe(false);
  expect(window.location.search).toBe('?cols=prComments');
  expect(saved()['contributions.members.columns']).toMatchObject({ hideZeroMembers: false });
  const previous = history.at(-2)!;
  expect(new URL(previous).search).toBe('?page=2&cols=prComments&zero=hide');
  act(() => window.history.replaceState(null, '', previous));
  expect(result.current.controls.hideZeroMembers).toBe(true);
  act(() => {
    result.current.controls.visibility.onChange({ prComments: false });
  });
  expect(saved()['contributions.members.columns']).toMatchObject({
    columns: { prComments: false },
    hideZeroMembers: true,
  });
});
it('gives links the report’s address with its columns, sort and a pending search', () => {
  window.history.replaceState(
    null,
    '',
    '/contributors?sort=name&cols=-issuesAuthored,prComments&back=!',
  );
  const { result } = renderHook(() => useControls({ preferences: report() }));
  act(() => result.current.table.setSearch('Alice'));
  const href = result.current.controls.returnHref;
  expect(href).toBe('/contributors?q=Alice&sort=name&cols=-issuesAuthored,prComments&back=!');
  act(() => {
    result.current.controls.freezeReturn();
  });
  expect(window.location.pathname + window.location.search).toBe(href);
});
it('shows the server’s notice until a change, and keeps it out of later views', () => {
  const unfit = 'Saved filters are too large for this link. Default filters are shown.';
  const preferences = report({ notice: unfit });
  const { result } = renderHook(() => useControls({ preferences }));
  expect(result.current.controls.notice).toBe(unfit);
  act(() => {
    result.current.controls.visibility.onChange({ prComments: true });
  });
  expect(result.current.controls.notice).toBeUndefined();
});
it('clears rejected-change feedback after a successful correction', () => {
  const { result } = renderHook(() => useControls({ pickerDirectory: wideDirectory }));
  let rejection: string | undefined;
  act(() => {
    rejection = result.current.controls.update(
      {
        ...defaults,
        selection: {
          ...defaults.selection,
          population: {
            kind: 'selected',
            companyIds: [],
            accountIds: wideDirectory.accounts.map((account) => account.id),
          },
        },
      },
      'population',
    );
  });
  expect(rejection).toContain('This change is too large');
  expect(window.location.pathname + window.location.search).toBe('/contributors');
  act(() => {
    result.current.controls.update(defaults, 'population');
  });
  expect(result.current.controls.notice).toBeUndefined();
  expect(navigation.push).toHaveBeenCalledOnce();
});
it('drafts population union and exclusions separately, preserves selections across search and bounds large pickers', async () => {
  const user = userEvent.setup(),
    onApply = vi.fn();
  const large = contributionSample({ scenario: 'large' });
  render(
    <PopulationSelector
      options={localContributionOptions(large, contributionSampleAsOf)}
      selected={{ population: { kind: 'all' }, excludedAccountIds: [] }}
      onApply={onApply}
    />,
  );
  await user.click(screen.getByRole('button', { name: 'All accounts' }));
  const dialog = screen.getByRole('dialog');
  await user.click(within(dialog).getByRole('radio', { name: 'Selected accounts' }));
  const companies = within(dialog).getByRole('group', { name: /^Companies/ });
  await user.click(await within(companies).findByLabelText('Example Acme'));
  const people = within(dialog).getByRole('group', { name: /^Individuals/ });
  await waitFor(() => expect(within(people).getAllByRole('checkbox')).toHaveLength(51));
  await user.click(within(people).getByRole('checkbox', { name: /sample-person-001/ }));
  await user.click(within(people).getByRole('button', { name: 'Next' }));
  await user.type(within(people).getByRole('textbox'), 'heavy');
  await user.click(
    await within(people).findByRole('checkbox', { name: /Sample agent with hundreds/ }),
  );
  await user.click(within(people).getByLabelText('Show selected only'));
  await waitFor(() => expect(within(people).getAllByRole('checkbox')).toHaveLength(2));
  const excluded = within(dialog).getByRole('group', { name: /^Exclusions/ });
  await user.type(within(excluded).getByRole('textbox'), 'heavy');
  await user.click(
    await within(excluded).findByRole('checkbox', { name: /Sample agent with hundreds/ }),
  );
  await user.click(within(dialog).getByRole('button', { name: 'Apply accounts' }));
  expect(onApply).toHaveBeenCalledWith({
    population: {
      kind: 'selected',
      companyIds: ['company-acme'],
      accountIds: ['account-person-001', 'account-heavy-agent'],
    },
    excludedAccountIds: ['account-heavy-agent'],
  });
});
it('connects period controls and presents browser-storage and pending states', async () => {
  const user = userEvent.setup(),
    onChange = vi.fn(),
    onReset = vi.fn();
  const toolbar = (pending: boolean, storageAvailable: boolean) => (
    <ReportToolbar
      label="Contribution report scope"
      {...contributionToolbar({
        options: localContributionOptions(directory, contributionSampleAsOf),
        directory,
        value: defaults,
        asOf: contributionSampleAsOf,
        pending,
        storageAvailable,
        onChange,
        onReset,
      })}
    />
  );
  const { rerender } = render(toolbar(false, false));
  expect(screen.getByRole('status')).toHaveTextContent(
    /^Browser storage is unavailable\. Changes still work in this URL\.$/,
  );
  expect(screen.getByRole('group', { name: 'Report filters' })).toBeEnabled();
  await user.selectOptions(
    screen.getByRole('combobox', { name: 'Reporting period preset' }),
    'this-month',
  );
  expect(onChange).toHaveBeenCalledWith(
    {
      ...defaults,
      period: { kind: 'preset', preset: 'this-month' },
    },
    'period',
  );
  await user.click(screen.getByRole('button', { name: 'Reset filters' }));
  expect(onReset).toHaveBeenCalledOnce();
  rerender(toolbar(true, true));
  expect(screen.getByRole('status')).toHaveTextContent('Updating report');
  expect(screen.getByRole('button', { name: 'Reset filters' })).toBeDisabled();
  rerender(toolbar(false, true));
  expect(screen.getByRole('status')).toHaveTextContent(
    /^Preferences saved for your account on this browser\.$/,
  );
});
