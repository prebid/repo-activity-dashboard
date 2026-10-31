import { expect, it } from 'vitest';
import {
  repositoryMatrixEntryHref,
  repositoryMatrixSummaryHref,
} from '@/lib/presentation/repository-timeline-matrix-entry';

it('carries a canonical repository selection and an independent Summary snapshot', () => {
  const summary =
    '/repos?period=this-week&period2=last-month&age=30&age=60&activity.sort=prsMerged&activity.dir=desc&backlog.columns=name&backlog.columns=totalOpenPrs';
  const href = repositoryMatrixEntryHref(['repo-b', 'repo-a', 'repo-a'], summary)!;
  const query = new URL(href, 'https://example.test').searchParams;
  expect(query.getAll('repo')).toEqual(['repo-a', 'repo-b']);
  expect(query.get('timeline')).toBe('1');
  expect(query.has('period')).toBe(false);
  expect(repositoryMatrixSummaryHref(query.get('summary'))).toBe(summary);
  expect(repositoryMatrixEntryHref([], '/repos')).toBe('/repos?timeline=1&repo=');
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
  expect(repositoryMatrixEntryHref(['repo-a'], value)).toBeNull();
});
it('bounds the complete entry URL rather than accepting an oversized nested snapshot', () => {
  expect(
    repositoryMatrixEntryHref(
      Array.from({ length: 1000 }, (_, i) => 'repo-' + i),
      '/repos',
    ),
  ).toBeNull();
});
it('keeps only the Summary parameters, so nested child links stay within the link budget', () => {
  const padded = repositoryMatrixEntryHref(
    ['repo-a'],
    '/repos?period=last-month&utm_source=' + encodeURIComponent(' '.repeat(2400)),
  )!;
  expect(new URL(padded, 'https://example.test').searchParams.get('summary')).toBe(
    '/repos?period=last-month',
  );
  expect(repositoryMatrixEntryHref(['repo-a'], '/repos?q=x')).toBe('/repos?timeline=1&repo=repo-a');
});
