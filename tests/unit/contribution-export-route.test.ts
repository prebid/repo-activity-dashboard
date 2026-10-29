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
beforeEach(() => {
  viewer.mockReset().mockResolvedValue({ id: 'sample' });
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
