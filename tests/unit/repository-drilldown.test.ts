import { expect, it } from 'vitest';
import {
  childHref,
  readDrilldownSelection,
  repositoryDrilldownHref,
  readRepositoryDrilldown,
  summaryBack,
  summaryReturnTo,
} from '@/lib/presentation/repository-drilldown';
import { parseQuery } from '@/lib/presentation/url/codec';
import type { UrlValues } from '@/lib/presentation/url/registry';
import { overviewReturnPathSchema, type DrilldownSelection } from '@/models/repository-drilldown';
import { activityMetricIds, agingThresholds, backlogMetricIds } from '@/models/repository-overview';

const repo = {
  id: 'repo-prebidjs',
  slug: 'prebidjs',
  name: 'Prebid.js',
  primaryBranch: 'master' as const,
};
const asOf = '2026-10-24T12:00:00.000Z';
const range = {
  start: '2026-10-01T00:00:00.000Z',
  end: asOf,
  endInclusive: true,
};
/** The canonical values of a repository page href. */
function valuesOf(href: string) {
  const url = new URL(href, 'https://dashboard.invalid');
  const parsed = parseQuery('/repos/[slug]', url.search);
  if (parsed.kind !== 'canonical') throw new Error('Expected a canonical href: ' + href);
  return parsed.values;
}
const view = (href: string) => ({
  route: '/repos/[slug]' as const,
  segments: { slug: ['prebidjs'] },
  values: valuesOf(href),
});

it('writes a drilldown as its metric and age, with the Summary it came from as a back frame', () => {
  expect(
    repositoryDrilldownHref(repo, {
      selection: { scope: 'current', metric: 'agedPrs', ageDays: 30 },
      returnTo: '/repos?repo=prebidjs,prebidserver&asort=-prsMerged',
    }),
  ).toBe('/repos/prebidjs?age=30&metric=agedPrs&back=~repo:prebidjs,prebidserver~asort:-prsMerged');
  // The record kinds' default lists are their entries, and a v1-default Summary costs nothing.
  for (const returnTo of ['/repos', '/repos?v=1'])
    expect(
      repositoryDrilldownHref(repo, {
        selection: { scope: 'current', metric: 'openIssues' },
        returnTo,
      }),
    ).toBe('/repos/prebidjs?view=issues');
  expect(
    repositoryDrilldownHref(repo, {
      selection: { scope: 'current', metric: 'totalOpenPrs' },
      returnTo: '/repos',
    }),
  ).toBe('/repos/prebidjs');
});
it('writes a period as its preset and snapshot, and carries the target table’s presentation', () => {
  expect(
    repositoryDrilldownHref(
      repo,
      {
        selection: { scope: 'period', metric: 'prsOpened', range },
        returnTo: '/repos?period=last-month&period2=this-month',
      },
      { sort: 'title', cols: ['labels'], charts: true },
    ),
  ).toBe(
    '/repos/prebidjs?period=this-month&at=2026-10-24T12:00Z&metric=prsOpened&sort=title&cols=labels&charts&back=~period:last-month~period2:this-month',
  );
});
it('marks a Summary that cannot be restored unavailable instead of dropping it', () => {
  for (const returnTo of [null, '/repos?repo=repo-prebidjs', '/repos?timeline'])
    expect(
      repositoryDrilldownHref(repo, {
        selection: { scope: 'period', metric: 'prsMerged', range, branch: 'master' },
        returnTo,
      }),
    ).toBe('/repos/prebidjs?period=this-month&at=2026-10-24T12:00Z&metric=prsMerged&back=!');
});
it('round-trips every approved metric and threshold through its canonical href', () => {
  const selections: DrilldownSelection[] = [
    ...backlogMetricIds.map((metric): DrilldownSelection => ({ scope: 'current', metric })),
    ...agingThresholds.map((ageDays): DrilldownSelection => ({
      scope: 'current',
      metric: 'agedPrs',
      ageDays,
    })),
    ...activityMetricIds.map((metric): DrilldownSelection => ({
      scope: 'period',
      metric,
      range,
      ...(metric === 'prsMerged' ? { branch: 'master' } : {}),
    })),
    // An interval that ended before the snapshot keeps its exclusive end.
    {
      scope: 'period',
      metric: 'medianMergeDays',
      branch: 'master',
      range: {
        start: '2026-10-01T00:00:00.000Z',
        end: '2026-10-24T00:00:00.000Z',
        endInclusive: false,
      },
    },
  ];
  expect(selections).toHaveLength(37);
  for (const selection of selections) {
    const href = repositoryDrilldownHref(repo, { selection, returnTo: '/repos' });
    expect(readDrilldownSelection(valuesOf(href), repo, asOf), href).toEqual(selection);
  }
});
it('resolves an unpinned period at the reporting as-of and the merge branch from the catalog', () => {
  const main = { ...repo, primaryBranch: 'main' as const };
  expect(readDrilldownSelection({ metric: 'prsMerged', period: 'this-month' }, main, asOf)).toEqual(
    { scope: 'period', metric: 'prsMerged', range, branch: 'main' },
  );
  expect(() =>
    repositoryDrilldownHref(repo, {
      selection: { scope: 'period', metric: 'prsMerged', branch: 'main', range },
      returnTo: '/repos',
    }),
  ).toThrow('Invalid repository drilldown');
  // An exclusive range that ends between days has no period to stand for it.
  expect(() =>
    repositoryDrilldownHref(repo, {
      selection: {
        scope: 'period',
        metric: 'prsOpened',
        range: { ...range, endInclusive: false },
      },
      returnTo: '/repos',
    }),
  ).toThrow('Invalid repository drilldown');
});
it.each<UrlValues>([
  { view: 'issues', metric: 'prsOpened', period: 'this-month' },
  { metric: 'missing' },
  { metric: 'agedPrs' },
  { metric: 'agedPrs', age: '31' },
  { metric: 'openIssues', age: '30' },
  { metric: 'openIssues', period: 'this-month' },
  { at: '2026-10-24' },
  { metric: 'prsOpened' },
  { metric: 'prsOpened', period: 'this-month', at: '2026-02-30' },
  { metric: 'prsOpened', period: 'next-month' },
  { metric: 'prsOpened', period: 'this-month', age: '30' },
])('selects no list for contradictory or incomplete values: %o', (values) => {
  expect(readDrilldownSelection(values, repo, asOf)).toBeNull();
});
it('names the Summary a page returns to: none, a restored frame, or unavailable', () => {
  expect(summaryReturnTo(view('/repos/prebidjs?metric=draftPrs'))).toBe('/repos');
  expect(summaryReturnTo(view('/repos/prebidjs?back=-'))).toBe('/repos?v=1');
  expect(summaryReturnTo(view('/repos/prebidjs?back=~age:60,90~bsort:name'))).toBe(
    '/repos?age=60,90&bsort=name',
  );
  for (const frame of ['!', '~nope:1', '/contributors'])
    expect(summaryReturnTo(view('/repos/prebidjs?back=' + frame)), frame).toBeNull();
  const list = view('/repos/prebidjs?metric=draftPrs');
  expect(summaryBack(list, '/repos?age=60')).toEqual(['~age:60']);
  expect(summaryBack(list, '/repos')).toEqual(['-']);
});
it('refuses a link whose own values leave its frames no room under the URL cap', () => {
  expect(() =>
    childHref({
      route: '/repos/[slug]',
      segments: { slug: ['prebidjs'] },
      values: { q: 'x'.repeat(500), labels: Array(14).fill('y'.repeat(500)), back: ['~age:60'] },
    }),
  ).toThrow('This link is too large to open.');
});

