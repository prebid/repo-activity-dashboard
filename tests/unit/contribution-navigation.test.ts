import { safeContributionReturn } from '../support/legacy-trail';
import { contributionSample } from '@/mocks/contributions';
import {
  defaultContributionSelection,
  selectContributions,
} from '@/lib/presentation/contributions';
import {
  defaultContributionSettings,
  readContributionSettings,
} from '@/lib/presentation/contribution-settings';
import { expect, it } from 'vitest';
import { contributionViewOf } from '@/lib/presentation/contribution-url';
import { resolveBack } from '@/lib/presentation/url/back';
import {
  companyFocus,
  companyBreakdownHref,
  contributionHref,
  contributionMetricHref,
  contributionPath,
  contributionTargetOf,
  readContributionLayoutQuery,
} from '@/lib/presentation/contribution-navigation';
it('keeps stable identity routes unambiguous for unmapped and mapped companies', () => {
  expect(contributionPath('companies')).toBe('/companies');
  expect(contributionPath({ kind: 'contributor', accountId: 'account-alice' })).toBe(
    '/contributors/account-alice',
  );
  expect(contributionPath({ kind: 'company', companyId: 'unmapped' })).toBe(
    '/companies/id/unmapped',
  );
  expect(contributionPath({ kind: 'company', companyId: null })).toBe('/companies/unmapped');
  expect(companyFocus(['unmapped'])).toEqual({ kind: 'company', companyId: null });
  expect(companyFocus(['id', 'unmapped'])).toEqual({ kind: 'company', companyId: 'unmapped' });
  for (const path of [[], ['id'], ['id', ''], ['unknown'], ['id', 'a', 'b']])
    expect(companyFocus(path)).toBeNull();
});
it('keeps the Reviewers lens through people, company, metric and Over time links', () => {
  const alice = { kind: 'contributor', accountId: 'account-alice' } as const;
  expect(contributionPath('contributors', 'reviewers')).toBe('/reviewers');
  expect(contributionPath('companies', 'reviewers')).toBe('/companies');
  expect(contributionPath(alice, 'reviewers')).toBe('/contributors/account-alice');
  expect(
    contributionHref('contributors', 'reference', undefined, undefined, undefined, 'reviewers'),
  ).toBe('/reviewers?v=1');
  expect(contributionHref('companies', 'large', undefined, undefined, undefined, 'reviewers')).toBe(
    '/companies?lens=reviewers&sample=large&v=1',
  );
  // From /reviewers, a person link carries the lens; its parent is the Reviewers overview.
  const person = contributionHref(
    alice,
    'reference',
    '/reviewers?all',
    undefined,
    undefined,
    'reviewers',
  )!;
  expect(person).toBe('/contributors/account-alice?lens=reviewers&back=~all');
  expect(resolveBack(contributionViewOf(person)!)[0]).toMatchObject({
    available: true,
    href: '/reviewers?all',
  });
  const report = selectContributions(contributionSample(), undefined, alice);
  expect(
    contributionMetricHref(
      alice,
      'reference',
      report.context,
      'approvalContributions',
      person,
      undefined,
      undefined,
      'reviewers',
    ),
  ).toBe(
    '/contributors/account-alice?lens=reviewers&metric=approvalContributions' +
      '&back=/contributors/account-alice~lens:reviewers&back=~all',
  );
  // Saved Reviewers-lens presentation, Show all included, rides on links that open the table.
  expect(
    contributionHref(
      'contributors',
      'reference',
      undefined,
      undefined,
      {
        contributors: { showAllAccounts: true, sort: { sort: 'name', descending: false } },
      },
      'reviewers',
    ),
  ).toBe('/reviewers?sort=name&all');
  expect(
    contributionHref('contributors', 'reference', undefined, undefined, {
      contributors: { showAllAccounts: true },
    }),
  ).toBe('/contributors?v=1');
});
it('carries the parent report as a back frame without accepting external return destinations', () => {
  const parent = '/companies/id/company-acme?view=repositories&sample=large&page=2';
  const href = contributionHref(
    { kind: 'contributor', accountId: 'account-alice' },
    'large',
    parent,
  );
  expect(href).toBe(
    '/contributors/account-alice?sample=large&back=/companies/id/company-acme~view:repositories~page:2',
  );
  const child = contributionViewOf(href!)!;
  const [restored] = resolveBack(child);
  expect(restored).toEqual(expect.objectContaining({ available: true, href: parent }));
  // A parent the child derives (the area report at its scope) needs no frame.
  expect(contributionHref({ kind: 'company', companyId: null }, 'reference', '/companies')).toBe(
    '/companies/unmapped',
  );
  // A same-level link names its defaults explicitly, so it never answers with a saved view.
  expect(contributionHref('contributors', 'reference')).toBe('/contributors?v=1');
  // Another origin is never a parent; the frozen reader still rejects unsafe legacy returns.
  for (const external of ['https://evil.test/companies?page=2', '//evil.test/companies?page=2'])
    expect(
      contributionHref({ kind: 'contributor', accountId: 'account-alice' }, 'reference', external),
    ).toBe('/contributors/account-alice');
  for (const path of [
    null,
    undefined,
    '',
    '//evil.test',
    'https://evil.test',
    '/repos',
    '/companies-else',
    '/contributors\\evil',
    '/contributors?x=' + 'x'.repeat(65536),
  ])
    expect(safeContributionReturn(path, '/companies')).toBe('/companies');
  expect(safeContributionReturn('/contributors?report.page=2', '/companies')).toBe(
    '/contributors?report.page=2',
  );
});
it('carries an Over time parent as a frame its Report reads back', () => {
  const overTime = '/contributors/account-alice?timeline&period=last-month';
  const href = contributionHref(
    { kind: 'company', companyId: 'company-acme' },
    'reference',
    overTime,
    {
      ...defaultContributionSettings(contributionSample()),
      period: { kind: 'preset', preset: 'last-month' },
    },
  )!;
  expect(href).toBe(
    '/companies/id/company-acme?period=last-month&back=/contributors/account-alice~timeline',
  );
  const [restored] = resolveBack(contributionViewOf(href)!);
  expect(restored).toMatchObject({ available: true, href: overTime });
});
it('validates layout scenarios and retains independent table queries when switching breakdowns', () => {
  expect(readContributionLayoutQuery(new URLSearchParams())).toEqual({
    sample: 'reference',
    breakdown: 'members',
  });
  expect(
    readContributionLayoutQuery(new URLSearchParams('sample=large&view=repositories')),
  ).toEqual({
    sample: 'large',
    breakdown: 'repositories',
  });
  for (const query of ['sample=unknown', 'sample=', 'view=other'])
    expect(readContributionLayoutQuery(new URLSearchParams(query))).toBeNull();
  expect(
    readContributionLayoutQuery(
      new URLSearchParams('sample=partial&sample=bad&view=members&view=bad'),
    ),
  ).toEqual({
    sample: 'partial',
    breakdown: 'members',
  });
  // The other breakdown keeps the scope and the parent; table state belongs to each table.
  expect(
    companyBreakdownHref(
      '/companies/id/company-acme',
      'sample=large&period=last-month&q=bob&page=2&zero=hide&back=/contributors/account-alice',
      'repositories',
    ),
  ).toBe(
    '/companies/id/company-acme?view=repositories&sample=large&period=last-month&back=/contributors/account-alice',
  );
  expect(companyBreakdownHref('/companies/unmapped', 'view=repositories', 'members')).toBe(
    '/companies/unmapped',
  );
  // It opens the other table with its saved presentation (decision C3).
  expect(
    companyBreakdownHref('/companies/unmapped', '', 'repositories', {
      repositories: { columns: { prComments: true }, sort: { sort: 'name', descending: false } },
    }),
  ).toBe('/companies/unmapped?view=repositories&sort=name&cols=prComments');
});

