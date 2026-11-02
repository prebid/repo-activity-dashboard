import type { ReactElement } from 'react';
import { act, waitFor, within } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { repositoryOverviewSamples } from '@/mocks/repository-overview';
import { repositoryPageNavigationSample, repositoryPageSample } from '@/mocks/repository-page';
import { repositoryInsightSample } from '@/mocks/repository-insights';
import {
  defaultOverviewSettings,
  serializeOverviewPreferences,
} from '@/lib/presentation/overview-settings';
import { serializeRepositoryColumns } from '@/lib/presentation/repository-page-preferences';
import { overviewSettingsColumns } from '@/features/repositories/overview-columns';
import { overviewPreferencesInvalidNotice } from '@/lib/navigation/use-overview-settings';
import type { PreferenceBinding } from '@/models/preferences';
import {
  alice,
  preferenceSections,
  rawPreferenceCookie,
  seedPreferences,
} from '../support/preference-cookies';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth/viewer', () => ({ requireViewer: vi.fn() }));
const navigation = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
}));
vi.mock('next/navigation', async () => {
  const { useSyncExternalStore } = await import('react');
  const subscribe = (notify: () => void) => {
    window.addEventListener('popstate', notify);
    return () => window.removeEventListener('popstate', notify);
  };
  const path = () => window.location.pathname,
    search = () => window.location.search;
  return {
    useRouter: () => navigation,
    usePathname: () => useSyncExternalStore(subscribe, path, path),
    useSearchParams: () => new URLSearchParams(useSyncExternalStore(subscribe, search, search)),
  };
});
import { preferenceSnapshot } from '@/server/preferences';
import {
  repositoriesPreferences,
  repositoryInsightSort,
  repositoryPagePreferences,
  timelineSupportCookie,
  timelineSupportSort,
} from '@/app/_screens/repository-preferences';
import { RepositoriesScreen } from '@/app/_screens/repositories-screen';
import { RepositoryPageScreen } from '@/app/_screens/repository-page-screen';
import { RepositoryInsightsScreen } from '@/app/_screens/repository-insights-screen';

const samples = repositoryOverviewSamples();
const [first, second] = samples.repositories.map((row) => row.repository);
const bob: PreferenceBinding = { accountId: 'bob', authVersion: 0 };
const definition = {
  ...overviewSettingsColumns,
  repositoryIds: samples.repositories.map((row) => row.repository.id),
};
const writes: string[] = [];
beforeEach(() => {
  writes.length = 0;
  for (const method of ['pushState', 'replaceState'] as const) {
    const native = window.history[method].bind(window.history);
    vi.spyOn(window.history, method).mockImplementation((state, unused, url) => {
      native(state, unused, url);
      writes.push(method + ' ' + String(url));
    });
  }
});
afterEach(() => vi.restoreAllMocks());

/** The request's snapshot of the repositories cookie, as the server reads it. */
const snapshot = (binding: PreferenceBinding = alice) =>
  preferenceSnapshot('repositories', binding, rawPreferenceCookie('repositories'));

/**
 * Render on the "server", then hydrate. `check` runs on the server HTML before any client code,
 * and again once the page is interactive, so the saved view must be there from the first paint.
 */
async function serverThenClient(view: ReactElement, check: (page: HTMLElement) => void) {
  const address = window.location.href;
  writes.length = 0;
  const container = document.createElement('div');
  container.innerHTML = renderToString(view);
  document.body.append(container);
  check(container);
  const recover = vi.fn();
  let root: Root | undefined;
  try {
    act(() => {
      root = hydrateRoot(container, view, { onRecoverableError: recover });
    });
    await waitFor(() => expect(within(container).getAllByRole('button')[0]).not.toBeDisabled());
    check(container);
    expect(recover).not.toHaveBeenCalled();
    expect(writes).toEqual([]);
    expect(window.location.href).toBe(address);
  } finally {
    act(() => root?.unmount());
    container.remove();
  }
}
const bodyRows = (page: HTMLElement, name: string) =>
  within(page).getByRole('table', { name }).querySelectorAll('tbody tr').length;
const sortedHeader = (page: HTMLElement) =>
  [...page.querySelectorAll('th[aria-sort="ascending"], th[aria-sort="descending"]')].map(
    (header) => [header.getAttribute('aria-sort'), header.textContent?.trim()],
  );

