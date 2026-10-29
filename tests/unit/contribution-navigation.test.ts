import { expect, it } from 'vitest';
import {
  companyFocus,
  companyBreakdownHref,
  contributionHref,
  contributionPath,
  readContributionLayoutQuery,
  safeContributionReturn,
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
it('preserves sample and exact parent table state without accepting external return destinations', () => {
  const parent = '/companies/id/company-acme?view=repositories&repositories.page=2';
  const href = new URL(
    contributionHref({ kind: 'contributor', accountId: 'account-alice' }, 'large', parent),
    'https://example.test',
  );
  expect(href.searchParams.get('sample')).toBe('large');
  expect(href.searchParams.get('returnTo')).toBe(parent);
  expect(contributionHref('contributors', 'reference')).toBe('/contributors');
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
it('validates layout scenarios and retains independent table queries when switching breakdowns', () => {
  expect(readContributionLayoutQuery(new URLSearchParams())).toEqual({
    sample: 'reference',
    breakdown: 'members',
    actorTypes: ['human', 'agent', 'bot', 'unknown'],
  });
  expect(
    readContributionLayoutQuery(new URLSearchParams('sample=large&view=repositories')),
  ).toEqual({
    sample: 'large',
    breakdown: 'repositories',
    actorTypes: ['human', 'agent', 'bot', 'unknown'],
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
    actorTypes: ['human', 'agent', 'bot', 'unknown'],
  });
  const changed = companyBreakdownHref(
    '/companies/id/company-acme',
    'sample=large&members.page=2',
    'repositories',
  );
  expect(changed).toContain('members.page=2');
  expect(changed).toContain('view=repositories');
  expect(companyBreakdownHref('/companies/unmapped', 'view=repositories', 'members')).toBe(
    '/companies/unmapped',
  );
});

it('preserves explicit mixed/empty actor filters, rejects unknown values and keeps them on focused links', () => {
  expect(
    readContributionLayoutQuery(new URLSearchParams('type=agent&type=human&type=agent'))
      ?.actorTypes,
  ).toEqual(['human', 'agent']);
  expect(readContributionLayoutQuery(new URLSearchParams('type='))?.actorTypes).toEqual([]);
  expect(readContributionLayoutQuery(new URLSearchParams('type=robot'))).toBeNull();
  expect(
    contributionHref(
      { kind: 'contributor', accountId: 'account-alice' },
      'reference',
      '/contributors?type=human',
      ['human'],
    ),
  ).toContain('type=human');
});
