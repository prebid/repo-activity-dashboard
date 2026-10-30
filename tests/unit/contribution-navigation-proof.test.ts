import { expect, it } from 'vitest';
import { contributionSample } from '@/mocks/contributions';
import {
  defaultContributionSettings,
  writeContributionSettings,
} from '@/lib/presentation/contribution-settings';
import { contributionHref } from '@/lib/presentation/contribution-navigation';
import {
  contributionReturnHref,
  withContributionReturn,
  contributionUrlFits,
} from '@/lib/presentation/contribution-return';

it('keeps 100-account navigation bounded through repeated report visits', () => {
  const sample = contributionSample({ scenario: 'large' });
  const settings = defaultContributionSettings(sample);
  settings.selection.population = {
    kind: 'selected',
    accountIds: sample.accounts.slice(0, 100).map((account) => account.id),
    companyIds: [],
  };
  let href = '/contributors?sample=large&' + writeContributionSettings('', settings);
  for (let depth = 0; depth < 12; depth++) {
    href = contributionHref(
      { kind: 'contributor', accountId: 'account-alice' },
      'large',
      href,
      settings,
    )!;
    expect(new TextEncoder().encode(href).length).toBeLessThan(7500);
    expect(new URL(href, 'https://dashboard.test').searchParams.getAll('account')).toEqual(
      [...settings.selection.population.accountIds].sort(),
    );
  }
});

it('restores independent nested snapshots after a copied link changes its current scope', () => {
  const root =
    '/companies?scope=1&period=this-year&account=account-alice&population=selected&report.page=2&companies.columns=name&companies.columns=prsAuthored&report.q=caf%C3%A9';
  const person = withContributionReturn('/contributors/account-alice?period=this-year', root)!;
  const child = withContributionReturn('/companies/id/company-acme?period=this-month', person)!;
  const changed = new URL(child, 'https://dashboard.test');
  changed.searchParams.set('period', 'last-month');
  const restored = contributionReturnHref(changed.searchParams, '/companies');
  expect(new URL(restored, changed).pathname).toBe('/contributors/account-alice');
  expect(new URL(restored, changed).searchParams.get('period')).toBe('this-year');
  const original = new URL(
    contributionReturnHref(new URL(restored, changed).searchParams, '/companies'),
    changed,
  );
  expect(original.pathname).toBe('/companies');
  expect(original.searchParams.get('period')).toBe('this-year');
  expect(original.searchParams.get('report.page')).toBe('2');
  expect(original.searchParams.get('report.q')).toBe('café');
  expect(original.searchParams.getAll('companies.columns')).toEqual(['name', 'prsAuthored']);
  expect(original.searchParams.getAll('account')).toEqual(['account-alice']);
});

it('bounds retained history while keeping the nearest return snapshots exact', () => {
  let current = '/contributors?report.page=1';
  for (let page = 2; page <= 20; page++)
    current = withContributionReturn('/contributors?report.page=' + page, current)!;
  expect(contributionUrlFits(current)).toBe(true);
  for (let page = 19; page >= 12; page--) {
    current = contributionReturnHref(
      new URL(current, 'https://dashboard.test').searchParams,
      '/companies',
    );
    expect(new URL(current, 'https://dashboard.test').searchParams.get('report.page')).toBe(
      String(page),
    );
  }
  expect(
    contributionReturnHref(new URL(current, 'https://dashboard.test').searchParams, '/companies'),
  ).toBe('/companies');
});
it('bounds bytes as well as depth without dropping the immediate parent', () => {
  let href = '/contributors?report.q=' + 'a'.repeat(1000);
  let prior = href;
  for (let i = 0; i < 10; i++) {
    prior = href;
    href = withContributionReturn('/contributors?report.q=' + String(i).repeat(1000), href)!;
    expect(href).not.toBeNull();
    expect(contributionUrlFits(href)).toBe(true);
  }
  const restored = new URL(
    contributionReturnHref(new URL(href, 'https://test.invalid').searchParams, '/companies'),
    'https://test.invalid',
  );
  expect(restored.searchParams.get('report.q')).toBe(
    new URL(prior, 'https://test.invalid').searchParams.get('report.q'),
  );
  const international = '/contributors/' + encodeURIComponent('é'.repeat(100));
  const link = withContributionReturn('/companies', international)!;
  expect(
    contributionReturnHref(new URL(link, 'https://test.invalid').searchParams, '/contributors'),
  ).toBe(international);
  const clean = withContributionReturn('/contributors', '/companies?ignored=discard')!;
  expect(
    contributionReturnHref(new URL(clean, 'https://test.invalid').searchParams, '/contributors'),
  ).toBe('/companies');
  expect(
    withContributionReturn('/contributors', '/companies?report.q=' + 'x'.repeat(8000)),
  ).toBeNull();
  expect(
    contributionReturnHref(new URLSearchParams({ returnTo: '//external.test' }), '/companies'),
  ).toBe('/companies');
});

