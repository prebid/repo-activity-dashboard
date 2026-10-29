import { expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SelectableBars } from '@/components/charts/selectable-bars';
import { RepositoryCharts } from '@/features/repositories/repository-charts';
import { repositoryPageSample } from '@/mocks/repository-page';
import { repositoryOverviewSamples } from '@/mocks/repository-overview';
import { selectRepositoryPage } from '@/lib/presentation/repository-page';
const repo = repositoryOverviewSamples().repositories[0].repository;
it('uses keyboard-operable bars with printed values, visible selection, and honest missing/zero states', async () => {
  const onSelect = vi.fn(),
    user = userEvent.setup();
  render(
    <SelectableBars
      label="Distribution"
      points={[
        {
          id: 'a',
          label: 'Available',
          detail: 'Available records',
          count: { status: 'complete', value: 137 },
          selected: false,
        },
        {
          id: 'b',
          label: 'Zero',
          detail: 'Zero records',
          count: { status: 'complete', value: 0 },
          selected: false,
        },
        {
          id: 'c',
          label: 'Missing',
          detail: 'Missing records',
          count: { status: 'missing', value: null, reason: 'Not prepared' },
          selected: false,
        },
        {
          id: 'd',
          label: 'Partial',
          detail: 'Partial records',
          count: { status: 'partial', value: 2, reason: 'Incomplete' },
          selected: true,
        },
      ]}
      onSelect={onSelect}
    />,
  );
  await user.tab();
  expect(screen.getByRole('button', { name: 'Available 137' })).toHaveFocus();
  await user.keyboard('{Enter}');
  expect(onSelect).toHaveBeenLastCalledWith(0);
  expect(screen.getByRole('button', { name: 'Zero 0' })).toBeDisabled();
  expect(screen.getByRole('button', { name: /^Missing —/ })).toBeDisabled();
  expect(screen.getByRole('button', { name: /^Partial 2/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await user.tab();
  await user.keyboard(' ');
  expect(onSelect).toHaveBeenLastCalledWith(3);
});
it('labels complete chart populations and non-draft eligibility while supporting collapsed charts', async () => {
  const page = selectRepositoryPage(
    repositoryPageSample(repo, {
      selection: { scope: 'current', metric: 'totalOpenPrs' },
      returnTo: '/repos',
    }),
  );
  const onSelect = vi.fn(),
    onVisibilityChange = vi.fn(),
    user = userEvent.setup();
  const { rerender } = render(
    <RepositoryCharts
      page={page}
      visible
      onSelect={onSelect}
      onVisibilityChange={onVisibilityChange}
    />,
  );
  const age = screen.getByRole('figure', { name: 'Age distribution' });
  expect(within(age).getByText('137', { exact: true })).toBeVisible();
  expect(screen.getAllByText('Non-draft PRs · 17 drafts excluded')).toHaveLength(2);
  await user.click(
    within(screen.getByRole('figure', { name: 'Current human approvals' })).getByRole('button', {
      name: 'Zero 60',
    }),
  );
  expect(onSelect).toHaveBeenCalledWith({ kind: 'approvals', key: '0' });
  await user.click(screen.getByRole('button', { name: 'Hide charts' }));
  expect(onVisibilityChange).toHaveBeenCalledWith(false);
  rerender(
    <RepositoryCharts
      page={page}
      visible={false}
      onSelect={onSelect}
      onVisibilityChange={onVisibilityChange}
    />,
  );
  expect(screen.queryByRole('figure')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Show charts' }));
  expect(onVisibilityChange).toHaveBeenLastCalledWith(true);
});

it('keeps a zero-activity timeline keyboard-scrollable even when its bars cannot narrow the list', async () => {
  const user = userEvent.setup();
  render(
    <SelectableBars
      label="Zero activity"
      orientation="vertical"
      points={[
        {
          id: 'day',
          label: 'Oct 1',
          detail: 'Oct 1, 2026 UTC',
          count: { status: 'complete', value: 0 },
          selected: false,
        },
      ]}
      onSelect={vi.fn()}
    />,
  );
  await user.tab();
  expect(screen.getByRole('group', { name: 'Zero activity' })).toHaveFocus();
  expect(screen.getByRole('button', { name: 'Oct 1 0' })).toBeDisabled();
});
