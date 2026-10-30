import type { ContributionOptions } from '@/models/contribution-options';
import type { ContributionSettings } from '@/models/contribution-settings';
import { localContributionOptions } from '../support/contribution-options';
import { useMemo, useSyncExternalStore } from 'react';
import { act, renderHook, render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useContributionControls } from '@/lib/navigation/use-contribution-controls';
import { useTableController } from '@/lib/navigation/use-table-controller';
import { PopulationSelector } from '@/features/contributions/population-selector';
import { ContributionControls } from '@/features/contributions/contribution-controls';
import { contributionSample, contributionSampleAsOf } from '@/mocks/contributions';
import { selectContributions } from '@/lib/presentation/contributions';
import {
  contributionPreferenceKey,
  defaultContributionSettings,
  readContributionSettings,
  readContributionPreferences,
  serializeContributionPreferences,
} from '@/lib/presentation/contribution-settings';
import type { ContributionPage } from '@/models/contribution-page';
import { contributionDefaultSort } from '@/models/contributions';
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
function useControls(
  viewerId = 'alice',
  pickerDirectory = directory,
  tableKey = 'contributors',
  suppliedOptions?: ContributionOptions,
) {
  const options = useMemo(
    () => localContributionOptions(pickerDirectory, contributionSampleAsOf),
    [pickerDirectory],
  );
  const search = useSyncExternalStore(subscribe, () => window.location.search);
  const page = useMemo((): ContributionPage => {
    const settings = readContributionSettings(
      new URLSearchParams(search),
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
  }, [search]);
  const table = useTableController({
    queryKey: tableKey === 'members' ? 'members' : 'report',
    scopeKey: 'contributions-test',
    viewerId,
    columnIds: ids,
    defaultSort: contributionDefaultSort,
    historyMode: 'push',
  });
  return {
    controls: useContributionControls(
      viewerId,
      page,
      pickerDirectory,
      table,
      tableKey,
      ids,
      suppliedOptions ?? options,
    ),
    table,
  };
}
const history: string[] = [];
it('does not restore a delayed saved scope over an explicit navigation', async () => {
  const saved = {
    ...defaults,
    selection: { ...defaults.selection, excludedAccountIds: ['account-alice'] },
  };
  localStorage.setItem(
    contributionPreferenceKey('alice', 'reference'),
    serializeContributionPreferences(saved),
  );
  let resolve!: (value: ContributionSettings | null) => void;
  let signal!: AbortSignal;
  const options = {
    ...localContributionOptions(directory, contributionSampleAsOf),
    validate: vi.fn((_settings: ContributionSettings, active: AbortSignal) => {
      signal = active;
      return new Promise<ContributionSettings | null>((done) => {
        resolve = done;
      });
    }),
  };
  const { result } = renderHook(() => useControls('alice', directory, 'contributors', options));
  expect(result.current.controls.pending).toBe(true);
  act(() => window.history.pushState(null, '', '/contributors?period=this-week'));
  await act(async () => {
    resolve(saved);
    await Promise.resolve();
  });
  expect(signal.aborted).toBe(true);
  expect(result.current.controls.value.period).toEqual({ kind: 'preset', preset: 'this-week' });
  expect(result.current.controls.value.selection.excludedAccountIds).toEqual([]);
});
it.each(['invalid', 'rejected', 'timeout', 'changed', 'storage'] as const)(
  'handles %s saved-scope validation without overwriting the active report',
  async (mode) => {
    vi.useFakeTimers();
    const key = contributionPreferenceKey('alice', 'reference');
    const saved = {
      ...defaults,
      selection: { ...defaults.selection, excludedAccountIds: ['account-alice'] },
    };
    const raw = serializeContributionPreferences(saved);
    localStorage.setItem(key, raw);
    let resolve!: (value: ContributionSettings | null) => void, reject!: (error: Error) => void;
    const options = {
      ...localContributionOptions(directory, contributionSampleAsOf),
      validate: () =>
        new Promise<ContributionSettings | null>((done, fail) => {
          resolve = done;
          reject = fail;
        }),
    };
    const { result } = renderHook(() => useControls('alice', directory, 'contributors', options));
    if (mode === 'changed') localStorage.setItem(key, serializeContributionPreferences(defaults));
    const blocked =
      mode === 'storage'
        ? vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw Error('blocked');
          })
        : undefined;
    await act(async () => {
      if (mode === 'timeout') await vi.advanceTimersByTimeAsync(15000);
      else if (mode === 'rejected') reject(Error('offline'));
      else resolve(mode === 'invalid' ? null : saved);
      await Promise.resolve();
    });
    blocked?.mockRestore();
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(result.current.controls.value.selection.excludedAccountIds).toEqual([]);
    expect(result.current.controls.pending).toBe(false);
    if (mode === 'storage') expect(result.current.controls.storageAvailable).toBe(false);
    else expect(result.current.controls.notice).toMatch(/Saved filters/);
    expect(localStorage.getItem(key)).toBe(
      mode === 'changed' ? serializeContributionPreferences(defaults) : raw,
    );
    if (mode === 'invalid') {
      act(() =>
        result.current.controls.update(
          { ...defaults, period: { kind: 'preset', preset: 'last-month' } },
          'period',
        ),
      );
      expect(
        readContributionPreferences(localStorage.getItem(key), directory, contributionSampleAsOf)
          ?.selection.excludedAccountIds,
      ).toEqual([]);
    }
  },
);
beforeEach(() => {
  localStorage.clear();
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
it('renders defaults without an unnecessary server replacement', () => {
  renderHook(() => useControls());
  expect(navigation.replace).not.toHaveBeenCalled();
});
it('does not navigate to oversized saved filters or replace the saved value with defaults', () => {
  const key = contributionPreferenceKey('alice', 'reference');
  const large = {
    ...defaults,
    selection: {
      ...defaults.selection,
      population: {
        kind: 'selected' as const,
        accountIds: wideDirectory.accounts.map((account) => account.id),
        companyIds: [],
      },
    },
  };
  const raw = serializeContributionPreferences(large);
  localStorage.setItem(key, raw);
  const { result } = renderHook(() => useControls('alice', wideDirectory));
  expect(result.current.controls.notice).toContain('Saved filters are too large');
  expect(navigation.replace).not.toHaveBeenCalled();
  expect(localStorage.getItem(key)).toBe(raw);
  expect(result.current.controls.value.selection.population).toEqual({ kind: 'all' });
});
it('rejects an oversized filter change before navigation or preference persistence', () => {
  const { result } = renderHook(() => useControls('alice', wideDirectory));
  act(() =>
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
    ),
  );
  expect(result.current.controls.notice).toContain('too large');
  expect(navigation.push).not.toHaveBeenCalled();
  expect(localStorage.getItem(contributionPreferenceKey('alice', 'reference'))).toBeNull();
  expect(result.current.controls.value.selection.population).toEqual({ kind: 'all' });
});
it('refuses presentation writes that would turn a bounded incoming URL into an oversized one', () => {
  window.history.replaceState(null, '', '/contributors?scope=1&nav=' + 'a'.repeat(7400));
  const { result } = renderHook(() => useControls());
  const before = window.location.href;
  act(() => result.current.controls.visibility.onChange({ prComments: true }));
  expect(result.current.controls.notice).toContain('too large');
  expect(window.location.href).toBe(before);
  expect(
    localStorage.getItem(contributionPreferenceKey('alice', 'reference') + ':columns:contributors'),
  ).toBeNull();
});
it('does not save a repository drilldown when only the period changes', () => {
  const key = contributionPreferenceKey('alice', 'reference');
  localStorage.setItem(key, serializeContributionPreferences(defaults));
  window.history.replaceState(
    null,
    '',
    '/contributors/account-alice?period=this-year&repo=repo-prebidjs',
  );
  const { result } = renderHook(() => useControls());
  act(() =>
    result.current.controls.update(
      {
        ...result.current.controls.value,
        period: { kind: 'preset', preset: 'this-month' },
      },
      'period',
    ),
  );
  expect(
    readContributionPreferences(localStorage.getItem(key), directory, contributionSampleAsOf)
      ?.selection.repositoryIds,
  ).toEqual([...defaults.selection.repositoryIds].sort());
  expect(result.current.controls.value.selection.repositoryIds).toEqual(['repo-prebidjs']);
});
it('restores a relative period and excluded accounts on direct entry, but never overwrites an explicit link', async () => {
  const saved = {
    ...defaults,
    period: { kind: 'preset' as const, preset: 'last-month' as const },
    selection: { ...defaults.selection, excludedAccountIds: ['account-alice'] },
  };
  const key = contributionPreferenceKey('alice', 'reference');
  localStorage.setItem(key, serializeContributionPreferences(saved));
  const { result, unmount } = renderHook(() => useControls());
  await waitFor(() => expect(result.current.controls.value.period).toEqual(saved.period));
  expect(result.current.controls.value.selection.excludedAccountIds).toEqual(['account-alice']);
  expect(navigation.replace).toHaveBeenCalledOnce();
  unmount();
  act(() => window.history.replaceState(null, '', '/contributors?period=this-week'));
  const explicit = renderHook(() => useControls());
  expect(explicit.result.current.controls.value.selection.excludedAccountIds).toEqual([]);
  expect(explicit.result.current.controls.value.period).toEqual({
    kind: 'preset',
    preset: 'this-week',
  });
  expect(localStorage.getItem(key)).toBe(serializeContributionPreferences(saved));
});
it('flushes pending search, resets every page and freezes the previous scope for Back', () => {
  vi.useFakeTimers();
  window.history.replaceState(
    null,
    '',
    '/contributors?report.page=4&members.page=2&repositories.page=3',
  );
  const { result } = renderHook(() => useControls());
  act(() => result.current.table.setSearch('Bob'));
  act(() =>
    result.current.controls.update(
      {
        ...result.current.controls.value,
        selection: {
          ...result.current.controls.value.selection,
          excludedAccountIds: ['account-alice'],
        },
      },
      'population',
    ),
  );
  const params = new URLSearchParams(window.location.search);
  expect(params.get('report.q')).toBe('Bob');
  expect(params.get('exclude')).toBe('account-alice');
  expect(['report', 'members', 'repositories'].every((key) => !params.has(key + '.page'))).toBe(
    true,
  );
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
  const { result } = renderHook(() => useControls());
  act(() =>
    result.current.controls.visibility.onChange({ prComments: true, issuesAuthored: false }),
  );
  const columnHistory = history.at(-2)!;
  expect(result.current.controls.visibility.value.prComments).toBe(true);
  expect(result.current.controls.visibility.value.issuesAuthored).toBe(false);
  const key = contributionPreferenceKey('alice', 'reference');
  expect(JSON.parse(localStorage.getItem(key + ':columns:contributors')!)).toMatchObject({
    columns: { prComments: true },
  });
  act(() => window.history.replaceState(null, '', columnHistory));
  expect(result.current.controls.visibility.value.prComments).toBe(false);
  act(() =>
    result.current.controls.update(
      {
        ...defaults,
        selection: { ...defaults.selection, repositoryIds: [] },
      },
      'repositoryIds',
    ),
  );
  act(() => result.current.table.setSearch('Alice'));
  act(() => result.current.controls.reset());
  expect(result.current.controls.value.selection.repositoryIds).toHaveLength(18);
  expect(result.current.table.draftSearch).toBe('');
  expect(localStorage.getItem(key)).toBeNull();
  expect(localStorage.getItem(key + ':columns:contributors')).not.toBeNull();
});
it('isolates accounts and continues through read/write/remove storage failures', () => {
  const aliceKey = contributionPreferenceKey('alice', 'reference');
  localStorage.setItem(
    aliceKey,
    serializeContributionPreferences({
      ...defaults,
      selection: { ...defaults.selection, actorTypes: ['bot'] },
    }),
  );
  const { result, rerender } = renderHook(({ viewerId }) => useControls(viewerId), {
    initialProps: { viewerId: 'alice' },
  });
  expect(result.current.controls.value.selection.actorTypes).toEqual(['bot']);
  act(() => {
    window.history.replaceState(null, '', '/contributors');
  });
  rerender({ viewerId: 'bob' });
  // Explicit scopes are authoritative even if the account changes; a fresh entry restores Bob's defaults.
  act(() => window.history.replaceState(null, '', '/contributors'));
  expect(result.current.controls.value.selection.actorTypes).toEqual([
    'human',
    'agent',
    'bot',
    'unknown',
  ]);
  const read = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw Error('blocked');
  });
  rerender({ viewerId: 'carol' });
  expect(result.current.controls.storageAvailable).toBe(false);
  read.mockRestore();
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw Error('full');
  });
  act(() =>
    result.current.controls.update(
      {
        ...defaults,
        selection: { ...defaults.selection, repositoryIds: [] },
      },
      'repositoryIds',
    ),
  );
  expect(result.current.controls.value.selection.repositoryIds).toEqual([]);
  expect(result.current.controls.storageAvailable).toBe(false);
  act(() => result.current.controls.visibility.onChange({ issuesAuthored: false }));
  expect(result.current.controls.visibility.value.issuesAuthored).toBe(false);
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
    throw Error('blocked');
  });
  act(() => result.current.controls.reset());
  expect(result.current.controls.value.selection.repositoryIds).toHaveLength(18);
  expect(result.current.controls.storageAvailable).toBe(false);
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
  const { rerender } = render(
    <ContributionControls
      options={localContributionOptions(directory, contributionSampleAsOf)}
      directory={directory}
      value={defaults}
      asOf={contributionSampleAsOf}
      pending={false}
      storageAvailable={false}
      onChange={onChange}
      onReset={onReset}
    />,
  );
  expect(screen.getByRole('status')).toHaveTextContent('Browser storage is unavailable');
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
  rerender(
    <ContributionControls
      options={localContributionOptions(directory, contributionSampleAsOf)}
      directory={directory}
      value={defaults}
      asOf={contributionSampleAsOf}
      pending
      storageAvailable
      onChange={onChange}
      onReset={onReset}
    />,
  );
  expect(screen.getByRole('status')).toHaveTextContent('Updating report');
  expect(screen.getByRole('button', { name: 'Reset filters' })).toBeDisabled();
});

