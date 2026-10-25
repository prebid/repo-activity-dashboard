import { it, expect, vi } from 'vitest';
import { render, renderHook, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { useTableQuery } from '@/components/tables/use-table-query';
import { DataTable } from '@/components/tables/data-table';
import { preferenceKey, type TableQuery } from '@/lib/presentation/table-query';
const columnIds = ['name'];
const columns = [{ id: 'name', label: 'Name', value: (r: { id: string; name: string }) => r.name }];
const initial: TableQuery = { search: '', sort: '', descending: false, page: 1 };
it('notifies adapters on initial query and history changes without looping on new callback identity', () => {
  window.history.replaceState({ internal: 'preserve' }, '', '/?items.page=2&view=issues');
  const changes = vi.fn<(query: TableQuery) => void>();
  const { result, rerender } = renderHook(() =>
    useTableQuery({
      queryKey: 'items',
      columnIds: [...columnIds],
      initialSearch: '',
      onChange: (q) => changes(q),
    }),
  );
  expect(changes).toHaveBeenCalledExactlyOnceWith({ ...initial, page: 2 });
  rerender();
  expect(changes).toHaveBeenCalledTimes(1);
  act(() => result.current.update({ search: 'needle', page: 1 }));
  expect(changes).toHaveBeenLastCalledWith({ ...initial, search: 'needle' });
  expect(window.history.state).toEqual({ internal: 'preserve' });
  expect(window.location.search).toContain('view=issues');
  act(() => {
    window.history.replaceState(null, '', '/?items.page=2');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  expect(changes).toHaveBeenLastCalledWith({ ...initial, page: 2 });
});
it('restores only valid account preferences and gives explicit URL state precedence', () => {
  localStorage.setItem(
    preferenceKey('alice', 'items'),
    JSON.stringify({ sort: 'name', descending: true }),
  );
  const { result, unmount } = renderHook(() =>
    useTableQuery({ queryKey: 'items', columnIds, initialSearch: '', viewerId: 'alice' }),
  );
  expect(result.current.query).toEqual({ ...initial, sort: 'name', descending: true });
  unmount();
  window.history.replaceState(null, '', '/?items.sort=name&items.dir=asc');
  const other = renderHook(() =>
    useTableQuery({ queryKey: 'items', columnIds, initialSearch: '', viewerId: 'alice' }),
  );
  expect(other.result.current.query.descending).toBe(false);
});
it.each(['{', '{"sort":"retired","descending":true}', 'null', '{"sort":"name"}'])(
  'ignores malformed saved preferences %s',
  (stored) => {
    localStorage.setItem(preferenceKey('alice', 'items'), stored);
    const { result } = renderHook(() =>
      useTableQuery({ queryKey: 'items', columnIds, initialSearch: '', viewerId: 'alice' }),
    );
    expect(result.current.query).toEqual(initial);
  },
);
it('keeps URL interaction usable when storage is denied', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('denied');
  });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('denied');
  });
  const { result } = renderHook(() =>
    useTableQuery({ queryKey: 'items', columnIds, initialSearch: '', viewerId: 'alice' }),
  );
  act(() => result.current.update({ sort: 'name', descending: true }));
  expect(result.current.query.sort).toBe('name');
});
it('hides stale pages until results for the requested query arrive', () => {
  const onQueryChange = vi.fn();
  const paging = { totalCount: 200, query: initial, onQueryChange };
  const { rerender } = render(
    <DataTable
      title="Remote"
      queryKey="items"
      columns={columns}
      rows={[{ id: 'a', name: 'Old result' }]}
      paging={paging}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(screen.getByText('Loading items')).toBeVisible();
  expect(screen.queryByText('Old result')).not.toBeInTheDocument();
  expect(onQueryChange).toHaveBeenLastCalledWith({ ...initial, page: 2 });
  rerender(
    <DataTable
      title="Remote"
      queryKey="items"
      columns={columns}
      rows={[{ id: 'b', name: 'New result' }]}
      paging={{ ...paging, query: { ...initial, page: 2 } }}
    />,
  );
  expect(screen.getByText('New result')).toBeVisible();
  expect(screen.getByText('Page 2 of 2')).toBeVisible();
});
it('requests a valid page when the result count shrinks instead of relabeling stale rows', () => {
  window.history.replaceState(null, '', '/?items.page=3');
  const onQueryChange = vi.fn();
  render(
    <DataTable
      title="Remote"
      queryKey="items"
      columns={columns}
      rows={[]}
      paging={{ totalCount: 120, query: { ...initial, page: 3 }, onQueryChange }}
    />,
  );
  expect(onQueryChange).toHaveBeenLastCalledWith({ ...initial, page: 2 });
  expect(screen.getByText('Loading items')).toBeVisible();
});
it('shows retryable failures and catches asynchronous export errors', async () => {
  const retry = vi.fn();
  const onExport = vi.fn().mockRejectedValue(new Error('export offline'));
  const props = { title: 'Remote', queryKey: 'items', columns, rows: [{ id: 'a', name: 'One' }] };
  const paging = { totalCount: 1, query: initial, onQueryChange: () => {}, onExport };
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
it('corrects local pagination after the supplied data shrinks', () => {
  window.history.replaceState(null, '', '/?items.page=3');
  render(
    <DataTable
      title="Local"
      queryKey="items"
      columns={columns}
      rows={[{ id: 'a', name: 'One' }]}
    />,
  );
  expect(screen.getByText('Page 1 of 1')).toBeVisible();
  expect(window.location.search).toBe('');
});
it('notifies a new table namespace even if its initial query has identical values', () => {
  const first = vi.fn();
  const second = vi.fn();
  const { rerender } = renderHook(
    ({ key, onChange }) => useTableQuery({ queryKey: key, columnIds, initialSearch: '', onChange }),
    { initialProps: { key: 'prs', onChange: first } },
  );
  expect(first).toHaveBeenCalledOnce();
  rerender({ key: 'issues', onChange: second });
  expect(second).toHaveBeenCalledExactlyOnceWith(initial);
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
        queryKey="nested"
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
