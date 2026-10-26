import { it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LocalDataTable as DataTable } from '@/components/tables/local-data-table';
import type { TableQuery } from '@/lib/presentation/table-query';
const columns = [{ id: 'name', label: 'Name', value: (r: { id: string; name: string }) => r.name }];
const initial: TableQuery = { search: '', sort: '', descending: false, page: 1 };
it('hides stale pages until results for the requested query arrive', () => {
  const onQueryChange = vi.fn();
  const paging = { totalCount: 200, query: initial };
  const { rerender } = render(
    <DataTable
      title="Remote"
      columns={columns}
      rows={[{ id: 'a', name: 'Old result' }]}
      paging={paging}
      onQueryChange={onQueryChange}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(screen.getByText('Loading items')).toBeVisible();
  expect(screen.queryByText('Old result')).not.toBeInTheDocument();
  expect(onQueryChange).toHaveBeenLastCalledWith({ ...initial, page: 2 });
  rerender(
    <DataTable
      title="Remote"
      columns={columns}
      rows={[{ id: 'b', name: 'New result' }]}
      paging={{ ...paging, query: { ...initial, page: 2 } }}
      onQueryChange={onQueryChange}
    />,
  );
  expect(screen.getByText('New result')).toBeVisible();
  expect(screen.getByText('Page 2 of 2')).toBeVisible();
});
it('requests a valid page when the count shrinks without relabeling old rows', () => {
  const onQueryChange = vi.fn();
  render(
    <DataTable
      title="Remote"
      initialQuery={{ ...initial, page: 3 }}
      columns={columns}
      rows={[]}
      paging={{ totalCount: 120, query: { ...initial, page: 3 } }}
      onQueryChange={onQueryChange}
    />,
  );
  expect(onQueryChange).toHaveBeenLastCalledWith({ ...initial, page: 2 });
  expect(screen.getByText('Loading items')).toBeVisible();
});
it('shows retryable failures and catches asynchronous export errors', async () => {
  const retry = vi.fn(),
    onExport = vi.fn().mockRejectedValue(new Error('offline'));
  const props = { title: 'Remote', columns, rows: [{ id: 'a', name: 'One' }] },
    paging = { totalCount: 1, query: initial, onExport };
  const { rerender } = render(
    <DataTable {...props} paging={{ ...paging, error: 'Offline', onRetry: retry }} />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(retry).toHaveBeenCalledOnce();
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
  rerender(<DataTable {...props} paging={paging} />);
  fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Export failed'));
  expect(onExport).toHaveBeenCalledWith({ search: '', sort: '', descending: false });
  expect(screen.getByRole('button', { name: 'Export CSV' })).toBeEnabled();
});
it('corrects local pagination without touching browser history', () => {
  window.history.replaceState(null, '', '/?unrelated=preserve');
  render(
    <DataTable
      title="Local"
      initialQuery={{ ...initial, page: 3 }}
      columns={columns}
      rows={[{ id: 'a', name: 'One' }]}
    />,
  );
  expect(screen.getByText('Page 1 of 1')).toBeVisible();
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
        title="Nested"
        columns={columns}
        rows={Array.from({ length: 101 }, (_, i) => ({ id: String(i), name: 'Item ' + i }))}
      />
    </form>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Name' }));
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(screen.getByText('Page 2 of 2')).toBeVisible();
  expect(submitted).not.toHaveBeenCalled();
});
it('rejects invalid paged contracts instead of displaying a misleading total', () => {
  const props = { title: 'Remote', columns, rows: [{ id: 'a', name: 'One' }] };
  expect(() => render(<DataTable {...props} paging={{ totalCount: 0, query: initial }} />)).toThrow(
    'valid total',
  );
  expect(() =>
    render(
      <DataTable
        {...props}
        rows={Array.from({ length: 101 }, (_, i) => ({ id: String(i), name: 'Too many' }))}
        paging={{ totalCount: 200, query: initial }}
      />,
    ),
  ).toThrow('at most 100');
});