it('keeps account types solely in the validated report settings', () => {
  const source = contributionSample();
  const read = (query: string) =>
    readContributionSettings(new URLSearchParams(query), source, source.asOf);
  expect(read('type=agent&type=human&type=agent')?.selection.actorTypes).toEqual([
    'human',
    'agent',
  ]);
  expect(read('type=')?.selection.actorTypes).toEqual([]);
  expect(read('type=robot')).toBeNull();
  const settings = defaultContributionSettings(source);
  settings.selection.actorTypes = ['human'];
  expect(
    contributionHref(
      { kind: 'contributor', accountId: 'account-alice' },
      'reference',
      undefined,
      settings,
    ),
  ).toContain('type=human');
});

it('names a focus’s report target and refuses links past the URL cap', () => {
  expect(contributionTargetOf('companies', { kind: 'overview' })).toBe('companies');
  const alice = { kind: 'contributor', accountId: 'account-alice' } as const;
  expect(contributionTargetOf('companies', alice)).toBe(alice);
  const source = contributionSample();
  const settings = defaultContributionSettings(source);
  settings.selection.population = {
    kind: 'selected',
    accountIds: Array.from({ length: 800 }, (_, index) => 'account-extra-' + index),
    companyIds: [],
  };
  expect(contributionHref('contributors', 'reference', undefined, settings)).toBeNull();
  // A metric link from a page that is not a canonical report carries no parent frame.
  const context = selectContributions(source, defaultContributionSelection(source)).context;
  expect(
    contributionMetricHref(alice, 'reference', context, 'prsAuthored', '/contributors?scope=1'),
  ).toBe('/contributors/account-alice?metric=prsAuthored');
  // A breakdown of an address that is not canonical keeps that address.
  expect(companyBreakdownHref('/companies/unmapped', '?scope=1', 'repositories')).toBe(
    '/companies/unmapped?scope=1',
  );
});
