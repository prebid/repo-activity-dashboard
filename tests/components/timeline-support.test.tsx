import { expect, it, vi } from 'vitest';
import { render, screen, renderHook, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TimelineTable } from '@/components/reporting/timeline-table';
import { TimelineSupportFrame } from '@/components/reporting/timeline-support-frame';
import { RepositoryTimelineSupportView } from '@/features/repositories/repository-timeline-support';
import { ContributionTimelineSupportView } from '@/features/contributions/contribution-timeline-support';
import { useLocalTableController } from '@/components/tables/local-data-table';
import {
  selectRepositoryTimelineSupport,
  selectContributionTimelineSupport,
} from '@/lib/presentation/timeline-support';
import { repositoryTimelineSample } from '@/mocks/repository-timeline';
import { contributionTimelineSample } from '@/mocks/contribution-timeline';
import { selectRepositoryTimeline } from '@/lib/presentation/repository-timeline';
import { selectContributionTimeline } from '@/lib/presentation/contribution-timeline';
import { timelineCsvDownload } from '@/components/reporting/timeline-csv-download';
import { CsvExportDialog } from '@/components/exports/csv-export-dialog';
import type { TimelineSupportContext, TimelineSupport } from '@/models/timeline-support';
const request = {
  grouping: 'month' as const,
  range: { start: '2026-01-01T00:00:00.000Z', end: '2026-10-24T12:00:00.000Z', endInclusive: true },
};
const source = repositoryTimelineSample(),
  report = selectRepositoryTimeline(source, request);
