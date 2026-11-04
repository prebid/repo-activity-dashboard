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
vi.mock('@/lib/auth/viewer', () => ({
  requireViewer: viewer,
  // Page titles are rendered only for a signed-in viewer.
  getViewer: () => Promise.resolve({ kind: 'authenticated', user: { mustChangePassword: false } }),
}));
vi.mock('next/image', () => ({ default: (props: { alt: string }) => <span>{props.alt}</span> }));
vi.mock('next/headers', () => ({
  headers: () => Promise.resolve(new Headers()),
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
import ContributorsPage, {
  generateMetadata as contributorsMetadata,
} from '@/app/(dashboard)/contributors/page';
import ContributorPage, {
  generateMetadata as contributorMetadata,
} from '@/app/(dashboard)/contributors/[accountId]/page';
import { PreferenceBindingProvider } from '@/lib/navigation/preference-binding';
import { ContributionRoute } from '@/app/_screens/contribution-route';
import { DashboardHeader } from '@/components/layout/dashboard-header';
import { repositoryCatalog } from '@/config/repositories';
import CompaniesPage, {
  generateMetadata as companiesMetadata,
} from '@/app/(dashboard)/companies/page';
import CompanyPage from '@/app/(dashboard)/companies/[...identity]/page';
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
  expect(screen.getByRole('switch', { name: 'Show all 7 accounts' })).toBeChecked();
  all.unmount();
  render(await route({ v: '1' }, ReviewersPage));
  const reviewers = screen.getByRole('region', { name: 'Reviewers' });
  expect(
    within(reviewers).getByRole('link', { name: 'Alice — view contribution report' }),
  ).toBeInTheDocument();
  // Finn has no review, approval or merge credit.
  expect(screen.queryByRole('link', { name: 'Finn — view contribution report' })).toBeNull();
  expect(within(reviewers).getByRole('switch', { name: 'Show all 7 accounts' })).not.toBeChecked();
  expect(
    within(screen.getByRole('navigation', { name: 'Contribution reports' })).getByRole('link', {
      name: 'Reviewers',
    }),
  ).toHaveAttribute('aria-current', 'page');
  expect(historyWrites).not.toHaveBeenCalled();
});

it('serves the Companies lens at /companies?lens=all: its own saved view, six credits and sort', async () => {
  seedPreferences(alice, {
    'contributions.scope': stored(lastMonth),
    'contributions.companies.sort': { sort: 'name', descending: false },
    'contributions.all.companies.sort': { sort: 'mergesPerformed', descending: true },
  });
  // The entry opens the lens's own saved sort and the shared scope, not the Companies tab's sort.
  await expect(route({ lens: 'all' }, CompaniesPage)).rejects.toThrow(
    'redirect /companies?lens=all&period=last-month&sort=-mergesPerformed',
  );
  render(await route({ lens: 'all', v: '1' }, CompaniesPage));
  expect(screen.getByRole('heading', { level: 1, name: 'Companies' })).toBeInTheDocument();
  const table = screen.getByRole('table', { name: 'Companies' });
  for (const name of [
    'PRs authored',
    'Authored PRs merged',
    'Reviewer contributions',
    'Approval contributions',
    'Merges performed',
    'Issues authored',
  ])
    expect(within(table).getByRole('columnheader', { name }), name).toBeInTheDocument();
  expect(within(table).getByRole('columnheader', { name: 'Authored PRs merged' })).toHaveAttribute(
    'aria-sort',
    'descending',
  );
  // Each company's report and supporting records open in the lens.
  const links = within(table).getAllByRole('link');
  expect(links.length).toBeGreaterThan(1);
  for (const link of links)
    expect(query(link.getAttribute('href')!), link.getAttribute('href')!).toMatchObject({
      lens: 'all',
    });
  // Show all belongs to the Reviewers lens.
  expect(screen.queryByRole('switch', { name: /^Show all/ })).toBeNull();
  expect(historyWrites).not.toHaveBeenCalled();
});

it('labels a company roster’s Hide zero by lens and keeps the lens on its breakdown and crumb', async () => {
  const company = async (search: Record<string, string>) => {
    const element = (await CompanyPage({
      params: Promise.resolve({ identity: ['id', 'company-beacon'] }),
      searchParams: Promise.resolve(search),
    })) as ReactElement<Parameters<typeof ContributionRoute>[0]>;
    return ContributionRoute(element.props);
  };
  const contributors = render(await company({ zero: 'hide' }));
  expect(screen.getByRole('checkbox', { name: 'Hide zero totals' })).toBeChecked();
  expect(
    within(screen.getByRole('region', { name: 'Company contributors' })).getByRole('link', {
      name: /^Finn/,
    }),
  ).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Back to Companies' })).toHaveAttribute(
    'href',
    '/companies',
  );
  contributors.unmount();
  render(await company({ lens: 'reviewers', zero: 'hide' }));
  expect(screen.getByRole('checkbox', { name: 'Hide zero reviewer totals' })).toBeChecked();
  const members = screen.getByRole('region', { name: 'Company members' });
  // Finn has no reviewer credit, so the reviewer Hide zero leaves him out.
  expect(within(members).queryByRole('link', { name: /^Finn/ })).toBeNull();
  const breakdown = new URL(
    within(members).getByRole('link', { name: 'By repository' }).getAttribute('href')!,
    'https://dashboard.test',
  );
  expect(breakdown.searchParams.get('lens')).toBe('reviewers');
  const crumb = screen.getByRole('link', { name: 'Back to Companies' });
  expect(crumb).toHaveAttribute('href', '/companies?lens=reviewers');
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
  const reviewers = render(await route({ lens: 'reviewers' }, ReviewersPage));
  expect(screen.getByRole('heading', { level: 1, name: 'Reviewers' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Open reviewers' })).toHaveAttribute(
    'href',
    '/reviewers',
  );
  reviewers.unmount();
  // The Companies lens has no people overview, so `lens=all` names it on /reviewers too.
  render(await route({ lens: 'all' }, ReviewersPage));
  expect(screen.getByRole('heading', { level: 1, name: 'Companies' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Open companies' })).toHaveAttribute(
    'href',
    '/companies?lens=all',
  );
});
it('renders an address it rejects in the lens its query names, as the title and the masthead do', async () => {
  type Search = Record<string, string>;
  const alicePage = (search: Search) => ({
    params: Promise.resolve({ accountId: 'account-alice' }),
    searchParams: Promise.resolve(search),
  });
  const cases: {
    path: string;
    search: Search;
    open: (search: Search) => Promise<unknown>;
    title: (search: Search) => Promise<{ title?: unknown }>;
    heading: string;
    recovery: [string, string];
    document: string;
    masthead: 'Contributors' | 'Reviewers' | 'Companies';
  }[] = [
    // `lens` is not a /contributors parameter: the address names the Reviewers lens anyway.
    {
      path: '/contributors',
      search: { lens: 'reviewers' },
      open: (search) => ContributorsPage({ searchParams: Promise.resolve(search) }),
      title: (search) => contributorsMetadata({ searchParams: Promise.resolve(search) }),
      heading: 'Reviewers',
      recovery: ['Open reviewers', '/reviewers'],
      document: 'Reviewers',
      masthead: 'Reviewers',
    },
    {
      path: '/companies',
      search: { lens: 'reviewers', bogus: '1' },
      open: (search) => CompaniesPage({ searchParams: Promise.resolve(search) }),
      title: (search) => companiesMetadata({ searchParams: Promise.resolve(search) }),
      heading: 'Companies',
      recovery: ['Open companies', '/companies?lens=reviewers'],
      document: 'Companies · Reviewers',
      masthead: 'Reviewers',
    },
    // Show all belongs to overviews.
    {
      path: '/contributors/account-alice',
      search: { all: '', lens: 'reviewers' },
      open: (search) => ContributorPage(alicePage(search)),
      title: (search) => contributorMetadata(alicePage(search)),
      heading: 'Reviewers',
      recovery: ['Open reviewers', '/reviewers'],
      document: 'Alice · Reviewers',
      masthead: 'Reviewers',
    },
    // The Companies lens has no people overview; its Show all is invalid, as on every lens but
    // Reviewers.
    {
      path: '/contributors',
      search: { lens: 'all' },
      open: (search) => ContributorsPage({ searchParams: Promise.resolve(search) }),
      title: (search) => contributorsMetadata({ searchParams: Promise.resolve(search) }),
      heading: 'Companies',
      recovery: ['Open companies', '/companies?lens=all'],
      document: 'Companies · All activity',
      masthead: 'Companies',
    },
    {
      path: '/companies',
      search: { lens: 'all', all: '' },
      open: (search) => CompaniesPage({ searchParams: Promise.resolve(search) }),
      title: (search) => companiesMetadata({ searchParams: Promise.resolve(search) }),
      heading: 'Companies',
      recovery: ['Open companies', '/companies?lens=all'],
      document: 'Companies · All activity',
      masthead: 'Companies',
    },
    {
      path: '/contributors',
      search: { unknown: '1' },
      open: (search) => ContributorsPage({ searchParams: Promise.resolve(search) }),
      title: (search) => contributorsMetadata({ searchParams: Promise.resolve(search) }),
      heading: 'Contributors',
      recovery: ['Open contributors', '/contributors'],
      document: 'Contributors',
      masthead: 'Contributors',
    },
  ];
  for (const { path, search, open, title, heading, recovery, document, masthead } of cases) {
    const address = path + '?' + new URLSearchParams(search).toString();
    History.prototype.replaceState.call(window.history, null, '', address);
    const element = (await open(search)) as ReactElement<Parameters<typeof ContributionRoute>[0]>;
    const view = render(
      <>
        <DashboardHeader
          repositories={repositoryCatalog}
          activePath={path}
          accountControls={null}
        />
        {await ContributionRoute(element.props)}
      </>,
    );
    expect(screen.getByText('Invalid contribution view'), address).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 }).textContent, address).toBe(heading);
    expect(screen.getByRole('link', { name: recovery[0] }), address).toHaveAttribute(
      'href',
      recovery[1],
    );
    expect((await title(search)).title, address).toBe(document);
    const main = screen.getByRole('navigation', { name: 'Main navigation' });
    for (const name of ['Contributors', 'Reviewers'] as const)
      expect(within(main).getByRole('link', { name }), address + ' ' + name).toHaveAttribute(
        'data-active',
        String(name === masthead),
      );
    view.unmount();
  }
  expect(historyWrites).not.toHaveBeenCalled();
});

it('opens the area report from its crumb, named after the lens: its saved form without a frame, else the frame', async () => {
  seedPreferences(alice, { 'contributions.scope': stored(lastMonth) });
  const crumb = async (search: string, name = 'Back to Contributors') => {
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
    const href = screen.getByRole('link', { name }).getAttribute('href');
    view.unmount();
    return href;
  };
  // The contributor page at default scope derives the bare Contributors entry, which the
  // masthead opens in the viewer's saved explicit form.
  expect(await crumb('')).toBe('/contributors?period=last-month');
  // A page at another scope derives the report at that scope; a frame names its own parent.
  expect(await crumb('?period=this-month')).toBe('/contributors?period=this-month');
  expect(await crumb('?back=~page:2')).toBe('/contributors?page=2');
  // In the Reviewers lens the parent is the Reviewers overview.
  expect(await crumb('?lens=reviewers', 'Back to Reviewers')).toBe('/reviewers?period=last-month');
});
