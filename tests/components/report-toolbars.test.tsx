import { useSyncExternalStore, type ReactElement } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { contributionSample, contributionSampleAsOf } from '@/mocks/contributions';
import { repositoryOverviewSamples } from '@/mocks/repository-overview';
import { repositoryPageNavigationSample, repositoryPageSample } from '@/mocks/repository-page';
import userEvent from '@testing-library/user-event';
import { localContributionOptions } from '../support/contribution-options';
import {
  defaultContributionSettings,
  serializeContributionPreferences,
} from '@/lib/presentation/contribution-settings';
import {
  preferenceSections,
  rawPreferenceCookie,
  seedPreferences,
} from '../support/preference-cookies';
import { preferenceSnapshot } from '@/server/preferences';

// Every report page's toolbar, rendered by the screen that composes it in the app.
const viewer = vi.hoisted(() => vi.fn());
vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth/viewer', () => ({ requireViewer: viewer }));
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
    useRouter: () => navigation,
    usePathname: () => useSyncExternalStore(subscribe, () => window.location.pathname),
    useSearchParams: () =>
      new URLSearchParams(useSyncExternalStore(subscribe, () => window.location.search)),
  };
});
import { RepositoriesScreen } from '@/app/_screens/repositories-screen';
import { repositoriesPreferences } from '@/app/_screens/repository-preferences';
import { RepositoryPageScreen } from '@/app/_screens/repository-page-screen';
import {
  ContributionTimelineScreen,
  RepositoryTimelineMatrixScreen,
  RepositoryTimelineScreen,
} from '@/app/_screens/timeline-screens';
import { ContributionsScreen } from '@/app/_screens/contributions-screen';
import { timelineView } from '@/server/timeline-preview';
import { viewOf } from '@/lib/presentation/url/back';
import { timelineQueryOf } from '../support/timeline-urls';
import { contributions } from '@/server/reporting';

beforeEach(() => {
  viewer.mockReset().mockResolvedValue({ id: 'sample-viewer' });
});

function ready<T extends { status: string }>(result: T): Extract<T, { status: 'ready' }> {
  if (result.status !== 'ready') throw Error('Expected a ready preview, got ' + result.status);
  return result as Extract<T, { status: 'ready' }>;
}

const samples = repositoryOverviewSamples();
const repository = samples.repositories[0].repository;

/** Each page, its address, its toolbar's region name and the resets it shows, in order. */
const pages: [
  name: string,
  path: string,
  region: string,
  resets: string[],
  view: () => ReactElement | Promise<ReactElement>,
][] = [
  [
    'Summary',
    '/repos',
    'Repository view settings',
    ['Reset view'],
    () => <RepositoriesScreen viewerId="sample-viewer" samples={samples} />,
  ],
  [
    'Repository page',
    '/repos/' + repository.slug,
    'Selected repository scope',
    ['Reset view'],
    () => (
      <RepositoryPageScreen
        viewerId="sample-viewer"
        source={repositoryPageSample(repository, {
          selection: { scope: 'current', metric: 'totalOpenPrs' },
          returnTo: '/repos',
        })}
        navigation={repositoryPageNavigationSample(repository)}
      />
    ),
  ],
  [
    'All repositories Timeline',
    '/repos?timeline',
    'Timeline scope',
    ['Reset view'],
    async () => {
      const result = ready(await timelineView(viewOf('/repos?timeline')!));
      if (!('matrix' in result)) throw Error('Expected the matrix');
      return (
        <RepositoryTimelineMatrixScreen
          viewerId={result.viewerId}
          context={result.controls}
          matrix={result.matrix}
          summaryHref={result.summaryHref}
        />
      );
    },
  ],
  [
    'Repository Timeline',
    '/repos/' + repository.slug + '?timeline',
    'Timeline scope',
    ['Reset view'],
    async () => {
      const result = ready(await timelineView(viewOf('/repos/' + repository.slug + '?timeline')!));
      if (!('omitted' in result)) throw Error('Expected a repository Timeline');
      return (
        <RepositoryTimelineScreen
          viewerId={result.viewerId}
          context={result.controls}
          parent={result.parent}
          facets={result.facets}
          omitted={result.omitted}
          report={result.report}
          navigation={result.navigation}
        />
      );
    },
  ],
  [
    'Contributors Over time',
    '/contributors?timeline',
    'Timeline scope',
    ['Reset filters', 'Reset view'],
    async () => {
      const result = ready(await timelineView(viewOf('/contributors?timeline')!));
      if (!('reportHref' in result)) throw Error('Expected Over time');
      return (
        <ContributionTimelineScreen
          viewerId={result.viewerId}
          context={result.controls}
          report={result.report}
          area="contributors"
          reportHref={result.reportHref}
        />
      );
    },
  ],
  [
    'Contributors report',
    '/contributors',
    'Contribution report scope',
    ['Reset filters'],
    async () => {
      const result = await contributions('contributors');
      if (result.status === 'invalid') throw Error('Expected a contribution report');
      return (
        <ContributionsScreen
          page={result.page}
          viewerId={result.viewer.id}
          directory={result.directory}
          view={{ route: '/contributors', segments: {}, values: {} }}
        />
      );
    },
  ],
];

