import { describe, expect, it } from 'vitest';
import { contributionSample } from '@/mocks/contributions';
import {
  defaultContributionSettings,
  writeContributionSettings,
} from '@/lib/presentation/contribution-settings';
import { contributionHref } from '@/lib/presentation/contribution-navigation';
import {
  contributionReturnHref,
  withContributionReturn,
} from '@/lib/presentation/contribution-return';

const origin = 'https://dashboard.test';
const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
const decoded = (href: string): unknown[] =>
  JSON.parse(
    Buffer.from(new URL(href, origin).searchParams.get('nav')!, 'base64url').toString('utf8'),
  ) as unknown[];
function canonical(href: string) {
  const url = new URL(href, origin);
  url.searchParams.sort();
  return url.pathname + url.search;
}
const columns = [
  'name',
  'actorType',
  'company',
  'prsAuthored',
  'authoredPrsMerged',
  'reviewerContributions',
  'approvalContributions',
  'mergesPerformed',
  'issuesAuthored',
];
function population(count: number, presentation: boolean) {
  const source = contributionSample({ scenario: 'large' });
  const settings = defaultContributionSettings(source);
  settings.selection.population = {
    kind: 'selected',
    companyIds: [],
    accountIds: source.accounts
      .filter((account) => account.id.startsWith('account-person-'))
      .slice(0, count)
      .map((account) => account.id),
  };
  const query = writeContributionSettings('sample=large', settings);
  const params = new URLSearchParams(query);
  if (presentation) {
    for (const id of columns) params.append('contributors.columns', id);
    params.set('report.sort', 'authoredPrsMerged');
    params.set('report.dir', 'desc');
    params.set('report.page', '2');
  }
  return { settings, query, parent: canonical('/contributors?' + params.toString()) };
}

it('compacts a 100-account snapshot without storing mutable references to the child', () => {
  const { query, parent } = population(100, false);
  const href = withContributionReturn('/contributors/account-person-001?' + query, parent)!;
  expect(Buffer.byteLength(href)).toBeLessThan(Buffer.byteLength(parent) * 1.3);
  expect(decoded(href)[0]).toBe(2);
  expect(contributionReturnHref(new URL(href, origin).searchParams, '/companies')).toBe(parent);
});
it('keeps a 130-account report linkable with its full default presentation frozen', () => {
  const { settings, parent } = population(130, true);
  const href = contributionHref(
    { kind: 'contributor', accountId: 'account-person-001' },
    'large',
    parent,
    settings,
  );
  expect(href).not.toBeNull();
  expect(Buffer.byteLength(href!)).toBeLessThan(5000);
  const restored = contributionReturnHref(new URL(href!, origin).searchParams, '/companies');
  expect(restored).toBe(parent);
  expect(new URL(restored, origin).searchParams.getAll('contributors.columns')).toEqual(columns);
});
it('preserves two independent parents when a copied child changes repeated scope and presentation keys', () => {
  const { parent: overview, query } = population(100, true);
  const person = withContributionReturn(
    '/contributors/account-person-001?' +
      query +
      '&exclude=account-person-099&repositories.columns=name&repositories.page=2',
    overview,
  )!;
  const child = withContributionReturn('/companies/id/company-acme?' + query, person)!;
  const changed = new URL(child, origin);
  for (const [key, value] of [
    ['account', 'account-person-150'],
    ['exclude', 'account-person-002'],
    ['repo', 'repo-prebidserver'],
    ['type', 'agent'],
    ['period', 'last-month'],
    ['report.q', 'changed'],
    ['repositories.columns', 'prComments'],
    ['repositories.page', '1'],
  ])
    changed.searchParams.set(key, value);
  const restoredPerson = new URL(
    contributionReturnHref(changed.searchParams, '/companies'),
    origin,
  );
  const originalPerson = new URL(person, origin);
  for (const key of [
    'account',
    'exclude',
    'repo',
    'type',
    'period',
    'repositories.columns',
    'repositories.page',
  ])
    expect(restoredPerson.searchParams.getAll(key)).toEqual(
      originalPerson.searchParams.getAll(key),
    );
  expect(contributionReturnHref(restoredPerson.searchParams, '/companies')).toBe(overview);
});
it('decodes a fixed v1 bookmark and upgrades its remaining trail without dropping presentation', () => {
  const nav = encode([
    1,
    [
      ['this-year'],
      ['account-alice', 'account-bob'],
      columns,
      ['authoredPrsMerged'],
      ['desc'],
      ['2'],
    ],
    [
      [
        '/contributors',
        [
          ['period', 0],
          ['account', 1],
          ['contributors.columns', 2],
          ['report.sort', 3],
          ['report.dir', 4],
          ['report.page', 5],
        ],
      ],
      ['/companies', []],
    ],
  ]);
  const parent = contributionReturnHref(new URLSearchParams({ nav }), '/companies');
  const params = new URL(parent, origin).searchParams;
  expect(params.getAll('account')).toEqual(['account-alice', 'account-bob']);
  expect(params.getAll('contributors.columns')).toEqual(columns);
  expect(params.get('report.page')).toBe('2');
  expect(params.get('report.sort')).toBe('authoredPrsMerged');
  expect(params.get('report.dir')).toBe('desc');
  expect(decoded(parent)[0]).toBe(2);
  expect(contributionReturnHref(params, '/contributors')).toBe('/companies');
  const legacy = new URLSearchParams({ returnTo: '/contributors/account-alice?nav=' + nav });
  const person = contributionReturnHref(legacy, '/companies');
  expect(new URL(person, origin).pathname).toBe('/contributors/account-alice');
  expect(contributionReturnHref(new URL(person, origin).searchParams, '/companies')).toBe(parent);
});

