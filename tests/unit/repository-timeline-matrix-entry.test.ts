import { expect, it } from 'vitest';
import { repositoryMatrixEntryHref } from '@/lib/presentation/repository-timeline-matrix-entry';
import { resolveBack, viewOf } from '@/lib/presentation/url/back';
import { repositoryCatalog } from '@/config/repositories';

const source = {
  source: 'sample' as const,
  scenarioId: 'all-repositories-v1',
  asOf: '2026-10-24T12:00:00.000Z',
};
const enabled = repositoryCatalog
  .filter((row) => row.enabled)
  .map((row) => ({ id: row.id, slug: row.slug }));
const repos = (...slugs: string[]) => slugs.map((slug) => ({ id: 'repo-' + slug, slug }));

it('opens the matrix from a Summary at the defaults with the shortest link', () => {
  for (const summary of ['/repos', '/repos?v=1'])
    expect(repositoryMatrixEntryHref(enabled, summary, source)).toBe('/repos?timeline');
});
it('carries the Summary’s repositories and keeps the rest of the Summary as the parent frame', () => {
  const summary =
    '/repos?repo=prebidjs,prebidserver&period=this-week&period2=last-month&age=30,60&asort=-prsMerged&bpage=2';
  const href = repositoryMatrixEntryHref(
    repos('prebidserver', 'prebidjs', 'prebidjs'),
    summary,
    source,
  )!;
  expect(href).toBe(
    '/repos?timeline&repo=prebidjs,prebidserver&back=~period:this-week~period2:last-month~age:30,60~bpage:2~asort:-prsMerged',
  );
  const [parent] = resolveBack(viewOf(href)!);
  expect(parent).toMatchObject({ available: true, view: viewOf(summary) });
  // A matrix of no repositories still returns to the Summary of every repository it came from.
  expect(repositoryMatrixEntryHref([], '/repos', source)).toBe('/repos?timeline&repo=&back=~-repo');
});
it.each([
  'https://example.test/repos',
  '//example.test/repos',
  '/contributors',
  '/repos/prebidjs',
  '/repos?timeline=1',
  '/repos?summary=%2Frepos',
  '/repos?backlog.sort=name',
  '/repos?q=x',
])('offers no matrix entry for an address that is not a canonical Summary: %s', (value) => {
  expect(repositoryMatrixEntryHref(repos('prebidjs'), value, source)).toBeNull();
});
it('offers no matrix entry when its Summary frame exceeds the frame budget', () => {
  const ages = Array.from({ length: 400 }, (_, index) => String(index + 1)).join(',');
  expect(repositoryMatrixEntryHref(repos('prebidjs'), '/repos?age=' + ages, source)).toBeNull();
});