describe('report toolbars', () => {
  it.each(pages)(
    '%s frames its scope controls with ghost resets and the saved-state sentence',
    async (_name, path, region, resets, view) => {
      window.history.replaceState(null, '', path);
      render(await view());
      const toolbar = screen.getByRole('region', { name: region });
      // One toolbar per page, and each reset belongs to a labelled group inside it.
      expect(screen.getAllByRole('region', { name: region })).toHaveLength(1);
      const buttons = within(toolbar)
        .getAllByRole('button')
        .filter((button) => /reset/i.test(button.textContent ?? ''));
      expect(buttons.map((button) => button.textContent)).toEqual(resets);
      for (const button of buttons) {
        expect(button.closest('fieldset')).not.toBeNull();
        expect(button.querySelector('svg')).toHaveAttribute('width', '14');
      }
      // Decision 4's sentence is the toolbar's one status line once the page settles.
      const status = within(toolbar).getByRole('status');
      await waitFor(() =>
        expect(status).toHaveTextContent(/^Preferences saved for your account on this browser\.$/),
      );
      // No other reset or clear wording survives beside the toolbar.
      expect(
        screen
          .queryAllByRole('button')
          .filter((button) => /reset/i.test(button.textContent ?? ''))
          .filter((button) => !toolbar.contains(button)),
      ).toEqual([]);
    },
  );

  describe('Over time resets', () => {
    // Report filters (period, account types) and Timeline settings (grouping, direction) both
    // differ from their defaults, and each has a saved value in the preference cookie.
    const search = 'timeline&period=last-month&type=human,bot&group=week&sort=-period';
    const binding = { accountId: 'sample-viewer', authVersion: 0 };
    const keys = {
      view: 'timeline.contributors.overview',
      filters: 'contributions.scope',
    } as const;
    async function overTime() {
      navigation.push.mockClear();
      window.history.replaceState(null, '', '/contributors?' + search);
      seedPreferences(binding, {
        [keys.view]: { version: 1, query: 'timeline.group=week' },
        [keys.filters]: JSON.parse(
          serializeContributionPreferences(defaultContributionSettings(contributionSample())),
        ) as unknown,
      });
      const result = ready(
        await timelineView(viewOf('/contributors?' + search)!, {
          preferences: preferenceSnapshot(
            'contributions',
            binding,
            rawPreferenceCookie('contributions'),
          ),
        }),
      );
      if (!('reportHref' in result)) throw Error('Expected Over time');
      render(
        <ContributionTimelineScreen
          viewerId={result.viewerId}
          context={result.controls}
          report={result.report}
          area="contributors"
          reportHref={result.reportHref}
        />,
      );
      const toolbar = screen.getByRole('region', { name: 'Timeline scope' });
      return { keys, toolbar };
    }
    async function click(toolbar: HTMLElement, group: string, reset: string) {
      const button = within(within(toolbar).getByRole('group', { name: group })).getByRole(
        'button',
        { name: reset },
      );
      await waitFor(() => expect(button).toBeEnabled());
      await userEvent.click(button);
      expect(navigation.push).toHaveBeenCalledOnce();
      const href = String(navigation.push.mock.lastCall?.[0]);
      expect(new URL(href, 'https://dashboard.invalid').pathname).toBe('/contributors');
      return timelineQueryOf(href);
    }

    it('Reset filters restores the shared report filters and keeps the Timeline settings', async () => {
      const { keys, toolbar } = await overTime();
      const params = await click(toolbar, 'Report filters', 'Reset filters');
      expect(params.get('period')).toBe('this-year');
      expect(params.getAll('type')).toEqual([]);
      expect(params.get('timeline.group')).toBe('week');
      expect(params.get('timeline.dir')).toBe('desc');
      expect(Object.keys(preferenceSections('contributions', binding)!)).toEqual([keys.view]);
    });

    it('Reset view restores the Timeline settings and keeps the report filters', async () => {
      const { keys, toolbar } = await overTime();
      const params = await click(toolbar, 'Timeline settings', 'Reset view');
      // The default grouping and order are left out of the address.
      expect(params.has('timeline.group')).toBe(false);
      expect(params.has('timeline.dir')).toBe(false);
      expect(params.get('period')).toBe('last-month');
      expect(params.getAll('type')).toEqual(['human', 'bot']);
      expect(Object.keys(preferenceSections('contributions', binding)!)).toEqual([keys.filters]);
    });
  });

  it('keeps the repository Record scope apart from the Reset view that keeps it', async () => {
    window.history.replaceState(null, '', '/repos/' + repository.slug);
    render(await pages[1][4]());
    const toolbar = screen.getByRole('region', { name: 'Selected repository scope' });
    const scope = within(toolbar).getByRole('group', { name: 'Record scope' });
    expect(within(scope).getByRole('combobox', { name: 'Record scope' })).toHaveValue('current');
    expect(within(scope).queryByRole('button')).not.toBeInTheDocument();
    // The reset's group is named for what Reset view restores.
    const view = within(toolbar).getByRole('group', { name: 'Columns, sorting and charts' });
    expect(within(view).getByRole('button', { name: 'Reset view' })).toBeInTheDocument();
    expect(within(view).queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('states the unavailable-storage sentence once the browser refuses a saved change', async () => {
    vi.spyOn(Document.prototype, 'cookie', 'set').mockImplementation(() => {});
    window.history.replaceState(null, '', '/repos');
    const binding = { accountId: 'sample-viewer', authVersion: 0 };
    render(
      <RepositoriesScreen
        viewerId="sample-viewer"
        samples={samples}
        preferences={repositoriesPreferences(
          preferenceSnapshot('repositories', binding, undefined),
          samples,
        )}
      />,
    );
    const toolbar = screen.getByRole('region', { name: 'Repository view settings' });
    const period = screen.getByRole('combobox', { name: 'Period 1 preset' });
    await waitFor(() => expect(period).toBeEnabled());
    await userEvent.selectOptions(period, 'this-week');
    expect(within(toolbar).getByRole('status')).toHaveTextContent(
      /^Browser storage is unavailable\. Changes still work in this URL\.$/,
    );
    expect(period).toHaveValue('this-week');
  });
});
