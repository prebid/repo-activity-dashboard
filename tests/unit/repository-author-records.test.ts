import { expect, it } from 'vitest';
import {
  repositoryAuthorRecordsHref,
  repositoryAuthorsHref,
  authorListQuery,
  isAuthorSelection,
  readAuthorAccountSegment,
} from '@/lib/presentation/repository-author-records';
import { authorAccountSchema, authorTableColumnIds } from '@/models/repository-insights';
import { repositoryAuthorRecordSample, repositoryInsightSample } from '@/mocks/repository-insights';
import { repositoryRecordSample } from '@/mocks/repository-records';
import { repositoryOverviewSamples } from '@/mocks/repository-overview';
import { authorColumns } from '@/features/repositories/repository-insights-view';
import { recountActivity } from '../support/world-recount';
const samples = repositoryOverviewSamples();
const repo = samples.repositories.find((row) => row.repository.slug === 'prebidjs')!.repository;
const range = samples.periods.find(
  ({ period }) => period.selection.kind === 'preset' && period.selection.preset === 'this-year',
)!.period.range;
const parent = {
  selection: { scope: 'period' as const, metric: 'prAuthors' as const, range },
  returnTo: '/repos?period=this-year&age=60',
};
const query = { search: 'sample-author', sort: 'account', descending: true, page: 2 };
it('preserves parent scope and table context without accepting an arbitrary return destination', () => {
  const href = repositoryAuthorRecordsHref(repo, parent, 'GitHub-Actions[bot]', query);
  const url = new URL(href, 'https://dashboard.invalid');
  expect(url.pathname).toBe('/repos/prebidjs/authors/github-actions%5Bbot%5D');
  expect(url.searchParams.get('metric')).toBe('prAuthors');
  expect(url.searchParams.get('returnTo')).toBe('/repos?period=this-year&age=60');
  expect(authorListQuery(url.searchParams)).toEqual(query);
  url.searchParams.set('prs.q', 'child search');
  url.searchParams.set('prs.page', '3');
  const back = new URL(
    repositoryAuthorsHref(repo, parent, authorListQuery(url.searchParams)),
    'https://dashboard.invalid',
  );
  expect(back.pathname).toBe('/repos/prebidjs');
  expect(back.searchParams.get('authors.page')).toBe('2');
  expect(back.searchParams.has('prs.q')).toBe(false);
  expect(back.searchParams.has('prs.page')).toBe(false);
  expect(authorColumns('prs', () => href).map((column) => column.id)).toEqual([
    ...authorTableColumnIds,
  ]);
  expect(() =>
    repositoryAuthorsHref(repo, { ...parent, returnTo: 'https://evil.example' }, query),
  ).toThrow();
  expect(() =>
    repositoryAuthorsHref(
      repo,
      { selection: { scope: 'current', metric: 'totalOpenPrs' }, returnTo: '/repos' },
      query,
    ),
  ).toThrow('Expected author-list scope');
});
it('validates author handles and keeps malformed author-table state bounded', () => {
  for (const value of ['', '../other', 'https://evil.example', 'a/b', 'a b', 'x'.repeat(101)])
    expect(authorAccountSchema.safeParse(value).success).toBe(false);
  expect(authorAccountSchema.parse('SAMPLE-AUTHOR-2')).toBe('sample-author-2');
  expect(
    authorListQuery(new URLSearchParams('authors.sort=unknown&authors.page=-2&authors.q=abc')),
  ).toEqual({ search: 'abc', sort: '', descending: false, page: 1 });
  expect(isAuthorSelection(parent.selection)).toBe(true);
  expect(isAuthorSelection({ ...parent.selection, metric: 'agentFeedbackCredits' })).toBe(false);
});
it('reconciles high-volume authors without expanding their records into the overview', () => {
  const recount = recountActivity(repo.id, range).counts;
  for (const [metric, total, unique] of [
    ['prAuthors', recount.prsOpened, recount.prAuthors],
    ['issueAuthors', recount.issuesOpened, recount.issueAuthors],
  ] as const) {
    const drilldown = { ...parent, selection: { ...parent.selection, metric } };
    const all = repositoryRecordSample(repo, {
      selection: {
        scope: 'period',
        metric: metric === 'prAuthors' ? 'prsOpened' : 'issuesOpened',
        range,
      },
      returnTo: parent.returnTo,
    });
    const authored = all.rows.filter((row) => row.author === 'sample-author-2');
    expect(authored.length).toBeGreaterThan(100);
    const overview = repositoryInsightSample(repo, drilldown);
    if (overview.kind !== 'authors') throw new Error('Expected authors');
    expect(overview.measurement).toEqual({ status: 'complete', value: unique });
    expect(overview.rows).toHaveLength(unique);
    expect(overview.rows.reduce((sum, row) => sum + row.recordCount, 0)).toBe(total);
    expect(overview.rows.find((row) => row.account === 'sample-author-2')).toMatchObject({
      recordCount: authored.length,
      accountType: 'agent',
    });
    expect(overview.rows.every((row) => !('records' in row))).toBe(true);
    const records = repositoryAuthorRecordSample(
      repo,
      drilldown,
      'sample-author-2',
      repositoryAuthorsHref(repo, drilldown, query),
    );
    expect(records.measurement).toEqual({ status: 'complete', value: authored.length });
    expect(records.rows).toEqual(authored);
    expect(
      records.rows.every((row) => row.createdAt >= range.start && row.createdAt <= range.end),
    ).toBe(true);
    const states = new Set(records.rows.map((row) => row.state));
    expect(states.has('Closed')).toBe(true);
    if (records.kind === 'prs') expect(states.has('Merged')).toBe(true);
  }
});
it('distinguishes a valid empty author filter from an unavailable period', () => {
  const empty = repositoryAuthorRecordSample(repo, parent, 'not-in-this-sample', '/repos');
  expect(empty.rows).toEqual([]);
  expect(empty.measurement).toEqual({ status: 'complete', value: 0 });
  const missing = repositoryAuthorRecordSample(
    repo,
    {
      ...parent,
      selection: {
        ...parent.selection,
        // The record set starts in 2024, so an earlier range has no prepared coverage.
        range: {
          start: '2023-10-01T00:00:00.000Z',
          end: '2023-10-02T00:00:00.000Z',
          endInclusive: false,
        },
      },
    },
    'sample-author-2',
    '/repos',
  );
  expect(missing.rows).toEqual([]);
  expect(missing.measurement.status).toBe('missing');
});

