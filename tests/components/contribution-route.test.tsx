import { useSyncExternalStore } from 'react';
import { render, screen, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { contributionSample, contributionSampleAsOf } from '@/mocks/contributions';
import {
  defaultContributionSettings,
  serializeContributionPreferences,
  writeContributionSettings,
} from '@/lib/presentation/contribution-settings';
import type { ContributionSettings } from '@/models/contribution-settings';
import { localContributionOptions } from '../support/contribution-options';
import { alice, preferenceSections, seedPreferences } from '../support/preference-cookies';

// The route as a request renders it: the viewer, the cookie jar the browser sends, and the client
// screen it composes.
const viewer = vi.hoisted(() => vi.fn());
vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth/viewer', () => ({ requireViewer: viewer }));
vi.mock('next/headers', () => ({
  cookies: () =>
    Promise.resolve({
      get: (name: string) => {
        for (const pair of document.cookie.split('; ')) {
          const [key, ...value] = pair.split('=');
          if (key === name) return { name, value: value.join('=') };
        }
        return undefined;
      },
    }),
}));
vi.mock('@/features/contributions/contribution-options-client', () => ({
  contributionOptionsClient: () =>
    localContributionOptions(contributionSample(), contributionSampleAsOf),
}));
const navigation = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
}));
vi.mock('next/navigation', () => {
  const subscribe = (notify: () => void) => {
    window.addEventListener('popstate', notify);
    return () => window.removeEventListener('popstate', notify);
  };
  return {
    notFound: () => {
      throw Error('not-found');
    },
    redirect: (href: string) => {
      throw Error('redirect ' + href);
    },
    useRouter: () => navigation,
    usePathname: () => useSyncExternalStore(subscribe, () => window.location.pathname),
    useSearchParams: () =>
      new URLSearchParams(useSyncExternalStore(subscribe, () => window.location.search)),
  };
});
import { ContributionRoute } from '@/app/_screens/contribution-route';

const defaults = defaultContributionSettings(contributionSample());
const lastMonth: ContributionSettings = {
  ...structuredClone(defaults),
  period: { kind: 'preset', preset: 'last-month' },
};
const stored = (value: ContributionSettings): unknown =>
  JSON.parse(serializeContributionPreferences(value));
const historyWrites = vi.fn();
beforeEach(() => {
  viewer.mockReset().mockResolvedValue({ id: 'alice', authVersion: 0 });
  window.history.replaceState(null, '', '/contributors');
  for (const method of ['pushState', 'replaceState'] as const)
    vi.spyOn(window.history, method).mockImplementation(historyWrites);
  historyWrites.mockClear();
});
const route = (search: Record<string, string> = {}) =>
  ContributionRoute({ area: 'contributors', searchParams: Promise.resolve(search) });
const toolbar = () => screen.getByRole('region', { name: 'Contribution report scope' });

it('redirects an entry to its saved scope, whose first render is the saved view', async () => {
  seedPreferences(alice, {
    'contributions.scope': stored(lastMonth),
    'contributions.contributors.columns': { version: 1, columns: { issuesAuthored: false } },
    'contributions.contributors.sort': { sort: 'name', descending: false },
  });
  const href = '/contributors?' + writeContributionSettings('', lastMonth);
  await expect(route()).rejects.toThrow('redirect ' + href);
  // The browser follows the redirect; the address is set without the recorded history methods.
  History.prototype.replaceState.call(window.history, null, '', href);
  render(await route(Object.fromEntries(new URL(href, 'https://dashboard.test').searchParams)));
  expect(within(toolbar()).getByRole('combobox', { name: 'Reporting period preset' })).toHaveValue(
    'last-month',
  );
  const table = screen.getByRole('table', { name: 'Contributors' });
  expect(within(table).getByRole('columnheader', { name: 'Contributor' })).toHaveAttribute(
    'aria-sort',
    'ascending',
  );
  expect(within(table).queryByRole('columnheader', { name: 'Issues authored' })).toBeNull();
  expect(historyWrites).not.toHaveBeenCalled();
  expect(navigation.replace).not.toHaveBeenCalled();
});

it('renders defaults with the recovery notice for a rejected scope, then deletes it', async () => {
  const rejected = stored({
    ...structuredClone(defaults),
    selection: { ...defaults.selection, excludedAccountIds: ['account-removed'] },
  });
  seedPreferences(alice, {
    'contributions.scope': rejected,
    'contributions.details.sort': { sort: 'creditedAt', descending: false },
  });
  render(await route());
  expect(within(toolbar()).getByRole('status')).toHaveTextContent(
    'Saved filters could not be restored. Default filters are shown.',
  );
  expect(within(toolbar()).getByRole('combobox', { name: 'Reporting period preset' })).toHaveValue(
    'this-year',
  );
  expect(preferenceSections('contributions')).toEqual({
    'contributions.details.sort': { sort: 'creditedAt', descending: false },
  });
  expect(historyWrites).not.toHaveBeenCalled();
});

it('ignores preferences saved for another account or authentication revision', async () => {
  for (const binding of [
    { accountId: 'bob', authVersion: 0 },
    { accountId: 'alice', authVersion: 1 },
  ]) {
    seedPreferences(binding, {
      'contributions.scope': stored(lastMonth),
      'contributions.contributors.columns': { version: 1, columns: { issuesAuthored: false } },
    });
    const view = render(await route());
    expect(
      within(toolbar()).getByRole('combobox', { name: 'Reporting period preset' }),
    ).toHaveValue('this-year');
    expect(screen.getByRole('columnheader', { name: 'Issues authored' })).toBeInTheDocument();
    expect(within(toolbar()).getByRole('status')).not.toHaveTextContent(/Saved filters/);
    view.unmount();
  }
});