const context = (metric: string): TimelineSupportContext => ({
  source: report.source,
  interval: report.rows[9].interval,
  metric,
  measurement: report.rows[9].values[metric as keyof (typeof report.rows)[9]['values']]!,
  href: '/repos/prebidjs?timeline=1',
  parentHref: '/repos?timeline=1',
  scope: '/repos/prebidjs?timeline=1',
});
function Preview({ detail }: { detail: TimelineSupport }) {
  const controller = useLocalTableController();
  const visibility = { value: {}, onChange: () => {} };
  return (
    <TimelineSupportFrame
      context={detail.context}
      title="Timeline detail"
      contribution={detail.kind === 'contribution'}
      authorBack="/repos/prebidjs?timeline=1"
    >
      {detail.kind === 'contribution' ? (
        <ContributionTimelineSupportView
          detail={detail}
          controller={controller}
          visibility={visibility}
          disabled={false}
        />
      ) : (
        <RepositoryTimelineSupportView
          detail={detail}
          controller={controller}
          visibility={visibility}
          disabled={false}
          authorHref={(account) => '/repos/prebidjs?author=' + account}
          onAuthor={() => {}}
        />
      )}
    </TimelineSupportFrame>
  );
}
it('connects known and zero cells but keeps unavailable measurements unlinked', () => {
  const table = renderHook(() => useLocalTableController()).result.current;
  render(
    <TimelineTable
      rows={report.rows}
      grouping="month"
      metrics={[
        { id: 'prsOpened', label: 'Opened', defaultVisible: true, unit: 'count' },
        { id: 'medianMergeDays', label: 'Median', defaultVisible: true, unit: 'days' },
      ]}
      controls={{
        controller: table,
        visibility: { value: {}, onChange: () => {} },
        detailHref: (metric, interval) =>
          '/repos/prebidjs?metric=' + metric + '&interval=' + interval,
        csvDownload: vi.fn(),
        exportContextKey: 'sample',
      }}
    />,
  );
  expect(screen.getByRole('link', { name: 'Opened, Jan 2026: 0' })).toHaveAttribute(
    'href',
    expect.stringContaining('prsOpened'),
  );
  expect(screen.queryByRole('link', { name: /Median, Jan/ })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Median, Oct 2026: 31 d' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Export CSV' })).toBeVisible();
});
it('renders unique authors and source-specific PRs with GitHub destinations and the shared CSV dialog', async () => {
  const user = userEvent.setup();
  const authors = selectRepositoryTimelineSupport(source, report, context('prAuthors'));
  const view = render(<Preview detail={authors} />);
  expect(screen.getByRole('link', { name: 'sample-bob: 2 authored records' })).toHaveAttribute(
    'href',
    '/repos/prebidjs?author=sample-bob',
  );
  expect(screen.getByRole('link', { name: /GitHub profile for sample-bob/ })).toHaveAttribute(
    'target',
    '_blank',
  );
  view.rerender(
    <Preview
      detail={selectRepositoryTimelineSupport(source, report, context('prAuthors'), 'sample-bob')}
    />,
  );
  expect(screen.getByRole('table').querySelectorAll('tbody tr')).toHaveLength(2);
  expect(screen.getByRole('link', { name: '105' })).toHaveAttribute(
    'href',
    expect.stringContaining('105'),
  );
  await user.click(screen.getByRole('button', { name: 'Export CSV' }));
  expect(screen.getByRole('dialog')).toHaveTextContent('current filters and sorting');
  expect(screen.getByRole('checkbox', { name: 'Title (required)' })).toBeChecked();
});
it('renders grouped contributions and historical approval labels without showing comment bodies', () => {
  const s = contributionTimelineSample(),
    r = selectContributionTimeline(s, request),
    metric = 'reviewerContributions';
  const c = {
    ...context('prsOpened'),
    source: r.source,
    metric,
    measurement: r.rows[9].values[metric],
  };
  const view = render(<Preview detail={selectContributionTimelineSupport(s, r, c)} />);
  expect(screen.getByRole('table').querySelectorAll('tbody tr')).toHaveLength(6);
  expect(screen.getByText(/comments are grouped/i)).toBeVisible();
  const snapshot = selectRepositoryTimeline(
    source,
    {
      grouping: 'day',
      range: {
        start: '2026-10-21T00:00:00.000Z',
        end: '2026-10-22T00:00:00.000Z',
        endInclusive: false,
      },
    },
    'snapshot',
  );
  const details = selectRepositoryTimelineSupport(source, snapshot, {
    ...context('humanApprovals1'),
    interval: snapshot.rows[0].interval,
    measurement: snapshot.rows[0].values.humanApprovals1!,
  });
  view.rerender(<Preview detail={details} />);
  expect(screen.getByRole('columnheader', { name: 'Human approvals at cutoff' })).toBeVisible();
  expect(screen.getByRole('table').querySelectorAll('tbody tr')).toHaveLength(1);
});
it('shows the scope description its caller supplies in the CSV dialog', async () => {
  render(
    <CsvExportDialog
      title="Matrix"
      description="All repositories and all periods, beyond the visible window."
      columns={[{ id: 'period', label: 'Period', required: true }]}
      visibleColumnIds={['period']}
      contextKey="a"
      onDownload={() => ({ blob: new Blob(), fileName: 'matrix.csv' })}
    />,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
  expect(screen.getByRole('dialog')).toHaveTextContent('beyond the visible window');
});
it('binds the CSV request to source identity, current ordering and cancellation and rejects non-CSV responses', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(
      new Response('period,value\r\nOctober,3', { headers: { 'content-type': 'text/csv' } }),
    );
  vi.stubGlobal('fetch', fetch);
  const signal = new AbortController().signal,
    download = timelineCsvDownload('/repos/prebidjs?timeline=1', report.source),
    selection = {
      columnIds: ['period', 'prsOpened'],
      query: { search: '', sort: 'prsOpened', descending: true, page: 3 },
      signal,
    };
  const result = await download(selection);
  expect(result.fileName).toBe('timeline-sample.csv');
  const [, options] = fetch.mock.calls[0] as [string, RequestInit];
  expect(options.signal).toBe(signal);
  expect(options.credentials).toBe('same-origin');
  expect(options.cache).toBe('no-store');
  expect(JSON.parse(options.body as string)).toMatchObject({
    revision: report.source.scenarioId,
    asOf: report.source.asOf,
    columns: ['period', 'prsOpened'],
    href: expect.stringContaining('timeline.dir=desc') as unknown,
  });
  for (const response of [
    new Response('error', { status: 400 }),
    new Response('html', { headers: { 'content-type': 'text/html' } }),
    { ok: true, redirected: true, headers: new Headers({ 'content-type': 'text/csv' }) },
  ]) {
    fetch.mockResolvedValue(response);
    await expect(
      download({ ...selection, query: { ...selection.query, descending: false } }),
    ).rejects.toThrow('unavailable');
  }
});
it('explains bounded-out detail links without turning known values into missing data', () => {
  const table = renderHook(() => useLocalTableController()).result.current;
  render(
    <TimelineTable
      rows={[report.rows[9]]}
      grouping="month"
      metrics={[{ id: 'prsOpened', label: 'Opened', defaultVisible: true, unit: 'count' }]}
      controls={{
        controller: table,
        visibility: { value: {}, onChange: () => {} },
        detailHref: () => null,
      }}
    />,
  );
  expect(screen.getByTitle(/too large to link/)).toHaveTextContent('3');
  expect(screen.getByText(/the link would be too large/)).toBeInTheDocument();
  expect(
    screen.getAllByRole('status').some((node) => /too large to link/.test(node.textContent ?? '')),
  ).toBe(true);
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});
it('shows author account types by label, preserved login casing and supplied profile URLs', () => {
  const authors = selectRepositoryTimelineSupport(source, report, context('prAuthors'));
  if (authors.kind !== 'authors') throw Error('Expected authors');
  expect(authors.rows.every((row) => row.profileUrl.startsWith('https://github.example/'))).toBe(
    true,
  );
  render(<Preview detail={authors} />);
  const table = screen.getByRole('table');
  expect(within(table).getAllByText('Human').length).toBeGreaterThan(0);
  expect(within(table).queryByText('human')).not.toBeInTheDocument();
  const first = authors.rows[0];
  expect(
    within(table).getAllByRole('link', { name: new RegExp('@' + first.account) })[0],
  ).toHaveAttribute('href', first.profileUrl);
});
