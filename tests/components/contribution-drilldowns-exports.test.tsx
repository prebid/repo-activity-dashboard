import { expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth/viewer', () => ({ requireViewer: () => Promise.resolve({ id: 'viewer' }) }));
import { cleanup, render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { contributionExportResponse } from '@/server/contribution-export';
import {
  ContributionDetailsView,
  contributionDetailColumns,
} from '@/features/contributions/contribution-details-view';
import { ContributionView } from '@/features/contributions/contribution-view';
import { contributionSample } from '@/mocks/contributions';
import {
  selectContributionPresentation,
  defaultContributionSelection,
} from '@/lib/presentation/contributions';
import { useLocalTableController } from '@/components/tables/local-data-table';
import type { ContributionPage } from '@/models/contribution-page';
import type { ReportMetric } from '@/models/contribution-metrics';
import { ContributionMetricLink } from '@/features/contributions/contribution-columns';
function data(
  metric?: ReportMetric,
  sample: ContributionPage['sample'] = 'reference',
  accountId?: string,
): ContributionPage {
  const source = contributionSample({ scenario: sample });
  return {
    area: 'contributors',
    sample,
    breakdown: 'members',
    returnTo: '/contributors?report.page=3',
    ...selectContributionPresentation(
      source,
      defaultContributionSelection(source),
      accountId ? { kind: 'contributor', accountId } : { kind: 'overview' },
      metric,
    ),
  };
}
function Preview({ page }: { page: ContributionPage }) {
  const controller = useLocalTableController({
    search: '',
    sort: page.details ? 'creditedAt' : 'authoredPrsMerged',
    descending: true,
    page: 1,
  });
  const links = {
    sample: page.sample,
    currentHref: '/contributors?report.page=3',
    context: page.report.context,
  };
  return page.details ? (
    <ContributionDetailsView
      page={page}
      details={page.details}
      controller={controller}
      links={links}
    />
  ) : (
    <ContributionView page={page} controller={controller} links={links} />
  );
}
it('names the credited account’s type after its handle, whose avatar badge is hidden from assistive technology', () => {
  render(<Preview page={data('approvalContributions')} />);
  const handle = within(screen.getByRole('table')).getAllByRole('link', {
    name: /GitHub profile for sample-alice/,
  })[0];
  // jsdom joins inline names without the spaces a browser inserts, so only the order is exact.
  expect(handle.closest('td')).toHaveAccessibleName(
    /^@sample-alice — GitHub profile for sample-alice \(sample placeholder\) ?Human$/,
  );
});
it('keeps display-name reports, GitHub handles and actor icons distinct without an extra action', () => {
  render(<Preview page={data()} />);
  const row = screen.getByRole('link', { name: 'Alice — view contribution report' }).closest('tr')!;
  expect(
    within(row).getByRole('link', { name: 'Alice — view contribution report' }),
  ).toHaveAttribute('href', expect.stringContaining('/contributors/account-alice?'));
  expect(within(row).getByRole('link', { name: /@sample-alice — GitHub profile/ })).toHaveAttribute(
    'href',
    'https://github.example/sample-alice',
  );
  expect(within(row).getByTitle('Human').querySelector('svg')).not.toBeNull();
  expect(screen.getByTitle('Prebid agent').querySelector('svg')).not.toBeNull();
  expect(screen.getByTitle('Bot').querySelector('svg')).not.toBeNull();
  expect(screen.queryByText('View report')).not.toBeInTheDocument();
});
it('opens metric-specific supporting links, preserves zero links and does not invent links for unavailable values', () => {
  render(<Preview page={data()} />);
  const row = screen.getByRole('link', { name: 'Alice — view contribution report' }).closest('tr')!;
  expect(
    within(row).getByRole('link', { name: 'Approval contributions: 3 — view supporting records' }),
  ).toHaveAttribute('href', expect.stringContaining('metric=approvalContributions'));
  expect(
    within(row).getByRole('link', { name: 'Merges performed: 0 — view supporting records' }),
  ).toHaveAttribute('href', expect.stringContaining('metric=mergesPerformed'));
  render(
    <ContributionMetricLink
      value={{ status: 'missing', value: null, reason: 'Unavailable' }}
      metric="prsAuthored"
      focus={{ kind: 'overview' }}
      links={{ sample: 'reference', currentHref: '/contributors' }}
    />,
  );
  expect(screen.getByTitle('Unavailable')).not.toHaveRole('link');
});
it('paginates a 240-PR supporting cohort without limiting it to current open PRs', async () => {
  const user = userEvent.setup();
  render(<Preview page={data('prsAuthored', 'large', 'account-heavy-agent')} />);
  expect(screen.getByRole('region', { name: 'Supporting record totals' })).toHaveTextContent('240');
  const table = screen.getByRole('table');
  expect(table.querySelectorAll('tbody tr')).toHaveLength(50);
  await user.click(screen.getByRole('button', { name: 'Next' }));
  expect(screen.getByText('Page 2 of 5')).toBeVisible();
  await user.type(
    screen.getByRole('textbox', { name: 'Search PRs authored' }),
    'closed without merging',
  );
  expect(table.querySelectorAll('tbody tr')).toHaveLength(1);
  expect(table).toHaveTextContent('Closed');
  const record = within(table).getByRole('link', { name: /#1001/ });
  expect(record).toHaveAttribute('target', '_blank');
  expect(record).toHaveAttribute('href', expect.stringContaining('github.example'));
  expect(screen.getByRole('link', { name: 'Back to report' })).toHaveAttribute(
    'href',
    '/contributors?report.page=3',
  );
});
it('shows each supporting record’s state as the label its search and CSV value carry', () => {
  for (const [metric, labels] of [
    ['prsAuthored', ['Draft', 'Merged', 'Open']],
    ['issuesAuthored', ['Closed', 'Open']],
  ] as const) {
    const page = data(metric);
    const view = render(<Preview page={page} />);
    const state = contributionDetailColumns(page.details!).find((column) => column.id === 'state')!;
    const cells = [...screen.getByRole('table').querySelectorAll('tbody [data-column="state"]')];
    // Every row fits on one page, so the shown labels and the row values match as multisets.
    expect(cells).toHaveLength(page.details!.rows.length);
    const shown = cells.map((cell) => cell.textContent);
    expect([...shown].sort()).toEqual(page.details!.rows.map((row) => state.value(row)).sort());
    expect([...new Set(shown)].sort()).toEqual(labels);
    // The status glyph is decorative; the label is the cell's text.
    for (const cell of cells)
      expect(cell.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    view.unmount();
  }
});
it.each(['prComments', 'reviewed.filesChanged', 'issuesAuthored', 'issueComments'] as const)(
  'describes the units and dates in %s details',
  (metric) => {
    render(<Preview page={data(metric)} />);
    expect(screen.getByRole('region', { name: 'Supporting record totals' })).toBeVisible();
    expect(screen.getByRole('table')).toBeVisible();
    if (metric === 'prComments' || metric === 'issueComments')
      expect(screen.getByRole('button', { name: /Last comment/ })).toBeVisible();
    if (metric === 'reviewed.filesChanged')
      expect(screen.getByRole('button', { name: /Merged on/ })).toBeVisible();
  },
);
it('shows unavailable detail coverage with an empty supporting list', async () => {
  const user = userEvent.setup();
  const state = () =>
    screen
      .getByRole('heading', { name: 'No supporting records in this scope' })
      .closest('[data-kind]');
  render(<Preview page={data('approvalContributions', 'missing')} />);
  expect(screen.getByLabelText('Detail coverage')).toHaveTextContent('missing history is not zero');
  expect(
    screen.getByRole('heading', { name: 'No supporting records in this scope' }),
  ).toBeVisible();
  // Unavailable values leave the list empty: the missing state, never the empty-result one.
  expect(state()).toHaveAttribute('data-kind', 'missing');
  cleanup();
  const empty = data('approvalContributions', 'empty');
  expect(empty.details?.measurement.status).toBe('complete');
  expect(empty.details?.rows).toEqual([]);
  render(<Preview page={empty} />);
  expect(state()).toHaveAttribute('data-kind', 'empty');
  cleanup();
  render(<Preview page={data('approvalContributions')} />);
  await user.type(
    screen.getByRole('textbox', { name: 'Search Approval contributions' }),
    'no such record',
  );
  expect(state()).toHaveAttribute('data-kind', 'no-match');
});
it('selects export metrics/layout, sends pending search, and recovers from failed and redirected downloads', async () => {
  const user = userEvent.setup();
  render(<Preview page={data()} />);
  await user.type(screen.getByRole('textbox', { name: 'Search Contributors' }), 'Alice');
  await user.click(screen.getByRole('button', { name: 'Export CSV' }));
  const dialog = screen.getByRole('dialog', { name: 'Contributors CSV export' });
  await user.click(within(dialog).getByRole('radio', { name: 'By repository' }));
  await user.click(within(dialog).getByRole('button', { name: 'All columns' }));
  expect(within(dialog).getByText('42 selected')).toBeVisible();
  await user.click(within(dialog).getByRole('button', { name: 'Clear selection' }));
  expect(within(dialog).getByText('1 selected')).toBeVisible();
  expect(within(dialog).getByRole('button', { name: 'Download CSV' })).toBeEnabled();
  await user.click(within(dialog).getByRole('button', { name: 'Visible columns' }));
  expect(within(dialog).getByText('9 selected')).toBeVisible();
  await user.click(within(dialog).getByRole('checkbox', { name: 'PRs authored' }));
  await user.click(within(dialog).getByRole('radio', { name: 'By repository' }));
  const fetchMock = vi
    .fn<typeof fetch>()
    .mockRejectedValueOnce(Error('offline'))
    .mockResolvedValueOnce({
      ok: true,
      redirected: true,
      headers: new Headers({ 'content-type': 'text/html' }),
    } as Response)
    .mockResolvedValue(
      new Response('csv', { headers: { 'content-type': 'text/csv; charset=utf-8' } }),
    );
  vi.stubGlobal('fetch', fetchMock);
  for (let i = 0; i < 2; i++) {
    await user.click(within(dialog).getByRole('button', { name: 'Download CSV' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Export failed');
  }
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  const create = vi.fn(() => 'blob:export'),
    revoke = vi.fn();
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL = create;
      static revokeObjectURL = revoke;
    },
  );
  await user.click(within(dialog).getByRole('button', { name: 'Download CSV' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  const requested = fetchMock.mock.calls[2][0];
  if (typeof requested !== 'string') throw Error('Expected a relative export URL');
  expect(requested).toBe('/contributors/export');
  expect(fetchMock.mock.calls[2][1]?.method).toBe('POST');
  const encoded = fetchMock.mock.calls[2][1]?.body;
  if (typeof encoded !== 'string') throw Error('Expected JSON request body');
  const body = JSON.parse(encoded) as { query: string };
  const url = new URL('/contributors/export?' + body.query, 'http://localhost');
  expect(url.searchParams.get('layout')).toBe('repositories');
  expect(url.searchParams.get('export.q')).toBe('Alice');
  expect(url.searchParams.getAll('column')).not.toContain('prsAuthored');
  expect(create).toHaveBeenCalledOnce();
  expect(click).toHaveBeenCalledOnce();
  expect(revoke).toHaveBeenCalledWith('blob:export');
});

it('keeps accessible metric names consistent with formatted thousands and partial values', () => {
  const page = data();
  render(
    <ContributionMetricLink
      value={{ status: 'partial', value: 1234, reason: 'Some records are missing' }}
      metric="prsAuthored"
      focus={{ kind: 'overview' }}
      links={{ sample: 'reference', currentHref: '/contributors', context: page.report.context }}
    />,
  );
  expect(
    screen.getByRole('link', {
      name: 'PRs authored: 1,234 (partial subtotal) — view supporting records',
    }),
  ).toHaveTextContent('1,234');
});

it('heads the core metrics Authoring, Reviewing and Issues on screen only, leaving menus and CSV headers as they were', async () => {
  const user = userEvent.setup();
  const core = [
    'PRs authored',
    'Authored PRs merged',
    'Reviewer contributions',
    'Approval contributions',
    'Merges performed',
    'Issues authored',
  ];
  const heading = /Authoring|Reviewing|Issues —/;
  render(<Preview page={data()} />);
  const table = screen.getByRole('table');
  for (const [name, span] of [
    ['Authoring', '2'],
    ['Reviewing', '3'],
    ['Issues', '1'],
  ]) {
    const header = within(table).getByRole('columnheader', { name });
    expect(header).toHaveAttribute('scope', 'colgroup');
    expect(header).toHaveAttribute('colspan', span);
  }
  const [groups, metrics] = table.querySelectorAll('thead tr');
  expect([...groups.querySelectorAll('th')].map((cell) => cell.textContent)).toEqual([
    'Contributor',
    'Account type',
    'Company',
    'Authoring',
    'Reviewing',
    'Issues',
  ]);
  // The metric columns keep their order, and each sort button is named by its label alone.
  expect(
    within(metrics as HTMLElement)
      .getAllByRole('button')
      .map((button) => button.textContent),
  ).toEqual(core);
  for (const label of core)
    expect(within(table).getByRole('button', { name: label })).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Columns' }));
  for (const label of core)
    expect(screen.getByRole('menuitemcheckbox', { name: label })).toBeVisible();
  expect(
    screen.getAllByRole('menuitemcheckbox').filter((item) => heading.test(item.textContent)),
  ).toEqual([]);
  await user.keyboard('{Escape}');
  await user.click(screen.getByRole('button', { name: 'Column definitions for Contributors' }));
  const definitions = screen.getByRole('dialog');
  for (const label of core)
    expect(within(definitions).getByText(label, { exact: true })).toBeVisible();
  expect(definitions).not.toHaveTextContent(heading);
  await user.keyboard('{Escape}');
  await user.click(screen.getByRole('button', { name: 'Export CSV' }));
  const dialog = screen.getByRole('dialog', { name: 'Contributors CSV export' });
  for (const label of core)
    expect(within(dialog).getByRole('checkbox', { name: label })).toBeChecked();
  expect(dialog).not.toHaveTextContent(heading);
  // The visible-columns download runs through the export route that serves the CSV.
  vi.stubGlobal('fetch', (path: string, init: RequestInit) =>
    contributionExportResponse(
      new Request('https://dashboard.test' + path, {
        method: init.method,
        headers: init.headers,
        body: init.body,
      }),
      'contributors',
    ),
  );
  let file: Blob | undefined;
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL = (blob: Blob) => {
        file = blob;
        return 'blob:export';
      };
      static revokeObjectURL = () => {};
    },
  );
  await user.click(within(dialog).getByRole('button', { name: 'Download CSV' }));
  await waitFor(() => expect(file).toBeDefined());
  const [header] = (await file!.text()).split('\r\n');
  expect(header.slice(1, -1).split('","')).toEqual([
    'Entity type',
    'Entity ID',
    'Name',
    'GitHub account',
    'Account type',
    'Company ID',
    'Current company',
    'Repository ID',
    'Repository',
    ...core.flatMap((label) => [
      label,
      label + ' coverage',
      label + ' coverage detail',
      label + ' counting basis',
    ]),
    'Export layout',
    'Hide zero member totals',
    'Metric ordering',
    'Data source',
    'Sample scenario',
    'Period start (UTC)',
    'Period end (UTC)',
    'End inclusive',
    'Snapshot (UTC)',
    'Company attribution',
    'Report focus',
    'Report selection',
    'Table search',
    'Sorted by',
    'Sort direction',
  ]);
});
