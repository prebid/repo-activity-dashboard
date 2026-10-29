import { useState } from 'react';
import { expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AllRepositoriesView } from '@/features/repositories/all-repositories-view';
import { useLocalTableController, LocalDataTable } from '@/components/tables/local-data-table';
import { MeasurementValue, MeasurementDifference } from '@/components/metrics/measurement-value';
import { repositoryOverviewSamples } from '@/mocks/repository-overview';
import type { OverviewSettings } from '@/models/overview-settings';
import { defaultOverviewSettings } from '@/lib/presentation/overview-settings';
import { selectOverviewSample } from '@/lib/presentation/overview-samples';
import { withOverviewSort } from '@/lib/presentation/overview-sort';
import { overviewSettingsColumns } from '@/features/repositories/overview-columns';
import type { AgingThreshold } from '@/models/repository-overview';
import type { DataColumn } from '@/components/tables/data-table';

const samples = repositoryOverviewSamples();
const repositories = samples.repositories.map((row) => row.repository);
const definition = {
  ...overviewSettingsColumns,
  repositoryIds: repositories.map((repo) => repo.id),
};
const defaultsForPreview = defaultOverviewSettings(definition);
it('renders signed differences only from complete values, including durations and known zero', () => {
  const view = render(
    <MeasurementDifference
      first={{ status: 'complete', value: 10 }}
      second={{ status: 'complete', value: 4 }}
    />,
  );
  expect(screen.getByText('+6')).toBeVisible();
  view.rerender(
    <MeasurementDifference
      first={{ status: 'complete', value: 4 }}
      second={{ status: 'complete', value: 10 }}
    />,
  );
  expect(screen.getByText('-6')).toBeVisible();
  view.rerender(
    <MeasurementDifference
      first={{ status: 'complete', value: 0 }}
      second={{ status: 'complete', value: 0 }}
    />,
  );
  expect(screen.getByText('0')).toBeVisible();
  view.rerender(
    <MeasurementDifference
      first={{ status: 'complete', value: 3.5 }}
      second={{ status: 'complete', value: 4 }}
      unit="days"
    />,
  );
  expect(screen.getByText('-0.5 d')).toBeVisible();
  view.rerender(
    <MeasurementDifference
      first={{ status: 'partial', value: 3, reason: 'Incomplete' }}
      second={{ status: 'complete', value: 4 }}
    />,
  );
  expect(
    screen.getByTitle('A difference requires complete values in both periods.'),
  ).toHaveTextContent('—');
});
function Preview({
  twoPeriods = false,
  ageDays = 30,
}: {
  twoPeriods?: boolean;
  ageDays?: AgingThreshold;
}) {
  const backlog = useLocalTableController();
  const activity = useLocalTableController();
  const [settings, setSettings] = useState<OverviewSettings>(() => ({
    ...defaultOverviewSettings(definition),
    periods: twoPeriods
      ? [defaultsForPreview.periods[0], { kind: 'preset', preset: 'last-month' }]
      : defaultsForPreview.periods,
    ageThresholds: [ageDays],
  }));
  return (
    <AllRepositoriesView
      data={selectOverviewSample(samples, settings.periods[0], settings.repositoryIds)}
      secondaryData={
        settings.periods.length === 2
          ? selectOverviewSample(samples, settings.periods[1], settings.repositoryIds)
          : undefined
      }
      backlogController={withOverviewSort(backlog, 'backlog', settings)}
      activityController={withOverviewSort(activity, 'activity', settings)}
      repositories={repositories}
      settings={{
        value: settings,
        update: (patch) => setSettings((previous) => ({ ...previous, ...patch })),
        reset: () => setSettings(defaultOverviewSettings(definition)),
        storageAvailable: true,
      }}
    />
  );
}
it('groups two labeled periods and an automatic difference under one repository name', async () => {
  const user = userEvent.setup();
  render(<Preview />);
  expect(screen.queryByRole('checkbox', { name: 'Show change' })).not.toBeInTheDocument();
  expect(screen.queryByRole('option', { name: 'Custom range' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Add second period' }));
  expect(screen.getByRole('combobox', { name: 'Period 2 preset' })).toHaveValue('');
  await user.click(screen.getByRole('button', { name: 'Cancel adding period' }));
  await user.click(screen.getByRole('button', { name: 'Add second period' }));
  await user.selectOptions(screen.getByRole('combobox', { name: 'Period 2 preset' }), 'last-month');
  const activity = screen.getByRole('table', { name: 'Period activity' });
  expect(activity.querySelectorAll('tbody tr')).toHaveLength(48);
  const pairs = [...activity.querySelectorAll('tbody tr')].filter((row) =>
    row.textContent?.includes('Prebid.js'),
  );
  expect(within(activity).getAllByRole('link', { name: 'Prebid.js' })).toHaveLength(1);
  expect(pairs[0]).toHaveTextContent('This month');
  expect(pairs[1]).toHaveTextContent('Last month');
  expect(pairs[0].querySelector('[data-column="prsOpened"]')).toHaveTextContent('47');
  expect(pairs[1].querySelector('[data-column="prsOpened"]')).toHaveTextContent('61');
  expect(pairs[2]).toHaveTextContent('Difference');
  expect(pairs[2].querySelector('[data-column="prsOpened"]')).toHaveTextContent('-14');
  expect(screen.queryByRole('button', { name: 'Add second period' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Swap periods' }));
  expect(pairs[0]).toHaveTextContent('Last month');
  expect(pairs[0].querySelector('[data-column="prsOpened"]')).toHaveTextContent('61');
  expect(pairs[2].querySelector('[data-column="prsOpened"]')).toHaveTextContent('+14');
  await user.click(screen.getByRole('button', { name: 'Remove period 1' }));
  expect(activity.querySelectorAll('tbody tr')).toHaveLength(18);
  expect(screen.getByRole('combobox', { name: 'Period 1 preset' })).toHaveValue('this-month');
});
it('accepts two custom ranges, rejects duplicate dates, and keeps missing values specific to their period', async () => {
  const user = userEvent.setup();
  render(<Preview />);
  async function enter(from: string, through: string) {
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: from } });
    fireEvent.change(screen.getByLabelText('End date'), { target: { value: through } });
    await user.click(screen.getByRole('button', { name: 'Apply dates' }));
  }
  await user.click(screen.getByRole('button', { name: 'Custom range for Period 1' }));
  await enter('2026-10-06', '2026-10-08');
  await user.click(screen.getByRole('button', { name: 'Add second period' }));
  await user.click(screen.getByRole('button', { name: 'Custom range for Period 2' }));
  await enter('2026-10-06', '2026-10-08');
  expect(screen.getByRole('dialog').querySelector('[role="alert"]')).toHaveTextContent(
    'Choose two different periods',
  );
  await enter('2026-10-13', '2026-10-15');
  const activity = screen.getByRole('table', { name: 'Period activity' });
  const pair = [...activity.querySelectorAll('tbody tr')].filter((row) =>
    row.textContent?.includes('Prebid.js'),
  );
  expect(pair[0]).toHaveTextContent('Oct 6, 2026 – Oct 8, 2026');
  expect(pair[1]).toHaveTextContent('Oct 13, 2026 – Oct 15, 2026');
  expect(pair[0].querySelector('[data-column="prsOpened"]')).toHaveTextContent('7');
  expect(pair[1].querySelector('[data-column="prsOpened"]')).toHaveTextContent('5');
  expect(pair[2].querySelector('[data-column="prsOpened"]')).toHaveTextContent('+2');
  await user.click(screen.getByRole('button', { name: 'Edit custom range for Period 2' }));
  await enter('2026-10-01', '2026-10-02');
  expect(
    screen.getByText('No prepared sample data for Period 2. Its values are shown as dashes.'),
  ).toBeVisible();
  expect(pair[0].querySelector('[data-column="prsOpened"]')).toHaveTextContent('7');
  expect(pair[1].querySelector('[data-column="prsOpened"]')).toHaveTextContent('—');
  expect(pair[2].querySelector('[data-column="prsOpened"]')).toHaveTextContent('—');
});
it('keeps aging exclusively in its own selector and removes the group when none are selected', async () => {
  const user = userEvent.setup();
  render(<Preview />);
  const backlog = screen.getByRole('region', { name: 'Current backlog' });
  expect(within(backlog).queryByRole('combobox')).not.toBeInTheDocument();
  await user.click(within(backlog).getByRole('button', { name: 'PR age' }));
  await user.click(screen.getByRole('menuitemcheckbox', { name: 'Over 90 days' }));
  await user.keyboard('{Escape}');
  expect(within(backlog).getByRole('columnheader', { name: 'PR age' })).toHaveAttribute(
    'colspan',
    '2',
  );
  const row = within(backlog).getByRole('link', { name: 'Prebid.js' }).closest('tr')!;
  expect(row.querySelector('[data-column="agedPrs30"]')).toHaveTextContent('90');
  expect(row.querySelector('[data-column="agedPrs90"]')).toHaveTextContent('30');
  await user.click(within(backlog).getByRole('button', { name: 'Columns' }));
  expect(screen.queryByRole('menuitemcheckbox', { name: 'PR age' })).not.toBeInTheDocument();
  expect(screen.queryByRole('menuitemcheckbox', { name: /Over \d+ days/ })).not.toBeInTheDocument();
  await user.click(screen.getByRole('menuitemcheckbox', { name: 'Drafts' }));
  await user.keyboard('{Escape}');
  await user.click(within(backlog).getByRole('button', { name: 'PR age' }));
  expect(screen.getByRole('menuitemcheckbox', { name: 'Over 30 days' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  expect(screen.getByRole('menuitemcheckbox', { name: 'Over 90 days' })).not.toHaveAttribute(
    'aria-disabled',
    'true',
  );
  await user.click(screen.getByRole('menuitemcheckbox', { name: 'Over 30 days' }));
  await user.click(screen.getByRole('menuitemcheckbox', { name: 'Over 90 days' }));
  await user.keyboard('{Escape}');
  expect(within(backlog).queryByRole('columnheader', { name: 'PR age' })).not.toBeInTheDocument();
  expect(row.querySelector('[data-column^="agedPrs"]')).toBeNull();
  await user.click(within(backlog).getByRole('button', { name: 'PR age' }));
  await user.click(screen.getByRole('menuitemcheckbox', { name: 'PR age' }));
  await user.keyboard('{Escape}');
  expect(within(backlog).getByRole('columnheader', { name: 'PR age' })).toHaveAttribute(
    'colspan',
    '6',
  );
  await user.click(within(backlog).getByRole('button', { name: 'Over 90 days' }));
  expect(within(backlog).getByRole('columnheader', { name: 'Over 90 days ↑' })).toHaveAttribute(
    'aria-sort',
    'ascending',
  );
});
it('searches repository options without changing selection and applies or cancels the draft explicitly', async () => {
  const user = userEvent.setup();
  render(<Preview />);
  await user.click(screen.getByRole('button', { name: /^Choose repositories/ }));
  const dialog = screen.getByRole('dialog', { name: 'Choose repositories' });
  await user.type(within(dialog).getByRole('textbox', { name: 'Search repositories' }), 'server');
  expect(within(dialog).getAllByRole('checkbox')).toHaveLength(2);
  expect(within(dialog).getByText('18 selected')).toBeVisible();
  await user.click(within(dialog).getByRole('button', { name: 'Clear selection' }));
  await user.click(within(dialog).getByRole('checkbox', { name: 'Prebid Server (Go)' }));
  await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
  expect(
    screen.getByRole('table', { name: 'Current backlog' }).querySelectorAll('tbody tr'),
  ).toHaveLength(18);
  await user.click(screen.getByRole('button', { name: /^Choose repositories/ }));
  expect(screen.getByRole('textbox', { name: 'Search repositories' })).toHaveValue('');
  await user.type(screen.getByRole('textbox', { name: 'Search repositories' }), 'does-not-exist');
  expect(screen.getByText(/No repositories match/)).toBeVisible();
  await user.clear(screen.getByRole('textbox', { name: 'Search repositories' }));
  await user.click(screen.getByRole('button', { name: 'Clear selection' }));
  await user.click(screen.getByRole('checkbox', { name: 'SalesAgent' }));
  await user.click(screen.getByRole('button', { name: 'Apply selection' }));
  for (const title of ['Current backlog', 'Period activity'])
    expect(screen.getByRole('table', { name: title }).querySelectorAll('tbody tr')).toHaveLength(1);
  await user.click(screen.getByRole('button', { name: /^Choose repositories/ }));
  await user.click(screen.getByRole('button', { name: 'Select all 18' }));
  expect(screen.getByText('18 selected')).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Clear selection' }));
  await user.click(screen.getByRole('button', { name: 'Apply selection' }));
  expect(screen.getByRole('heading', { name: 'No repositories selected' })).toBeVisible();
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Reset view' }));
  expect(screen.getAllByRole('table')).toHaveLength(2);
});
it('changes the primary period and aging independently', async () => {
  const user = userEvent.setup();
  render(<Preview />);
  const backlog = screen.getByRole('region', { name: 'Current backlog' });
  const activity = screen.getByRole('region', { name: 'Period activity' });
  const backlogRow = within(backlog).getByRole('link', { name: 'Prebid.js' }).closest('tr')!;
  const activityRow = within(activity).getByRole('link', { name: 'Prebid.js' }).closest('tr')!;
  await user.click(screen.getByRole('button', { name: 'PR age' }));
  await user.click(screen.getByRole('menuitemcheckbox', { name: 'Over 60 days' }));
  await user.click(screen.getByRole('menuitemcheckbox', { name: 'Over 30 days' }));
  await user.keyboard('{Escape}');
  expect(backlogRow.querySelector('[data-column="agedPrs60"]')).toHaveTextContent('60');
  await user.selectOptions(screen.getByRole('combobox', { name: 'Period 1 preset' }), 'this-week');
  expect(activityRow.querySelector('[data-column="prsOpened"]')).toHaveTextContent('12');
  expect(backlogRow.querySelector('[data-column="totalOpenPrs"]')).toHaveTextContent('137');
  expect(backlogRow.querySelector('[data-column="agedPrs60"]')).toHaveTextContent('60');
  expect(screen.queryByRole('checkbox', { name: 'Show change' })).not.toBeInTheDocument();
});
it('validates custom dates and distinguishes unavailable samples from an empty result', async () => {
  const user = userEvent.setup();
  render(<Preview />);
  await user.click(screen.getByRole('button', { name: 'Custom range for Period 1' }));
  const dialog = screen.getByRole('dialog', { name: 'Custom date range' });
  fireEvent.change(within(dialog).getByLabelText('Start date'), {
    target: { value: '2026-10-09' },
  });
  fireEvent.change(within(dialog).getByLabelText('End date'), { target: { value: '2026-10-06' } });
  await user.click(within(dialog).getByRole('button', { name: 'Apply dates' }));
  expect(within(dialog).getByRole('alert')).toHaveTextContent('start on or before the end');
  fireEvent.change(within(dialog).getByLabelText('Start date'), {
    target: { value: '2026-10-06' },
  });
  fireEvent.change(within(dialog).getByLabelText('End date'), { target: { value: '2026-10-08' } });
  await user.click(within(dialog).getByRole('button', { name: 'Apply dates' }));
  expect(screen.getByRole('combobox', { name: 'Period 1 preset' })).toHaveValue('');
  const activity = screen.getByRole('region', { name: 'Period activity' });
  const row = within(activity).getByRole('link', { name: 'Prebid.js' }).closest('tr')!;
  expect(row.querySelector('[data-column="prsOpened"]')).toHaveTextContent('7');
  await user.click(screen.getByRole('button', { name: 'Edit custom range for Period 1' }));
  expect(screen.getByLabelText('Start date')).toHaveValue('2026-10-06');
  fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-10-01' } });
  fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-10-02' } });
  await user.click(screen.getByRole('button', { name: 'Apply dates' }));
  expect(within(activity).getByText(/No prepared sample data/)).toBeVisible();
  expect(row.querySelector('[data-column="prsOpened"]')).toHaveTextContent('—');
});
it('shows a horizontal-scroll hint only while the table overflows its container', async () => {
  const callbacks: (() => void)[] = [];
  const observe = vi.fn();
  const disconnect = vi.fn();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        callbacks.push(callback);
      }
      observe = observe;
      disconnect = disconnect;
    },
  );
  const width = vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(1200);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(500);
  const view = render(<Preview />);
  expect(screen.getAllByText(/Scroll horizontally/)).toHaveLength(2);
  expect(observe).toHaveBeenCalledTimes(2);
  expect(
    screen.getByRole('region', { name: 'Current backlog table scroll area' }),
  ).toHaveAccessibleDescription('Scroll horizontally to see all columns');
  width.mockReturnValue(400);
  act(() => callbacks.forEach((callback) => callback()));
  await waitFor(() => expect(screen.queryAllByText(/Scroll horizontally/)).toHaveLength(0));
  view.unmount();
  expect(disconnect).toHaveBeenCalledTimes(2);
});
it('renders separate grouped tables with complete sample populations and pinned identities', () => {
  render(<Preview />);
  const backlog = screen.getByRole('table', { name: 'Current backlog' });
  const activity = screen.getByRole('table', { name: 'Period activity' });
  expect(backlog.querySelectorAll('tbody tr')).toHaveLength(18);
  expect(activity.querySelectorAll('tbody tr')).toHaveLength(18);
  expect(within(backlog).getByRole('columnheader', { name: 'Repository' })).toHaveAttribute(
    'rowspan',
    '2',
  );
  expect(within(backlog).getByRole('columnheader', { name: 'Pull requests' })).toHaveAttribute(
    'colspan',
    '3',
  );
  expect(within(backlog).getByRole('columnheader', { name: 'Human approvals' })).toHaveAttribute(
    'colspan',
    '3',
  );
  expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
  expect(within(backlog).getByRole('button', { name: 'Over 30 days' })).toHaveAccessibleDescription(
    'Non-draft PRs created more than 30 days ago.',
  );
  const row = within(backlog).getByRole('link', { name: 'Prebid.js' }).closest('tr')!;
  expect(within(row).getByText('137')).toBeVisible();
  expect(within(row).getByText('90')).toBeVisible();
  const total = row.querySelector('[data-column="totalOpenPrs"]')!;
  const headings = total
    .getAttribute('headers')!
    .split(' ')
    .map((id) => document.getElementById(id)?.textContent);
  expect(headings).toEqual(['Pull requests', 'Total PRs ↓']);
});
it('keeps column visibility and sorting independent without table search', async () => {
  const user = userEvent.setup();
  render(<Preview />);
  const backlog = screen.getByRole('region', { name: 'Current backlog' });
  const activity = screen.getByRole('region', { name: 'Period activity' });
  await user.click(within(backlog).getByRole('button', { name: 'Columns' }));
  expect(screen.getByRole('menuitemcheckbox', { name: 'Repository (required)' })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  expect(screen.getByRole('menuitemcheckbox', { name: 'Human approvals' })).toHaveAttribute(
    'aria-checked',
    'mixed',
  );
  await user.click(screen.getByRole('menuitemcheckbox', { name: 'Human reviewers' }));
  await user.click(screen.getByRole('menuitemcheckbox', { name: 'Human approvals' }));
  await user.keyboard('{Escape}');
  expect(within(backlog).getByRole('columnheader', { name: 'Human reviewers' })).toHaveAttribute(
    'colspan',
    '4',
  );
  expect(within(backlog).getByRole('columnheader', { name: 'Human approvals' })).toHaveAttribute(
    'colspan',
    '4',
  );
  expect(
    within(activity).queryByRole('columnheader', { name: 'Human reviewers' }),
  ).not.toBeInTheDocument();
  await user.click(within(backlog).getByRole('button', { name: 'Total PRs ↓' }));
  await user.click(within(backlog).getByRole('button', { name: 'Total PRs ↑' }));
  expect(within(backlog).getByRole('columnheader', { name: 'Total PRs ↓' })).toHaveAttribute(
    'aria-sort',
    'descending',
  );
  expect(within(backlog).queryByRole('textbox')).not.toBeInTheDocument();
  expect(within(activity).queryByRole('textbox')).not.toBeInTheDocument();
  expect(within(backlog).getByRole('table').querySelectorAll('tbody tr')).toHaveLength(18);
  expect(within(activity).getByRole('table').querySelectorAll('tbody tr')).toHaveLength(18);
});
it('updates group spans and reveals automation partials through the controlled columns menu', async () => {
  const user = userEvent.setup();
  render(<Preview twoPeriods ageDays={60} />);
  const backlog = screen.getByRole('region', { name: 'Current backlog' });
  await user.click(within(backlog).getByRole('button', { name: 'Columns' }));
  await user.click(screen.getByRole('menuitemcheckbox', { name: 'Reviewer coverage' }));
  await user.click(screen.getByRole('menuitemcheckbox', { name: '1 approval' }));
  await user.keyboard('{Escape}');
  expect(within(backlog).getByRole('columnheader', { name: 'Human approvals' })).toHaveAttribute(
    'colspan',
    '2',
  );
  expect(within(backlog).getByRole('button', { name: 'Over 60 days' })).toBeVisible();
  expect(within(backlog).getByText(/Partial value./)).toBeInTheDocument();
  const activity = screen.getByRole('region', { name: 'Period activity' });
  await user.click(within(activity).getByRole('button', { name: 'Columns' }));
  await user.click(screen.getByRole('menuitemcheckbox', { name: 'Prebid agents' }));
  await user.click(screen.getByRole('menuitemcheckbox', { name: 'Other bots' }));
  await user.keyboard('{Escape}');
  expect(within(activity).getByRole('columnheader', { name: 'Agent reviewers' })).toBeVisible();
  expect(within(activity).getByRole('table').querySelectorAll('tbody tr')).toHaveLength(48);
});
it('uses the caller as the only owner of controlled visibility, including non-pinned sized columns', async () => {
  interface Row {
    id: string;
    a: number;
    b: number;
  }
  const columns: DataColumn<Row>[] = [
    { id: 'a', label: 'A', group: 'Values', width: 100, value: (row) => row.a },
    { id: 'b', label: 'B', group: 'Values', width: 100, value: (row) => row.b },
  ];
  function Controlled() {
    const [value, onChange] = useState<Record<string, boolean>>({});
    return (
      <LocalDataTable
        title="Controlled"
        columns={columns}
        rows={[{ id: 'one', a: 1, b: 2 }]}
        visibility={{ value, onChange }}
      />
    );
  }
  const user = userEvent.setup();
  render(<Controlled />);
  await user.click(screen.getByRole('button', { name: 'Columns' }));
  expect(screen.getByRole('menuitemcheckbox', { name: 'Values' })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  await user.click(screen.getByRole('menuitemcheckbox', { name: 'B' }));
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('columnheader', { name: 'B' })).not.toBeInTheDocument();
});
it('renders metric uncertainty, details, units and neutral comparisons without false zeros', () => {
  render(
    <>
      <MeasurementValue
        measurement={{ status: 'partial', value: 2, reason: 'Incomplete sample' }}
        comparison={{ status: 'complete', value: 1 }}
      />
      <MeasurementValue
        measurement={{ status: 'not-applicable', value: null, reason: 'No merges' }}
        unit="days"
      />
      <MeasurementValue
        measurement={{ status: 'complete', value: 5.5 }}
        unit="days"
        detail="38 merged PRs"
        comparison={{ status: 'complete', value: 7 }}
      />
    </>,
  );
  expect(screen.getByText('Partial value. Incomplete sample')).toBeInTheDocument();
  expect(screen.getByText('5.5 d')).toBeVisible();
  expect(screen.getByText(/-1.5 d/)).toBeVisible();
  expect(screen.getByText('No merges')).toBeInTheDocument();
  expect(screen.getByText('38 merged PRs')).toBeInTheDocument();
});
