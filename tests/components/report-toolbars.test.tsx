import { useSyncExternalStore, type ReactElement } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { contributionSample, contributionSampleAsOf } from '@/mocks/contributions';
import { repositoryOverviewSamples } from '@/mocks/repository-overview';
import { repositoryPageNavigationSample, repositoryPageSample } from '@/mocks/repository-page';
import userEvent from '@testing-library/user-event';
import { localContributionOptions } from '../support/contribution-options';
import { timelinePreferenceKey } from '@/lib/presentation/timeline-controls';
import { contributionPreferenceKey } from '@/lib/presentation/contribution-settings';

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
import { RepositoryPageScreen } from '@/app/_screens/repository-page-screen';
import {
  ContributionTimelineScreen,
  RepositoryTimelineMatrixScreen,
  RepositoryTimelineScreen,
} from '@/app/_screens/timeline-screens';
import { ContributionsScreen } from '@/app/_screens/contributions-screen';
import {
  contributionTimelinePreview,
  repositoryTimelineMatrixPreview,
  repositoryTimelinePreview,
} from '@/server/timeline-preview';
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
    '/repos?timeline=1',
    'Timeline scope',
    ['Reset view'],
    async () => {
      const result = ready(
        await repositoryTimelineMatrixPreview(new URLSearchParams('timeline=1')),
      );
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
    '/repos/' + repository.slug + '?timeline=1',
    'Timeline scope',
    ['Reset view'],
    async () => {
      const result = ready(
        await repositoryTimelinePreview(repository.slug, new URLSearchParams('timeline=1')),
      );
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
    '/contributors?timeline=1',
    'Timeline scope',
    ['Reset filters', 'Reset view'],
    async () => {
      const result = ready(
        await contributionTimelinePreview('contributors', new URLSearchParams('timeline=1')),
      );
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
        // The ghost variant: no fill or edge at rest, the ghost hover fill.
        expect(button).toHaveClass('border-transparent', 'hover:bg-ghost-hover');
        expect(button).not.toHaveClass('bg-overlay', 'bg-action');
        const icon = button.querySelector('svg');
        expect(icon).toHaveClass('lucide-rotate-ccw');
        expect(icon).toHaveAttribute('width', '14');
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
    // differ from their defaults, and each has a saved value in browser storage.
    const search =
      'timeline=1&timeline.state=1&scope=1&period=last-month&type=human&type=bot' +
      '&timeline.group=week&timeline.dir=desc';
    async function overTime() {
      navigation.push.mockClear();
      window.history.replaceState(null, '', '/contributors?' + search);
      const result = ready(
        await contributionTimelinePreview('contributors', new URLSearchParams(search)),
      );
      const keys = {
        view: timelinePreferenceKey(result.viewerId, result.controls),
        filters: contributionPreferenceKey(result.viewerId, result.controls.sample.split(':')[0]),
      };
      localStorage.setItem(keys.view, 'saved view');
      localStorage.setItem(keys.filters, 'saved filters');
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
      const url = new URL(String(navigation.push.mock.lastCall?.[0]), 'https://dashboard.invalid');
      expect(url.pathname).toBe('/contributors');
      return url.searchParams;
    }

    it('Reset filters restores the shared report filters and keeps the Timeline settings', async () => {
      const { keys, toolbar } = await overTime();
      const params = await click(toolbar, 'Report filters', 'Reset filters');
      expect(params.get('period')).toBe('this-year');
      expect(params.getAll('type')).toEqual([]);
      expect(params.get('timeline.group')).toBe('week');
      expect(params.get('timeline.dir')).toBe('desc');
      expect(localStorage.getItem(keys.filters)).toBeNull();
      expect(localStorage.getItem(keys.view)).toBe('saved view');
    });

    it('Reset view restores the Timeline settings and keeps the report filters', async () => {
      const { keys, toolbar } = await overTime();
      const params = await click(toolbar, 'Timeline settings', 'Reset view');
      expect(params.get('timeline.group')).toBe('month');
      expect(params.get('timeline.dir')).toBe('asc');
      expect(params.get('period')).toBe('last-month');
      expect(params.getAll('type')).toEqual(['human', 'bot']);
      expect(localStorage.getItem(keys.view)).toBeNull();
      expect(localStorage.getItem(keys.filters)).toBe('saved filters');
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

  it('states the unavailable-storage sentence when browser storage throws', async () => {
    for (const method of ['getItem', 'setItem', 'removeItem'] as const)
      vi.spyOn(Storage.prototype, method).mockImplementation(() => {
        throw new DOMException('Storage disabled', 'SecurityError');
      });
    window.history.replaceState(null, '', '/repos');
    render(<RepositoriesScreen viewerId="sample-viewer" samples={samples} />);
    const status = within(
      screen.getByRole('region', { name: 'Repository view settings' }),
    ).getByRole('status');
    await waitFor(() =>
      expect(status).toHaveTextContent(
        /^Browser storage is unavailable\. Changes still work in this URL\.$/,
      ),
    );
  });
});
