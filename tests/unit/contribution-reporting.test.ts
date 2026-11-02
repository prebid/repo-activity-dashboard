import { reportRows } from '../support/contribution-reports';
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
import { parseQuery } from '@/lib/presentation/url/codec';
import type { UrlRoute } from '@/lib/presentation/url/registry';
/** A canonical query's registry values, as the page helper hands them to the report. */
function at(query: string, route: UrlRoute = '/contributors') {
  const parsed = parseQuery(route, query);
  if (parsed.kind !== 'canonical') throw Error('Expected a canonical query: ' + query);
  return parsed.values;
}
beforeEach(() => {
  viewer.mockReset().mockResolvedValue({ id: 'sample-viewer' });
});
it('ships only the active report collection and no complete account directory', async () => {
  const result = await contributions('companies', at('sample=large', '/companies'));
  expect(JSON.stringify(result)).not.toContain('Sample contributor 250');
  if (result.status !== 'ready') throw Error('Expected report');
  expect(result.page.report.context).not.toHaveProperty('includedAccountIds');
  expect(result.directory).not.toHaveProperty('accounts');
});
it('composes display models once on the guarded server boundary', async () => {
  const result = await contributions('contributors');
  if (result.status !== 'ready' || result.page.report.kind !== 'overview')
    throw Error('Expected overview');
  expect(viewer).toHaveBeenCalledOnce();
  expect(reportRows(result.page.report, 'contributors')).toHaveLength(7);
  expect(result.page.report.totals.authoredPrsMerged).toEqual({ status: 'complete', value: 5 });
  expect('credits' in result.page).toBe(false);
  expect('source' in result.page).toBe(false);
});
it('keeps focus, sample, breakdown and the return context its back frame names', async () => {
  const company = { kind: 'company', companyId: 'company-acme' } as const;
  const result = await contributions(
    'companies',
    at('sample=large&view=repositories&back=~page:2', '/companies/[...identity]'),
    company,
  );
  if (result.status !== 'ready' || result.page.report.kind !== 'company')
    throw Error('Expected company');
  expect(result.page.returnTo).toBe('/companies?sample=large&page=2');
  expect(result.page.breakdown).toBe('repositories');
  expect(result.page.report.kind === 'company' && result.page.report.memberCount).toBe(100);
  expect(reportRows(result.page.report, 'repositories')).toHaveLength(18);
  const unmapped = await contributions('companies', undefined, {
    kind: 'company',
    companyId: null,
  });
  expect(unmapped.status).toBe('ready');
  // Without a frame the parent is the area report at the page's scope; `!` cannot be restored.
  const derived = await contributions('companies', at('period=last-month'), company);
  expect(derived.status === 'ready' && derived.page.returnTo).toBe('/companies?period=last-month');
  const lost = await contributions('companies', at('back=!'), company);
  expect(lost.status === 'ready' && lost.page.returnTo).toBeNull();
  // An Over time parent opens at the legacy address its screens still read.
  const fromOverTime = await contributions(
    'companies',
    at('back=/contributors/account-alice~timeline~group:week', '/companies/[...identity]'),
    company,
  );
  expect(fromOverTime.status === 'ready' && fromOverTime.page.returnTo).toBe(
    '/contributors/account-alice?scope=1&period=this-year&timeline=1&timeline.state=1' +
      '&timeline.group=week&timeline.sort=period&timeline.dir=asc&timeline.page=1',
  );
});
it('rejects invalid scenarios and unknown entities after authentication', async () => {
  expect((await contributions('contributors', { sample: 'bad' })).status).toBe('invalid');
  await expect(
    contributions('contributors', undefined, { kind: 'contributor', accountId: 'absent' }),
  ).rejects.toThrow('not-found');
  await expect(
    contributions('companies', undefined, { kind: 'company', companyId: 'absent' }),
  ).rejects.toThrow('not-found');
  viewer.mockRejectedValue(Error('denied'));
  await expect(contributions('contributors', { sample: 'bad' })).rejects.toThrow('denied');
});
it('answers the Reviewers lens and a snapshot other than the sample with the invalid view', async () => {
  const company = { kind: 'company', companyId: 'company-acme' } as const;
  expect((await contributions('companies', at('lens=reviewers', '/companies'))).status).toBe(
    'invalid',
  );
  expect((await contributions('companies', { lens: 'reviewers' }, company)).status).toBe('invalid');
  expect((await contributions('contributors', at('at=2026-10-24T12:00Z'))).status).toBe('ready');
  expect((await contributions('contributors', at('at=2026-10-01'))).status).toBe('invalid');
});

it('filters before company aggregation and keeps actor selection on focused reports', async () => {
  const result = await contributions('companies', at('type=human', '/companies'));
  if (result.status !== 'ready' || result.page.report.kind !== 'overview')
    throw Error('Expected overview');
  expect(reportRows(result.page.report, 'companies')).toHaveLength(3);
  expect(result.page.report.context.selection.actorTypes).toEqual(['human']);
  expect(result.page.report.totals.mergesPerformed).toEqual({ status: 'complete', value: 4 });
  expect('actorTypes' in result.page).toBe(false);
  const empty = await contributions('contributors', at('type='));
  if (empty.status !== 'ready' || empty.page.report.kind !== 'overview')
    throw Error('Expected overview');
  expect(reportRows(empty.page.report, 'contributors')).toEqual([]);
});

it('applies repository, period, inclusion union and exclusion once before all report projections', async () => {
  const query =
    'period=this-month&repo=prebidjs&type=human&account=account-alice&company=company-acme&exclude=account-alice';
  const result = await contributions('companies', at(query, '/companies/[...identity]'), {
    kind: 'company',
    companyId: 'company-acme',
  });
  if (result.status !== 'ready' || result.page.report.kind !== 'company')
    throw Error('Expected company');
  expect(reportRows(result.page.report, 'members').map((row) => row.account.id)).toEqual([
    'account-bob',
    'account-eve',
  ]);
  const byRepository = await contributions(
    'companies',
    at(query + '&view=repositories', '/companies/[...identity]'),
    { kind: 'company', companyId: 'company-acme' },
  );
  if (byRepository.status !== 'ready') throw Error('Expected report');
  expect(
    reportRows(byRepository.page.report, 'repositories').map((row) => row.repository.id),
  ).toEqual(['repo-prebidjs']);
  expect(result.page.report.context.range.start).toBe('2026-10-01T00:00:00.000Z');
  expect(result.directory).not.toHaveProperty('accounts');
  expect(result.directory.repositories).toHaveLength(18);
  const excluded = await contributions('contributors', at(query, '/contributors/[accountId]'), {
    kind: 'contributor',
    accountId: 'account-alice',
  });
  if (excluded.status !== 'ready') throw Error('Expected ready');
  expect(excluded.page.report.context.includedAccountCount).toBe(0);
  for (const invalid of ['repo=absent', 'exclude=absent', 'period=2027-01-01..2027-01-02'])
    expect((await contributions('contributors', at(invalid))).status).toBe('invalid');
});
it('keeps 100 company members and full totals upstream of 50-row pagination', async () => {
  const result = await contributions(
    'companies',
    at('sample=large&company=company-acme', '/companies/[...identity]'),
    { kind: 'company', companyId: 'company-acme' },
  );
  if (result.status !== 'ready' || result.page.report.kind !== 'company')
    throw Error('Expected company');
  expect(result.page.report.kind === 'company' && result.page.report.memberCount).toBe(100);
  expect(result.page.report.totals.prsAuthored).toEqual({ status: 'complete', value: 100 });
});
