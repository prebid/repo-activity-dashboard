import { contributionReturnHref } from '@/lib/presentation/contribution-return';
import { expect, it, vi } from 'vitest';
import type { MouseEvent } from 'react';
import { render, screen, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ContributionView } from '@/features/contributions/contribution-view';

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
    report: selectContributions(
      contributionSample({ scenario: sample }),
      undefined,
      options.focus,
      options,
    ),
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
  expect(within(table).getByRole('columnheader', { name: 'Authored PRs merged' })).toHaveAttribute(
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
  const aliceUrl = new URL(alice.getAttribute('href')!, 'https://dashboard.test');
  expect(aliceUrl.pathname).toBe('/contributors/account-alice');
  expect(contributionReturnHref(aliceUrl.searchParams, '/companies')).toBe(
    '/contributors?report.page=2',
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
  const companyUrl = new URL(
    within(table).getByRole('link', { name: 'Example Acme' }).getAttribute('href')!,
    'https://dashboard.test',
  );
  expect(companyUrl.pathname).toBe('/companies/id/company-acme');
  expect(contributionReturnHref(companyUrl.searchParams, '/companies')).toBe(
    '/contributors?report.page=2',
  );
  const unmappedUrl = new URL(
    within(table).getByRole('link', { name: 'Unmapped company' }).getAttribute('href')!,
    'https://dashboard.test',
  );
  expect(unmappedUrl.pathname).toBe('/companies/unmapped');
  expect(contributionReturnHref(unmappedUrl.searchParams, '/companies')).toBe(
    '/contributors?report.page=2',
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
  // The breakdown switch is header content inside the table panel, above its scroll area.
  const members = screen.getByRole('region', { name: 'Company contributors' });
  const breakdown = within(members).getByRole('navigation', { name: 'Company breakdown' });
  expect(breakdown).toBeVisible();
  expect(
    breakdown.compareDocumentPosition(
      within(members).getByRole('region', { name: 'Company contributors table scroll area' }),
    ) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  view.rerender(
    <Preview
      data={page({
        area: 'companies',
        sample: data.sample,
        focus: data.report.context.focus,
        breakdown: 'repositories',
      })}
    />,
  );
  expect(screen.getByRole('table').querySelectorAll('tbody tr')).toHaveLength(2);
  expect(
    within(screen.getByRole('region', { name: 'By repository' })).getByRole('navigation', {
      name: 'Company breakdown',
    }),
  ).toBeVisible();
  // The repository breakdown has no table search.
  expect(screen.queryByRole('textbox', { name: 'Search By repository' })).not.toBeInTheDocument();
});
it('shows identities as avatars, with the account type, company monograms, the unmapped bucket and a 48px heading slot', () => {
  const avatar = (scope: Element, size: 32 | 48) =>
    scope.querySelector<HTMLElement>(`[data-kind][data-size="${size}"]`);
  const heading = () => screen.getByRole('heading', { level: 1 }).closest('header')!;
  const view = render(<Preview data={page()} />);
  const alice = screen
    .getByRole('link', { name: 'Alice — view contribution report' })
    .closest('td')!;
  expect(avatar(alice, 32)).toHaveAttribute('data-kind', 'person');
  expect(avatar(alice, 32)).toHaveAttribute('title', 'Human');
  expect(avatar(alice, 32)).toHaveTextContent(/^A$/);
  expect(avatar(heading(), 48)).toBeNull();
  view.rerender(<Preview data={page({ area: 'companies' })} />);
  const acme = screen.getByRole('link', { name: 'Example Acme' }).closest('td')!;
  expect(avatar(acme, 32)).toHaveAttribute('data-kind', 'company');
  expect(avatar(acme, 32)).toHaveTextContent(/^EA$/);
  const unmapped = screen.getByRole('link', { name: 'Unmapped company' }).closest('td')!;
  expect(avatar(unmapped, 32)).toHaveAttribute('data-kind', 'unmapped-company');
  view.rerender(
    <Preview data={page({ focus: { kind: 'contributor', accountId: 'account-alice' } })} />,
  );
  expect(avatar(heading(), 48)).toHaveAttribute('data-kind', 'person');
  expect(avatar(heading(), 48)).toHaveAttribute('title', 'Human');
  view.rerender(
    <Preview
      data={page({ area: 'companies', focus: { kind: 'company', companyId: 'company-acme' } })}
    />,
  );
  expect(avatar(heading(), 48)).toHaveAttribute('data-kind', 'company');
  view.rerender(
    <Preview data={page({ area: 'companies', focus: { kind: 'company', companyId: null } })} />,
  );
  expect(avatar(heading(), 48)).toHaveAttribute('data-kind', 'unmapped-company');
});
it('names the account type in the identity cell, whose avatar badge is hidden from assistive technology', () => {
  render(<Preview data={page()} />);
  const table = screen.getByRole('table');
  for (const [name, login, type] of [
    ['Alice', 'sample-alice', 'Human'],
    ['Prebid sample agent', 'sample-agent', 'Prebid agent'],
  ] as const) {
    const cell = within(table)
      .getByRole('link', { name: name + ' — view contribution report' })
      .closest('td')!;
    // jsdom joins inline names without the spaces a browser inserts, so only the order is exact.
    expect(cell).toHaveAccessibleName(
      new RegExp(
        `^${name} — view contribution report ?@${login} — GitHub profile for ${login} \\(sample placeholder\\) ?${type}$`,
      ),
    );
  }
});
it('renders unmapped company context without claiming a company affiliation', () => {
  render(
    <Preview data={page({ area: 'companies', focus: { kind: 'company', companyId: null } })} />,
  );
  expect(screen.getByRole('heading', { name: 'Unmapped company', level: 1 })).toBeVisible();
  expect(screen.getByRole('table').querySelectorAll('tbody tr')).toHaveLength(2);
});
it('keeps empty, partial and missing coverage distinct', () => {
  const state = (title: string) =>
    screen.getByRole('heading', { name: title }).closest('[data-kind]');
  const view = render(<Preview data={page({ sample: 'empty' })} />);
  expect(
    screen.getByRole('heading', { name: 'No counted contributions in this period' }),
  ).toBeVisible();
  expect(state('No counted contributions in this period')).toHaveAttribute('data-kind', 'empty');
  view.rerender(<Preview data={page({ sample: 'partial' })} />);
  expect(screen.getByLabelText('Data coverage')).toHaveTextContent('incomplete');
  expect(screen.getByRole('table').querySelector('sup')).toBeInTheDocument();
  view.rerender(<Preview data={page({ sample: 'missing' })} />);
  expect(screen.getByLabelText('Data coverage')).toHaveTextContent('unavailable');
  // An empty table keeps its header row and states the result in one full-width row.
  const empty = screen.getByRole('table');
  expect(
    within(empty).getByRole('heading', { name: 'No confirmed contributions to list' }),
  ).toBeVisible();
  // Unavailable values leave the list empty: the missing state, never the empty-result one.
  expect(state('No confirmed contributions to list')).toHaveAttribute('data-kind', 'missing');
  expect(within(empty).getAllByRole('columnheader').length).toBeGreaterThan(0);
  expect(empty.querySelectorAll('tbody td[data-column]')).toHaveLength(0);
  view.rerender(
    <Preview
      data={page({ sample: 'missing', focus: { kind: 'contributor', accountId: 'account-alice' } })}
    />,
  );
  expect(screen.getByRole('table').querySelectorAll('tbody tr')).toHaveLength(18);
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
  expect(screen.getByRole('navigation', { name: 'Contributors pages' })).toHaveTextContent(
    'Page 2 of 6',
  );
  await user.type(
    screen.getByRole('textbox', { name: 'Search Contributors' }),
    'sample-heavy-agent',
  );
  expect(screen.getByRole('table').querySelectorAll('tbody tr')).toHaveLength(1);
  // One page of results needs no pager.
  expect(screen.queryByRole('navigation', { name: 'Contributors pages' })).not.toBeInTheDocument();
  expect(screen.getByText('1 matching row')).toBeVisible();
  expect(screen.getByRole('table').querySelector('[data-column="prsAuthored"]')).toHaveTextContent(
    '240',
  );
  expect(
    screen.getByRole('table').querySelector('[data-column="issuesAuthored"]'),
  ).toHaveTextContent('350');
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
  expect(screen.getByRole('columnheader', { name: 'PR comments' })).toBeVisible();
  expect(screen.queryByText(/its column is hidden/)).not.toBeInTheDocument();
});

it('describes a sort by a hidden column once, by its metric name without the display heading', async () => {
  const user = userEvent.setup();
  function Sorted({ sort }: { sort: string }) {
    const controller = useLocalTableController({ search: '', sort, descending: true, page: 1 });
    return (
      <ContributionView
        page={page()}
        controller={controller}
        links={{ sample: 'reference', currentHref: '/contributors' }}
      />
    );
  }
  // Optional metrics start hidden.
  const view = render(<Sorted sort="prComments" />);
  expect(screen.queryByRole('columnheader', { name: 'PR comments' })).not.toBeInTheDocument();
  expect(screen.getAllByText(/its column is hidden/).map((note) => note.textContent)).toEqual([
    'Sorted by Comment activity — PR comments (descending); its column is hidden.',
  ]);
  expect(
    screen.getByText('Credits, comment activity and merged PR volumes are separate measures.'),
  ).toBeVisible();
  view.unmount();
  render(<Sorted sort="prsAuthored" />);
  await user.click(screen.getByRole('button', { name: 'Columns' }));
  await user.click(screen.getByRole('menuitemcheckbox', { name: 'PRs authored' }));
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('columnheader', { name: 'PRs authored' })).not.toBeInTheDocument();
  expect(screen.getAllByText(/its column is hidden/).map((note) => note.textContent)).toEqual([
    'Sorted by PRs authored (descending); its column is hidden.',
  ]);
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

it('shows singular scope and result labels for one selected account and repository', () => {
  const source = contributionSample();
  const report = selectContributions(source, {
    repositoryIds: ['repo-prebidjs'],
    actorTypes: ['human'],
    population: { kind: 'selected', accountIds: ['account-alice'], companyIds: [] },
    excludedAccountIds: [],
  });
  render(<Preview data={{ ...page(), report }} />);
  expect(screen.getByText('1 included account')).toBeVisible();
  // The repository count belongs to the Repositories control, so the scope summary omits it.
  expect(screen.getByRole('region', { name: 'Contribution report scope' })).not.toHaveTextContent(
    /repositor/,
  );
  // No search is set, so the count does not say "matching".
  expect(screen.getByText('1 row')).toBeVisible();
});
it('names a partial account type selection in the report scope summary', () => {
  const source = contributionSample();
  const repositoryIds = source.repositories.map((row) => row.id);
  const report = selectContributions(source, {
    repositoryIds,
    actorTypes: ['bot', 'human'],
    population: { kind: 'all' },
    excludedAccountIds: [],
  });
  const view = render(<Preview data={{ ...page(), report }} />);
  const scope = () => screen.getByRole('region', { name: 'Contribution report scope' });
  // The Account type control reads "2 types", so the summary names them in their fixed order.
  expect(within(scope()).getByText('Account types: Human, Bot')).toBeVisible();
  view.rerender(<Preview data={page()} />);
  expect(scope()).not.toHaveTextContent(/account types?:/i);
});
