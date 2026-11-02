import { expect, it } from 'vitest';
import {
  legacySummaryHref,
  repositoryMatrixEntryHref,
  repositoryMatrixSummaryHref,
} from '@/lib/presentation/repository-timeline-matrix-entry';
import { contributionUrlFits } from '@/lib/presentation/contribution-return';

const source = {
  source: 'sample' as const,
  scenarioId: 'all-repositories-v1',
  asOf: '2026-10-24T12:00:00.000Z',
};
const repos = (...ids: string[]) => ids.map((id) => ({ id, slug: id.replace(/^repo-/, '') }));
it('carries a canonical repository selection and the Summary in the form the matrix reads', () => {
  const summary = '/repos?period=this-week&period2=last-month&age=30,60&asort=-prsMerged&bpage=2';
  const href = repositoryMatrixEntryHref(repos('repo-b', 'repo-a', 'repo-a'), summary, source)!;
  const query = new URL(href, 'https://example.test').searchParams;
  expect(query.getAll('repo')).toEqual(['repo-a', 'repo-b']);
  expect(query.get('timeline')).toBe('1');
  expect(query.has('period')).toBe(false);
  // The Summary tab's old link answers with a 307 to this same canonical Summary.
  expect(repositoryMatrixSummaryHref(query.get('summary'))).toBe(
    '/repos?period=this-week&period2=last-month&age=30&age=60&backlog.page=2&activity.sort=prsMerged&activity.dir=desc',
  );
  expect(repositoryMatrixEntryHref([], '/repos', source)).toBe('/repos?timeline=1&repo=');
  expect(repositoryMatrixSummaryHref(undefined)).toBe('/repos');
});
it('writes the Summary’s repositories, periods and tables as the frozen reader reads them', () => {
  expect(
    legacySummaryHref(
      '/repos?repo=prebidjs,prebidserver&period=2026-10-06..2026-10-08&age=&bsort=name',
    ),
  ).toBe(
    '/repos?repo=repo-prebidjs&repo=repo-prebidserver&period=custom&from=2026-10-06&through=2026-10-08&age=&backlog.sort=name&backlog.dir=asc',
  );
  // The frozen reader takes a second period only beside an explicit first one.
  expect(legacySummaryHref('/repos?repo=&period2=2026-10-01..2026-10-02&apage=3')).toBe(
    '/repos?repo=&period2=custom&from2=2026-10-01&through2=2026-10-02&period=this-month&activity.page=3',
  );
  expect(legacySummaryHref('/repos?v=1')).toBe('/repos');
});
it.each([
  'https://example.test/repos',
  '//example.test/repos',
  '/contributors',
  '/repos/prebidjs',
  '/repos?timeline',
  '/repos?timeline=1',
  '/repos?summary=%2Frepos',
  '/repos?backlog.sort=name',
  '/repos?q=x',
])('offers no matrix entry for an address that is not a canonical Summary: %s', (value) => {
  expect(legacySummaryHref(value)).toBeNull();
  expect(repositoryMatrixEntryHref(repos('repo-a'), value, source)).toBeNull();
});
it.each([
  'https://example.test/repos',
  '//example.test/repos',
  '/contributors',
  '/repos/prebidjs',
  '/repos?timeline=1',
  '/repos?summary=%2Frepos',
  '/repos/../admin/users',
  '/repos\n',
  '/repos?x=' + 'a'.repeat(8000),
])('the matrix rejects an unsafe or recursive Summary snapshot: %s', (value) => {
  expect(repositoryMatrixSummaryHref(value)).toBeNull();
});
it('reads only the Summary parameters from any matrix summary', () => {
  expect(repositoryMatrixSummaryHref('/repos?period=last-month&utm_source=x')).toBe(
    '/repos?period=last-month',
  );
  expect(repositoryMatrixSummaryHref('/repos?q=x')).toBe('/repos');
});
it('drops a Summary return context that leaves child links no room, keeping the entry', () => {
  // Child links nest the summary twice, so each repository grows the link three times over.
  const summary = '/repos?repo=' + Array.from({ length: 400 }, (_, i) => 'r' + i).join(',');
  const legacy = legacySummaryHref(summary)!;
  expect(
    contributionUrlFits('/repos?timeline=1&repo=repo-a&summary=' + encodeURIComponent(legacy)),
  ).toBe(true);
  expect(repositoryMatrixEntryHref(repos('repo-a'), summary, source)).toBe(
    '/repos?timeline=1&repo=repo-a',
  );
});
it('offers no entry when even the bare entry leaves no room for its child links', () => {
  const ids = Array.from({ length: 450 }, (_, i) => 'repo-' + String(i).padStart(4, '0'));
  const bare = '/repos?timeline=1&' + ids.map((id) => 'repo=' + id).join('&');
  expect(contributionUrlFits(bare)).toBe(true);
  expect(repositoryMatrixEntryHref(repos(...ids), '/repos', source)).toBeNull();
  expect(
    repositoryMatrixEntryHref(
      Array.from({ length: 1000 }, (_, i) => ({ id: 'repo-' + i, slug: 'r' + i })),
      '/repos',
      source,
    ),
  ).toBeNull();
});
