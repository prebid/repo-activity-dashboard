import { render, renderHook, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, expect, it } from 'vitest';
import {
  useRepositoriesEntryHref,
  useRepositoryListEntryQuery,
} from '@/lib/navigation/use-repositories-entry';
import { PreferenceBindingProvider } from '@/lib/navigation/preference-binding';
import {
  defaultOverviewSettings,
  overviewCatalogDefinition,
  serializeOverviewPreferences,
} from '@/lib/presentation/overview-settings';
import { RepositoryHeader } from '@/features/repositories/repository-header';
import { InvalidRepositoriesView } from '@/features/repositories/all-repositories-header';
import { repositoryOverviewSamples } from '@/mocks/repository-overview';
import { alice, seedPreferences } from '../support/preference-cookies';

const asOf = '2026-10-24T12:00:00.000Z';
const repo = repositoryOverviewSamples().repositories[0].repository;
function Session({ children }: { children: ReactNode }) {
  return <PreferenceBindingProvider binding={alice}>{children}</PreferenceBindingProvider>;
}
const saved = (settings: Partial<ReturnType<typeof defaultOverviewSettings>>) =>
  JSON.parse(
    serializeOverviewPreferences({
      ...defaultOverviewSettings(overviewCatalogDefinition),
      ...settings,
    }),
  ) as unknown;
afterEach(() => {
  document.cookie = 'dashboard-repositories=; Max-Age=0; Path=/';
});

it('links All repositories to the viewer’s saved Summary, bare until a custom range is checked', () => {
  seedPreferences(alice, {
    overview: saved({ repositoryIds: [repo.id], ageThresholds: [60, 90] }),
    'overview.backlog.sort': { sort: 'name', descending: false },
  });
  const entry = () =>
    renderHook(() => useRepositoriesEntryHref(asOf), { wrapper: Session }).result.current;
  expect(entry()).toBe('/repos?repo=' + repo.slug + '&age=60,90&bsort=name');
  seedPreferences(alice, {
    overview: saved({ periods: [{ kind: 'custom', from: '2026-10-06', through: '2026-10-08' }] }),
  });
  expect(entry()).toBe('/repos');
  expect(
    renderHook(() => useRepositoriesEntryHref(asOf, 'bob'), { wrapper: Session }).result.current,
  ).toBe('/repos');
});

it('opens the saved Summary from a page that names none, the named one otherwise', () => {
  seedPreferences(alice, { overview: saved({ ageThresholds: [] }) });
  const crumb = (returnTo: string | null, returnSection?: string) => {
    const view = render(
      <Session>
        <RepositoryHeader
          repository={repo}
          asOf={asOf}
          returnTo={returnTo}
          returnSection={returnSection}
        />
      </Session>,
    );
    const trail = screen.getByRole('navigation', { name: 'Breadcrumb' });
    const link = within(trail).queryByRole('link', { name: 'All repositories' });
    const href = link?.getAttribute('href') ?? null;
    view.unmount();
    return href;
  };
  expect(crumb('/repos')).toBe('/repos?age=');
  expect(crumb('/repos', 'period-activity')).toBe('/repos?age=#period-activity');
  expect(crumb('/repos?v=1')).toBe('/repos?v=1');
  expect(crumb(null)).toBeNull();
});

it('names an address All repositories cannot show and links to its entry', () => {
  render(
    <InvalidRepositoriesView message="This link has a parameter this view does not accept." />,
  );
  expect(screen.getByRole('heading', { level: 1 })).toHaveAccessibleName('All repositories');
  expect(screen.getByText(/does not accept/)).toBeVisible();
  expect(screen.getByRole('link', { name: 'Open All repositories' })).toHaveAttribute(
    'href',
    '/repos',
  );
});

it('opens any repository list in the viewer’s saved list presentation, bare without one', () => {
  const query = () =>
    renderHook(() => useRepositoryListEntryQuery(), { wrapper: Session }).result.current;
  expect(query()).toBe('');
  seedPreferences(alice, {
    'repository.prs.sort': { sort: 'number', descending: false },
    'repository.prs.columns': { version: 1, columns: { latestActor: true }, chartsVisible: true },
  });
  expect(query()).toBe('?sort=number&cols=latestActor&charts');
  // An unreadable sort is left out, as the server leaves it out.
  seedPreferences(alice, { 'repository.prs.sort': 'not json' });
  expect(query()).toBe('');
  // Without the reporting snapshot the Summary entry stays bare.
  seedPreferences(alice, { overview: saved({ ageThresholds: [60] }) });
  expect(
    renderHook(() => useRepositoriesEntryHref(undefined), { wrapper: Session }).result.current,
  ).toBe('/repos');
});
