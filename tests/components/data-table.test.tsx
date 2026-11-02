import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { renderToString } from 'react-dom/server';
import { renderedMain } from '../support/rendered-html';
import { render, screen, within, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { DataColumn } from '@/components/tables/data-table';
import { LocalDataTable as DataTable } from '@/components/tables/local-data-table';
import { MetricValue } from '@/components/metrics/metric-value';
import { EmptyState } from '@/components/feedback/empty-state';
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
it('sorts and exports against a full value axis while rendering only the visible columns', async () => {
  const blobs: Blob[] = [];
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL(blob: Blob) {
        blobs.push(blob);
        return 'blob:axis';
      }
      static revokeObjectURL() {}
    },
  );
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  const user = userEvent.setup();
  render(
    <DataTable
      search="local"
      title="Window"
      rows={rows}
      columns={[columns[0]]}
      valueColumns={[columns[0], { ...columns[1], sortNote: 'Sorted using the full axis.' }]}
      showColumnMenu={false}
      exportName="window.csv"
      initialQuery={{ search: 'Item', sort: 'count', descending: true, page: 2 }}
    />,
  );
  expect(screen.queryByRole('columnheader', { name: /Count/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Columns' })).not.toBeInTheDocument();
  expect(screen.getByText('Sorted using the full axis.')).toBeVisible();
  expect(screen.getByRole('table').querySelector('tbody tr')).toHaveTextContent('Item 199');
  await user.click(screen.getByRole('button', { name: 'Export CSV' }));
  await user.click(screen.getByRole('button', { name: 'Download CSV' }));
  expect(blobs).toHaveLength(1);
  const csv = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === 'string' ? resolve(reader.result) : reject(Error('Missing CSV'));
    reader.onerror = reject;
    reader.readAsText(blobs[0]);
  });
  expect(csv.split('\r\n')).toHaveLength(250);
  expect(csv.split('\r\n')[0]).toBe('"Title"');
  expect(csv.split('\r\n')[1]).toBe('"Item 249"');
  expect(csv.split('\r\n').at(-1)).toBe('"Item 002"');
});
it('server-renders rows while keeping React-only table controls disabled until hydration', () => {
  const main = renderedMain(
    renderToString(
      <main>
        <DataTable
          search="local"
          title="Hydration"
          rows={rows}
          columns={columns}
          exportName="test.csv"
        />
      </main>,
    ),
  )!;
  expect(main.querySelectorAll('tbody tr')).toHaveLength(50);
  expect(main.querySelector('fieldset[aria-label="Hydration table controls"]')).toHaveAttribute(
    'disabled',
  );
  expect(main.querySelector('th button')).toHaveAttribute('disabled');
  expect(
    Array.from(main.querySelectorAll('button')).find((button) => button.textContent === 'Next'),
  ).toHaveAttribute('disabled');
});
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
    <DataTable
      search="local"
      title="Stable cells"
      rows={rows.slice(0, 1)}
      columns={makeColumns()}
    />,
  );
  const button = screen.getByRole('button', { name: 'Count 0' });
  await user.click(button);
  expect(button).toHaveTextContent('Count 1');
  view.rerender(
    <DataTable
      search="local"
      title="Stable cells"
      rows={rows.slice(0, 1)}
      columns={makeColumns()}
    />,
  );
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
    <DataTable
      search="local"
      title="Grouped"
      rows={grouped}
      columns={definitions}
      exportName="grouped.csv"
    />,
  );
  await user.click(screen.getByRole('button', { name: 'Count' }));
  expect(screen.getByRole('columnheader', { name: 'Count' })).toHaveAttribute(
    'aria-sort',
    'ascending',
  );
  await user.click(screen.getByRole('button', { name: 'Count' }));
  expect(screen.getByRole('columnheader', { name: 'Count' })).toHaveAttribute(
    'aria-sort',
    'descending',
  );
  expect(
    [...screen.getByRole('table').querySelectorAll('tbody tr')].map(
      (row) => row.firstElementChild?.textContent,
    ),
  ).toEqual(['B period 1', 'B period 2', 'A period 1', 'A period 2', 'C period 1', 'C period 2']);
  await user.click(screen.getByRole('button', { name: 'Export CSV' }));
  await user.click(screen.getByRole('button', { name: 'Download CSV' }));
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
    render(
      <DataTable
        search="local"
        title="Comparison groups"
        rows={grouped}
        columns={columns}
        pageSize={48}
      />,
    );
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
      render(
        <DataTable
          search="local"
          title="Bounded"
          rows={rows}
          columns={columns}
          pageSize={pageSize}
        />,
      );
      expect(screen.getByRole('table').querySelectorAll('tbody tr')).toHaveLength(50);
    },
  );
  it('paginates 250 rows and searches across the full set', async () => {
    const user = userEvent.setup();
    render(<DataTable search="local" title="Records" rows={rows} columns={columns} />);
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
    const pager = screen.getByRole('navigation', { name: 'Records pages' });
    expect(pager).toHaveTextContent('Page 4 of 5');
    expect(screen.getByText('250 items')).toBeVisible();
    await user.type(screen.getByRole('textbox', { name: 'Search Records' }), 'keyboard');
    expect(screen.getByText('Oldest keyboard issue')).toBeVisible();
    expect(screen.getByText('1 matching item')).toBeVisible();
    // A single page of results hides the pager instead of disabling it.
    expect(pager).not.toBeInTheDocument();
    expect(screen.queryByText(/^Page \d+ of \d+$/)).not.toBeInTheDocument();
  });
  it('sorts with missing values last and exposes sort state', async () => {
    const user = userEvent.setup();
    render(
      <DataTable
        search="local"
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
    expect(screen.getByRole('columnheader', { name: 'Count' })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
    await user.click(screen.getByRole('button', { name: 'Count' }));
    const result = within(screen.getByRole('table')).getAllByRole('row').slice(1);
    expect(result[0]).toHaveTextContent('C');
    expect(result[2]).toHaveTextContent('B');
    expect(screen.getByRole('columnheader', { name: 'Count' })).toHaveAttribute(
      'aria-sort',
      'descending',
    );
  });
  it.each(['local', 'none'] as const)(
    'exports every row in the applicable scope (search=%s)',
    async (search) => {
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
          search={search}
          initialQuery={{
            search: search === 'local' ? '' : 'no match',
            sort: '',
            descending: false,
            page: 1,
          }}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
      await userEvent.setup().click(screen.getByRole('button', { name: 'Download CSV' }));
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
  it('keeps the header row of an empty table and states the result in one full-width row', () => {
    const view = render(<DataTable search="local" title="Empty" rows={[]} columns={columns} />);
    const table = screen.getByRole('table', { name: 'Empty' });
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toEqual(['Title', 'Count']);
    const state = within(table).getByRole('status');
    expect(state).toHaveAttribute('data-kind', 'empty');
    expect(state).toHaveAttribute('data-variant', 'embedded');
    expect(within(state).getByRole('heading', { name: 'No items' })).toBeVisible();
    expect(state).toHaveTextContent('Adjust the selected scope or search.');
    expect(state.closest('td')).toHaveAttribute('colspan', '2');
    view.rerender(
      <DataTable
        title="Empty"
        rows={[]}
        columns={columns}
        search="none"
        empty={{ kind: 'missing', title: 'Records unavailable', description: 'Not prepared.' }}
      />,
    );
    const missing = within(screen.getByRole('table')).getByRole('status');
    expect(missing).toHaveAttribute('data-kind', 'missing');
    expect(missing).toHaveTextContent(/^Records unavailableNot prepared\.$/);
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
    render(<EmptyState kind="error" title="Unable to load" onRetry={retry} />);
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalledOnce();
  });
});

describe('column controls', () => {
  it('hides presentation columns without changing the matching population', async () => {
    const user = userEvent.setup();
    render(
      <DataTable search="local" title="Columns sample" rows={rows.slice(0, 3)} columns={columns} />,
    );
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
    expect(screen.getByText('3 items')).toBeVisible();
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
      search="local"
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
  await userEvent.setup().click(screen.getByRole('button', { name: 'Download CSV' }));
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
        search="local"
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
  await userEvent.setup().click(screen.getByRole('button', { name: 'Download CSV' }));
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

it('uses explicit CSV columns without making export-only metadata searchable or visible', async () => {
  const user = userEvent.setup();
  const blobs: Blob[] = [];
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL(blob: Blob) {
        blobs.push(blob);
        return 'blob:explicit-columns';
      }
      static revokeObjectURL() {}
    },
  );
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  render(
    <DataTable
      search="local"
      title="Export contract"
      rows={[{ id: 'one', title: 'Visible row', count: 2 }]}
      columns={columns}
      exportName="contract.csv"
      exportColumns={[
        ...columns,
        { id: 'coverage', label: 'Coverage', value: () => 'export-only metadata' },
      ]}
    />,
  );
  expect(screen.queryByRole('columnheader', { name: 'Coverage' })).not.toBeInTheDocument();
  await user.type(screen.getByRole('textbox', { name: 'Search Export contract' }), 'export-only');
  expect(screen.queryByText('Visible row')).not.toBeInTheDocument();
  expect(within(screen.getByRole('table')).getByRole('status')).toHaveTextContent(
    'No matching items',
  );
  await user.clear(screen.getByRole('textbox', { name: 'Search Export contract' }));
  await user.click(screen.getByRole('button', { name: 'Export CSV' }));
  await user.click(screen.getByRole('button', { name: 'Download CSV' }));
  const csv = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === 'string' ? resolve(reader.result) : reject(Error('Missing CSV'));
    reader.onerror = reject;
    reader.readAsText(blobs[0]);
  });
  expect(csv).toBe('"Title","Count","Coverage"\r\n"Visible row","2","export-only metadata"');
});

it('defers resize-observer layout updates to a frame and cancels pending work on disposal', () => {
  const frames = new Map<number, FrameRequestCallback>();
  let next = 0;
  let notify: () => void = () => {};
  const disconnect = vi.fn();
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn((callback: FrameRequestCallback) => {
      frames.set(++next, callback);
      return next;
    }),
  );
  vi.stubGlobal(
    'cancelAnimationFrame',
    vi.fn((id: number) => {
      frames.delete(id);
    }),
  );
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        notify = callback;
      }
      observe() {}
      disconnect() {
        disconnect();
      }
    },
  );
  const view = render(
    <DataTable search="local" title="Resize contract" rows={rows.slice(0, 1)} columns={columns} />,
  );
  const region = screen.getByRole('region', { name: 'Resize contract table scroll area' });
  Object.defineProperty(region, 'scrollWidth', { configurable: true, value: 1000 });
  Object.defineProperty(region, 'clientWidth', { configurable: true, value: 200 });
  act(() => {
    notify();
    notify();
  });
  expect(frames.size).toBe(1);
  expect(screen.queryByText(/Scroll horizontally/)).not.toBeInTheDocument();
  act(() => {
    const callback = [...frames.values()][0];
    frames.clear();
    callback(0);
  });
  expect(screen.getByText(/Scroll horizontally/)).toBeVisible();
  act(() => notify());
  view.unmount();
  expect(frames.size).toBe(0);
  expect(disconnect).toHaveBeenCalled();
  window.dispatchEvent(new Event('resize'));
  expect(frames.size).toBe(0);
});

