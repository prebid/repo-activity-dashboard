import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { DataColumn } from '@/components/tables/data-table';
import { LocalDataTable as DataTable } from '@/components/tables/local-data-table';
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
it('keeps cell interaction state and focus when column render callbacks change', async () => {
  const user = userEvent.setup();
  function Counter() {
    const [count, setCount] = useState(0);
    return <button onClick={() => setCount((value) => value + 1)}>Count {count}</button>;
  }
  const makeColumns = (): DataColumn<Row>[] => [
    { id: 'title', label: 'Action', value: (row) => row.title, cell: () => <Counter /> },
  ];
  const view = render(
    <DataTable title="Stable cells" rows={rows.slice(0, 1)} columns={makeColumns()} />,
  );
  const button = screen.getByRole('button', { name: 'Count 0' });
  await user.click(button);
  expect(button).toHaveTextContent('Count 1');
  view.rerender(<DataTable title="Stable cells" rows={rows.slice(0, 1)} columns={makeColumns()} />);
  expect(screen.getByRole('button', { name: 'Count 1' })).toBe(button);
  expect(button).toHaveFocus();
});
it('keeps grouped rows together when sorting and exports their actual values', async () => {
  const user = userEvent.setup();
  const blobs: Blob[] = [];
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL(blob: Blob) {
        blobs.push(blob);
        return 'blob:grouped';
      }
      static revokeObjectURL() {}
    },
  );
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  const grouped = [
    { id: 'a1', title: 'A period 1', count: 5, rank: 5 },
    { id: 'a2', title: 'A period 2', count: 100, rank: 5 },
    { id: 'b1', title: 'B period 1', count: 9, rank: 9 },
    { id: 'b2', title: 'B period 2', count: 1, rank: 9 },
    { id: 'c1', title: 'C period 1', count: null, rank: null },
    { id: 'c2', title: 'C period 2', count: 999, rank: null },
  ];
  const definitions: DataColumn<(typeof grouped)[number]>[] = [
    { id: 'title', label: 'Title', value: (row) => row.title },
    { id: 'count', label: 'Count', value: (row) => row.count, sortValue: (row) => row.rank },
  ];
  render(
    <DataTable title="Grouped" rows={grouped} columns={definitions} exportName="grouped.csv" />,
  );
  await user.click(screen.getByRole('button', { name: 'Count' }));
  await user.click(screen.getByRole('button', { name: 'Count ↑' }));
  expect(
    [...screen.getByRole('table').querySelectorAll('tbody tr')].map(
      (row) => row.firstElementChild?.textContent,
    ),
  ).toEqual(['B period 1', 'B period 2', 'A period 1', 'A period 2', 'C period 1', 'C period 2']);
  await user.click(screen.getByRole('button', { name: 'Export CSV' }));
  const csv = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Missing CSV'));
    reader.onerror = reject;
    reader.readAsText(blobs[0]);
  });
  expect(csv.split('\r\n')).toEqual([
    '"Title","Count"',
    '"B period 1","9"',
    '"B period 2","1"',
    '"A period 1","5"',
    '"A period 2","100"',
    '"C period 1",',
    '"C period 2","999"',
  ]);
});
describe('shared table', () => {
  it('keeps three-row comparison groups together with a bounded 48-row page', async () => {
    const user = userEvent.setup();
    const grouped = Array.from({ length: 102 }, (_, i) => ({
      id: String(i),
      title: 'Repository ' + Math.floor(i / 3) + ' row ' + (i % 3),
      count: i,
    }));
    render(<DataTable title="Comparison groups" rows={grouped} columns={columns} pageSize={48} />);
    expect(screen.getByRole('table').querySelectorAll('tbody tr')).toHaveLength(48);
    expect(screen.getByText('Repository 15 row 2')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('table').querySelectorAll('tbody tr')).toHaveLength(48);
    expect(screen.getByText('Repository 16 row 0')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('table').querySelectorAll('tbody tr')).toHaveLength(6);
    expect(screen.getByText('Repository 32 row 0')).toBeVisible();
    expect(screen.getByText('Repository 33 row 2')).toBeVisible();
  });
  it.each([0, NaN, 150])(
    'retains the 50-row maximum for invalid or oversized page sizes: %s',
    (pageSize) => {
      render(<DataTable title="Bounded" rows={rows} columns={columns} pageSize={pageSize} />);
      expect(screen.getByRole('table').querySelectorAll('tbody tr')).toHaveLength(50);
    },
  );
  it('paginates 250 rows and searches across the full set', async () => {
    const user = userEvent.setup();
    render(<DataTable title="Records" rows={rows} columns={columns} />);
    const seen: string[] = [];
    for (let page = 1; page <= 5; page++) {
      const visible = within(screen.getByRole('table')).getAllByRole('row');
      expect(visible).toHaveLength(51);
      seen.push(...visible.slice(1).map((row) => row.firstElementChild?.textContent ?? ''));
      expect(screen.getByText('Page ' + page + ' of 5')).toBeVisible();
      if (page < 5) await user.click(screen.getByRole('button', { name: 'Next' }));
    }
    expect(seen).toEqual(rows.map((row) => row.title));
    expect(new Set(seen).size).toBe(250);
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Previous' }));
    expect(screen.getByText('Page 4 of 5')).toBeVisible();
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
  it.each([true, false])(
    'exports every row in the applicable scope (searchable=%s)',
    async (searchable) => {
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
          exportName="sample.csv"
          searchable={searchable}
          initialQuery={{
            search: searchable ? '' : 'no match',
            sort: '',
            descending: false,
            page: 1,
          }}
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
    },
  );
  it('renders a meaningful empty state', () => {
    render(<DataTable title="Empty" rows={[]} columns={columns} />);
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
    render(<DataTable title="Columns sample" rows={rows.slice(0, 3)} columns={columns} />);
    await user.click(screen.getByText('Columns'));
    await user.click(screen.getByRole('menuitemcheckbox', { name: 'Count' }));
    expect(screen.getByRole('menuitemcheckbox', { name: 'Title' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await user.keyboard('{Escape}');
    expect(
      within(screen.getByRole('table')).queryByRole('columnheader', { name: 'Count' }),
    ).not.toBeInTheDocument();
    expect(within(screen.getByRole('table')).getAllByRole('cell')).toHaveLength(3);
    expect(screen.getByText('3 matching items')).toBeVisible();
  });
});

it('renders missing default cells, exports ascending order, and distinguishes an empty search', async () => {
  const blobs: Blob[] = [];
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL(blob: Blob) {
        blobs.push(blob);
        return 'blob:ascending';
      }
      static revokeObjectURL() {}
    },
  );
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  const plain: DataColumn<Row>[] = [
    { id: 'title', label: 'Title', value: (r) => r.title },
    { id: 'count', label: 'Count', value: (r) => r.count },
  ];
  render(
    <DataTable
      title="Defaults"
      rows={[
        { id: 'missing', title: 'Missing', count: null },
        { id: 'two', title: 'Two', count: 2 },
        { id: 'zero', title: 'Zero', count: 0 },
      ]}
      columns={plain}
      exportName="ascending.csv"
    />,
  );
  expect(screen.getByRole('cell', { name: '—' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Count' }));
  fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
  const csv = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === 'string'
        ? resolve(reader.result)
        : reject(new Error('Expected text'));
    reader.onerror = reject;
    reader.readAsText(blobs[0]);
  });
  expect(csv.split('\r\n')).toEqual(['"Title","Count"', '"Zero","0"', '"Two","2"', '"Missing",']);
  fireEvent.change(screen.getByRole('textbox', { name: 'Search Defaults' }), {
    target: { value: 'absent' },
  });
  expect(screen.getByText('No matching items')).toBeVisible();
});

it('exports the full filtered sort order and handles explicit search submission', async () => {
  const blobs: Blob[] = [];
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL(blob: Blob) {
        blobs.push(blob);
        return 'blob:sorted';
      }
      static revokeObjectURL() {}
    },
  );
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  const submitted = vi.fn();
  render(
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submitted();
      }}
    >
      <DataTable
        title="Sorted export"
        rows={rows}
        columns={columns}
        exportName="sorted.csv"
        initialQuery={{ search: 'Item', sort: 'count', descending: true, page: 2 }}
      />
    </form>,
  );
  const input = screen.getByRole('textbox', { name: 'Search Sorted export' });
  fireEvent.keyDown(input, { key: 'Enter' });
  fireEvent.blur(input);
  expect(submitted).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
  const csv = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === 'string'
        ? resolve(reader.result)
        : reject(new Error('Expected text'));
    reader.onerror = reject;
    reader.readAsText(blobs[0]);
  });
  const lines = csv.split('\r\n');
  expect(lines).toHaveLength(250);
  expect(lines[1]).toBe('"Item 249","248"');
  expect(lines.at(-1)).toBe('"Item 002",');
  expect(rows[0].id).toBe('1');
});