it.each([
  ['sample-author-2', 'sample-author-2'],
  ['SAMPLE-AUTHOR-2', 'sample-author-2'],
  ['Sample-Author-3[bot]', 'sample-author-3[bot]'],
  ['Sample-Author-3%5Bbot%5D', 'sample-author-3[bot]'],
  ['sample-author-3%5bbot%5d', 'sample-author-3[bot]'],
  ['a'.repeat(95) + '%5Bbot%5D', 'a'.repeat(95) + '[bot]'],
])('reads an account route segment once: %s', (segment, expected) => {
  expect(readAuthorAccountSegment(segment)).toBe(expected);
});
it.each([
  '',
  'bad%',
  'bad%ZZ',
  '%E0%A4%A',
  '../other',
  'https://evil.example',
  'bad%2Factor',
  'bad%20actor',
  'sample-author-3%255Bbot%255D',
  'sample-author-3[bot][bot]',
  'a'.repeat(101),
  'a'.repeat(96) + '%5Bbot%5D',
])('rejects an invalid or repeatedly encoded account segment: %s', (segment) => {
  expect(readAuthorAccountSegment(segment)).toBeNull();
});
it.each(['prAuthors', 'issueAuthors'] as const)(
  'keeps the fake bot author and its %s records consistent',
  (metric) => {
    const drilldown = { ...parent, selection: { ...parent.selection, metric } };
    const count = repositoryRecordSample(repo, {
      selection: {
        scope: 'period',
        metric: metric === 'prAuthors' ? 'prsOpened' : 'issuesOpened',
        range,
      },
      returnTo: parent.returnTo,
    }).rows.filter((row) => row.author === 'sample-author-3[bot]').length;
    expect(count).toBeGreaterThan(0);
    const overview = repositoryInsightSample(repo, drilldown);
    if (overview.kind !== 'authors') throw new Error('Expected authors');
    expect(overview.rows.find((row) => row.account === 'sample-author-3[bot]')).toMatchObject({
      accountType: 'bot',
      recordCount: count,
    });
    const records = repositoryAuthorRecordSample(repo, drilldown, 'sample-author-3[bot]', '/repos');
    expect(records.measurement).toEqual({ status: 'complete', value: count });
    expect(records.rows).toHaveLength(count);
    expect(records.rows.every((row) => row.author === 'sample-author-3[bot]')).toBe(true);
  },
);