it('renders All repositories from the saved settings and sorts on the server, unchanged by hydration', async () => {
  window.history.replaceState(null, '', '/repos');
  seedPreferences(alice, {
    overview: JSON.parse(
      serializeOverviewPreferences({
        ...defaultOverviewSettings(definition),
        repositoryIds: [first.id, second.id],
        periods: [{ kind: 'preset', preset: 'last-month' }],
        ageThresholds: [90],
      }),
    ) as unknown,
    'overview.backlog.sort': { sort: 'name', descending: true },
  });
  const sections = preferenceSections('repositories');
  const view = (
    <RepositoriesScreen
      viewerId="alice"
      samples={samples}
      preferences={repositoriesPreferences(snapshot(), samples)}
    />
  );
  await serverThenClient(view, (page) => {
    expect(bodyRows(page, 'Current backlog')).toBe(2);
    expect(within(page).getByRole('combobox', { name: 'Period 1 preset' })).toHaveValue(
      'last-month',
    );
    const backlog = within(page).getByRole('table', { name: 'Current backlog' });
    expect(within(backlog).getByRole('columnheader', { name: /^Over 90 days/ })).toBeVisible();
    expect(within(backlog).getByRole('columnheader', { name: 'Repository' })).toHaveAttribute(
      'aria-sort',
      'descending',
    );
  });
  expect(preferenceSections('repositories')).toEqual(sections);
});

it("ignores another account's saved settings", async () => {
  window.history.replaceState(null, '', '/repos');
  seedPreferences(alice, {
    overview: JSON.parse(
      serializeOverviewPreferences({
        ...defaultOverviewSettings(definition),
        repositoryIds: [first.id],
      }),
    ) as unknown,
  });
  expect(snapshot(bob).status).toBe('ignored');
  const view = (
    <RepositoriesScreen
      viewerId="bob"
      samples={samples}
      preferences={repositoriesPreferences(snapshot(bob), samples)}
    />
  );
  await serverThenClient(view, (page) => {
    expect(bodyRows(page, 'Current backlog')).toBe(samples.repositories.length);
    expect(within(page).getByRole('combobox', { name: 'Period 1 preset' })).toHaveValue(
      'this-month',
    );
  });
});

it('renders the defaults with the recovery notice for an invalid saved section, then deletes it', async () => {
  window.history.replaceState(null, '', '/repos');
  seedPreferences(alice, {
    overview: { version: 3, settings: { repositoryIds: 'all' } },
    'overview.activity.sort': { sort: 'prsMerged', descending: false },
  });
  const view = (
    <RepositoriesScreen
      viewerId="alice"
      samples={samples}
      preferences={repositoriesPreferences(snapshot(), samples)}
    />
  );
  await serverThenClient(view, (page) => {
    expect(within(page).getByText(overviewPreferencesInvalidNotice)).toBeVisible();
    expect(bodyRows(page, 'Current backlog')).toBe(samples.repositories.length);
  });
  // Only the rejected section goes; the valid sort stays saved.
  expect(preferenceSections('repositories')).toEqual({
    'overview.activity.sort': { sort: 'prsMerged', descending: false },
  });
});

it("renders another repository's pull requests with the saved list presentation and sort", async () => {
  window.history.replaceState(null, '', '/repos/' + second.slug);
  seedPreferences(alice, {
    'repository.prs.columns': JSON.parse(
      serializeRepositoryColumns({ latestActivity: false }),
    ) as unknown,
    'repository.prs.sort': { sort: 'number', descending: false },
  });
  const source = repositoryPageSample(second, {
    selection: { scope: 'current', metric: 'totalOpenPrs' },
    returnTo: '/repos',
  });
  const view = (
    <RepositoryPageScreen
      viewerId="alice"
      source={source}
      navigation={repositoryPageNavigationSample(second)}
      preferences={repositoryPagePreferences(snapshot(), source)}
    />
  );
  await serverThenClient(view, (page) => {
    expect(sortedHeader(page)).toEqual([['ascending', 'PR']]);
    expect(page.querySelectorAll('tbody [data-column="latestActivity"]')).toHaveLength(0);
    expect(page.querySelectorAll('tbody [data-column="ageDays"]').length).toBeGreaterThan(0);
  });
});

