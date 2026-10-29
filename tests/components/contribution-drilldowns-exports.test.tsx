import { expect, it, vi } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ContributionDetailsView } from '@/features/contributions/contribution-details-view';
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
it('shows unavailable detail coverage with an empty supporting list', () => {
  render(<Preview page={data('approvalContributions', 'missing')} />);
  expect(screen.getByLabelText('Detail coverage')).toHaveTextContent('missing history is not zero');
  expect(
    screen.getByRole('heading', { name: 'No supporting records in this scope' }),
  ).toBeVisible();
});
it('selects export metrics/layout, sends pending search, and recovers from failed and redirected downloads', async () => {
  const user = userEvent.setup();
  render(<Preview page={data()} />);
  await user.type(screen.getByRole('textbox', { name: 'Search Contributors' }), 'Alice');
  await user.click(screen.getByRole('button', { name: 'Export CSV' }));
  const dialog = screen.getByRole('dialog', { name: 'Contributors CSV export' });
  await user.click(within(dialog).getByRole('radio', { name: 'By repository' }));
  await user.click(within(dialog).getByRole('button', { name: 'All columns' }));
  expect(within(dialog).getByText('39 selected')).toBeVisible();
  await user.click(within(dialog).getByRole('button', { name: 'Clear selection' }));
  expect(within(dialog).getByRole('button', { name: 'Download CSV' })).toBeDisabled();
  await user.click(within(dialog).getByRole('button', { name: 'Visible columns' }));
  expect(within(dialog).getByText('6 selected')).toBeVisible();
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
  const url = new URL(requested, 'http://localhost');
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
