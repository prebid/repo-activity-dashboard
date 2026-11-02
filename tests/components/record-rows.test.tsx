import { expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  RecordIdentity,
  RecordNumber,
  issueStatus,
  pullRequestStatus,
} from '@/components/github/record-identity';
import { RepositoryPageView } from '@/features/repositories/repository-page-view';
import { useLocalTableController } from '@/components/tables/local-data-table';
import { selectRepositoryPage } from '@/lib/presentation/repository-page';
import { repositoryAuthorsHref } from '@/lib/presentation/repository-author-records';
import {
  repositoryPageRecordsSample,
  repositoryPageNavigationSample,
} from '@/mocks/repository-page';
import { repositoryAuthorRecordSample } from '@/mocks/repository-insights';
import { repositoryRecordSample } from '@/mocks/repository-records';
import { repositoryOverviewSamples } from '@/mocks/repository-overview';
import type { RepositoryRecordList } from '@/models/repository-records';
import type { TableQuery } from '@/models/table-query';

const samples = repositoryOverviewSamples();
const repo = samples.repositories.find((row) => row.repository.slug === 'prebidjs')!.repository;
const range = samples.periods.find(
  ({ period }) => period.selection.kind === 'preset' && period.selection.preset === 'this-year',
)!.period.range;
function Page({ list, query }: { list: RepositoryRecordList; query?: TableQuery }) {
  const controller = useLocalTableController(query);
  return (
    <RepositoryPageView
      page={selectRepositoryPage(repositoryPageRecordsSample(list))}
      navigation={repositoryPageNavigationSample(list.repository)}
      controller={controller}
    />
  );
}

it('links a record title and number to the record, with its status and labels beneath the title', () => {
  const url = 'https://github.example/example-fixtures/prebidjs/pull/105';
  render(
    <>
      <RecordNumber number={105} url={url} />
      <RecordIdentity
        title="Sample PR"
        url={url}
        status={pullRequestStatus('Open', true)}
        labels={['bug', 'docs']}
      />
    </>,
  );
  for (const name of ['105', 'Sample PR']) {
    const link = screen.getByRole('link', { name });
    expect(link).toHaveAttribute('href', url);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  }
  // A draft reads Draft whatever its state; the status and chips sit beside, not inside, the link.
  const identity = screen.getByRole('link', { name: 'Sample PR' }).parentElement!;
  expect(within(identity).getByText('Draft', { exact: true })).toBeVisible();
  for (const label of ['bug', 'docs'])
    expect(within(identity).getByText(label, { exact: true })).toBeVisible();
  expect(pullRequestStatus('Merged')).toEqual({ kind: 'pr', status: 'merged' });
  expect(pullRequestStatus('Closed', false)).toEqual({ kind: 'pr', status: 'closed' });
  expect(issueStatus('Open')).toEqual({ kind: 'issue', status: 'open' });
  expect(issueStatus('Closed')).toEqual({ kind: 'issue', status: 'closed' });
});

it('starts an author-scoped record list without its Author column and keeps it in Columns', async () => {
  const user = userEvent.setup();
  const drilldown = {
    selection: { scope: 'period' as const, metric: 'prAuthors' as const, range },
    returnTo: '/repos?period=this-year',
  };
  const back = repositoryAuthorsHref(repo, drilldown, {
    search: 'sample-author-2',
    sort: 'recordCount',
    descending: true,
    page: 1,
  });
  const list = repositoryAuthorRecordSample(repo, drilldown, 'sample-author-2', back);
  const view = render(<Page list={list} />);
  const table = screen.getByRole('table', { name: 'PRs by sample-author-2' });
  expect(screen.getByText('Author: sample-author-2', { exact: true })).toBeVisible();
  expect(within(table).queryByRole('columnheader', { name: 'Author' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Columns' }));
  const author = screen.getByRole('menuitemcheckbox', { name: 'Author' });
  expect(author).toHaveAttribute('aria-checked', 'false');
  await user.click(author);
  await user.keyboard('{Escape}');
  expect(within(table).getByRole('columnheader', { name: 'Author' })).toBeVisible();
  const accounts = [...table.querySelectorAll('tbody [data-column="author"]')].map((cell) =>
    within(cell as HTMLElement)
      .getByRole('link')
      .textContent?.trim(),
  );
  expect(accounts.length).toBeGreaterThan(1);
  expect(new Set(accounts)).toEqual(new Set(['sample-author-2']));
  view.unmount();
  // The repository's own record list keeps the column.
  render(
    <Page
      list={repositoryRecordSample(repo, {
        selection: { scope: 'current', metric: 'totalOpenPrs' },
        returnTo: '/repos',
      })}
    />,
  );
  expect(screen.getByRole('columnheader', { name: 'Author' })).toBeVisible();
});

it('describes a record list sorted by a hidden column once, in the table footer', () => {
  render(
    <Page
      list={repositoryRecordSample(repo, {
        selection: { scope: 'current', metric: 'totalOpenPrs' },
        returnTo: '/repos',
      })}
      query={{ search: '', sort: 'createdAt', descending: true, page: 1 }}
    />,
  );
  expect(screen.queryByRole('columnheader', { name: 'Created' })).not.toBeInTheDocument();
  expect(screen.getAllByText(/^Sorted by /)).toHaveLength(1);
  expect(
    screen.getByText('Sorted by Created (descending); its column is hidden.', { exact: true }),
  ).toBeVisible();
  expect(screen.queryByText('Newest created first')).not.toBeInTheDocument();
});
