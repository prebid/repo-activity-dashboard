import { expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RepositoryInsightsView } from '@/features/repositories/repository-insights-view';
import { OverviewMetric } from '@/features/repositories/overview-metric';
import { useLocalTableController } from '@/components/tables/local-data-table';
import { repositoryInsightSample } from '@/mocks/repository-insights';
import { repositoryOverviewSamples } from '@/mocks/repository-overview';
import type { InsightMetric, RepositoryInsight } from '@/models/repository-insights';
const samples = repositoryOverviewSamples();
const repo = samples.repositories.find((row) => row.repository.slug === 'prebidjs')!.repository;
const range = samples.periods[2].period.range;
function detail(metric: InsightMetric, empty = false) {
  const identity = empty
    ? samples.repositories.find((row) => row.repository.slug === 'prebid-mobile-ios-sdk')!
        .repository
    : repo;
  return repositoryInsightSample(identity, {
    selection: {
      scope: 'period',
      metric,
      range,
      ...(metric === 'medianMergeDays' ? { branch: identity.primaryBranch } : {}),
    },
    returnTo: '/repos?period=this-month&period2=last-month&age=60',
  });
}
function Preview({ insight }: { insight: RepositoryInsight }) {
  const controller = useLocalTableController();
  return <RepositoryInsightsView insight={insight} controller={controller} />;
}
it('uses singular units for one account, record, credit, and merged PR', () => {
  const gdpr = samples.repositories.find((row) => row.repository.slug === 'go-gdpr')!.repository;
  const sales = samples.repositories.find(
    (row) => row.repository.slug === 'salesagent',
  )!.repository;
  const oneAuthor = repositoryInsightSample(gdpr, {
    selection: { scope: 'period', metric: 'prAuthors', range },
    returnTo: '/repos',
  });
  const view = render(<Preview insight={oneAuthor} />);
  expect(screen.getByText('1 unique account')).toBeVisible();
  expect(screen.getByLabelText('View 1 PR by sample-author-1')).toBeVisible();
  view.rerender(
    <Preview
      insight={repositoryInsightSample(sales, {
        selection: {
          scope: 'period',
          metric: 'agentFeedbackCredits',
          range: samples.periods[0].period.range,
        },
        returnTo: '/repos',
      })}
    />,
  );
  expect(screen.getByText('1 contribution credit')).toBeVisible();
  expect(screen.getByText('1 distinct PR')).toBeVisible();
  view.rerender(
    <Preview
      insight={repositoryInsightSample(gdpr, {
        selection: {
          scope: 'period',
          metric: 'medianMergeDays',
          branch: gdpr.primaryBranch,
          range: samples.periods[3].period.range,
        },
        returnTo: '/repos',
      })}
    />,
  );
  expect(screen.getByText('1 merged PR')).toBeVisible();
});
it('uses compact account rows and links to full filtered record lists', () => {
  render(<Preview insight={detail('prAuthors')} />);
  expect(screen.getByText('24 unique accounts')).toBeVisible();
  expect(screen.getByRole('table').querySelectorAll('tbody tr')).toHaveLength(24);
  expect(screen.getByText('Prebid agent')).toBeVisible();
  expect(screen.getByText('Bot')).toBeVisible();
  const link = screen.getByRole('link', { name: 'View 2 PRs by sample-author-1' });
  const target = new URL(link.getAttribute('href')!, 'https://dashboard.invalid');
  expect(target.pathname).toBe('/repos/prebidjs/authors/sample-author-1');
  expect(target.searchParams.get('metric')).toBe('prAuthors');
  expect(target.searchParams.get('from')).toBe('2026-10-01T00:00:00.000Z');
  expect(screen.getByRole('table').querySelector('details')).toBeNull();
  expect(screen.getByRole('link', { name: '← All repositories' })).toHaveAttribute(
    'href',
    '/repos?period=this-month&period2=last-month&age=60',
  );
});
it('shows credit units separately from distinct PR counts', () => {
  render(<Preview insight={detail('agentFeedbackCredits')} />);
  expect(screen.getByText('18 contribution credits')).toBeVisible();
  expect(screen.getByText('9 distinct PRs')).toBeVisible();
  expect(screen.getByRole('table').querySelectorAll('tbody tr')).toHaveLength(18);
  expect(screen.getByRole('button', { name: 'First credited' })).toHaveAccessibleDescription(
    /Repeated actions do not create additional credits/,
  );
});
it('captures pending author-search text in the record link return context', () => {
  function PendingSearch() {
    const controller = useLocalTableController({
      search: '',
      sort: 'account',
      descending: true,
      page: 1,
    });
    return (
      <RepositoryInsightsView
        insight={detail('prAuthors')}
        controller={{ ...controller, draftSearch: 'sample-author-2' }}
      />
    );
  }
  render(<PendingSearch />);
  const href = screen
    .getByRole('link', { name: 'View 2 PRs by sample-author-2' })
    .getAttribute('href')!;
  const params = new URL(href, 'https://dashboard.invalid').searchParams;
  expect(params.get('authors.q')).toBe('sample-author-2');
  expect(params.get('authors.sort')).toBe('account');
  expect(params.get('authors.dir')).toBe('desc');
  expect(params.has('authors.page')).toBe(false);
});
it('shows the median separately from sample size and sorts numeric elapsed durations', async () => {
  const user = userEvent.setup();
  render(<Preview insight={detail('medianMergeDays')} />);
  expect(screen.getByText('5.5 d')).toBeVisible();
  expect(screen.getByText('38 merged PRs')).toBeVisible();
  expect(screen.getByText('Primary branch: master')).toBeVisible();
  expect(screen.getByRole('table').querySelectorAll('tbody tr')).toHaveLength(38);
  await user.click(screen.getByRole('button', { name: 'Merge time' }));
  const times = [...screen.getByRole('table').querySelectorAll('[data-column="mergeDays"]')].map(
    (cell) => Number.parseFloat(cell.textContent),
  );
  expect(new Set(times).size).toBeGreaterThan(1);
  expect(times).toEqual([...times].sort((a, b) => a - b));
});
it('keeps empty, unavailable, and partial detail states explicit', () => {
  const view = render(<Preview insight={detail('prAuthors', true)} />);
  expect(screen.getByRole('heading', { name: 'No items' })).toBeVisible();
  view.rerender(<Preview insight={detail('medianMergeDays', true)} />);
  expect(screen.getByRole('heading', { name: 'No merged PRs in this period' })).toBeVisible();
  const missing = repositoryInsightSample(repo, {
    selection: {
      scope: 'period',
      metric: 'prAuthors',
      range: {
        start: '2026-10-01T00:00:00.000Z',
        end: '2026-10-02T00:00:00.000Z',
        endInclusive: false,
      },
    },
    returnTo: '/repos',
  });
  view.rerender(<Preview insight={missing} />);
  expect(screen.getByRole('heading', { name: 'Sample records unavailable' })).toBeVisible();
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
  const partial = detail('medianMergeDays');
  if (partial.kind !== 'duration') throw new Error('Expected duration');
  partial.days = { status: 'partial', value: 5.5, reason: 'Incomplete timing sample.' };
  view.rerender(<Preview insight={partial} />);
  expect(
    screen.getByText('Partial merge-duration coverage: Incomplete timing sample.'),
  ).toBeVisible();
});
it('links known durations with visible day units, while missing and not-applicable values stay plain', () => {
  const props = {
    repository: repo,
    selection: {
      scope: 'period' as const,
      metric: 'medianMergeDays' as const,
      branch: 'master' as const,
      range,
    },
    label: 'Median merge time',
    returnTo: '/repos',
    unit: 'days' as const,
  };
  const view = render(
    <OverviewMetric {...props} measurement={{ status: 'complete', value: 5.5 }} />,
  );
  expect(screen.getByRole('link')).toHaveAccessibleName('Prebid.js: Median merge time, 5.5 d');
  expect(screen.getByRole('link')).toHaveAttribute(
    'href',
    expect.stringContaining('metric=medianMergeDays'),
  );
  view.rerender(<OverviewMetric {...props} measurement={{ status: 'complete', value: 0 }} />);
  expect(screen.getByRole('link')).toHaveAccessibleName('Prebid.js: Median merge time, 0 d');
  view.rerender(
    <OverviewMetric
      {...props}
      measurement={{ status: 'not-applicable', value: null, reason: 'No merged PRs.' }}
    />,
  );
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});
