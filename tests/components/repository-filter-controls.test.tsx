import { useState } from 'react';
import { expect, it, vi } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RepositoryFilterControls } from '@/features/repositories/repository-filter-controls';
import { defaultRepositoryFilters } from '@/lib/presentation/repository-page-query';
import { initialTableQuery, type TableController } from '@/lib/presentation/table-controller';
import { repositoryPageSample } from '@/mocks/repository-page';
import { repositoryOverviewSamples } from '@/mocks/repository-overview';
const repo = repositoryOverviewSamples().repositories[0].repository;
const source = repositoryPageSample(repo, {
  selection: { scope: 'current', metric: 'totalOpenPrs' },
  returnTo: '/repos',
});
const onChange = vi.fn();
function PendingSearch() {
  const [filters, setFilters] = useState(() => defaultRepositoryFilters('prs'));
  const [draftSearch, setDraftSearch] = useState('');
  const table: TableController = {
    scopeKey: 'test',
    query: { ...initialTableQuery, search: filters.search },
    draftSearch,
    setSearch: setDraftSearch,
    update: vi.fn(),
    reconcilePage: vi.fn(),
    flushSearch: () => {
      setFilters((value) => ({ ...value, search: draftSearch }));
      return { ...initialTableQuery, search: draftSearch };
    },
  };
  return (
    <RepositoryFilterControls
      source={source}
      filters={filters}
      table={table}
      onChange={onChange}
      onClear={vi.fn()}
    />
  );
}
it('keeps the filter dialog open when blur commits a pending search, and still applies facet edits', async () => {
  onChange.mockClear();
  const user = userEvent.setup();
  render(<PendingSearch />);
  await user.type(screen.getByRole('textbox'), 'Sample PR 1:');
  await user.click(screen.getByRole('button', { name: 'Filters' }));
  const dialog = screen.getByRole('dialog', { name: 'Filter pull requests' });
  expect(dialog).toBeVisible();
  await user.selectOptions(
    within(dialog).getByRole('combobox', { name: 'Draft status' }),
    'drafts',
  );
  await user.click(within(dialog).getByRole('button', { name: 'Apply filters' }));
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ kind: 'prs', draft: 'drafts' }));
});
it('closes an editing draft when the cohort or applied facets change', async () => {
  const user = userEvent.setup();
  const filters = defaultRepositoryFilters('prs');
  const table: TableController = {
    scopeKey: 'test',
    query: initialTableQuery,
    draftSearch: '',
    setSearch: vi.fn(),
    update: vi.fn(),
    reconcilePage: vi.fn(),
    flushSearch: () => initialTableQuery,
  };
  const props = { source, filters, table, onChange: vi.fn(), onClear: vi.fn() };
  const { rerender } = render(<RepositoryFilterControls {...props} />);
  await user.click(screen.getByRole('button', { name: 'Filters' }));
  rerender(
    <RepositoryFilterControls {...props} filters={{ ...filters, authors: ['sample-alice'] }} />,
  );
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  await user.click(screen.getByRole('button', { name: /^Filters/ }));
  rerender(
    <RepositoryFilterControls
      {...props}
      source={{ ...source, repository: { ...repo, id: 'another-repo' } }}
    />,
  );
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});
