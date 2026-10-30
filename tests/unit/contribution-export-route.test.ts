import { beforeEach, expect, it, vi } from 'vitest';
const viewer = vi.hoisted(() => vi.fn());
vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth/viewer', () => ({ requireViewer: viewer }));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw Error('not-found');
  },
}));
import { GET as contributorsExport } from '@/app/(dashboard)/contributors/export/route';
import { GET as companiesExport } from '@/app/(dashboard)/companies/export/route';
import { contributions } from '@/server/reporting';
import { contributionExportResponse } from '@/server/contribution-export';
const url = 'https://dashboard.test/contributors/export';
const request = (query: string) =>
  new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query }),
  });
beforeEach(() => {
  viewer.mockReset().mockResolvedValue({ id: 'viewer' });
});
it('authenticates before parsing and uses the same schema for both transport methods and layouts', async () => {
  viewer.mockRejectedValueOnce(Error('denied'));
  await expect(contributionExportResponse(request(''), 'contributors')).rejects.toThrow('denied');
  for (const layout of ['summary', 'repositories']) {
    const query =
      'column=name&column=actorType&column=company&column=approvalContributions&sample=partial&layout=' +
      layout;
    const post = await contributionExportResponse(request(query), 'contributors');
    const get = await contributionExportResponse(new Request(url + '?' + query), 'contributors');
    expect(post.status).toBe(200);
    expect(post.headers.get('cache-control')).toBe('private, no-store');
    const csv = await post.text();
    expect(csv).toBe(await get.text());
    for (const label of [
      'coverage',
      'counting basis',
      'Metric ordering',
      'Current company',
      'GitHub account',
    ])
      expect(csv).toContain(label);
  }
});
it('distinguishes missing company identities from explicit Unmapped and permits identity-only exports', async () => {
  for (const query of [
    'entity=company&column=name',
    'entity=company&entityId=&entityId=company-acme&column=name',
  ])
    expect((await contributionExportResponse(request(query), 'companies')).status).toBe(400);
  const response = await contributionExportResponse(
    request('entity=company&entityId=&column=name'),
    'companies',
  );
  expect(response.status).toBe(200);
  const csv = await response.text();
  expect(csv).toContain('account-drew');
  expect(csv).not.toContain('account-alice');
  expect(csv).not.toContain('Account type');
  expect(csv).not.toContain('counting basis');
});
it('rejects invalid and oversized request bodies', async () => {
  expect(
    (
      await contributionExportResponse(
        new Request(url, { method: 'POST', body: '{}' }),
        'contributors',
      )
    ).status,
  ).toBe(415);
  expect(
    (await contributionExportResponse(request('x'.repeat(65536)), 'contributors')).status,
  ).toBe(413);
  expect((await contributionExportResponse(request('column=bogus'), 'contributors')).status).toBe(
    400,
  );
});

it('requires a current signed-in viewer before parsing any export or drilldown request', async () => {
  viewer.mockRejectedValue(Error('denied'));
  await expect(
    contributorsExport(new Request('http://localhost/contributors/export?column=bad')),
  ).rejects.toThrow('denied');
  await expect(contributions('contributors', new URLSearchParams('metric=bad'))).rejects.toThrow(
    'denied',
  );
});
it('downloads private, non-cacheable CSV using the full scope and selected columns', async () => {
  const response = await companiesExport(
    new Request(
      'http://localhost/companies/export?sample=large&column=prsAuthored&layout=repositories&repo=repo-prebidjs&population=selected&company=company-acme&exclude=account-person-001',
    ),
  );
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(response.headers.get('content-type')).toBe('text/csv; charset=utf-8');
  expect(response.headers.get('content-disposition')).toContain('attachment;');
  expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  const csv = await response.text();
  expect(csv.split('\r\n')).toHaveLength(2);
  expect(csv).toContain('"5"');
  expect(csv).toContain('"repo-prebidjs"');
  expect(csv).not.toContain('"Approval contributions"');
  const individual = await contributorsExport(
    new Request(
      'http://localhost/contributors/export?column=prsAuthored&entity=contributor&entityId=account-alice',
    ),
  );
  expect((await individual.text()).split('\r\n')).toHaveLength(3);
});
it('rejects invalid metric columns, scopes and focused identities rather than widening the report', async () => {
  for (const query of [
    'column=bad',
    'column=prsAuthored&repo=absent',
    'column=prsAuthored&period=custom',
  ])
    expect(
      (await contributorsExport(new Request('http://localhost/contributors/export?' + query)))
        .status,
    ).toBe(400);
  await expect(
    contributorsExport(
      new Request(
        'http://localhost/contributors/export?column=prsAuthored&entity=contributor&entityId=absent',
      ),
    ),
  ).rejects.toThrow('not-found');
  expect((await contributions('contributors', new URLSearchParams('metric=bad'))).status).toBe(
    'invalid',
  );
});
it('composes optional metric details once with the same scope and counts as the report', async () => {
  const result = await contributions(
    'companies',
    new URLSearchParams('metric=reviewed.filesChanged&repo=repo-prebidjs&exclude=account-alice'),
    { kind: 'company', companyId: 'company-acme' },
  );
  if (result.status !== 'ready') throw Error('ready');
  expect(viewer).toHaveBeenCalledOnce();
  expect(result.page.details?.measurement).toEqual(
    result.page.report.additionalTotals['reviewed.filesChanged'],
  );
  expect(result.page.details?.rows.every((row) => row.account.id === 'account-bob')).toBe(true);
  expect(result.page.details?.context.selection.repositoryIds).toEqual(['repo-prebidjs']);
  expect('credits' in result.page).toBe(false);
});