it.each([
  ['plain', ['a', 'bc', 'different']],
  ['small shared prefixes', ['x1', 'x2']],
  ['variable suffix widths', ['account-a', 'account-longer', 'account-last']],
  ['duplicate values', ['same', 'same']],
  ['empty values', ['', '']],
  [
    'unicode prefixes',
    Array.from({ length: 30 }, (_, i) => '組織😀-' + String(i).padStart(3, '0')),
  ],
  ['different surrogate pairs', ['long-prefix-😀a', 'long-prefix-😁b', 'long-prefix-😂c']],
  [
    'query punctuation',
    Array.from({ length: 20 }, (_, i) => 'a&% +=' + String(i).padStart(2, '0')),
  ],
] as const)('round-trips %s without changing order or values', (_name, values) => {
  const params = new URLSearchParams('scope=1&population=selected&repo=&type=&company=');
  for (const value of values) params.append('account', value);
  const parent = canonical('/contributors?' + params.toString());
  const link = withContributionReturn('/companies', parent)!;
  expect(contributionReturnHref(new URL(link, origin).searchParams, '/companies')).toBe(parent);
});

describe('bounded v2 decoding', () => {
  it.each([
    { p: 'account-', w: 0, s: '12' },
    { p: 'account-', w: -1, s: '12' },
    { p: 'account-', w: 1.5, s: '12' },
    { p: '', w: 1, s: '12' },
    { p: 'account-', w: 1, s: '' },
    { p: 'account-', w: 2, s: '123' },
    { p: 'account-', w: 1, s: 'x'.repeat(513) },
    { p: 'account-', w: 1, s: '12', extra: true },
    { p: 'x'.repeat(4000), w: 1, s: 'y'.repeat(500) },
    { p: 'x', w: 1, s: '😀' },
    ['\ud800'],
  ])('rejects malformed or over-expanding value pool %#', (value) => {
    const nav = encode([2, [value], [['/contributors', [['account', 0]]]]]);
    expect(nav.length).toBeLessThan(7500);
    expect(contributionReturnHref(new URLSearchParams({ nav }), '/companies')).toBe('/companies');
  });
  it('rejects an oversized restored frame even when the packed pool itself is small', () => {
    const nav = encode([
      2,
      [{ p: 'x'.repeat(1000), w: 1, s: 'ab' }],
      [
        [
          '/contributors',
          [
            ['account', 0],
            ['exclude', 0],
            ['repo', 0],
            ['company', 0],
          ],
        ],
      ],
    ]);
    expect(nav.length).toBeLessThan(2000);
    expect(contributionReturnHref(new URLSearchParams({ nav }), '/companies')).toBe('/companies');
  });
  it('enforces the expansion budget across the entire pool before restoring any frames', () => {
    const values = Array.from({ length: 20 }, (_, i) => ({
      p: String(i).padStart(2, '0') + 'p'.repeat(198),
      w: 1,
      s: 'a'.repeat(20),
    }));
    const nav = encode([2, values, [['/contributors', [['account', 0]]]]]);
    expect(nav.length).toBeLessThan(7500);
    expect(contributionReturnHref(new URLSearchParams({ nav }), '/companies')).toBe('/companies');
  });
  it('accepts a valid compact field without guessing missing or extra values', () => {
    const nav = encode([
      2,
      [{ p: 'account-', w: 3, s: '001002' }],
      [['/contributors', [['account', 0]]]],
    ]);
    const restored = new URL(
      contributionReturnHref(new URLSearchParams({ nav }), '/companies'),
      origin,
    );
    expect(restored.pathname).toBe('/contributors');
    expect(restored.searchParams.getAll('account')).toEqual(['account-001', 'account-002']);
  });
});

it('refuses to emit a return list beyond the decoder cardinality limit', () => {
  const params = new URLSearchParams();
  for (let i = 0; i < 513; i++) params.append('repo', 'a');
  const parent = '/contributors?' + params.toString();
  expect(Buffer.byteLength(parent)).toBeLessThan(7500);
  expect(withContributionReturn('/companies', parent)).toBeNull();
});
