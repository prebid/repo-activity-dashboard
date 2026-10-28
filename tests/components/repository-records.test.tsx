import { selectRepositoryPage } from '@/lib/presentation/repository-page';
import {
  repositoryPageRecordsSample,
  repositoryPageNavigationSample,
} from '@/mocks/repository-page';
import { expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RepositoryPageView } from '@/features/repositories/repository-page-view';
import { OverviewMetric } from '@/features/repositories/overview-metric';
import { useLocalTableController } from '@/components/tables/local-data-table';
import { repositoryRecordSample } from '@/mocks/repository-records';
import { repositoryOverviewSamples } from '@/mocks/repository-overview';
import type { RepositoryRecordList } from '@/models/repository-records';
const samples = repositoryOverviewSamples();
const repo = samples.repositories.find((row) => row.repository.slug === 'prebidjs')!.repository;
function Preview({ list }: { list: RepositoryRecordList }) {
  const controller = useLocalTableController();
  return (
    <RepositoryPageView
      page={selectRepositoryPage(repositoryPageRecordsSample(list))}
      navigation={repositoryPageNavigationSample(list.repository)}
      controller={controller}
    />
  );
}
it('renders cohort metadata, top-level records, and a safe return link while keeping optional columns usable', async () => {
  const user = userEvent.setup();
  const list = repositoryRecordSample(repo, {
    selection: { scope: 'current', metric: 'humanApprovals1' },
    returnTo: '/repos?age=60&period=this-week',
  });
  render(<Preview list={list} />);
  expect(screen.getByText('40 matching records')).toBeVisible();
  expect(screen.getByRole('link', { name: '← All repositories' })).toHaveAttribute(
    'href',
    '/repos?age=60&period=this-week',
  );
  const table = screen.getByRole('table');
  expect(table.querySelectorAll('tbody tr')).toHaveLength(40);
  expect(
    within(table).getByRole('columnheader', { name: 'Current human approvals' }),
  ).toBeVisible();
  expect(
    within(table).queryByRole('columnheader', { name: 'Human reviewers' }),
  ).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Columns' }));
  await user.click(screen.getByRole('menuitemcheckbox', { name: 'Human reviewers' }));
  await user.keyboard('{Escape}');
  expect(within(table).getByRole('columnheader', { name: 'Human reviewers' })).toBeVisible();
});
it('labels partial and missing lists without turning unknown coverage into zero', () => {
  const partialRepo = samples.repositories.find(
    (row) => row.repository.slug === 'prebid-cache-java',
  )!.repository;
  const view = render(
    <Preview
      list={repositoryRecordSample(partialRepo, {
        selection: { scope: 'current', metric: 'agentFeedbackPrs' },
        returnTo: '/repos',
      })}
    />,
  );
  expect(screen.getByText(/Partial sample coverage:/)).toBeVisible();
  expect(screen.getByText('2 available sample records')).toBeVisible();
  const missingRepo = samples.repositories.find(
    (row) => row.repository.slug === 'prebid-agent-skills',
  )!.repository;
  view.rerender(
    <Preview
      list={repositoryRecordSample(missingRepo, {
        selection: { scope: 'current', metric: 'humanApprovals0' },
        returnTo: '/repos',
      })}
    />,
  );
  expect(screen.getByRole('heading', { name: 'Sample records unavailable' })).toBeVisible();
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
});
it('links known zero and partial PR counts, including author metrics, but never missing values', () => {
  const props = {
    repository: repo,
    selection: { scope: 'current' as const, metric: 'totalOpenPrs' as const },
    label: 'Total PRs',
    returnTo: '/repos',
  };
  const view = render(<OverviewMetric {...props} measurement={{ status: 'complete', value: 0 }} />);
  expect(screen.getByRole('link')).toHaveAttribute(
    'href',
    '/repos/prebidjs?scope=current&metric=totalOpenPrs',
  );
  view.rerender(<OverviewMetric {...props} measurement={{ status: 'complete', value: 12345 }} />);
  expect(screen.getByRole('link')).toHaveAccessibleName('Prebid.js: Total PRs, 12,345');
  view.rerender(
    <OverviewMetric
      {...props}
      measurement={{ status: 'partial', value: 2, reason: 'Incomplete sample' }}
    />,
  );
  expect(screen.getByRole('link')).toHaveAccessibleName('Prebid.js: Total PRs, 2 (partial)');
  view.rerender(
    <OverviewMetric
      {...props}
      measurement={{ status: 'missing', value: null, reason: 'Missing sample' }}
    />,
  );
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
  view.rerender(
    <OverviewMetric
      {...props}
      selection={{ scope: 'period', metric: 'prAuthors', range: samples.periods[0].period.range }}
      measurement={{ status: 'complete', value: 8 }}
    />,
  );
  expect(screen.getByRole('link')).toHaveAttribute(
    'href',
    expect.stringContaining('metric=prAuthors'),
  );
});