it('reads legacy returns and refuses oversize links without silently changing their scope', () => {
  const legacy =
    '/contributors/account-alice?returnTo=' + encodeURIComponent('/companies?report.page=2');
  const link = withContributionReturn('/companies/id/company-acme', legacy)!;
  const parent = contributionReturnHref(
    new URL(link, 'https://dashboard.test').searchParams,
    '/contributors',
  );
  expect(
    contributionReturnHref(new URL(parent, 'https://dashboard.test').searchParams, '/contributors'),
  ).toBe('/companies?report.page=2');
  expect(withContributionReturn('/contributors?report.q=' + 'a'.repeat(7500))).toBeNull();
  expect(
    withContributionReturn(
      '/contributors?report.q=' + 'a'.repeat(6000),
      '/companies?report.q=' + 'b'.repeat(6000),
    ),
  ).toBeNull();
  expect(withContributionReturn('/contributors', 'https://external.test')).toBe('/contributors');
  const modern = withContributionReturn('/contributors/account-alice', '/companies?report.page=4')!;
  const wrapped = new URLSearchParams({ returnTo: modern });
  const back = contributionReturnHref(wrapped, '/companies');
  expect(
    contributionReturnHref(new URL(back, 'https://dashboard.test').searchParams, '/companies'),
  ).toBe('/companies?report.page=4');
});

it.each([
  '',
  '!',
  'a'.repeat(7501),
  Buffer.from('not json').toString('base64url'),
  Buffer.from(JSON.stringify([3, [], []])).toString('base64url'),
  Buffer.from(JSON.stringify([1, [], [['https://external.test', []]]])).toString('base64url'),
  Buffer.from(JSON.stringify([1, [], [['/contributors?period=this-year', []]]])).toString(
    'base64url',
  ),
  Buffer.from(JSON.stringify([1, [['1']], [['/contributors', [['report.page', 99]]]]])).toString(
    'base64url',
  ),
  Buffer.from(JSON.stringify([1, [['1']], [['/contributors', [['nav', 0]]]]])).toString(
    'base64url',
  ),
  Buffer.from(JSON.stringify([1, [['1']], [['/contributors', [['returnTo', 0]]]]])).toString(
    'base64url',
  ),
  Buffer.from(
    JSON.stringify([
      1,
      [['1']],
      [
        [
          '/contributors',
          [
            ['report.page', 0],
            ['report.page', 0],
          ],
        ],
      ],
    ]),
  ).toString('base64url'),
  Buffer.from(JSON.stringify([1, [['a'.repeat(7490)]], [['/contributors', [['q', 0]]]]])).toString(
    'base64url',
  ),
])('rejects invalid return context %#', (nav) => {
  expect(contributionReturnHref(new URLSearchParams({ nav }), '/companies')).toBe('/companies');
});
