import { expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { contributionSample } from '@/mocks/contributions';
import {
  childViewHref,
  contributionColumnVisibility,
  contributionLensValues,
  contributionReportRoute,
  contributionScopeInput,
  contributionScopeValues,
  contributionTarget,
  contributionViewOf,
  savedPresentationValues,
} from '@/lib/presentation/contribution-url';
import {
  defaultContributionSettings,
  validateContributionSettings,
} from '@/lib/presentation/contribution-settings';
import { contributionTimelineHref } from '@/lib/presentation/contribution-timeline';
import { parseQuery, urlHref } from '@/lib/presentation/url/codec';
import { resolveBack } from '@/lib/presentation/url/back';
import type { ContributionSettings } from '@/models/contribution-settings';

const source = contributionSample();
const defaults = defaultContributionSettings(source);
const view = (href: string) => {
  const result = contributionViewOf(href);
  if (!result) throw Error('Expected a canonical contribution view: ' + href);
  return result;
};

it.each<[string, (value: ContributionSettings) => void, string]>([
  ['the defaults', () => {}, ''],
  [
    'a custom period and narrowed repositories and types',
    (value) => {
      value.period = { kind: 'custom', from: '2026-09-01', through: '2026-09-30' };
      value.selection.repositoryIds = ['repo-prebidserver', 'repo-prebidjs'];
      value.selection.actorTypes = ['bot', 'human'];
    },
    'repo=prebidjs,prebidserver&period=2026-09-01..2026-09-30&type=human,bot',
  ],
  [
    'a selected population with Unmapped and exclusions',
    (value) => {
      value.selection.population = {
        kind: 'selected',
        accountIds: ['account-bob'],
        companyIds: [null, 'company-acme'],
      };
      value.selection.excludedAccountIds = ['account-alice'];
    },
    'account=account-bob&company=company-acme,unmapped&exclude=account-alice',
  ],
  [
    'explicitly empty selections',
    (value) => {
      value.selection.repositoryIds = [];
      value.selection.actorTypes = [];
      value.selection.population = { kind: 'selected', accountIds: [], companyIds: [] };
    },
    'repo=&type=&account=',
  ],
])('writes %s as scope values and reads them back', (_, change, query) => {
  const settings = structuredClone(defaults);
  change(settings);
  const values = contributionScopeValues(settings);
  expect(urlHref('/contributors', {}, values).replace(/^\/contributors\??/, '')).toBe(query);
  const parsed = parseQuery('/contributors', query);
  if (parsed.kind !== 'canonical') throw Error('Expected canonical');
  const read = validateContributionSettings(
    contributionScopeInput(parsed.values, source),
    source,
    source.asOf,
  );
  expect(read && urlHref('/contributors', {}, contributionScopeValues(read))).toBe(
    urlHref('/contributors', {}, values),
  );
});

it('shows the contributor lens’s three metric columns by default (decision C5)', () => {
  const visible = (href: string) => {
    const { route, values } = view(href);
    const columns = contributionColumnVisibility(route, values)!;
    return Object.keys(columns).filter((id) => columns[id]);
  };
  expect(visible('/contributors')).toEqual([
    'name',
    'actorType',
    'company',
    'prsAuthored',
    'authoredPrsMerged',
    'issuesAuthored',
  ]);
  expect(
    visible('/companies/unmapped?view=repositories&cols=mergesPerformed,-issuesAuthored'),
  ).toEqual(['name', 'prsAuthored', 'authoredPrsMerged', 'mergesPerformed']);
  // A column the table lacks makes the view invalid rather than ignored.
  expect(contributionColumnVisibility('/contributors', { cols: ['members'] })).toBeNull();
});

it('writes a table’s saved presentation as explicit fields on the links that open it (C3)', () => {
  const saved = {
    contributors: {
      columns: { prComments: true, issuesAuthored: false, name: false },
      sort: { sort: 'prComments', descending: true },
    },
    members: { hideZeroMembers: true, sort: { sort: 'company', descending: false } },
    details: { columns: { lastAt: true } },
  };
  expect(savedPresentationValues('/contributors', {}, saved)).toEqual({
    // The name column always shows.
    cols: ['-issuesAuthored', 'prComments'],
    sort: '-prComments',
  });
  // A saved sort on a column the table lacks does not apply; zero totals are a members choice.
  expect(savedPresentationValues('/companies/[...identity]', {}, saved)).toEqual({ zero: 'hide' });
  expect(savedPresentationValues('/companies', {}, saved)).toEqual({});
  // Comment details show Last activity by default; credit details do not.
  expect(savedPresentationValues('/contributors', { metric: 'prComments' }, saved)).toEqual({});
  expect(savedPresentationValues('/contributors', { metric: 'prsAuthored' }, saved)).toEqual({
    cols: ['lastAt'],
  });
});

it('opens Companies-lens targets on /companies and carries `lens=all` on every other route', () => {
  const alice = { kind: 'contributor', accountId: 'account-alice' } as const;
  const acme = { kind: 'company', companyId: 'company-acme' } as const;
  // The lens has no people overview: the people area's overview is the Companies overview.
  expect(contributionTarget('companies', 'all')).toEqual({ route: '/companies', segments: {} });
  expect(contributionTarget('contributors', 'all')).toEqual({ route: '/companies', segments: {} });
  expect(contributionReportRoute('contributors', undefined, 'all').route).toBe('/companies');
  expect(contributionReportRoute('contributors', alice, 'all')).toEqual({
    route: '/contributors/[accountId]',
    segments: { accountId: ['account-alice'] },
  });
  expect(contributionReportRoute('companies', acme, 'all')).toEqual({
    route: '/companies/[...identity]',
    segments: { identity: ['id', 'company-acme'] },
  });
  for (const route of [
    '/companies',
    '/contributors/[accountId]',
    '/companies/[...identity]',
  ] as const)
    expect(contributionLensValues(route, 'all'), route).toEqual({ lens: 'all' });
  expect(contributionLensValues('/companies', 'reviewers')).toEqual({ lens: 'reviewers' });
  // The default lens is never written, and a people overview's route is its lens.
  expect(contributionLensValues('/companies', 'contributors')).toEqual({});
  for (const lens of ['reviewers', 'all'] as const) {
    expect(contributionLensValues('/contributors', lens), lens).toEqual({});
    expect(contributionLensValues('/reviewers', lens), lens).toEqual({});
  }
});

it('shows the six credits by default in the Companies lens and keeps Show all Reviewers-only', () => {
  const credits = [
    'prsAuthored',
    'authoredPrsMerged',
    'reviewerContributions',
    'approvalContributions',
    'mergesPerformed',
    'issuesAuthored',
  ];
  const visible = (href: string) => {
    const { route, values } = view(href);
    const columns = contributionColumnVisibility(route, values)!;
    return Object.keys(columns).filter((id) => columns[id]);
  };
  expect(visible('/companies?lens=all')).toEqual(['name', 'members', ...credits]);
  expect(visible('/companies/id/company-acme?lens=all')).toEqual(['name', 'actorType', ...credits]);
  expect(visible('/contributors/account-alice?lens=all')).toEqual(['name', ...credits]);
  const saved = {
    companies: {
      showAllAccounts: true,
      columns: { prComments: true, issuesAuthored: false },
      sort: { sort: 'mergesPerformed', descending: true },
    },
  };
  expect(savedPresentationValues('/companies', { lens: 'all' }, saved)).toEqual({
    cols: ['-issuesAuthored', 'prComments'],
    sort: '-mergesPerformed',
  });
  expect(savedPresentationValues('/companies', { lens: 'reviewers' }, saved)).toMatchObject({
    all: true,
  });
});

it('carries the parent as the first back frame and its own frames after it', () => {
  const company = view(
    '/companies/id/company-acme?period=last-month&back=/contributors/account-alice',
  );
  const child = childViewHref(company, {
    route: '/contributors/[accountId]',
    segments: { accountId: ['account-bob'] },
    values: { period: 'last-month' },
  });
  expect(child).toBe(
    '/contributors/account-bob?period=last-month&back=/companies/id/company-acme&back=/contributors/account-alice',
  );
  const ancestors = resolveBack(view(child!));
  expect(ancestors.map((ancestor) => ancestor.available && ancestor.href)).toEqual([
    '/companies/id/company-acme?period=last-month&back=/contributors/account-alice',
    '/contributors/account-alice?period=last-month',
    '/contributors?period=last-month',
  ]);
  // A derived parent costs nothing.
  const overview = view('/contributors?period=last-month');
  expect(
    childViewHref(overview, {
      route: '/contributors/[accountId]',
      segments: { accountId: ['account-bob'] },
      values: { period: 'last-month' },
    }),
  ).toBe('/contributors/account-bob?period=last-month');
  // An immediate parent that cannot fit disables the link.
  const crowded = view('/contributors?q=' + 'x'.repeat(500) + '&exclude=' + 'a'.repeat(7000));
  expect(
    childViewHref(crowded, {
      route: '/contributors/[accountId]',
      segments: { accountId: ['account-bob'] },
      values: { exclude: ['a'.repeat(7000)] },
    }),
  ).toBeNull();
});

it('links a report to its Over time, which resolves the report and its parents', () => {
  const report = view(
    '/contributors/account-alice?sample=large&q=agent&sort=name&cols=prComments&back=~q:heavy',
  );
  const settings = validateContributionSettings(
    contributionScopeInput(report.values, contributionSample({ scenario: 'large' })),
    contributionSample({ scenario: 'large' }),
    source.asOf,
  )!;
  const href = contributionTimelineHref(report, settings)!;
  expect(href).toBe(
    '/contributors/account-alice?timeline&sample=large&back=~q:agent~sort:name~cols:prComments&back=~q:heavy&v=1',
  );
  const [restored, grandparent] = resolveBack(view(href));
  expect(restored).toMatchObject({
    available: true,
    href: '/contributors/account-alice?sample=large&q=agent&sort=name&cols=prComments&back=~q:heavy',
  });
  expect(grandparent).toMatchObject({
    available: true,
    href: '/contributors?sample=large&q=heavy',
  });
});
it('carries report ancestors as frames and keeps an unavailable one unavailable', () => {
  const settings = defaultContributionSettings(source);
  const chain = (href: string) =>
    resolveBack(view(contributionTimelineHref(view(href), settings)!)).map((ancestor) =>
      ancestor.available ? ancestor.href : null,
    );
  // An overview is top-level: its Over time returns to it alone.
  expect(chain('/companies?q=Acme')).toEqual(['/companies?q=Acme']);
  // A company's members table, hiding zero totals, then the derived Companies report.
  expect(chain('/companies/id/company-acme?zero=hide&page=2')).toEqual([
    '/companies/id/company-acme?page=2&zero=hide',
    '/companies?v=1',
  ]);
  // An unavailable ancestor stays unavailable, and an Over time ancestor is restored.
  expect(chain('/contributors/account-alice?back=!')).toEqual([
    '/contributors/account-alice?back=!&v=1',
    null,
  ]);
  expect(chain('/companies/id/company-acme?back=/contributors/account-alice~timeline')).toEqual([
    '/companies/id/company-acme?back=/contributors/account-alice~timeline&v=1',
    '/contributors/account-alice?timeline&v=1',
    '/contributors/account-alice?v=1',
    '/contributors?v=1',
  ]);
  // Only a report has an Over time link.
  expect(contributionTimelineHref(view('/contributors?timeline'), settings)).toBeNull();
});