it('drops a malformed list presentation and keeps a sort saved for columns this table lacks', async () => {
  window.history.replaceState(null, '', '/repos/' + first.slug);
  seedPreferences(alice, {
    'repository.issues.columns': { version: 1, columns: ['latestActivity'] },
    'repository.issues.sort': { sort: 'mergedAt', descending: false },
  });
  const source = repositoryPageSample(first, {
    selection: { scope: 'current', metric: 'openIssues' },
    returnTo: '/repos',
  });
  const preferences = repositoryPagePreferences(snapshot(), source);
  expect(preferences.presentation).toMatchObject({
    value: null,
    invalid: JSON.stringify({ version: 1, columns: ['latestActivity'] }),
  });
  // Issue lists have no merge column, so the sort does not apply here and is kept, not rejected.
  expect(preferences.sort).toMatchObject({ value: { sort: 'mergedAt', descending: false } });
  expect(preferences.sort).not.toHaveProperty('invalid');
  await serverThenClient(
    <RepositoryPageScreen
      viewerId="alice"
      source={source}
      navigation={repositoryPageNavigationSample(first)}
      preferences={preferences}
    />,
    (page) => {
      expect(
        within(page).getByText('Sorted by Created (descending); its column is hidden.'),
      ).toBeVisible();
      expect(page.querySelectorAll('tbody [data-column="latestActivity"]').length).toBeGreaterThan(
        0,
      );
    },
  );
  expect(preferenceSections('repositories')).toEqual({
    'repository.issues.sort': { sort: 'mergedAt', descending: false },
  });
});

it('applies a saved insight sort only to a table that has its column', async () => {
  window.history.replaceState(null, '', '/repos/' + first.slug);
  const range = samples.periods[2].period.range;
  const authors = repositoryInsightSample(first, {
    selection: { scope: 'period', metric: 'prAuthors', range },
    returnTo: '/repos',
  });
  const credits = repositoryInsightSample(first, {
    selection: { scope: 'period', metric: 'agentFeedbackCredits', range },
    returnTo: '/repos',
  });
  seedPreferences(alice, {
    'repository.authors.sort': { sort: 'account', descending: false },
    'repository.credits.sort': { sort: 'recordCount', descending: false },
  });
  await serverThenClient(
    <RepositoryInsightsScreen
      viewerId="alice"
      insight={authors}
      navigation={repositoryPageNavigationSample(first)}
      savedSort={repositoryInsightSort(snapshot(), authors)}
    />,
    (page) => expect(sortedHeader(page)).toEqual([['ascending', 'GitHub account']]),
  );
  // The credits table has no record-count column, so its default sort applies and the choice stays.
  const saved = repositoryInsightSort(snapshot(), credits);
  expect(saved.value).toEqual({ sort: 'recordCount', descending: false });
  await serverThenClient(
    <RepositoryInsightsScreen
      viewerId="alice"
      insight={credits}
      navigation={repositoryPageNavigationSample(first)}
      savedSort={saved}
    />,
    (page) => expect(sortedHeader(page)).toEqual([['descending', expect.any(String)]]),
  );
  expect(preferenceSections('repositories')).toHaveProperty('repository.credits.sort');
});

it('checks the shape of insight and Timeline supporting sorts in their own sections', () => {
  window.history.replaceState(null, '', '/repos/' + first.slug);
  const range = samples.periods[2].period.range;
  const duration = repositoryInsightSample(first, {
    selection: { scope: 'period', metric: 'medianMergeDays', range, branch: first.primaryBranch },
    returnTo: '/repos',
  });
  seedPreferences(alice, {
    'repository.merged-prs.sort': { sort: 'mergeDays', descending: true },
    'timeline-support.authors.prs.sort': { sort: 1, descending: true },
  });
  expect(repositoryInsightSort(snapshot(), duration)).toMatchObject({
    section: 'repository.merged-prs.sort',
    value: { sort: 'mergeDays', descending: true },
  });
  const authors = { kind: 'authors', recordKind: 'prs' } as Parameters<
    typeof timelineSupportSort
  >[1];
  expect(timelineSupportCookie(authors)).toBe('repositories');
  expect(timelineSupportSort(snapshot(), authors)).toMatchObject({
    section: 'timeline-support.authors.prs.sort',
    value: null,
    invalid: JSON.stringify({ sort: 1, descending: true }),
  });
  const contribution = { kind: 'contribution' } as Parameters<typeof timelineSupportSort>[1];
  expect(timelineSupportCookie(contribution)).toBe('contributions');
  seedPreferences(alice, {
    'timeline-support.contribution.sort': { sort: 'creditedAt', descending: false },
  });
  expect(
    timelineSupportSort(
      preferenceSnapshot('contributions', alice, rawPreferenceCookie('contributions')),
      contribution,
    ),
  ).toMatchObject({
    section: 'timeline-support.contribution.sort',
    value: { sort: 'creditedAt', descending: false },
  });
});