it('discloses invalid saved filters instead of silently applying stale exclusions', () => {
  localStorage.setItem(contributionPreferenceKey('alice', 'reference'), '{invalid');
  const { result } = renderHook(() => useControls());
  expect(result.current.controls.value.selection.repositoryIds).toHaveLength(18);
  expect(result.current.controls.notice).toBe(
    'Saved filters could not be restored. Default filters are shown.',
  );
  act(() => result.current.controls.reset());
  expect(result.current.controls.notice).toBeUndefined();
});

it('retains a failed-save warning when a server navigation supplies fresh picker props', () => {
  const { result, rerender } = renderHook(
    ({ pickerDirectory }) => useControls('alice', pickerDirectory),
    { initialProps: { pickerDirectory: directory } },
  );
  const failure = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw Error('quota');
  });
  act(() =>
    result.current.controls.update(
      {
        ...defaults,
        selection: { ...defaults.selection, excludedAccountIds: ['account-alice'] },
      },
      'population',
    ),
  );
  expect(result.current.controls.storageAvailable).toBe(false);
  rerender({ pickerDirectory: { ...directory } });
  expect(result.current.controls.storageAvailable).toBe(false);
  expect(result.current.controls.value.selection.excludedAccountIds).toEqual(['account-alice']);
  failure.mockRestore();
  act(() => result.current.controls.update(defaults, 'population'));
  expect(result.current.controls.storageAvailable).toBe(true);
});

