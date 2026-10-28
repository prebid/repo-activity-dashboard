import { expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RepositoryRecordsView } from '@/features/repositories/repository-records-view';
import { OverviewMetric } from '@/features/repositories/overview-metric';
import { useLocalTableController } from '@/components/tables/local-data-table';
import { repositoryRecordSample } from '@/mocks/repository-records';
import { repositoryOverviewSamples } from '@/mocks/repository-overview';
import type { RepositoryRecordList } from '@/models/repository-records';
const samples = repositoryOverviewSamples();
const repo = samples.repositories.find((row) => row.repository.slug === 'prebidjs')!.repository;
function Preview({ list }: { list: RepositoryRecordList }) {
  const controller = useLocalTableController();
  return <RepositoryRecordsView list={list} controller={controller} />;
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