it('starts CSV choices from visible columns and keeps export-only choices out of table preferences', async () => {
  const user = userEvent.setup(),
    blobs: Blob[] = [],
    onChange = vi.fn();
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL(blob: Blob) {
        blobs.push(blob);
        return 'blob:choices';
      }
      static revokeObjectURL() {}
    },
  );
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  render(
    <DataTable
      search="local"
      title="Selection"
      rows={rows}
      columns={columns.map((column) =>
        column.id === 'title' ? { ...column, hideable: false } : column,
      )}
      exportName="selection.csv"
      visibility={{ value: { count: false }, onChange }}
      initialQuery={{ search: '', sort: 'count', descending: true, page: 2 }}
    />,
  );
  expect(screen.queryByRole('button', { name: 'Export options' })).not.toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: 'Export CSV' })).toHaveLength(1);
  await user.click(screen.getByRole('button', { name: 'Export CSV' }));
  const dialog = screen.getByRole('dialog', { name: 'Selection CSV export' });
  expect(within(dialog).queryByRole('group', { name: 'Layout' })).not.toBeInTheDocument();
  expect(within(dialog).getByRole('checkbox', { name: 'Title (required)' })).toBeChecked();
  expect(within(dialog).getByRole('checkbox', { name: 'Title (required)' })).toBeDisabled();
  expect(within(dialog).getByRole('checkbox', { name: 'Count' })).not.toBeChecked();
  await user.click(within(dialog).getByRole('checkbox', { name: 'Count' }));
  await user.click(within(dialog).getByRole('button', { name: 'Download CSV' }));
  expect(onChange).not.toHaveBeenCalled();
  expect(screen.queryByRole('columnheader', { name: /Count/ })).not.toBeInTheDocument();
  const csv = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === 'string' ? resolve(reader.result) : reject(Error('No CSV'));
    reader.onerror = reject;
    reader.readAsText(blobs[0]);
  });
  expect(csv.split('\r\n')).toHaveLength(rows.length + 1);
  expect(csv.split('\r\n')[0]).toBe('"Title","Count"');
  await user.click(screen.getByRole('button', { name: 'Export CSV' }));
  expect(screen.getByRole('checkbox', { name: 'Count' })).not.toBeChecked();
});
describe('table toolbar', () => {
  const order = (toolbar: HTMLElement) =>
    [...toolbar.querySelectorAll('input, button')].map(
      (control) => control.getAttribute('aria-label') ?? control.textContent,
    );
  it('orders search, the feature controls and Columns, then Export CSV last', () => {
    render(
      <DataTable
        search="local"
        title="Ordered"
        rows={rows}
        columns={columns}
        exportName="ordered.csv"
        controls={<button type="button">Feature control</button>}
      />,
    );
    expect(order(screen.getByRole('group', { name: 'Ordered table controls' }))).toEqual([
      'Search Ordered',
      'Feature control',
      'Columns',
      'Export CSV',
    ]);
    // The export trigger leads with the Download glyph, like Filters and Columns lead with theirs.
    const icon = screen.getByRole('button', { name: 'Export CSV' }).firstElementChild;
    expect(icon).toHaveClass('lucide-download');
    expect(icon).toHaveAttribute('width', '14');
  });
  it('puts a feature export control in the last slot instead of the CSV dialog', () => {
    render(
      <DataTable
        search="none"
        title="Own export"
        rows={rows}
        columns={columns}
        showColumnMenu={false}
        exportName="unused.csv"
        exportControl={<button type="button">Repository export</button>}
        controls={<button type="button">Feature control</button>}
      />,
    );
    expect(order(screen.getByRole('group', { name: 'Own export table controls' }))).toEqual([
      'Feature control',
      'Repository export',
    ]);
    expect(screen.queryByRole('button', { name: 'Export CSV' })).not.toBeInTheDocument();
  });
});

