import { expect, it, vi } from 'vitest';
import type { MouseEvent } from 'react';
import { render, screen, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ContributionView } from '@/features/contributions/contribution-view';
import {
  contributionExportColumns,
  contributorExportColumns,
  contributorColumns,
  companyColumns,
  repositoryContributionColumns,
} from '@/features/contributions/contribution-columns';
import { contributionSample } from '@/mocks/contributions';
import { selectContributions } from '@/lib/presentation/contributions';
import { useLocalTableController } from '@/components/tables/local-data-table';
import { contributionDefaultSort } from '@/models/contributions';
import type { ContributionPage } from '@/models/contribution-page';

function page(
  options: {
    sample?: ContributionPage['sample'];
    area?: ContributionPage['area'];
    focus?: ContributionPage['report']['context']['focus'];
    breakdown?: ContributionPage['breakdown'];
  } = {},
): ContributionPage {
  const sample = options.sample ?? 'reference';
  return {
    sample,
    area: options.area ?? 'contributors',
    breakdown: options.breakdown ?? 'members',
    returnTo: '/contributors?report.page=2',
    report: selectContributions(contributionSample({ scenario: sample }), undefined, options.focus),
  };
}
function Preview({
  data,
  onFollow,
}: {
  data: ContributionPage;
  onFollow?: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  const controller = useLocalTableController({ search: '', page: 1, ...contributionDefaultSort });
  return (
    <ContributionView
      page={data}
      controller={controller}
      links={{ sample: data.sample, currentHref: '/contributors?report.page=2', onFollow }}
      breakdownControls={<nav aria-label="Company breakdown">By contributor / By repository</nav>}
    />
  );
}
it('renders the full overview with the approved default sort and independent metrics', async () => {
  const user = userEvent.setup();
  const onFollow = vi.fn((event: MouseEvent<HTMLAnchorElement>) => event.preventDefault());
  render(<Preview data={page()} onFollow={onFollow} />);
  expect(screen.getByRole('heading', { name: 'Contributors', level: 1 })).toBeVisible();
  const table = screen.getByRole('table');
  expect(table.querySelectorAll('tbody tr')).toHaveLength(7);
  expect(within(table).getByRole('columnheader', { name: /Authored PRs merged/ })).toHaveAttribute(
    'aria-sort',
    'descending',
  );
  expect(table.querySelector('tbody tr [data-column="name"]')).toHaveTextContent('Carol');
  const profile = within(table).getByRole('link', {
    name: /GitHub profile for sample-alice \(sample placeholder\)/,
  });
  expect(profile).toHaveAttribute('href', 'https://github.example/sample-alice');
  expect(profile).toHaveAttribute('target', '_blank');
  const alice = within(table).getByRole('link', { name: 'Alice — view contribution report' });
  expect(alice).toHaveAttribute(
    'href',
    '/contributors/account-alice?returnTo=%2Fcontributors%3Freport.page%3D2',
  );
  fireEvent.click(alice);
  expect(onFollow).toHaveBeenCalledOnce();
  await user.type(screen.getByRole('textbox', { name: 'Search Contributors' }), 'sample-agent');
  expect(table.querySelectorAll('tbody tr')).toHaveLength(1);
  expect(table).toHaveTextContent('Prebid sample agent');
  expect(screen.queryByRole('link', { name: 'Groups' })).not.toBeInTheDocument();
});
it('shows company totals rather than truncated member sums and links unmapped accounts explicitly', () => {
  render(<Preview data={page({ area: 'companies' })} />);
  const table = screen.getByRole('table');
  expect(table.querySelectorAll('tbody tr')).toHaveLength(4);
  expect(within(table).getByRole('link', { name: 'Example Acme' })).toHaveAttribute(
    'href',
    '/companies/id/company-acme?returnTo=%2Fcontributors%3Freport.page%3D2',
  );
  expect(within(table).getByRole('link', { name: 'Unmapped company' })).toHaveAttribute(
    'href',
    '/companies/unmapped?returnTo=%2Fcontributors%3Freport.page%3D2',
  );
});
it('renders a contributor’s independent totals and only relevant repository rows', () => {
  render(<Preview data={page({ focus: { kind: 'contributor', accountId: 'account-alice' } })} />);
  expect(screen.getByRole('heading', { name: 'Alice', level: 1 })).toBeVisible();
  expect(screen.getByRole('link', { name: 'Back to report' })).toHaveAttribute(
    'href',
    '/contributors?report.page=2',
  );
  const totals = screen.getByRole('region', { name: 'Report totals' });
  expect([...totals.querySelectorAll('dd')].map((node) => node.textContent)).toEqual([
    '2',
    '1',
    '2',
    '3',
    '0',
    '1',
  ]);
  expect(screen.getByRole('table').querySelectorAll('tbody tr')).toHaveLength(2);
  expect(within(totals).queryByRole('link')).not.toBeInTheDocument();
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
});
it('keeps zero-contribution company members visible and supports its repository layout', () => {
  const data = page({ area: 'companies', focus: { kind: 'company', companyId: 'company-acme' } });
  const view = render(<Preview data={data} />);
  expect(screen.getByRole('heading', { name: 'Example Acme', level: 1 })).toBeVisible();
  expect(screen.getByRole('table').querySelectorAll('tbody tr')).toHaveLength(3);
  expect(screen.getByRole('link', { name: 'Eve — view contribution report' })).toBeVisible();
  expect(screen.getByRole('navigation', { name: 'Company breakdown' })).toBeVisible();
  view.rerender(<Preview data={{ ...data, breakdown: 'repositories' }} />);
  expect(screen.getByRole('table').querySelectorAll('tbody tr')).toHaveLength(2);
});
it('renders unmapped company context without claiming a company affiliation', () => {
  render(
    <Preview data={page({ area: 'companies', focus: { kind: 'company', companyId: null } })} />,
  );
  expect(screen.getByRole('heading', { name: 'Unmapped company', level: 1 })).toBeVisible();
  expect(screen.getByRole('table').querySelectorAll('tbody tr')).toHaveLength(2);
});
it('keeps empty, partial and missing coverage distinct', () => {
  const view = render(<Preview data={page({ sample: 'empty' })} />);
  expect(
    screen.getByRole('heading', { name: 'No counted contributions in this period' }),
  ).toBeVisible();
  view.rerender(<Preview data={page({ sample: 'partial' })} />);
  expect(screen.getByLabelText('Data coverage')).toHaveTextContent('incomplete');
  expect(screen.getByRole('table').querySelector('sup')).toBeInTheDocument();
  view.rerender(<Preview data={page({ sample: 'missing' })} />);
  expect(screen.getByLabelText('Data coverage')).toHaveTextContent('unavailable');
  expect(screen.getByRole('table').querySelector('[data-column="prsAuthored"]')).toHaveTextContent(
    '—',
  );
});
it('paginates 251 accounts at 50 rows and searches by the displayed account identity', async () => {
  const user = userEvent.setup();
  render(<Preview data={page({ sample: 'large' })} />);
  expect(screen.getByRole('table').querySelectorAll('tbody tr')).toHaveLength(50);
  expect(screen.getByText('Page 1 of 6')).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Next' }));
  expect(screen.getByText('Page 2 of 6')).toBeVisible();
  await user.type(
    screen.getByRole('textbox', { name: 'Search Contributors' }),
    'sample-heavy-agent',
  );
  expect(screen.getByRole('table').querySelectorAll('tbody tr')).toHaveLength(1);
  expect(screen.getByText('Page 1 of 1')).toBeVisible();
  expect(screen.getByRole('table').querySelector('[data-column="prsAuthored"]')).toHaveTextContent(
    '240',
  );
  expect(
    screen.getByRole('table').querySelector('[data-column="issuesAuthored"]'),
  ).toHaveTextContent('350');
});
it('exports numeric values plus coverage and scope, independently of the compact identity display', () => {
  const data = page({ sample: 'partial' });
  if (data.report.kind !== 'overview') throw Error('Expected overview');
  const links = { sample: data.sample, currentHref: '/contributors' };
  const cols = contributorColumns(links);
  const exported = contributorExportColumns(cols, data.report.context, {
    search: 'Alice',
    ...contributionDefaultSort,
  });
  const alice = data.report.contributors.find((row) => row.id === 'account-alice')!;
  const values = Object.fromEntries(exported.map((col) => [col.id, col.value(alice)]));
  expect(values).toMatchObject({
    name: 'Alice',
    tableSearch: 'Alice',
    tableSort: 'authoredPrsMerged',
    tableDirection: 'desc',
    login: 'sample-alice',
    actorType: 'human',
    companyId: 'company-acme',
    approvalContributions: 2,
    'approvalContributions.coverage': 'partial',
    source: 'sample',
    attribution: 'current-mapping',
  });
  expect(values['approvalContributions.reason']).toContain('unestablished');
  const memberExport = contributorExportColumns(
    contributorColumns(links, false),
    data.report.context,
    { search: '', ...contributionDefaultSort },
  );
  expect(memberExport.find((col) => col.id === 'company')!.value(alice)).toBe('Example Acme');
  const company = data.report.companies[0];
  const companyExport = contributionExportColumns(companyColumns(links), data.report.context, {
    search: '',
    ...contributionDefaultSort,
  });
  expect(companyExport.find((col) => col.id === 'members')!.value(company)).toBe(3);
  const repositoryReport = selectContributions(contributionSample(), undefined, {
    kind: 'contributor',
    accountId: 'account-alice',
  });
  if (repositoryReport.kind !== 'contributor') throw Error('Expected contributor');
  expect(repositoryContributionColumns()[0].value(repositoryReport.repositories[0])).toBe(
    'Prebid.js',
  );
});

it('keeps account type visible and exposes the full optional volume groups through Columns', async () => {
  const user = userEvent.setup();
  render(<Preview data={page()} />);
  const table = screen.getByRole('table');
  expect(within(table).getByRole('columnheader', { name: 'Account type' })).toBeVisible();
  expect(table.querySelector('[data-column="authored.filesChanged"]')).not.toBeInTheDocument();
  expect(table.querySelector('[data-actor]')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Columns' }));
  await user.click(screen.getByRole('menuitemcheckbox', { name: 'Authored merged PR volume' }));
  await user.keyboard('{Escape}');
  expect(table.querySelector('[data-column="authored.filesChanged"]')).toHaveTextContent('13');
  expect(table.querySelector('[data-column="authored.filesTypeChanged"]')).toBeInTheDocument();
  expect(table.querySelector('[data-column="authored.linesAdded"]')).toBeInTheDocument();
  expect(table.querySelector('[data-column="authored.linesRemoved"]')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Column definitions for Contributors' }));
  const help = screen.getByRole('dialog');
  expect(within(help).getByText('Authored merged PR volume — Files changed')).toBeVisible();
  expect(
    within(help).getByText(
      /The total includes added, removed, modified, renamed, copied and type-changed files/,
    ),
  ).toBeVisible();
});

it('does not label a default-visible controlled metric as hidden', () => {
  function Controlled() {
    const controller = useLocalTableController({
      search: '',
      sort: 'prComments',
      descending: true,
      page: 1,
    });
    return (
      <ContributionView
        page={page()}
        controller={controller}
        links={{ sample: 'reference', currentHref: '/contributors' }}
        visibility={{ value: {}, onChange: vi.fn() }}
      />
    );
  }
  render(<Controlled />);
  expect(screen.getByRole('columnheader', { name: /PR comments/ })).toBeVisible();
  expect(screen.queryByText(/its column is hidden/)).not.toBeInTheDocument();
});

it('shows an empty report state when every selected repository is confirmed zero', () => {
  render(<Preview data={page({ focus: { kind: 'contributor', accountId: 'account-eve' } })} />);
  expect(
    screen.getByRole('heading', { name: 'No counted contributions in this period' }),
  ).toBeVisible();
  expect(screen.getByRole('region', { name: 'Report totals' }).querySelectorAll('dd')).toHaveLength(
    6,
  );
  expect(screen.queryByText('Prebid Server (Go)')).not.toBeInTheDocument();
});
