import { expect, it } from 'vitest';
import {
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
it('carries a canonical repository selection and an independent Summary snapshot', () => {
  const summary =
    '/repos?period=this-week&period2=last-month&age=30&age=60&activity.sort=prsMerged&activity.dir=desc&backlog.columns=name&backlog.columns=totalOpenPrs';
  const href = repositoryMatrixEntryHref(repos('repo-b', 'repo-a', 'repo-a'), summary, source)!;
  const query = new URL(href, 'https://example.test').searchParams;
  expect(query.getAll('repo')).toEqual(['repo-a', 'repo-b']);
  expect(query.get('timeline')).toBe('1');
  expect(query.has('period')).toBe(false);
  expect(repositoryMatrixSummaryHref(query.get('summary'))).toBe(summary);
  expect(repositoryMatrixEntryHref([], '/repos', source)).toBe('/repos?timeline=1&repo=');
  expect(repositoryMatrixSummaryHref(undefined)).toBe('/repos');
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
])('rejects an unsafe or recursive Summary snapshot: %s', (value) => {
  expect(repositoryMatrixSummaryHref(value)).toBeNull();
  expect(repositoryMatrixEntryHref(repos('repo-a'), value, source)).toBeNull();
});
it('reads only the Summary parameters from any matrix summary', () => {
  expect(repositoryMatrixSummaryHref('/repos?period=last-month&utm_source=x')).toBe(
    '/repos?period=last-month',
  );
  expect(repositoryMatrixSummaryHref('/repos?q=x')).toBe('/repos');
});
it('keeps only the Summary parameters, so nested child links stay within the link budget', () => {
  const padded = repositoryMatrixEntryHref(
    repos('repo-a'),
    '/repos?period=last-month&utm_source=' + encodeURIComponent(' '.repeat(2400)),
    source,
  )!;
  expect(new URL(padded, 'https://example.test').searchParams.get('summary')).toBe(
    '/repos?period=last-month',
  );
  expect(repositoryMatrixEntryHref(repos('repo-a'), '/repos?q=x', source)).toBe(
    '/repos?timeline=1&repo=repo-a',
  );
});
it('drops a Summary return context that leaves child links no room, keeping the entry', () => {
  // Child links nest the summary twice, so each '%' grows from 3 to 7 bytes.
  const summary = '/repos?backlog.q=' + encodeURIComponent('%'.repeat(1100));
  const withSummary = '/repos?timeline=1&repo=repo-a&summary=' + encodeURIComponent(summary);
  expect(contributionUrlFits(withSummary)).toBe(true);
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
