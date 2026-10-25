import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DataTable, type DataColumn } from '@/components/tables/data-table';
import { MetricValue } from '@/components/metrics/metric-value';
import { PageState } from '@/components/feedback/page-state';
interface Row {
  id: string;
  title: string;
  count: number | null;
}
const columns: DataColumn<Row>[] = [
  { id: 'title', label: 'Title', value: (r) => r.title },
  {
    id: 'count',
    label: 'Count',
    value: (r) => r.count,
    cell: (r) => <MetricValue value={r.count} />,
  },
];
const rows: Row[] = Array.from({ length: 250 }, (_, i) => ({
  id: String(i + 1),
  title: i === 249 ? 'Oldest keyboard issue' : 'Item ' + String(i + 1).padStart(3, '0'),
  count: i === 1 ? null : i,
}));
describe('shared table', () => {
  it('paginates 250 rows and searches across the full set', async () => {
    const user = userEvent.setup();
    render(<DataTable title="Records" rows={rows} columns={columns} queryKey="records" />);
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(101);
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(51);
    await user.type(screen.getByRole('textbox', { name: 'Search Records' }), 'keyboard');
    expect(screen.getByText('Oldest keyboard issue')).toBeVisible();
    expect(screen.getByText('Page 1 of 1')).toBeVisible();
  });
  it('sorts with missing values last and exposes sort state', async () => {
    const user = userEvent.setup();
    render(
      <DataTable
        title="Numbers"
        rows={[
          { id: 'a', title: 'A', count: 0 },
          { id: 'b', title: 'B', count: null },
          { id: 'c', title: 'C', count: 9 },
        ]}
        columns={columns}
        queryKey="numbers"
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Count' }));
    await user.click(screen.getByRole('button', { name: 'Count ↑' }));
    const result = within(screen.getByRole('table')).getAllByRole('row').slice(1);
    expect(result[0]).toHaveTextContent('C');
    expect(result[2]).toHaveTextContent('B');
    expect(screen.getByRole('columnheader', { name: 'Count ↓' })).toHaveAttribute(
      'aria-sort',
      'descending',
    );
  });
  it('exports every matching row, not only the visible page', async () => {
    const blobs: Blob[] = [];
    vi.stubGlobal(
      'URL',
      class extends URL {
        static createObjectURL(blob: Blob) {
          blobs.push(blob);
          return 'blob:test';
        }
        static revokeObjectURL() {}
      },
    );
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(
      <DataTable
        title="Export"
        rows={rows}
        columns={columns}
        queryKey="export"
        exportName="sample.csv"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
    expect(blobs).toHaveLength(1);
    const csv = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () =>
        typeof reader.result === 'string'
          ? resolve(reader.result)
          : reject(new Error('Expected CSV text'));
      reader.onerror = reject;
      reader.readAsText(blobs[0]);
    });
    expect(csv.split('\r\n')).toHaveLength(251);
    expect(csv).toContain('Oldest keyboard issue');
  });
  it('renders a meaningful empty state', () => {
    render(<DataTable title="Empty" rows={[]} columns={columns} queryKey="empty" />);
    expect(screen.getByText('No items')).toBeVisible();
  });
  it('renders known zero and unavailable separately', () => {
    render(
      <>
        <MetricValue value={0} />
        <MetricValue value={null} />
      </>,
    );
    expect(screen.getByText('0')).toBeVisible();
    expect(screen.getByTitle('Data unavailable')).toHaveTextContent('—');
  });
  it('allows retry from the error state', async () => {
    const retry = vi.fn();
    render(<PageState title="Unable to load" onRetry={retry} />);
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalledOnce();
  });
});

describe('column controls', () => {
  it('hides presentation columns without changing the matching population', async () => {
    const user = userEvent.setup();
    render(
      <DataTable
        title="Columns sample"
        rows={rows.slice(0, 3)}
        columns={columns}
        queryKey="columns"
      />,
    );
    await user.click(screen.getByText('Columns'));
    await user.click(screen.getByRole('checkbox', { name: 'Count' }));
    expect(
      within(screen.getByRole('table')).queryByRole('columnheader', { name: 'Count' }),
    ).not.toBeInTheDocument();
    expect(within(screen.getByRole('table')).getAllByRole('cell')).toHaveLength(3);
    expect(screen.getByText('3 matching items')).toBeVisible();
  });
});

describe('paged data input for a future adapter', () => {
  it('uses the supplied total and does not filter, re-sort, or page the supplied records again', () => {
    window.history.replaceState(
      null,
      '',
      '/?remote.page=3&remote.q=server-filter&remote.sort=count&remote.dir=desc',
    );
    const onQueryChange = vi.fn();
    render(
      <DataTable
        title="Remote page"
        rows={rows.slice(200)}
        columns={columns}
        queryKey="remote"
        paging={{
          query: { page: 3, search: 'server-filter', sort: 'count', descending: true },
          totalCount: 250,
          onQueryChange,
        }}
      />,
    );
    expect(screen.getByText('250 matching items')).toBeVisible();
    expect(screen.getByText('Page 3 of 3')).toBeVisible();
    const rendered = within(screen.getByRole('table')).getAllByRole('row');
    expect(rendered).toHaveLength(51);
    expect(rendered[1]).toHaveTextContent('Item 201');
    fireEvent.change(screen.getByRole('textbox', { name: 'Search Remote page' }), {
      target: { value: 'new scope' },
    });
    expect(onQueryChange).toHaveBeenLastCalledWith({
      search: 'new scope',
      sort: 'count',
      descending: true,
      page: 1,
    });
  });
  it('delegates export for the full scope without passing the page number', () => {
    window.history.replaceState(null, '', '/?remote.page=3&remote.q=scope');
    const onExport = vi.fn();
    render(
      <DataTable
        title="Remote export"
        rows={rows.slice(200)}
        columns={columns}
        queryKey="remote"
        paging={{
          query: { page: 3, search: 'scope', sort: '', descending: false },
          totalCount: 250,
          onQueryChange: () => {},
          onExport,
        }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
    expect(onExport).toHaveBeenCalledWith({ search: 'scope', sort: '', descending: false });
  });
});
