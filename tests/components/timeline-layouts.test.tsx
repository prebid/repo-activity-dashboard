import { expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
type ChartPoint = { value: number | null };
const chart = vi.hoisted(() => ({
  data: vi.fn<(data: ChartPoint[]) => void>(),
  line: vi.fn<(props: { connectNulls: boolean }) => void>(),
}));
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  LineChart: ({ children, data }: { children: ReactNode; data: ChartPoint[] }) => {
    chart.data(data);
    return <div>{children}</div>;
  },
  Line: (props: { connectNulls: boolean }) => {
    chart.line(props);
    return null;
  },
  CartesianGrid: () => null,
  YAxis: () => null,
  XAxis: ({ tickFormatter }: { tickFormatter: (input: unknown) => string }) => (
    <span>
      {tickFormatter(0)}
      {tickFormatter('bad')}
    </span>
  ),
  Tooltip: ({
    content,
  }: {
    content: (input: { active: boolean; label?: unknown }) => ReactNode;
  }) => (
    <>
      {content({ active: false })}
      {content({ active: true, label: 9 })}
      {content({ active: true, label: '9999' })}
    </>
  ),
}));
import { ContributionTimelineView } from '@/features/contributions/contribution-timeline-view';
import { RepositoryTimelineView } from '@/features/repositories/repository-timeline-view';
import { contributionTimelineSample } from '@/mocks/contribution-timeline';
import { castTimelineSample as repositoryTimelineSample } from '../support/cast-timeline';
import { repositoryPageNavigationSample } from '@/mocks/repository-page';
import { selectContributionTimeline } from '@/lib/presentation/contribution-timeline';
import { selectRepositoryTimeline } from '@/lib/presentation/repository-timeline';
import type { ContributionFocus, ContributionSelection } from '@/models/contributions';
import type { ContributionSampleScenario } from '@/models/contribution-page';
import type { TimelineRequest } from '@/models/reporting-timeline';
const request: TimelineRequest = {
  grouping: 'month',
  range: { start: '2026-01-01T00:00:00.000Z', end: '2026-10-24T12:00:00.000Z', endInclusive: true },
};
function contribution(
  sample: ContributionSampleScenario = 'reference',
  focus?: ContributionFocus,
  selection?: ContributionSelection,
) {
  const report = selectContributionTimeline(
    contributionTimelineSample(sample),
    request,
    selection,
    focus,
  );
  return (
    <ContributionTimelineView
      report={report}
      area={focus?.kind === 'company' ? 'companies' : 'contributors'}
      href="/contributors?timeline=1"
      reportHref="/contributors?scope=1&period=this-year"
    />
  );
}
function repository(
  sample: ContributionSampleScenario = 'reference',
  family: 'activity' | 'snapshot' = 'activity',
  query = request,
) {
  const source = repositoryTimelineSample('prs', 'repo-prebidjs', sample);
  return (
    <RepositoryTimelineView
      report={selectRepositoryTimeline(source, query, family)}
      navigation={repositoryPageNavigationSample(source.repository)}
      href="/repos/prebidjs?timeline=1"
    />
  );
}
it('renders chronological contribution periods, separate metrics and no unfinished export/filter controls', async () => {
  const user = userEvent.setup();
  render(contribution());
  expect(screen.getByRole('heading', { name: 'Contributors', level: 1 })).toBeVisible();
  expect(screen.getByRole('link', { name: 'Over time' })).toHaveAttribute('aria-current', 'page');
  const table = screen.getByRole('table');
  expect(table.querySelectorAll('thead tr')).toHaveLength(1);
  expect(table.querySelectorAll('tbody tr')).toHaveLength(10);
  const first = table.querySelector<HTMLElement>('tbody tr [data-column="period"]')!;
  expect(first).toHaveTextContent('Jan 2026');
  expect(within(first).queryByText('Partial')).not.toBeInTheDocument();
  // A partial period adds the caption "Partial" on its own line, under its covered dates.
  const last = table.querySelector<HTMLElement>('tbody tr:last-child [data-column="period"]')!;
  expect([...last.firstElementChild!.children].map((line) => line.textContent)).toEqual([
    'Oct 2026',
    'Oct 1–24, 2026',
    'Partial',
  ]);
  expect(table.querySelector('tbody tr:last-child [data-column="prsAuthored"]')).toHaveTextContent(
    '6',
  );
  expect(table.querySelector('sup')).toBeNull();
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Export CSV' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Show chart' })).not.toBeInTheDocument();
  await user.click(within(table).getByRole('button', { name: 'PRs authored' }));
  expect(within(table).getByRole('columnheader', { name: 'PRs authored' })).toHaveAttribute(
    'aria-sort',
    'ascending',
  );
  await user.click(within(table).getByRole('button', { name: 'PRs authored' }));
  expect(table.querySelector('tbody tr [data-column="period"]')).toHaveTextContent('Oct 2026');
  await user.click(screen.getByRole('button', { name: 'Columns' }));
  await user.click(screen.getByRole('menuitemcheckbox', { name: 'Comment activity' }));
  await user.keyboard('{Escape}');
  expect(within(table).getByRole('columnheader', { name: /PR comments/ })).toBeVisible();
});
it('keeps focused identity/profile destinations and company wording', () => {
  const view = render(
    contribution('reference', { kind: 'contributor', accountId: 'account-alice' }),
  );
  expect(screen.getByRole('heading', { name: 'Alice', level: 1 })).toBeVisible();
  expect(screen.getByRole('link', { name: /@sample-alice/ })).toHaveAttribute(
    'href',
    'https://github.example/sample-alice',
  );
  view.rerender(contribution('reference', { kind: 'company', companyId: 'company-acme' }));
  expect(screen.getByRole('heading', { name: 'Example Acme', level: 1 })).toBeVisible();
  view.rerender(contribution('reference', { kind: 'company', companyId: null }));
  expect(screen.getByRole('heading', { name: 'Unmapped company', level: 1 })).toBeVisible();
});
it('says an all-zero range is recorded, and says nothing when a value is missing or nonzero', () => {
  const zero = 'Every value in this range is a recorded zero; no data is missing.';
  const view = render(contribution('empty'));
  expect(screen.getByText(zero)).toBeVisible();
  view.rerender(contribution('missing'));
  expect(screen.queryByText(zero)).not.toBeInTheDocument();
  view.rerender(contribution('reference'));
  expect(screen.queryByText(zero)).not.toBeInTheDocument();
});
it('distinguishes a known-zero timeline, missing measurements and empty report selections', () => {
  const view = render(contribution('empty'));
  expect(screen.getByRole('table').querySelectorAll('tbody tr')).toHaveLength(10);
  expect(screen.queryByLabelText('Timeline data coverage')).not.toBeInTheDocument();
  view.rerender(contribution('missing'));
  expect(screen.getByLabelText('Timeline data coverage')).toBeVisible();
  expect(screen.getByRole('table').querySelector('[data-column="prsAuthored"]')).toHaveTextContent(
    '—',
  );
  for (const [selection, title] of [
    [
      {
        repositoryIds: [],
        actorTypes: ['human'],
        population: { kind: 'all' },
        excludedAccountIds: [],
      },
      'No repositories selected',
    ],
    [
      {
        repositoryIds: ['repo-prebidjs'],
        actorTypes: [],
        population: { kind: 'all' },
        excludedAccountIds: [],
      },
      'No account types selected',
    ],
    [
      {
        repositoryIds: ['repo-prebidjs'],
        actorTypes: ['human'],
        population: { kind: 'selected', accountIds: [], companyIds: [] },
        excludedAccountIds: [],
      },
      'No accounts match this report',
    ],
  ] satisfies [ContributionSelection, string][]) {
    view.rerender(contribution('reference', undefined, selection));
    expect(screen.getByRole('heading', { name: title })).toBeVisible();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  }
});
it('names a partial account type selection in the scope summary, in the fixed type order', () => {
  const repositoryIds = contributionTimelineSample('reference').contributions.repositories.map(
    (row) => row.id,
  );
  const selection = (actorTypes: ContributionSelection['actorTypes']): ContributionSelection => ({
    repositoryIds,
    actorTypes,
    population: { kind: 'all' },
    excludedAccountIds: [],
  });
  const view = render(contribution('reference', undefined, selection(['bot', 'human'])));
  const scope = () => screen.getByRole('region', { name: 'Timeline scope' });
  // The Account type control reads "2 types", so the summary names them.
  expect(within(scope()).getByText('Account types: Human, Bot')).toBeVisible();
  view.rerender(contribution('reference', undefined, selection(['agent'])));
  expect(within(scope()).getByText('Account type: Prebid agent')).toBeVisible();
  view.rerender(contribution('reference', undefined, selection([])));
  expect(within(scope()).getByText('No account types')).toBeVisible();
  // With every type included the control reads "All" and the summary leaves the fact out.
  view.rerender(contribution('reference'));
  expect(scope()).not.toHaveTextContent(/account types?:/i);
});
it('starts the repository chart collapsed, retains all chronological values and separates duration units', async () => {
  const user = userEvent.setup();
  render(repository());
  expect(screen.queryByRole('figure')).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Timeline' })).toHaveAttribute('aria-current', 'page');
  await user.click(screen.getByRole('button', { name: 'Show chart' }));
  expect(chart.data.mock.lastCall?.[0].map((p) => p.value)).toEqual([0, 0, 0, 0, 0, 0, 0, 1, 1, 3]);
  expect(chart.line).toHaveBeenCalled();
  expect(chart.line.mock.calls.every(([props]) => props.connectNulls === false)).toBe(true);
  await user.selectOptions(screen.getByLabelText('Chart metric'), 'medianMergeDays');
  expect(screen.getByText('Whole-range median')).toBeVisible();
  expect(chart.data.mock.lastCall?.[0].map((p) => p.value)).toEqual([
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    5,
    31,
  ]);
  await user.click(screen.getByRole('button', { name: 'Hide chart' }));
  expect(screen.queryByRole('figure')).not.toBeInTheDocument();
});
it('prints a full week’s range once and adds covered dates only to a partial week', () => {
  render(repository('reference', 'activity', { ...request, grouping: 'week' }));
  const periods = [
    ...screen.getByRole('table').querySelectorAll<HTMLElement>('tbody [data-column="period"]'),
  ].map((cell) => [...cell.firstElementChild!.children].map((line) => line.textContent));
  expect(periods[0]).toEqual(['Dec 29, 2025 – Jan 4, 2026', 'Jan 1–4, 2026', 'Partial']);
  expect(periods[1]).toEqual(['Jan 5–11, 2026']);
  expect(periods).toContainEqual(['Jan 26 – Feb 1, 2026']);
  expect(periods.at(-1)).toEqual(['Oct 19–25, 2026', 'Oct 19–24, 2026', 'Partial']);
});
it('keeps the full 500-interval chart independent of the 50-row table page', async () => {
  const user = userEvent.setup();
  render(
    repository('reference', 'activity', {
      grouping: 'day',
      range: { start: '2025-06-12T00:00:00.000Z', end: request.range.end, endInclusive: true },
    }),
  );
  expect(screen.getByRole('table').querySelectorAll('tbody tr')).toHaveLength(50);
  expect(screen.getByText('Page 1 of 10')).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Show chart' }));
  const data: unknown[] = chart.data.mock.lastCall![0];
  expect(data).toHaveLength(500);
  await user.click(screen.getByRole('button', { name: 'Next' }));
  expect(screen.getByText('Page 2 of 10')).toBeVisible();
  expect(chart.data.mock.lastCall![0]).toEqual(data);
});
it('renders unavailable charts and cutoff-specific snapshot column help honestly', async () => {
  const user = userEvent.setup();
  const view = render(repository('missing'));
  await user.click(screen.getByRole('button', { name: 'Show chart' }));
  expect(screen.getByRole('heading', { name: 'No chart values available' })).toBeVisible();
  view.rerender(
    repository('partial', 'snapshot', {
      grouping: 'day',
      range: {
        start: '2026-10-11T00:00:00.000Z',
        end: '2026-10-22T00:00:00.000Z',
        endInclusive: false,
      },
    }),
  );
  await user.click(screen.getByRole('button', { name: 'Show chart' }));
  expect(screen.getByText('At range end')).toBeVisible();
  await user.selectOptions(screen.getByLabelText('Chart metric'), 'agedPrs30');
  expect(screen.getByRole('table').querySelector('sup')).not.toBeNull();
  await user.click(
    screen.getByRole('button', { name: 'Column definitions for Backlog over time' }),
  );
  expect(screen.getByRole('dialog')).toHaveTextContent('supplied historical values');
});