it('does not let a successful column save clear a failed report-scope save', () => {
  const { result } = renderHook(() => useControls());
  const key = contributionPreferenceKey('alice', 'reference');
  const original = localStorage.setItem.bind(localStorage);
  const failure = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
    this: Storage,
    item,
    value,
  ) {
    if (item === key) throw Error('scope exceeds storage quota');
    original(item, value);
  });
  act(() =>
    result.current.controls.update(
      {
        ...defaults,
        selection: { ...defaults.selection, excludedAccountIds: ['account-alice'] },
      },
      'population',
    ),
  );
  expect(result.current.controls.storageAvailable).toBe(false);
  act(() => result.current.controls.visibility.onChange({ prComments: true }));
  expect(localStorage.getItem(key + ':columns:contributors')).not.toBeNull();
  expect(localStorage.getItem(key)).toBeNull();
  expect(result.current.controls.storageAvailable).toBe(false);
  failure.mockRestore();
  act(() => result.current.controls.update(defaults, 'population'));
  expect(result.current.controls.storageAvailable).toBe(true);
});

it('restores and toggles zero-member visibility without dropping column preferences or prior pages', () => {
  const key = contributionPreferenceKey('alice', 'reference') + ':columns:members';
  localStorage.setItem(
    key,
    JSON.stringify({ version: 1, columns: { prComments: true }, hideZeroMembers: true }),
  );
  window.history.replaceState(null, '', '/companies/id/company-acme?members.page=2');
  const { result } = renderHook(() => useControls('alice', directory, 'members'));
  expect(result.current.controls.hideZeroMembers).toBe(true);
  expect(result.current.controls.visibility.value.prComments).toBe(true);
  act(() => result.current.controls.changeHideZeroMembers(false));
  expect(result.current.controls.hideZeroMembers).toBe(false);
  expect(new URLSearchParams(window.location.search).has('members.page')).toBe(false);
  const previous = history.at(-2)!;
  expect(new URL(previous).searchParams.get('members.zero')).toBe('hide');
  expect(new URL(previous).searchParams.get('members.page')).toBe('2');
  act(() => window.history.replaceState(null, '', previous));
  expect(result.current.controls.hideZeroMembers).toBe(true);
  act(() => result.current.controls.visibility.onChange({ prComments: false }));
  expect(JSON.parse(localStorage.getItem(key)!)).toMatchObject({ hideZeroMembers: true });
});
it('freezes inherited columns and sorting in return URLs, including a pending search', () => {
  const key = contributionPreferenceKey('alice', 'reference') + ':columns:contributors';
  localStorage.setItem(
    key,
    JSON.stringify({ version: 1, columns: { prComments: true, issuesAuthored: false } }),
  );
  const { result } = renderHook(() => useControls());
  act(() => result.current.table.setSearch('Alice'));
  const href = new URL(result.current.controls.returnHref, 'http://localhost');
  expect(href.searchParams.getAll('contributors.columns')).toContain('prComments');
  expect(href.searchParams.getAll('contributors.columns')).not.toContain('issuesAuthored');
  expect(href.searchParams.get('report.sort')).toBe('authoredPrsMerged');
  expect(href.searchParams.get('report.q')).toBe('Alice');
  act(() => {
    result.current.controls.freezeReturn();
  });
  expect(window.location.pathname + window.location.search).toBe(href.pathname + href.search);
});