describe('search modes', () => {
  const query = { search: 'keyboard', sort: '', descending: false, page: 1 };
  it.each([
    ['local', true, 1, '1 matching item'],
    ['external', false, 50, '250 matching items'],
    ['none', false, 50, '250 items'],
  ] as const)('%s: field %s, %i rows on the page, count "%s"', (search, field, shown, count) => {
    render(
      <DataTable
        search={search}
        title="Modes"
        rows={rows}
        columns={columns}
        initialQuery={query}
      />,
    );
    expect(screen.queryByRole('textbox', { name: 'Search Modes' }) !== null).toBe(field);
    expect(screen.getByRole('table').querySelectorAll('tbody tr')).toHaveLength(shown);
    expect(screen.getByText(count)).toBeVisible();
  });
  it('says "matching" for an external search only while its query is set', () => {
    const view = render(
      <DataTable search="external" title="External" rows={rows} columns={columns} />,
    );
    expect(screen.getByText('250 items')).toBeVisible();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    view.unmount();
    render(
      <DataTable
        search="external"
        title="External"
        rows={rows.slice(0, 1)}
        columns={columns}
        initialQuery={{ ...query, search: 'Item' }}
      />,
    );
    expect(screen.getByText('1 matching item')).toBeVisible();
  });
  it('says "matching" while the caller\'s filters narrow the rows, with no search text', () => {
    const view = render(
      <DataTable
        search="external"
        filtered
        title="Filtered"
        rows={rows.slice(0, 92)}
        columns={columns}
      />,
    );
    expect(screen.getByText('92 matching items')).toBeVisible();
    view.rerender(
      <DataTable
        search="none"
        filtered
        title="Filtered"
        rows={rows.slice(0, 1)}
        columns={columns}
      />,
    );
    expect(screen.getByText('1 matching item')).toBeVisible();
  });
  it.each([
    ['none', 'Adjust the selected scope.'],
    ['external', 'Adjust the selected scope or search.'],
  ] as const)('an empty %s table suggests: %s', (search, hint) => {
    render(<DataTable search={search} title="Nothing" rows={[]} columns={columns} />);
    expect(within(screen.getByRole('table')).getByRole('status')).toHaveTextContent(
      'No items' + hint,
    );
  });
});

