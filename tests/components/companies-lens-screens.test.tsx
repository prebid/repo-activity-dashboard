import { useSyncExternalStore } from 'react';
import { render, screen, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { contributionSample, contributionSampleAsOf } from '@/mocks/contributions';
import { localContributionOptions } from '../support/contribution-options';

// The Companies lens (`lens=all`) as the screens compose it: the report and its Over time.
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
import { ContributionsScreen } from '@/app/_screens/contributions-screen';
import { ContributionTimelineScreen } from '@/app/_screens/timeline-screens';
import { selectContributions } from '@/lib/presentation/contributions';
import { viewOf } from '@/lib/presentation/url/back';
import { timelineView } from '@/server/timeline-preview';
import type { ContributionFocus } from '@/models/contributions';

beforeEach(() => {
  viewer.mockReset().mockResolvedValue({ id: 'sample-viewer' });
});

/** The report screen at `href`, in the Companies lens. */
function companiesLens(href: string, focus?: ContributionFocus) {
  window.history.replaceState(null, '', href);
  const view = viewOf(href)!;
  return (
    <ContributionsScreen
      page={{
        sample: 'reference',
        area: 'companies',
        breakdown: 'members',
        lens: 'all',
        returnTo: '/companies?lens=all',
        returnLabel: 'Back to Companies',
        report: selectContributions(contributionSample(), undefined, focus, {
          area: 'companies',
          lens: 'all',
        }),
      }}
      viewerId="sample-viewer"
      directory={contributionSample()}
      view={view}
    />
  );
}

it('shows the Companies overview with the six credits, All credits columns and no Show all', () => {
  render(companiesLens('/companies?lens=all'));
  expect(screen.getByRole('heading', { level: 1, name: 'Companies' })).toBeVisible();
  expect(screen.queryByRole('navigation', { name: 'Contribution reports' })).toBeNull();
  const companies = screen.getByRole('region', { name: 'Companies' });
  expect(within(companies).getByRole('button', { name: 'Columns · All credits' })).toBeVisible();
  for (const name of ['Authoring', 'Reviewing', 'Issues'])
    expect(within(companies).getByRole('columnheader', { name })).toBeVisible();
  expect(
    within(companies).getByRole('columnheader', { name: 'Authored PRs merged' }),
  ).toHaveAttribute('aria-sort', 'descending');
  expect(within(companies).getByRole('columnheader', { name: 'Merges performed' })).toBeVisible();
  expect(screen.queryByRole('switch')).toBeNull();
  // Over time keeps the lens.
  const timeline = new URL(
    screen.getByRole('link', { name: 'Over time' }).getAttribute('href')!,
    'https://dashboard.test',
  );
  expect(timeline.pathname).toBe('/companies');
  expect(timeline.searchParams.has('timeline')).toBe(true);
  expect(timeline.searchParams.get('lens')).toBe('all');
});

it('labels a company roster’s Hide zero over all totals in the Companies lens', () => {
  render(
    companiesLens('/companies/id/company-beacon?lens=all&zero=hide', {
      kind: 'company',
      companyId: 'company-beacon',
    }),
  );
  expect(screen.getByRole('checkbox', { name: 'Hide zero totals' })).toBeChecked();
  expect(screen.queryByRole('checkbox', { name: 'Hide zero reviewer totals' })).toBeNull();
  const members = screen.getByRole('region', { name: 'Company members' });
  expect(within(members).getByRole('button', { name: 'Columns · All credits' })).toBeVisible();
  // Finn has no reviewer credit, but his issue keeps him in an all-totals Hide zero.
  expect(within(members).getByRole('link', { name: /^Finn/ })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Back to Companies' })).toHaveAttribute(
    'href',
    '/companies?lens=all',
  );
});

it('gives the Companies lens Over time no area tabs and the six credits by default', async () => {
  window.history.replaceState(null, '', '/companies?timeline');
  const result = await timelineView(viewOf('/companies?timeline')!);
  if (result.status !== 'ready' || !('reportHref' in result)) throw Error('Expected Over time');
  render(
    <ContributionTimelineScreen
      viewerId={result.viewerId}
      // The screen reads the lens from its context.
      context={{ ...result.controls, lens: 'all' }}
      report={result.report}
      area="companies"
      reportHref="/companies?lens=all"
    />,
  );
  expect(screen.getByRole('heading', { level: 1, name: 'Companies' })).toBeVisible();
  expect(screen.queryByRole('navigation', { name: 'Contribution reports' })).toBeNull();
  expect(screen.getByRole('link', { name: 'Over time' })).toHaveAttribute('aria-current', 'page');
  const table = screen.getByRole('table');
  expect(
    [...table.querySelectorAll('tbody tr:first-child [data-column]')].map((cell) =>
      cell.getAttribute('data-column'),
    ),
  ).toEqual([
    'period',
    'prsAuthored',
    'authoredPrsMerged',
    'reviewerContributions',
    'approvalContributions',
    'mergesPerformed',
    'issuesAuthored',
  ]);
  expect(screen.getByRole('button', { name: 'Columns · All credits' })).toBeVisible();
});