// The frozen reader decodes old links for their redirect to the canonical form.
it('reads old links and ignores unrelated table parameters', () => {
  expect(
    readRepositoryDrilldown(new URLSearchParams('returnTo=%2Frepos%3Fperiod%3Dthis-week'), repo),
  ).toEqual({ status: 'none' });
  expect(readRepositoryDrilldown(new URLSearchParams('view=issues&issues.page=2'), repo)).toEqual({
    status: 'none',
  });
  expect(
    readRepositoryDrilldown(
      new URLSearchParams(
        'scope=period&metric=prsMerged&from=2026-10-01T00:00:00.000Z&to=2026-10-24T12:00:00.000Z&inclusive=1&branch=main&prs.page=2',
      ),
      { ...repo, primaryBranch: 'main' },
    ),
  ).toEqual({
    status: 'valid',
    value: {
      selection: { scope: 'period', metric: 'prsMerged', branch: 'main', range },
      returnTo: '/repos',
    },
  });
});
it.each([
  'metric=openIssues',
  'scope=current',
  'scope=current&metric=missing',
  'scope=current&metric=agedPrs',
  'scope=current&metric=agedPrs&age=31',
  'scope=current&metric=openIssues&age=30',
  'scope=current&metric=openIssues&branch=main',
  'scope=period&metric=prsOpened',
  'scope=period&metric=prsOpened&inclusive=yes',
  'returnTo=https://evil.example',
])('rejects malformed scope instead of selecting a different list: %s', (query) => {
  expect(readRepositoryDrilldown(new URLSearchParams(query), repo)).toEqual({ status: 'invalid' });
});
it('requires the configured primary branch only for old merge links', () => {
  const merged =
    'scope=period&metric=prsMerged&from=2026-10-01T00:00:00.000Z&to=2026-10-24T12:00:00.000Z&inclusive=1';
  expect(readRepositoryDrilldown(new URLSearchParams(merged + '&branch=main'), repo)).toEqual({
    status: 'invalid',
  });
  expect(readRepositoryDrilldown(new URLSearchParams(merged), repo)).toEqual({
    status: 'invalid',
  });
  expect(
    readRepositoryDrilldown(
      new URLSearchParams(merged.replace('prsMerged', 'prsOpened') + '&branch=master'),
      repo,
    ),
  ).toEqual({ status: 'invalid' });
});
it.each([
  'https://evil.example',
  '//evil.example',
  '/repos/elsewhere',
  '/repos#x',
  '/repos\\evil',
  '/repos\n',
  '/admin/users',
])('rejects unsafe or unrelated return path %s', (value) =>
  expect(overviewReturnPathSchema.safeParse(value).success).toBe(false),
);
it('uses the first scalar value consistently with foundation query parsing', () => {
  expect(
    readRepositoryDrilldown(
      new URLSearchParams('scope=current&metric=openIssues&metric=draftPrs'),
      repo,
    ),
  ).toEqual({
    status: 'valid',
    value: { selection: { scope: 'current', metric: 'openIssues' }, returnTo: '/repos' },
  });
});
