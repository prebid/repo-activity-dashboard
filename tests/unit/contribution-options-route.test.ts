import { beforeEach, expect, it, vi } from 'vitest';
const viewer = vi.hoisted(() => vi.fn());
vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth/viewer', () => ({ requireViewer: viewer }));
import { contributionOptionsResponse } from '@/server/contribution-options';
import { contributionDirectorySample, contributionSampleAsOf } from '@/mocks/contributions';
import { defaultContributionSettings } from '@/lib/presentation/contribution-settings';
const url = 'https://dashboard.test/api/reporting/contribution-options';
const query = { kind: 'accounts', search: '', page: 0, selectedIds: null };
const request = (body: unknown) =>
  new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  viewer.mockReset().mockResolvedValue({ id: 'viewer' });
});
it('authenticates before processing requests and returns bounded private metadata', async () => {
  viewer.mockRejectedValueOnce(Error('denied'));
  await expect(contributionOptionsResponse(request({}))).rejects.toThrow('denied');
  const response = await contributionOptionsResponse(
    request({ action: 'choices', sample: 'large', query }),
  );
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  const body: unknown = await response.json();
  expect(body).toMatchObject({ total: 251, page: 0 });
  expect(JSON.stringify(body)).not.toContain('records');
  expect(JSON.stringify(body)).not.toContain('account-person-051');
});
it('validates saved identities against the full catalogue without returning the catalogue', async () => {
  const settings = defaultContributionSettings(contributionDirectorySample('reference'));
  settings.selection.population = {
    kind: 'selected',
    accountIds: ['account-alice'],
    companyIds: [],
  };
  const ok = await contributionOptionsResponse(
    request({ action: 'validate', sample: 'reference', settings }),
  );
  expect(await ok.json()).toMatchObject({
    settings: { selection: { population: { accountIds: ['account-alice'] } } },
  });
  settings.selection.excludedAccountIds = ['unknown'];
  expect(
    await (
      await contributionOptionsResponse(
        request({ action: 'validate', sample: 'reference', settings }),
      )
    ).json(),
  ).toEqual({ settings: null });
  expect(contributionSampleAsOf).toContain('2026');
});
it('rejects malformed, unsupported and oversized requests', async () => {
  for (const body of [
    {},
    { action: 'choices', sample: 'bad', query },
    { action: 'choices', sample: 'large', query: { ...query, page: -1 } },
    { action: 'choices', sample: 'large', query: { ...query, search: 'x'.repeat(201) } },
  ])
    expect((await contributionOptionsResponse(request(body))).status).toBe(400);
  expect(
    (
      await contributionOptionsResponse(
        new Request(url, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: '{}' }),
      )
    ).status,
  ).toBe(415);
  expect(
    (
      await contributionOptionsResponse(
        new Request(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{bad',
        }),
      )
    ).status,
  ).toBe(400);
  expect(
    (await contributionOptionsResponse(request({ oversized: 'x'.repeat(65536) }))).status,
  ).toBe(413);
});
