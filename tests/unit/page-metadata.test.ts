import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  getViewer: vi.fn(),
  headers: vi.fn(),
  notFound: vi.fn(),
  redirect: vi.fn(),
}));
vi.mock('server-only', () => ({}));
// Only getViewer: calling requireViewer from metadata would fail on the missing export.
vi.mock('@/lib/auth/viewer', () => ({ getViewer: mocks.getViewer }));
vi.mock('next/headers', () => ({ headers: mocks.headers }));
vi.mock('next/navigation', () => ({ notFound: mocks.notFound, redirect: mocks.redirect }));
import {
  contributionPageMetadata,
  repositoriesPageMetadata,
  repositoryAuthorPageMetadata,
  repositoryPageMetadata,
} from '@/server/page-metadata';

const range = 'from=2026-01-01T00:00:00.000Z&to=2026-10-24T12:00:00.000Z&inclusive=1';
const query = (search: string) => new URLSearchParams(search);
const user = { id: 'viewer', email: 'viewer@example.test', role: 'user', authVersion: 1 };
const permitted = [
  () => repositoriesPageMetadata(query('timeline=1')),
  () => repositoryPageMetadata('prebidjs', query('view=issues')),
  () =>
    repositoryAuthorPageMetadata(
      'prebidjs',
      'sample-author-2',
      query('scope=period&metric=prAuthors&' + range),
    ),
  () => contributionPageMetadata('contributors', query('')),
  () =>
    contributionPageMetadata('contributors', query(''), {
      kind: 'contributor',
      accountId: 'account-alice',
    }),
  () =>
    contributionPageMetadata('companies', query('view=repositories'), {
      kind: 'company',
      companyId: 'company-acme',
    }),
  () => contributionPageMetadata('companies', query(''), { kind: 'company', companyId: null }),
];
let request: object;
beforeEach(() => {
  request = new Headers();
  mocks.headers.mockReset().mockImplementation(() => Promise.resolve(request));
  mocks.getViewer.mockReset().mockResolvedValue({ kind: 'authenticated', user });
});

describe('authenticated viewers', () => {
  it('receive each page title', async () => {
    expect(await Promise.all(permitted.map((metadata) => metadata()))).toEqual([
      { title: 'Timeline · All repositories' },
      { title: 'Open issues · Prebid.js' },
      { title: 'PRs by sample-author-2 · Prebid.js' },
      { title: 'Contributors' },
      { title: 'Alice · Contributors' },
      { title: 'By repository · Example Acme' },
      { title: 'Unmapped company · Companies' },
    ]);
    expect(mocks.notFound).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
  it('resolve names in the sample scenario the URL selects', async () => {
    const person = { kind: 'contributor', accountId: 'account-person-001' } as const;
    expect(await contributionPageMetadata('contributors', query('sample=large'), person)).toEqual({
      title: 'Sample contributor 1 · Contributors',
    });
    expect(await contributionPageMetadata('contributors', query(''), person)).toEqual({});
  });
  it.each([
    ['an unknown repository', () => repositoryPageMetadata('not-in-catalog', query(''))],
    [
      'an author of an unknown repository',
      () => repositoryAuthorPageMetadata('not-in-catalog', 'sample-author-2', query('')),
    ],
    [
      'an unknown contributor',
      () =>
        contributionPageMetadata('contributors', query(''), {
          kind: 'contributor',
          accountId: 'no-such-account',
        }),
    ],
    [
      'an unknown company',
      () =>
        contributionPageMetadata('companies', query(''), {
          kind: 'company',
          companyId: 'no-such-company',
        }),
    ],
    ['an undecodable identity', () => contributionPageMetadata('companies', query(''), null)],
    [
      'an unknown sample scenario',
      () =>
        contributionPageMetadata('contributors', query('sample=bogus'), {
          kind: 'contributor',
          accountId: 'account-alice',
        }),
    ],
  ])('receive the default title for %s', async (_, metadata) => {
    expect(await metadata()).toEqual({});
    expect(mocks.notFound).not.toHaveBeenCalled();
  });
});

describe.each([
  ['anonymous viewers', { kind: 'anonymous' }],
  ['unavailable accounts', { kind: 'unavailable' }],
  ['configuration failures', { kind: 'configuration' }],
  ['integrity failures', { kind: 'integrity' }],
  [
    'viewers who must change their password',
    { kind: 'authenticated', user: { ...user, mustChangePassword: true } },
  ],
])('%s', (_, decision) => {
  it('receive only the default title', async () => {
    mocks.getViewer.mockResolvedValue(decision);
    for (const metadata of permitted) expect(await metadata()).toEqual({});
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});

it('reads the viewer once per request, including the redirect render', async () => {
  await repositoriesPageMetadata(query(''));
  await contributionPageMetadata('contributors', query('timeline=1'));
  expect(mocks.getViewer).toHaveBeenCalledTimes(1);
  request = new Headers();
  await repositoriesPageMetadata(query(''));
  expect(mocks.getViewer).toHaveBeenCalledTimes(2);
});