it('shows current navigation totals separately from the selected cohort and links the catalog repository', () => {
  const list = repositoryRecordSample(repo, {
    selection: { scope: 'current', metric: 'agedPrs', ageDays: 60 },
    returnTo: '/repos?age=60',
  });
  render(<Preview list={list} />);
  expect(screen.getByText('60 matching records')).toBeVisible();
  const tabs = screen.getByRole('navigation', { name: 'Repository lists' });
  expect(within(tabs).getByRole('link', { name: /Pull requests/ })).toHaveAttribute(
    'aria-current',
    'page',
  );
  expect(within(tabs).getByText('137')).toBeVisible();
  expect(within(tabs).getByText('834')).toBeVisible();
  expect(screen.getByRole('link', { name: /View repository on GitHub/ })).toHaveAttribute(
    'href',
    'https://github.com/prebid/Prebid.js',
  );
  expect(screen.getByRole('link', { name: 'All open PRs' })).toHaveAttribute(
    'href',
    '/repos/prebidjs?scope=current&metric=totalOpenPrs&returnTo=%2Frepos%3Fage%3D60',
  );
});
it('keeps record identity and labels together, uses separate reviewer/approval values, and marks drafts ineligible', () => {
  const list = repositoryRecordSample(repo, {
    selection: { scope: 'current', metric: 'totalOpenPrs' },
    returnTo: '/repos',
  });
  if (list.kind !== 'prs') throw new Error('Expected PRs');
  render(<Preview list={list} />);
  const draft = list.rows.find((row) => row.draft)!;
  const link = screen.getByRole('link', { name: draft.title });
  expect(link).toHaveAttribute('href', draft.url);
  const row = link.closest('tr')!;
  expect(row.querySelector('[data-column="humanReviewers"]')).toHaveTextContent('—');
  expect(row.querySelector('[data-column="approvals"]')).toHaveTextContent('—');
  expect(within(row).getByText(draft.labels[0], { exact: true })).toBeVisible();
  const table = screen.getByRole('table');
  expect(within(table).queryByRole('columnheader', { name: 'Labels' })).not.toBeInTheDocument();
  expect(within(table).queryByRole('columnheader', { name: 'Status' })).not.toBeInTheDocument();
  expect(table.querySelectorAll('tbody tr')).toHaveLength(100);
});

it('searches the full issue population by its visible Unassigned value', async () => {
  const user = userEvent.setup();
  const list = repositoryRecordSample(repo, {
    selection: { scope: 'current', metric: 'openIssues' },
    returnTo: '/repos',
  });
  render(<Preview list={list} />);
  await user.click(screen.getByRole('button', { name: 'Columns' }));
  await user.click(screen.getByRole('menuitemcheckbox', { name: 'Assignees' }));
  await user.keyboard('{Escape}');
  await user.click(screen.getByRole('textbox', { name: 'Search Open issues' }));
  await user.paste('Unassigned');
  expect(screen.getByText('334 matching issues')).toBeVisible();
  expect(screen.getByText('Page 1 of 4')).toBeVisible();
  expect(screen.getByRole('table').querySelectorAll('tbody tr')).toHaveLength(100);
});
