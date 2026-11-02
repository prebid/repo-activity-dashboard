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
import { castTimelineSample as repositoryTimelineSample } from '../support/cast-timeline';
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
  expect(screen.getByRole('link', { name: 'Median, Oct 2026: 31.0 d' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Export CSV' })).toBeVisible();
});
it('renders unique authors and source-specific PRs with GitHub destinations and the shared CSV dialog', async () => {
  const user = userEvent.setup();
  const authors = selectRepositoryTimelineSupport(source, report, context('prAuthors'));
  const view = render(<Preview detail={authors} />);
  // The supporting view's scope states its interval in the one range notation.
  expect(screen.getByRole('region', { name: 'Supporting interval scope' })).toHaveTextContent(
    'Oct 1, 2026 – Oct 24, 2026 · UTC',
  );
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
it('states an empty contribution interval as missing only when its value is incomplete', () => {
  const s = contributionTimelineSample(),
    r = selectContributionTimeline(s, request),
    metric = 'reviewerContributions';
  const detail = selectContributionTimelineSupport(s, r, {
    ...context('prsOpened'),
    source: r.source,
    metric,
    measurement: r.rows[9].values[metric],
  });
  if (detail.kind !== 'contribution') throw Error('Expected contributions');
  const state = () =>
    screen
      .getByRole('heading', { name: 'No supporting contributions in this interval' })
      .closest('[data-kind]');
  // Designed fixtures: the same interval with no rows, once incomplete and once complete.
  const empty = (measurement: typeof detail.details.measurement) => ({
    ...detail,
    details: { ...detail.details, rows: [], measurement },
  });
  const view = render(
    <Preview
      detail={empty({
        status: 'missing',
        value: null,
        reason: 'Contribution samples are unavailable.',
      })}
    />,
  );
  expect(state()).toHaveAttribute('data-kind', 'missing');
  view.rerender(<Preview detail={empty({ status: 'complete', value: 0 })} />);
  expect(state()).toHaveAttribute('data-kind', 'empty');
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
  // PRs 105 and 108 are both Bob's; spelling one login differently must not split the account.
  const mixed = structuredClone(source);
  mixed.rows.find((row) => row.number === 105)!.author = 'Sample-Bob';
  const authors = selectRepositoryTimelineSupport(
    mixed,
    selectRepositoryTimeline(mixed, request),
    context('prAuthors'),
  );
  if (authors.kind !== 'authors') throw Error('Expected authors');
  expect(authors.rows.every((row) => row.profileUrl.startsWith('https://github.example/'))).toBe(
    true,
  );
  expect(authors.rows.filter((row) => row.id === 'sample-bob')).toEqual([
    expect.objectContaining({ account: 'Sample-Bob', recordCount: 2 }),
  ]);
  render(<Preview detail={authors} />);
  const table = screen.getByRole('table');
  expect(within(table).getAllByText('Human').length).toBeGreaterThan(0);
  expect(within(table).queryByText('human')).not.toBeInTheDocument();
  // Each account's avatar is titled with the type its Account type cell shows, and the account
  // cell names that type for assistive technology, which the avatar is hidden from.
  for (const row of table.querySelectorAll('tbody tr')) {
    const type = row.querySelector('[data-column="accountType"]')!.textContent;
    const account = row.querySelector<HTMLElement>('[data-column="account"]')!;
    expect(account.querySelector('[data-kind="person"]')!.getAttribute('title')).toBe(type);
    expect(account).toHaveAccessibleName(
      new RegExp(`GitHub profile for [\\w-]+ \\(sample placeholder\\) ?${type}$`, 'i'),
    );
  }
  expect(within(table).getByRole('link', { name: /@Sample-Bob/ })).toHaveAttribute(
    'href',
    authors.rows.find((row) => row.id === 'sample-bob')!.profileUrl,
  );
  expect(within(table).queryByText(/@sample-bob/)).not.toBeInTheDocument();
  for (const login of ['sample-bob', 'SAMPLE-BOB']) {
    const records = selectRepositoryTimelineSupport(
      mixed,
      selectRepositoryTimeline(mixed, request),
      context('prAuthors'),
      login,
    );
    if (records.kind !== 'repository') throw Error('Expected author records');
    expect(records.author).toBe('Sample-Bob');
    expect(records.rows.map((row) => row.number)).toEqual([105, 108]);
  }
});
it('explains in its footer only the value marks its visible metrics show', () => {
  const table = renderHook(() => useLocalTableController()).result.current;
  const marks = () =>
    [...document.querySelectorAll<HTMLElement>('[data-mark]')].map((entry) => entry.dataset.mark);
  const metrics = [
    { id: 'prsOpened', label: 'Opened', defaultVisible: true, unit: 'count' as const },
    { id: 'medianMergeDays', label: 'Median', defaultVisible: true, unit: 'days' as const },
  ];
  // Designed rows: complete counts and one partial median.
  const rows = report.rows.slice(0, 2).map((row, index) => ({
    ...row,
    values: {
      prsOpened: { status: 'complete' as const, value: index },
      medianMergeDays:
        index === 0
          ? { status: 'partial' as const, value: 2, reason: 'Some history is unavailable.' }
          : { status: 'complete' as const, value: 3 },
    },
  }));
  const shown = { controller: table, visibility: { value: {}, onChange: () => {} } };
  const view = render(
    <TimelineTable rows={rows} grouping="month" metrics={metrics} controls={shown} />,
  );
  expect(marks()).toEqual(['partial']);
  expect(screen.getByText('2 intervals').nextElementSibling).toHaveTextContent(/^\* Partial data$/);
  // Hiding the median hides its asterisk, so the legend goes with it.
  view.rerender(
    <TimelineTable
      rows={rows}
      grouping="month"
      metrics={metrics}
      controls={{ ...shown, visibility: { value: { medianMergeDays: false }, onChange: () => {} } }}
    />,
  );
  expect(marks()).toEqual([]);
  expect(screen.getByText('2 intervals').nextElementSibling).toBeNull();
  const missing = {
    ...rows[0],
    values: {
      ...rows[0].values,
      prsOpened: { status: 'missing' as const, value: null, reason: 'Not prepared.' },
    },
  };
  view.rerender(
    <TimelineTable rows={[missing, rows[1]]} grouping="month" metrics={metrics} controls={shown} />,
  );
  expect(marks()).toEqual(['missing', 'partial']);
});
