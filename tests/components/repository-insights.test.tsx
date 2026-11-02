import { expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RepositoryInsightsView } from '@/features/repositories/repository-insights-view';
import { OverviewMetric } from '@/features/repositories/overview-metric';
import { useLocalTableController } from '@/components/tables/local-data-table';
import { repositoryInsightSample } from '@/mocks/repository-insights';
import { repositoryPageSample } from '@/mocks/repository-page';
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
/** The first prepared repository and period whose Summary value for a metric is exactly one. */
function exactlyOne(metric: InsightMetric) {
  for (const period of samples.periods)
    for (const { repository } of samples.repositories) {
      const activity = period.rows[repository.id].activity;
      const value =
        metric === 'medianMergeDays'
          ? activity.mergeDuration.sampleSize.value
          : activity.counts[metric].value;
      if (value === 1) return { repository, range: period.period.range };
    }
  throw new Error('No sample period has exactly one ' + metric);
}
it('uses singular units for one account, record, credit, and merged PR', () => {
  const author = exactlyOne('prAuthors');
  const oneAuthor = repositoryInsightSample(author.repository, {
    selection: { scope: 'period', metric: 'prAuthors', range: author.range },
    returnTo: '/repos',
  });
  if (oneAuthor.kind !== 'authors') throw new Error('Expected authors');
  const view = render(<Preview insight={oneAuthor} />);
  expect(screen.getByText('1 unique account')).toBeVisible();
  const only = oneAuthor.rows[0];
  expect(
    screen.getByLabelText(
      'View ' +
        only.recordCount +
        ' PR' +
        (only.recordCount === 1 ? '' : 's') +
        ' by ' +
        only.account,
    ),
  ).toBeVisible();
  const credit = exactlyOne('agentFeedbackCredits');
  view.rerender(
    <Preview
      insight={repositoryInsightSample(credit.repository, {
        selection: { scope: 'period', metric: 'agentFeedbackCredits', range: credit.range },
        returnTo: '/repos',
      })}
    />,
  );
  const scope = () => screen.getByRole('region', { name: 'Selected repository scope' });
  expect(within(scope()).getByText('1 contribution credit')).toBeVisible();
  expect(within(scope()).getByText('1 distinct PR')).toBeVisible();
  // The scope and the table footer both count it; without a search the footer has no "matching".
  expect(screen.getAllByText('1 contribution credit')).toHaveLength(2);
  const merged = exactlyOne('medianMergeDays');
  view.rerender(
    <Preview
      insight={repositoryInsightSample(merged.repository, {
        selection: {
          scope: 'period',
          metric: 'medianMergeDays',
          branch: merged.repository.primaryBranch,
          range: merged.range,
        },
        returnTo: '/repos',
      })}
    />,
  );
  expect(screen.getByText('1 merged PR')).toBeVisible();
});
/** An author with several records, so its link uses the plural record unit. */
function frequentAuthor(insight: RepositoryInsight) {
  if (insight.kind !== 'authors') throw new Error('Expected authors');
  return insight.rows.find(
    (row) => /^sample-author-\d+$/.test(row.account) && row.recordCount > 1,
  )!;
}
it('uses compact account rows and links to full filtered record lists', () => {
  const insight = detail('prAuthors');
  render(<Preview insight={insight} />);
  const accounts = insight.measurement.value!;
  expect(accounts).toBeGreaterThan(1);
  expect(screen.getByText(accounts + ' unique accounts')).toBeVisible();
  expect(screen.getByRole('table').querySelectorAll('tbody tr')).toHaveLength(accounts);
  const types = [
    ...screen.getByRole('table').querySelectorAll('tbody [data-column="accountType"]'),
  ];
  expect(types.filter((cell) => cell.textContent === 'Prebid agent')).toHaveLength(1);
  expect(types.filter((cell) => cell.textContent === 'Bot')).toHaveLength(1);
  // Every account carries an avatar titled with its type; the type column keeps the text.
  expect(
    screen
      .getByRole('table')
      .querySelectorAll('tbody [data-column="account"] [data-kind="person"]'),
  ).toHaveLength(accounts);
  expect(screen.getByTitle('Prebid agent')).toHaveAttribute('data-account-type', 'agent');
  // The type column can be hidden, so the account cell names the type the hidden badge shows.
  const agent = screen.getByTitle('Prebid agent').closest('td')!;
  expect(agent).toHaveAccessibleName(
    /GitHub profile for [\w-]+ \(sample placeholder\) ?Prebid agent$/,
  );
  const author = frequentAuthor(insight);
  const link = screen.getByRole('link', {
    name: 'View ' + author.recordCount + ' PRs by ' + author.account,
  });
  const target = new URL(link.getAttribute('href')!, 'https://dashboard.invalid');
  expect(target.pathname).toBe('/repos/prebidjs/authors/' + author.account);
  expect(target.searchParams.get('metric')).toBe('prAuthors');
  expect(target.searchParams.get('from')).toBe('2026-10-01T00:00:00.000Z');
  expect(screen.getByRole('table').querySelector('details')).toBeNull();
  expect(screen.getByRole('link', { name: 'All repositories' })).toHaveAttribute(
    'href',
    '/repos?period=this-month&period2=last-month&age=60',
  );
});
it('shows credit units separately from distinct PR counts', () => {
  const insight = detail('agentFeedbackCredits');
  if (insight.kind !== 'contributions') throw new Error('Expected credits');
  render(<Preview insight={insight} />);
  const credits = insight.rows.length,
    prs = new Set(insight.rows.map((row) => row.pr.id)).size;
  expect(credits).toBeGreaterThan(1);
  const scope = screen.getByRole('region', { name: 'Selected repository scope' });
  expect(within(scope).getByText(credits + ' contribution credits')).toBeVisible();
  expect(within(scope).getByText(prs + ' distinct PRs')).toBeVisible();
  expect(screen.getByRole('table').querySelectorAll('tbody tr')).toHaveLength(credits);
  expect(screen.getByRole('button', { name: 'First credited' })).toHaveAccessibleDescription(
    /Repeated actions do not create additional credits/,
  );
});
it('captures pending author-search text in the record link return context', () => {
  const insight = detail('prAuthors');
  const author = frequentAuthor(insight);
  function PendingSearch() {
    const controller = useLocalTableController({
      search: '',
      sort: 'account',
      descending: true,
      page: 1,
    });
    return (
      <RepositoryInsightsView
        insight={insight}
        controller={{ ...controller, draftSearch: author.account }}
      />
    );
  }
  render(<PendingSearch />);
  const href = screen
    .getByRole('link', { name: 'View ' + author.recordCount + ' PRs by ' + author.account })
    .getAttribute('href')!;
  const params = new URL(href, 'https://dashboard.invalid').searchParams;
  expect(params.get('authors.q')).toBe(author.account);
  expect(params.get('authors.sort')).toBe('account');
  expect(params.get('authors.dir')).toBe('desc');
  expect(params.has('authors.page')).toBe(false);
});
it('shows the median separately from sample size and sorts numeric elapsed durations', async () => {
  const user = userEvent.setup();
  const insight = detail('medianMergeDays');
  if (insight.kind !== 'duration') throw new Error('Expected duration');
  // A fixed median isolates the day-unit formatting from the sample's computed value.
  insight.days = { status: 'complete', value: 5.5 };
  // 4.853 days from creation to merge, which the cell rounds to one decimal.
  insight.records.rows[0] = {
    ...insight.records.rows[0],
    createdAt: '2026-10-01T00:00:00.000Z',
    mergedAt: '2026-10-05T20:28:19.200Z',
  };
  render(<Preview insight={insight} />);
  const merged = insight.records.rows.length;
  expect(merged).toBeGreaterThan(1);
  expect(
    screen.getByRole('table').querySelector('tbody tr [data-column="mergeDays"]'),
  ).toHaveTextContent(/^4\.9 d$/);
  expect(screen.getByText('5.5 d')).toBeVisible();
  expect(screen.getByText(merged + ' merged PRs')).toBeVisible();
  expect(screen.getByText('Primary branch: master')).toBeVisible();
  expect(screen.getByRole('table').querySelectorAll('tbody tr')).toHaveLength(merged);
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
  // The record set starts in 2024, so an earlier range has no prepared coverage.
  const missing = repositoryInsightSample(repo, {
    selection: {
      scope: 'period',
      metric: 'prAuthors',
      range: {
        start: '2023-10-01T00:00:00.000Z',
        end: '2023-10-02T00:00:00.000Z',
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
  view.rerender(<OverviewMetric {...props} measurement={{ status: 'complete', value: 4.853 }} />);
  expect(screen.getByRole('link')).toHaveAccessibleName('Prebid.js: Median merge time, 4.9 d');
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

it('forwards a pending Timeline navigation to the repository header tab', () => {
  function Pending() {
    const controller = useLocalTableController();
    return (
      <RepositoryInsightsView
        insight={detail('prAuthors')}
        controller={controller}
        timelineHref="/repos/prebidjs?timeline=1"
        timelinePending
      />
    );
  }
  render(<Pending />);
  const tabs = screen.getByRole('navigation', { name: 'Repository lists' });
  expect(within(tabs).getByRole('link', { name: 'Timeline' }).lastElementChild).toHaveAttribute(
    'data-pending',
    'true',
  );
  expect(
    within(tabs).getByRole('link', { name: /^Pull requests/ }).lastElementChild,
  ).toHaveAttribute('data-pending', 'false');
});
it('lists merged and credited PRs in the record row, with status inline and avatars for authors', async () => {
  const user = userEvent.setup();
  const insight = detail('medianMergeDays');
  if (insight.kind !== 'duration') throw new Error('Expected duration');
  const view = render(<Preview insight={insight} />);
  const table = screen.getByRole('table', { name: 'Merged PRs and durations' });
  for (const name of ['Status', 'Labels', 'Author category'])
    expect(within(table).queryByRole('columnheader', { name })).not.toBeInTheDocument();
  const rows = [...table.querySelectorAll('tbody tr')];
  expect(rows).toHaveLength(insight.records.rows.length);
  for (const row of rows) {
    const href = row.querySelector('[data-column="number"] a')!.getAttribute('href');
    const record = insight.records.rows.find((item) => item.url === href)!;
    expect(row.querySelector('[data-column="number"] a')).toHaveTextContent(String(record.number));
    const title = within(row.querySelector<HTMLElement>('[data-column="title"]')!);
    expect(title.getByRole('link', { name: record.title })).toHaveAttribute('href', record.url);
    expect(title.getByText('Merged', { exact: true })).toBeVisible();
    for (const label of record.labels)
      expect(title.getByText(label, { exact: true })).toBeVisible();
    // The author's avatar carries the account type the cell names.
    const author = row.querySelector<HTMLElement>('[data-column="author"]')!;
    const type = within(author).getByText(/^(Human|Prebid agent|Bot|—)$/).textContent;
    expect(author.querySelector('[data-kind="person"]')).toHaveAttribute(
      'title',
      type === '—' ? 'Account type unavailable' : type,
    );
  }
  // The merged PRs carry the author types the record pages show for the same records.
  const page = repositoryPageSample(repo, { ...insight.records.drilldown, returnTo: '/repos' });
  const types = new Map(page.rows.map((row) => [row.id, row.authorType]));
  expect(insight.records.rows.map((row) => row.authorType)).toEqual(
    insight.records.rows.map((row) => types.get(row.id)),
  );
  expect(insight.records.rows.some((row) => row.authorType !== null)).toBe(true);
  await user.click(screen.getByRole('button', { name: 'Columns' }));
  // The menu's Status group holds Base branch alone; the inline values are not columns there.
  expect(screen.getByRole('menuitemcheckbox', { name: 'Author' })).toBeInTheDocument();
  expect(screen.getByRole('menuitemcheckbox', { name: 'Base branch' })).toBeInTheDocument();
  for (const name of ['Labels', 'Author category'])
    expect(screen.queryByRole('menuitemcheckbox', { name })).not.toBeInTheDocument();
  await user.keyboard('{Escape}');
  view.unmount();
  const credits = detail('agentFeedbackCredits');
  if (credits.kind !== 'contributions') throw new Error('Expected credits');
  render(<Preview insight={credits} />);
  const creditRows = [...screen.getByRole('table').querySelectorAll('tbody tr')];
  expect(creditRows).toHaveLength(credits.rows.length);
  for (const row of creditRows) {
    const title = within(row.querySelector<HTMLElement>('[data-column="title"]')!);
    const href = title.getAllByRole('link')[0].getAttribute('href');
    const { pr } = credits.rows.find((item) => item.pr.url === href)!;
    expect(title.getByRole('link', { name: pr.title })).toBeVisible();
    expect(
      title.getByText(pr.draft && pr.state === 'Open' ? 'Draft' : pr.state, { exact: true }),
    ).toBeVisible();
    const number = within(row.querySelector<HTMLElement>('[data-column="pr"]')!).getByRole('link');
    expect(number).toHaveTextContent(String(pr.number));
    expect(number).toHaveAttribute('href', pr.url);
  }
});
