import { it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LocalDataTable as DataTable } from '@/components/tables/local-data-table';
import { type TableQuery } from '@/models/table-query';
const columns = [{ id: 'name', label: 'Name', value: (r: { id: string; name: string }) => r.name }];
const initial: TableQuery = { search: '', sort: '', descending: false, page: 1 };
it('corrects local pagination without touching browser history', () => {
  window.history.replaceState(null, '', '/?unrelated=preserve');
  render(
    <DataTable
      search="local"
      title="Local"
      initialQuery={{ ...initial, page: 3 }}
      columns={columns}
      rows={[{ id: 'a', name: 'One' }]}
    />,
  );
  expect(screen.getByRole('cell', { name: 'One' })).toBeVisible();
  // One page needs no pager.
  expect(screen.queryByRole('navigation', { name: 'Local pages' })).not.toBeInTheDocument();
  expect(window.location.search).toBe('?unrelated=preserve');
});
it('does not submit a containing form when sorting or paging', () => {
  const submitted = vi.fn();
  render(
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submitted();
      }}
    >
      <DataTable
        search="local"
        title="Nested"
        columns={columns}
        rows={Array.from({ length: 101 }, (_, i) => ({ id: String(i), name: 'Item ' + i }))}
      />
    </form>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Name' }));
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(screen.getByRole('navigation', { name: 'Nested pages' })).toHaveTextContent('Page 2 of 3');
  expect(submitted).not.toHaveBeenCalled();
});
it('shows a recoverable local export error without losing the table', async () => {
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL(): string {
        throw new Error('blocked');
      }
    },
  );
  render(
    <DataTable
      search="local"
      title="Export"
      columns={columns}
      rows={[{ id: 'a', name: 'One' }]}
      exportName="fixture.csv"
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
  fireEvent.click(screen.getByRole('button', { name: 'Download CSV' }));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Export failed'));
  expect(screen.getByRole('button', { name: 'Download CSV' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.getByRole('table')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Export CSV' })).toBeEnabled();
});
