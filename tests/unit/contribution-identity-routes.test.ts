import { beforeEach, expect, it, vi } from 'vitest';
const viewer = vi.hoisted(() => vi.fn());
// Logical identities with reserved, percent and non-ASCII characters; each must be decoded once.
const ids = vi.hoisted(() => ({
  account: 'account-bøb/ops?#&%25',
  company: 'company-açme & co/1?#',
}));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth/viewer', () => ({ requireViewer: viewer }));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw Error('not-found');
  },
}));
// Bob and Example Acme keep every record and membership under the identities above.
vi.mock('@/mocks/contributions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/mocks/contributions')>();
  const rekey = <T>(value: T): T =>
    JSON.parse(
      JSON.stringify(value)
        .replaceAll('"account-bob"', JSON.stringify(ids.account))
        .replaceAll('"company-acme"', JSON.stringify(ids.company)),
    ) as T;
  return {
    ...actual,
    contributionSample: (...args: Parameters<typeof actual.contributionSample>) =>
      rekey(actual.contributionSample(...args)),
    contributionDirectorySample: (...args: Parameters<typeof actual.contributionDirectorySample>) =>
      rekey(actual.contributionDirectorySample(...args)),
  };
});
import ContributorPage from '@/app/(dashboard)/contributors/[accountId]/page';
import CompanyPage from '@/app/(dashboard)/companies/[...identity]/page';
import { contributionPath } from '@/lib/presentation/contribution-navigation';
import { timelineSupportHref } from '@/lib/presentation/timeline-support-query';
import { contributions } from '@/server/reporting';
import { contributionExportResponse } from '@/server/contribution-export';
import { loadTimelineReport } from '@/server/timeline-report';
import { loadTimelineSupport } from '@/server/timeline-support';
import { timelineExportResponse } from '@/server/timeline-export';
import { readCsv } from '../support/csv';
beforeEach(() => {
  viewer.mockReset().mockResolvedValue({ id: 'sample-viewer' });
});
const contributor = { kind: 'contributor', accountId: ids.account } as const;
const company = { kind: 'company', companyId: ids.company } as const;
const focusOf = (element: { props: unknown }) => (element.props as { focus: unknown }).focus;

it('decodes each route segment once into the logical identity', async () => {
  // Next.js supplies dynamic params percent-encoded with encodeURIComponent.
  const person = await ContributorPage({
    params: Promise.resolve({ accountId: encodeURIComponent(ids.account) }),
    searchParams: Promise.resolve({}),
  });
  expect(focusOf(person)).toEqual(contributor);
  const organization = await CompanyPage({
    params: Promise.resolve({ identity: ['id', encodeURIComponent(ids.company)] }),
    searchParams: Promise.resolve({}),
  });
  expect(focusOf(organization)).toEqual(company);
  expect(contributionPath(contributor)).toBe('/contributors/' + encodeURIComponent(ids.account));
});

// October PRs authored: Bob's 105 and 108; Example Acme adds Alice's 104.
it.each([
  ['contributors', contributor, 2],
  ['companies', company, 3],
] as const)(
  'serves the %s report, Timeline, support and export for the identity',
  async (area, focus, prs) => {
    const report = await contributions(area, new URLSearchParams(), focus);
    expect(report.status).toBe('ready');
    const href = contributionPath(focus) + '?timeline=1';
    const timeline = await loadTimelineReport(href);
    if (timeline.status !== 'ready' || timeline.category !== 'contribution')
      throw Error('Expected the contribution Timeline');
    const october = timeline.report.rows.find(
      (row) => row.interval.id === 'month:2026-10-01T00:00:00.000Z',
    )!;
    expect(october.values.prsAuthored).toEqual({ status: 'complete', value: prs });
    const support = new URL(
      timelineSupportHref(
        href,
        timeline.report.source,
        'prsAuthored',
        'month:2026-10-01T00:00:00.000Z',
      )!,
      'https://example.test',
    );
    const records = await loadTimelineSupport(support.pathname, support.searchParams);
    expect(records.status).toBe('ready');
    expect(JSON.stringify(records)).toContain('"number":105');
    const download = await timelineExportResponse(
      new Request('http://localhost/api/reporting/timeline-export', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          href,
          revision: timeline.report.source.scenarioId,
          asOf: timeline.report.source.asOf,
          columns: ['period', 'prsAuthored'],
        }),
      }),
    );
    expect(download.status).toBe(200);
    const csv = readCsv(await download.text());
    expect(csv.records.find((row) => row.Period === 'Oct 2026')!['PRs authored']).toBe(String(prs));
    const entity = area === 'contributors' ? 'contributor' : 'company';
    const id = area === 'contributors' ? ids.account : ids.company;
    const aggregate = await contributionExportResponse(
      new Request(
        'http://localhost/' +
          area +
          '/export?column=prsAuthored&entity=' +
          entity +
          '&entityId=' +
          encodeURIComponent(id),
      ),
      area,
    );
    expect(aggregate.status).toBe(200);
    expect(await aggregate.text()).toContain(id);
  },
);
