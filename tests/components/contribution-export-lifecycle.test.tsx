import { afterEach, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DataTable } from '@/components/tables/data-table';
import { contributionCsvAlternatives } from '@/features/contributions/contribution-csv-export';
import { useLocalTableController } from '@/components/tables/local-data-table';
import { contributionSample } from '@/mocks/contributions';
import { selectContributions } from '@/lib/presentation/contributions';
import type { ContributionPage } from '@/models/contribution-page';
const page: ContributionPage = {
  area: 'contributors',
  sample: 'reference',
  breakdown: 'members',
  returnTo: '/contributors',
  report: selectContributions(contributionSample()),
};
function Preview({ data = page }: { data?: ContributionPage }) {
  const controller = useLocalTableController({
    search: '',
    sort: 'name',
    descending: false,
    page: 1,
  });
  if (data.report.kind !== 'overview') throw Error('Expected overview');
  return (
    <DataTable
      title="Contributors"
      rows={data.report.contributors}
      columns={[
        { id: 'name', label: 'Contributor', hideable: false, value: (row) => row.account.name },
        { id: 'prsAuthored', label: 'PRs authored', value: (row) => row.metrics.prsAuthored.value },
      ]}
      controller={controller}
      exportName="test.csv"
      csvAlternatives={contributionCsvAlternatives(data)}
      exportContextKey={JSON.stringify([data.area, data.report.context])}
    />
  );
}
afterEach(() => vi.useRealTimers());
function stall() {
  const signals: AbortSignal[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal;
          if (!signal) throw Error('Missing abort signal');
          signals.push(signal);
          signal.addEventListener(
            'abort',
            () => reject(new DOMException('Aborted', 'AbortError')),
            { once: true },
          );
        }),
    ),
  );
  return signals;
}
async function start(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Export CSV' }));
  await user.click(screen.getByRole('radio', { name: 'By repository' }));
  await user.click(screen.getByRole('button', { name: 'Download CSV' }));
}
it('allows cancellation and aborts the stalled request without reporting an export failure', async () => {
  const user = userEvent.setup(),
    signals = stall();
  render(<Preview />);
  await start(user);
  expect(screen.getByRole('button', { name: 'Preparing export…' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled();
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(signals).toHaveLength(1);
  expect(signals[0].aborted).toBe(true);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  await start(user);
  expect(signals).toHaveLength(2);
  expect(signals[1].aborted).toBe(false);
  await user.keyboard('{Escape}');
  expect(signals[1].aborted).toBe(true);
});
it('bounds a stalled export at 30 seconds and restores a usable retry action', async () => {
  vi.useFakeTimers();
  const signals = stall();
  render(<Preview />);
  fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
  fireEvent.click(screen.getByRole('radio', { name: 'By repository' }));
  fireEvent.click(screen.getByRole('button', { name: 'Download CSV' }));
  await act(async () => {
    vi.advanceTimersByTime(30_000);
    await Promise.resolve();
  });
  expect(signals).toHaveLength(1);
  expect(signals[0].aborted).toBe(true);
  expect(screen.getByRole('alert')).toHaveTextContent('Export took too long. Try again.');
  expect(screen.getByRole('button', { name: 'Download CSV' })).toBeEnabled();
});
it('cancels on scope change and unmount rather than completing an export for a departed report', async () => {
  const user = userEvent.setup(),
    signals = stall();
  const { rerender, unmount } = render(<Preview />);
  await start(user);
  rerender(<Preview data={{ ...page, area: 'companies' }} />);
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(signals[0].aborted).toBe(true);
  await start(user);
  unmount();
  expect(signals[1].aborted).toBe(true);
});
it('does not download a response that arrives after cancellation or disrupt a newer request', async () => {
  const user = userEvent.setup();
  let resolveFirst!: (value: Response) => void;
  const fetchMock = vi
    .fn<typeof fetch>()
    .mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          resolveFirst = resolve;
        }),
    )
    .mockImplementation(() => new Promise<Response>(() => {}));
  vi.stubGlobal('fetch', fetchMock);
  const create = vi.fn(() => 'blob:test');
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL = create;
      static revokeObjectURL = vi.fn();
    },
  );
  render(<Preview />);
  await start(user);
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  await start(user);
  await act(async () => {
    resolveFirst(new Response('old data', { headers: { 'content-type': 'text/csv' } }));
    await Promise.resolve();
  });
  expect(create).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Preparing export…' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
});
