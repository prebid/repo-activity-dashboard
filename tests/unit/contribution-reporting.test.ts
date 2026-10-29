import { beforeEach, expect, it, vi } from 'vitest';
const viewer = vi.hoisted(() => vi.fn());
vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth/viewer', () => ({ requireViewer: viewer }));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw Error('not-found');
  },
}));
import { contributions } from '@/server/reporting';
beforeEach(() => {
  viewer.mockReset().mockResolvedValue({ id: 'sample-viewer' });
});
it('composes display models once on the guarded server boundary', async () => {
  const result = await contributions('contributors');
  if (result.status !== 'ready' || result.page.report.kind !== 'overview')
    throw Error('Expected overview');
  expect(viewer).toHaveBeenCalledOnce();
  expect(result.page.report.contributors).toHaveLength(7);
  expect(result.page.report.totals.authoredPrsMerged).toEqual({ status: 'complete', value: 5 });
  expect('credits' in result.page).toBe(false);
  expect('source' in result.page).toBe(false);
});
it('keeps focus, sample, breakdown and safe return context', async () => {
  const result = await contributions(
    'companies',
    new URLSearchParams('sample=large&view=repositories&returnTo=%2Fcompanies%3Freport.page%3D2'),
    { kind: 'company', companyId: 'company-acme' },
  );
  if (result.status !== 'ready' || result.page.report.kind !== 'company')
    throw Error('Expected company');
  expect(result.page.returnTo).toBe('/companies?report.page=2');
  expect(result.page.breakdown).toBe('repositories');
  expect(result.page.report.members).toHaveLength(100);
  expect(result.page.report.repositories).toHaveLength(18);
  const unmapped = await contributions('companies', undefined, {
    kind: 'company',
    companyId: null,
  });
  expect(unmapped.status).toBe('ready');
});
it('rejects invalid scenarios and unknown entities after authentication', async () => {
  expect((await contributions('contributors', new URLSearchParams('sample=bad'))).status).toBe(
    'invalid',
  );
  await expect(
    contributions('contributors', undefined, { kind: 'contributor', accountId: 'absent' }),
  ).rejects.toThrow('not-found');
  await expect(
    contributions('companies', undefined, { kind: 'company', companyId: 'absent' }),
  ).rejects.toThrow('not-found');
  viewer.mockRejectedValue(Error('denied'));
  await expect(contributions('contributors', new URLSearchParams('sample=bad'))).rejects.toThrow(
    'denied',
  );
});

it('filters before company aggregation and keeps actor selection on focused reports', async () => {
  const result = await contributions('companies', new URLSearchParams('type=human'));
  if (result.status !== 'ready' || result.page.report.kind !== 'overview')
    throw Error('Expected overview');
  expect(result.page.report.companies).toHaveLength(3);
  expect(result.page.report.context.selection.actorTypes).toEqual(['human']);
  expect(result.page.report.totals.mergesPerformed).toEqual({ status: 'complete', value: 4 });
  expect('actorTypes' in result.page).toBe(false);
  const empty = await contributions('contributors', new URLSearchParams('type='));
  if (empty.status !== 'ready' || empty.page.report.kind !== 'overview')
    throw Error('Expected overview');
  expect(empty.page.report.contributors).toEqual([]);
});

it('applies repository, period, inclusion union and exclusion once before all report projections', async () => {
  const query = new URLSearchParams(
    'period=this-month&repo=repo-prebidjs&population=selected&account=account-alice&company=company-acme&exclude=account-alice&type=human',
  );
  const result = await contributions('companies', query, {
    kind: 'company',
    companyId: 'company-acme',
  });
  if (result.status !== 'ready' || result.page.report.kind !== 'company')
    throw Error('Expected company');
  expect(result.page.report.members.map((row) => row.account.id)).toEqual([
    'account-bob',
    'account-eve',
  ]);
  expect(result.page.report.repositories.map((row) => row.repository.id)).toEqual([
    'repo-prebidjs',
  ]);
  expect(result.page.report.context.range.start).toBe('2026-10-01T00:00:00.000Z');
  expect(result.directory.accounts).toHaveLength(8);
  expect(result.directory.repositories).toHaveLength(18);
  const excluded = await contributions('contributors', query, {
    kind: 'contributor',
    accountId: 'account-alice',
  });
  if (excluded.status !== 'ready') throw Error('Expected ready');
  expect(excluded.page.report.context.includedAccountIds).toEqual([]);
  for (const invalid of [
    'repo=absent',
    'exclude=absent',
    'period=custom&from=2027-01-01&through=2027-01-02',
  ])
    expect((await contributions('contributors', new URLSearchParams(invalid))).status).toBe(
      'invalid',
    );
});
it('keeps 100 company members and full totals upstream of 50-row pagination', async () => {
  const result = await contributions(
    'companies',
    new URLSearchParams('sample=large&period=this-year&population=selected&company=company-acme'),
    { kind: 'company', companyId: 'company-acme' },
  );
  if (result.status !== 'ready' || result.page.report.kind !== 'company')
    throw Error('Expected company');
  expect(result.page.report.members).toHaveLength(100);
  expect(result.page.report.totals.prsAuthored).toEqual({ status: 'complete', value: 100 });
});
