import {
  safeContributionReturn,
  contributionReturnHref,
} from '@/lib/presentation/contribution-return';
import { contributionSample } from '@/mocks/contributions';
import {
  defaultContributionSettings,
  readContributionSettings,
} from '@/lib/presentation/contribution-settings';
import { expect, it } from 'vitest';
import {
  companyFocus,
  companyBreakdownHref,
  contributionHref,
  contributionPath,
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
it('preserves sample and exact parent table state without accepting external return destinations', () => {
  const parent = '/companies/id/company-acme?view=repositories&repositories.page=2';
  const href = new URL(
    contributionHref({ kind: 'contributor', accountId: 'account-alice' }, 'large', parent)!,
    'https://example.test',
  );
  expect(href.searchParams.get('sample')).toBe('large');
  const restored = new URL(
    contributionReturnHref(href.searchParams, '/contributors'),
    'https://example.test',
  );
  expect(restored.pathname).toBe('/companies/id/company-acme');
  expect(restored.searchParams.get('view')).toBe('repositories');
  expect(restored.searchParams.get('repositories.page')).toBe('2');
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
