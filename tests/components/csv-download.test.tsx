import { afterEach, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { postCsv, StaleExportError } from '@/components/exports/csv-download';
import { CsvExportDialog } from '@/components/exports/csv-export-dialog';

afterEach(() => vi.unstubAllGlobals());
function respond(status: number, type = 'text/csv; charset=utf-8', redirected = false) {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => {
      const response = new Response('a,b', { status, headers: { 'content-type': type } });
      Object.defineProperty(response, 'redirected', { value: redirected });
      return Promise.resolve(response);
    }),
  );
}
it('accepts only an authenticated CSV response and names a stale source', async () => {
  respond(200);
  expect(await (await postCsv('/export', { query: 'x' })).text()).toBe('a,b');
  respond(409, 'text/plain');
  await expect(postCsv('/export', {})).rejects.toBeInstanceOf(StaleExportError);
  respond(200, 'text/html');
  await expect(postCsv('/export', {})).rejects.toThrow('CSV export unavailable');
  respond(200, 'text/csv', true);
  await expect(postCsv('/export', {})).rejects.toThrow('CSV export unavailable');
});
it('tells the user to reload when the report changed before export', async () => {
  render(
    <CsvExportDialog
      title="Timeline"
      columns={[{ id: 'period', label: 'Period', required: true }]}
      visibleColumnIds={['period']}
      contextKey="a"
      onDownload={() => Promise.reject(new StaleExportError())}
    />,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
  await userEvent.click(screen.getByRole('button', { name: /^Download/ }));
  expect(
    await screen.findByText('The report data changed. Reload the page before exporting.'),
  ).toBeVisible();
});
