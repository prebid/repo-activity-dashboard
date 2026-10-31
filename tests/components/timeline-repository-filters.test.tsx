import { expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TimelineRepositoryFilters } from '@/features/repositories/timeline-repository-filters';
import { repositoryPageFiltersSchema } from '@/models/repository-page';

const facets = {
  labels: ['feature'],
  authors: ['sample-alice'],
  branches: ['main'],
  assignees: [],
};
it('applies cutoff filters through the shared form, encoding age bands as numbers', async () => {
  const onChange = vi.fn(() => undefined);
  render(
    <TimelineRepositoryFilters
      filters={repositoryPageFiltersSchema.parse({ kind: 'prs' })}
      facets={facets}
      snapshot
      onChange={onChange}
    />,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Record filters' }));
  const dialog = screen.getByRole('dialog');
  expect(within(dialog).queryByText('Current state')).not.toBeInTheDocument();
  const age = within(dialog).getByLabelText('Age');
  await userEvent.selectOptions(age, within(age).getAllByRole('option')[1]);
  await userEvent.click(within(dialog).getByRole('button', { name: 'Apply filters' }));
  expect(onChange).toHaveBeenCalledTimes(1);
  const applied = (onChange.mock.calls[0] as unknown as [{ ageBand?: unknown }])[0];
  expect(typeof applied.ageBand).toBe('number');
});
it('keeps the dialog open with the rejection message and removes chips one at a time', async () => {
  const onChange = vi.fn(() => 'Current age and review filters require Backlog at cutoff.');
  render(
    <TimelineRepositoryFilters
      filters={repositoryPageFiltersSchema.parse({ kind: 'prs', labels: ['feature'] })}
      facets={facets}
      snapshot={false}
      onChange={onChange}
    />,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Record filters (1)' }));
  await userEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
  expect(screen.getByRole('alert')).toHaveTextContent('require Backlog at cutoff');
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  await userEvent.keyboard('{Escape}');
  await userEvent.click(screen.getByRole('button', { name: /^Remove / }));
  expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ labels: [] }));
});
