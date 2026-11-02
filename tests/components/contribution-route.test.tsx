import { useSyncExternalStore, type ReactElement } from 'react';
import { render, screen, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { contributionSample, contributionSampleAsOf } from '@/mocks/contributions';
import {
  defaultContributionSettings,
  serializeContributionPreferences,
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
import ContributorsPage from '@/app/(dashboard)/contributors/page';
import ContributorPage from '@/app/(dashboard)/contributors/[accountId]/page';
import { PreferenceBindingProvider } from '@/lib/navigation/preference-binding';
import { ContributionRoute } from '@/app/_screens/contribution-route';
import CompaniesPage from '@/app/(dashboard)/companies/page';
import ReviewersPage from '@/app/(dashboard)/reviewers/page';

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
/** The page as a request renders it: the URL helper, then the report route it composes. */
async function route(search: Record<string, string> = {}, page = ContributorsPage) {
  const element = (await page({ searchParams: Promise.resolve(search) })) as ReactElement<
    Parameters<typeof ContributionRoute>[0]
  >;
  return ContributionRoute(element.props);
}
const query = (href: string) =>
  Object.fromEntries(new URL(href, 'https://dashboard.test').searchParams);
const toolbar = () => screen.getByRole('region', { name: 'Contribution report scope' });

it('redirects an entry to its saved scope, whose first render is the saved view', async () => {
  seedPreferences(alice, {
    'contributions.scope': stored(lastMonth),
    'contributions.contributors.columns': { version: 1, columns: { issuesAuthored: false } },
    'contributions.contributors.sort': { sort: 'name', descending: false },
  });
  const href = '/contributors?period=last-month&sort=name&cols=-issuesAuthored';
  await expect(route()).rejects.toThrow('redirect ' + href);
  // The browser follows the redirect; the address is set without the recorded history methods.
  History.prototype.replaceState.call(window.history, null, '', href);
  render(await route(query(href)));
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

it('answers a legacy link with a redirect to its canonical form, decoded by the frozen readers', async () => {
  await expect(
    route(query('/contributors?scope=1&period=this-year&report.sort=name&report.dir=asc')),
  ).rejects.toThrow('redirect /contributors?sort=name');
  // A default written out is another spelling of the same view.
  await expect(route({ period: 'this-year' })).rejects.toThrow('redirect /contributors');
});

it('serves /reviewers: the saved Reviewers view, its reviewer population and its invalid view', async () => {
  seedPreferences(alice, {
    'contributions.scope': stored(lastMonth),
    'contributions.contributors.sort': { sort: 'name', descending: false },
    'contributions.reviewers.contributors.sort': { sort: 'mergesPerformed', descending: true },
  });
  await expect(route({}, ReviewersPage)).rejects.toThrow(
    'redirect /reviewers?period=last-month&sort=-mergesPerformed',
  );
  const all = render(await route({ all: '' }, ReviewersPage));
  expect(screen.getByRole('link', { name: 'Finn — view contribution report' })).toBeInTheDocument();
  all.unmount();
  render(await route({ v: '1' }, ReviewersPage));
  expect(
    screen.getByRole('link', { name: 'Alice — view contribution report' }),
  ).toBeInTheDocument();
  // Finn has no review, approval or merge credit.
  expect(screen.queryByRole('link', { name: 'Finn — view contribution report' })).toBeNull();
  expect(historyWrites).not.toHaveBeenCalled();
});

it('renders the invalid view for an unknown parameter and for Show all outside the Reviewers lens', async () => {
  for (const [search, page] of [
    [{ unknown: '1' }, ContributorsPage],
    [{ all: '' }, CompaniesPage],
    [{ cols: 'retired' }, ContributorsPage],
  ] as const) {
    const view = render(await route(search, page));
    expect(screen.getByText('Invalid contribution view')).toBeInTheDocument();
    expect(historyWrites).not.toHaveBeenCalled();
    view.unmount();
  }
  render(await route({ lens: 'reviewers' }, ReviewersPage));
  expect(screen.getByRole('heading', { level: 1, name: 'Reviewers' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Open reviewers' })).toHaveAttribute(
    'href',
    '/reviewers',
  );
});

it('opens the area report from Back to report: its saved form without a frame, else the frame', async () => {
  seedPreferences(alice, { 'contributions.scope': stored(lastMonth) });
  const crumb = async (search: string) => {
    History.prototype.replaceState.call(
      window.history,
      null,
      '',
      '/contributors/account-alice' + search,
    );
    const element = (await ContributorPage({
      params: Promise.resolve({ accountId: 'account-alice' }),
      searchParams: Promise.resolve(query('/x' + search)),
    })) as ReactElement<Parameters<typeof ContributionRoute>[0]>;
    const view = render(
      <PreferenceBindingProvider binding={alice}>
        {await ContributionRoute(element.props)}
      </PreferenceBindingProvider>,
    );
    const href = screen.getByRole('link', { name: 'Back to report' }).getAttribute('href');
    view.unmount();
    return href;
  };
  // The contributor page at default scope derives the bare Contributors entry, which the
  // masthead opens in the viewer's saved explicit form.
  expect(await crumb('')).toBe('/contributors?period=last-month');
  // A page at another scope derives the report at that scope; a frame names its own parent.
  expect(await crumb('?period=this-month')).toBe('/contributors?period=this-month');
  expect(await crumb('?back=~page:2')).toBe('/contributors?page=2');
});
