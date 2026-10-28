import { useState } from 'react';
import { expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AllRepositoriesView } from '@/features/repositories/all-repositories-view';
import { useLocalTableController, LocalDataTable } from '@/components/tables/local-data-table';
import { MeasurementValue } from '@/components/metrics/measurement-value';
import { repositoryOverviewSamples } from '@/mocks/repository-overview';
import { defaultOverviewSettings } from '@/lib/presentation/overview-settings';
import { selectOverviewSample } from '@/lib/presentation/overview-samples';
import { overviewSettingsColumns } from '@/features/repositories/overview-columns';
import type { AgingThreshold } from '@/models/repository-overview';
import type { DataColumn } from '@/components/tables/data-table';

const samples = repositoryOverviewSamples();
const repositories = samples.repositories.map((row) => row.repository);
const definition = {
  ...overviewSettingsColumns,
  repositoryIds: repositories.map((repo) => repo.id),
};
function Preview({
  showChange = false,
  ageDays = 30,
}: {
  showChange?: boolean;
  ageDays?: AgingThreshold;
}) {
  const backlog = useLocalTableController();
  const activity = useLocalTableController();
  const [settings, setSettings] = useState(() => ({
    ...defaultOverviewSettings(definition),
    showChange,
    ageDays,
  }));
  return (
    <AllRepositoriesView
      data={selectOverviewSample(samples, settings.period, settings.repositoryIds)}
      backlogController={backlog}
      activityController={activity}
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
it('changes timeframe and aging independently and exposes the comparison dates and prior value', async () => {
  const user = userEvent.setup();
  render(<Preview />);
  const backlog = screen.getByRole('region', { name: 'Current backlog' });
  const activity = screen.getByRole('region', { name: 'Period activity' });
  const backlogRow = within(backlog).getByRole('link', { name: 'Prebid.js' }).closest('tr')!;
  const activityRow = within(activity).getByRole('link', { name: 'Prebid.js' }).closest('tr')!;
  await user.selectOptions(screen.getByRole('combobox', { name: 'PR aging threshold' }), '60');
  expect(backlogRow.querySelector('[data-column="agedPrs"]')).toHaveTextContent('60');
  await user.selectOptions(
    screen.getByRole('combobox', { name: 'Activity timeframe' }),
    'this-week',
  );
  expect(activityRow.querySelector('[data-column="prsOpened"]')).toHaveTextContent('12');
  expect(backlogRow.querySelector('[data-column="totalOpenPrs"]')).toHaveTextContent('137');
  expect(backlogRow.querySelector('[data-column="agedPrs"]')).toHaveTextContent('60');
  await user.click(screen.getByRole('checkbox', { name: 'Show change' }));
  expect(within(activity).getByText(/Compared with Oct 12, 2026/)).toBeVisible();
  expect(within(activityRow).getByTitle('Previous period: 10')).toHaveTextContent('+2');
});
it('validates custom dates and distinguishes unavailable samples from an empty result', async () => {
  const user = userEvent.setup();
  render(<Preview />);
  await user.selectOptions(screen.getByRole('combobox', { name: 'Activity timeframe' }), 'custom');
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
  expect(screen.getByRole('combobox', { name: 'Activity timeframe' })).toHaveValue('custom');
  const activity = screen.getByRole('region', { name: 'Period activity' });
  const row = within(activity).getByRole('link', { name: 'Prebid.js' }).closest('tr')!;
  expect(row.querySelector('[data-column="prsOpened"]')).toHaveTextContent('7');
  await user.click(screen.getByRole('button', { name: 'Edit dates' }));
  expect(screen.getByLabelText('Start date')).toHaveValue('2026-10-06');
  fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-10-01' } });
  fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-10-02' } });
  await user.click(screen.getByRole('button', { name: 'Apply dates' }));
  expect(within(activity).getByText(/No prepared sample data/)).toBeVisible();
  expect(row.querySelector('[data-column="prsOpened"]')).toHaveTextContent('—');
});
it('shows a horizontal-scroll hint only while the table overflows its container', () => {
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
  expect(screen.queryByText(/Scroll horizontally/)).not.toBeInTheDocument();
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
  expect(headings).toEqual(['Pull requests', 'Total open PRs']);
});
it('keeps column visibility and sorting independent without table search', async () => {
  const user = userEvent.setup();
  render(<Preview />);
  const backlog = screen.getByRole('region', { name: 'Current backlog' });
  const activity = screen.getByRole('region', { name: 'Period activity' });
  await user.click(within(backlog).getByRole('button', { name: 'Columns' }));
  expect(screen.getByRole('menuitemcheckbox', { name: 'Repository' })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  expect(screen.getByRole('menuitemcheckbox', { name: 'Human approvals' })).toHaveAttribute(
    'aria-checked',
    'mixed',
  );
  await user.click(screen.getByRole('menuitemcheckbox', { name: 'Human feedback' }));
  await user.click(screen.getByRole('menuitemcheckbox', { name: 'Human approvals' }));
  await user.keyboard('{Escape}');
  expect(within(backlog).getByRole('columnheader', { name: 'Human feedback' })).toHaveAttribute(
    'colspan',
    '4',
  );
  expect(within(backlog).getByRole('columnheader', { name: 'Human approvals' })).toHaveAttribute(
    'colspan',
    '4',
  );
  expect(
    within(activity).queryByRole('columnheader', { name: 'Human feedback' }),
  ).not.toBeInTheDocument();
  await user.click(within(backlog).getByRole('button', { name: 'Total open PRs' }));
  await user.click(within(backlog).getByRole('button', { name: 'Total open PRs ↑' }));
  expect(within(backlog).getByRole('columnheader', { name: 'Total open PRs ↓' })).toHaveAttribute(
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
  render(<Preview showChange ageDays={60} />);
  const backlog = screen.getByRole('region', { name: 'Current backlog' });
  await user.click(within(backlog).getByRole('button', { name: 'Columns' }));
  await user.click(screen.getByRole('menuitemcheckbox', { name: 'Feedback coverage' }));
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
  expect(within(activity).getByRole('columnheader', { name: 'Agent feedback' })).toBeVisible();
  expect(within(activity).getAllByText('+3', { selector: 'span' })[0]).toBeVisible();
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