describe('table footer', () => {
  it('stacks the sort note, footer note and legend under the count, with the pager beside them', () => {
    render(
      <DataTable
        search="none"
        title="Notes"
        rows={rows}
        columns={columns}
        valueColumns={[columns[0], { ...columns[1], sortNote: 'Missing values sort last.' }]}
        footerNote="One row per record."
        legend={['missing']}
        initialQuery={{ search: '', sort: 'count', descending: false, page: 1 }}
      />,
    );
    const count = screen.getByText('250 items');
    const notes = count.nextElementSibling!;
    expect([...notes.children].map((note) => note.textContent)).toEqual([
      'Missing values sort last.',
      'One row per record.',
      '— Not available or not applicable',
    ]);
    expect(notes.querySelector('[data-mark="missing"]')).toBeInTheDocument();
    const pager = screen.getByRole('navigation', { name: 'Notes pages' });
    expect(pager).toHaveTextContent('Page 1 of 5');
    expect(count.parentElement!.nextElementSibling).toBe(pager);
  });
  it('renders only the count on a single-page table without notes', () => {
    render(<DataTable search="none" title="Bare" rows={rows.slice(0, 3)} columns={columns} />);
    const count = screen.getByText('3 items');
    expect(count.nextElementSibling).toBeNull();
    expect(count.parentElement!.nextElementSibling).toBeNull();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
  });
});

it('disables sorting and pagination while an owning report is replacing its scope', () => {
  render(<DataTable search="local" title="Updating" rows={rows} columns={columns} disabled />);
  expect(screen.getByRole('button', { name: 'Count' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Columns' })).toBeDisabled();
  expect(screen.getByRole('table').querySelectorAll('tbody tr')).toHaveLength(50);
});

describe('sort headers', () => {
  const sortable: DataColumn<Row>[] = [
    { id: 'title', label: 'Title', value: (row) => row.title },
    { id: 'count', label: 'Count', align: 'right', value: (row) => row.count },
  ];
  const sorted = () =>
    screen
      .getAllByRole('columnheader')
      .filter((header) => header.getAttribute('aria-sort') !== 'none');
  it('names the sort button by its label alone while aria-sort carries the state', async () => {
    const user = userEvent.setup();
    render(<DataTable search="none" title="Sorting" rows={rows.slice(0, 3)} columns={sortable} />);
    const glyphs: string[] = [];
    for (const state of ['none', 'ascending', 'descending'] as const) {
      const button = screen.getByRole('button', { name: 'Count' });
      expect(screen.getByRole('columnheader', { name: 'Count' })).toHaveAttribute(
        'aria-sort',
        state,
      );
      expect(screen.getByRole('columnheader', { name: 'Title' })).toHaveAttribute(
        'aria-sort',
        'none',
      );
      expect(sorted()).toHaveLength(state === 'none' ? 0 : 1);
      // The glyph adds no text, so the label is the whole name in every state.
      expect(button).toHaveTextContent(/^Count$/);
      const glyph = button.querySelector('svg')!;
      expect(glyph).toHaveAttribute('aria-hidden', 'true');
      expect(glyph).toHaveAttribute('width', '12');
      glyphs.push(glyph.innerHTML);
      if (state !== 'descending') await user.click(button);
    }
    // Idle, ascending and descending each draw their own glyph.
    expect(new Set(glyphs).size).toBe(3);
  });
  it('puts the glyph before a numeric label and after a text label', () => {
    render(<DataTable search="none" title="Order" rows={rows.slice(0, 3)} columns={sortable} />);
    const count = screen.getByRole('button', { name: 'Count' });
    expect(count.firstElementChild!.querySelector('svg')).not.toBeNull();
    expect(count.lastElementChild).toHaveTextContent(/^Count$/);
    const title = screen.getByRole('button', { name: 'Title' });
    expect(title.firstElementChild).toHaveTextContent(/^Title$/);
    expect(title.lastElementChild!.querySelector('svg')).not.toBeNull();
  });
  it('describes a sort by a hidden column once, in the footer', () => {
    const view = render(
      <DataTable
        search="none"
        title="Hidden sort"
        rows={rows.slice(0, 3)}
        columns={[sortable[0], { ...sortable[1], group: 'Activity' }]}
        visibility={{ value: { count: false }, onChange: vi.fn() }}
        initialQuery={{ search: '', sort: 'count', descending: true, page: 1 }}
      />,
    );
    expect(
      screen.getAllByText('Sorted by Activity — Count (descending); its column is hidden.'),
    ).toHaveLength(1);
    expect(sorted()).toHaveLength(0);
    view.unmount();
    render(
      <DataTable
        search="none"
        title="Visible sort"
        rows={rows.slice(0, 3)}
        columns={sortable}
        initialQuery={{ search: '', sort: 'count', descending: true, page: 1 }}
      />,
    );
    expect(screen.queryByText(/^Sorted by/)).not.toBeInTheDocument();
  });
  it('describes a sort by a column outside the rendered window in the caller’s words', () => {
    const view = render(
      <DataTable
        search="none"
        title="Window sort"
        rows={rows.slice(0, 3)}
        columns={[sortable[0]]}
        valueColumns={sortable}
        offscreenSort={(id) =>
          id === 'count' ? { label: 'Sep 2026', where: 'outside the visible periods' } : undefined
        }
        initialQuery={{ search: '', sort: 'count', descending: false, page: 1 }}
      />,
    );
    expect(
      screen.getByText(
        'Sorted by Sep 2026 (ascending); its column is outside the visible periods.',
      ),
    ).toBeVisible();
    view.unmount();
    render(
      <DataTable
        search="none"
        title="Unnamed window sort"
        rows={rows.slice(0, 3)}
        columns={[sortable[0]]}
        valueColumns={sortable}
        initialQuery={{ search: '', sort: 'count', descending: false, page: 1 }}
      />,
    );
    expect(screen.queryByText(/^Sorted by/)).not.toBeInTheDocument();
  });
});

it('draws display-only group headings without changing names, menus or CSV headers', async () => {
  const user = userEvent.setup();
  const blobs: Blob[] = [];
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL(blob: Blob) {
        blobs.push(blob);
        return 'blob:headings';
      }
      static revokeObjectURL() {}
    },
  );
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  const headed: DataColumn<Row>[] = [
    { id: 'title', label: 'Title', value: (row) => row.title, pinned: true, hideable: false },
    {
      id: 'count',
      label: 'PRs authored',
      displayGroup: 'Authoring',
      align: 'right',
      value: (row) => row.count,
    },
    {
      id: 'double',
      label: 'Authored PRs merged',
      displayGroup: 'Authoring',
      align: 'right',
      value: (row) => (row.count === null ? null : row.count * 2),
    },
    { id: 'issues', label: 'Issues authored', displayGroup: 'Issues', value: () => 1 },
  ];
  render(
    <DataTable
      search="none"
      title="Headings"
      rows={rows.slice(2, 4)}
      columns={headed}
      exportName="headings.csv"
    />,
  );
  const table = screen.getByRole('table', { name: 'Headings' });
  const authoring = within(table).getByRole('columnheader', { name: 'Authoring' });
  expect(authoring).toHaveAttribute('scope', 'colgroup');
  expect(authoring).toHaveAttribute('colspan', '2');
  expect(within(table).getByRole('columnheader', { name: 'Issues' })).toHaveAttribute(
    'colspan',
    '1',
  );
  expect(within(table).getByRole('columnheader', { name: 'Title' })).toHaveAttribute(
    'rowspan',
    '2',
  );
  expect(
    within(table)
      .getAllByRole('button')
      .map((button) => button.textContent),
  ).toEqual(['Title', 'PRs authored', 'Authored PRs merged', 'Issues authored']);
  const cell = table.querySelector('tbody td[data-column="double"]')!;
  expect(cell.getAttribute('headers')!.split(' ')).toContain(authoring.id);
  await user.click(screen.getByRole('button', { name: 'Columns' }));
  expect(screen.getByRole('menuitemcheckbox', { name: 'Authored PRs merged' })).toBeVisible();
  await user.keyboard('{Escape}');
  await user.click(screen.getByRole('button', { name: 'Export CSV' }));
  await user.click(screen.getByRole('button', { name: 'Download CSV' }));
  const csv = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === 'string' ? resolve(reader.result) : reject(Error('Missing CSV'));
    reader.onerror = reject;
    reader.readAsText(blobs[0]);
  });
  expect(csv.split('\r\n')[0]).toBe(
    '"Title","PRs authored","Authored PRs merged","Issues authored"',
  );
});

it('marks the scroll area’s sideways edges as it scrolls', () => {
  render(<DataTable search="none" title="Edges" rows={rows.slice(0, 3)} columns={columns} />);
  const region = screen.getByRole('region', { name: 'Edges table scroll area' });
  const frame = region.parentElement!;
  let left = 0;
  Object.defineProperty(region, 'scrollWidth', { configurable: true, value: 1000 });
  Object.defineProperty(region, 'clientWidth', { configurable: true, value: 400 });
  Object.defineProperty(region, 'scrollLeft', { configurable: true, get: () => left });
  const scrollTo = (value: number) => {
    left = value;
    fireEvent.scroll(region);
  };
  scrollTo(0);
  expect(frame).not.toHaveAttribute('data-scrolled');
  expect(frame).toHaveAttribute('data-more');
  scrollTo(300);
  expect(frame).toHaveAttribute('data-scrolled');
  expect(frame).toHaveAttribute('data-more');
  scrollTo(600);
  expect(frame).toHaveAttribute('data-scrolled');
  expect(frame).not.toHaveAttribute('data-more');
});
