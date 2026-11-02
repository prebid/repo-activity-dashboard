import { expect, it } from 'vitest';
import { repositoryPageSample } from '@/mocks/repository-page';
import { repositoryOverviewSamples } from '@/mocks/repository-overview';
import {
  readRepositoryFilters,
  readRepositoryFilterValues,
  repositoryFilterFields,
  writeRepositoryFilters,
  defaultRepositoryFilters,
  repositoryFiltersNarrow,
} from '@/lib/presentation/repository-page-query';
import { mergeValues } from '@/lib/presentation/repository-url';
import { parseQuery, serializeQuery } from '@/lib/presentation/url/codec';
import type { UrlValues } from '@/lib/presentation/url/registry';
import { repositoryPageFiltersSchema, type RepositoryPageFilters } from '@/models/repository-page';
const repo = repositoryOverviewSamples().repositories[0].repository;
const asOf = '2026-10-24T12:00:00.000Z';
const source = repositoryPageSample(repo, {
  selection: { scope: 'current', metric: 'totalOpenPrs' },
  returnTo: '/repos?age=60',
});
const range = {
  start: '2026-10-01T00:00:00.000Z',
  end: asOf,
  endInclusive: true,
};
const period = repositoryPageSample(repo, {
  selection: { scope: 'period', metric: 'prsOpened', range },
  returnTo: '/repos',
});
/** Filters written into a query, then read back from that query as the page receives it. */
function roundTrip(base: UrlValues, filters: RepositoryPageFilters, at = asOf) {
  const query = serializeQuery(
    '/repos/[slug]',
    mergeValues(base, repositoryFilterFields(filters, at)),
  );
  const parsed = parseQuery('/repos/[slug]', query);
  if (parsed.kind !== 'canonical') throw new Error('Expected a canonical query: ' + query);
  return { query, values: parsed.values };
}

it('round-trips combined filters and keeps the scope, sort and return context they sit beside', () => {
  const filters = repositoryPageFiltersSchema.parse({
    kind: 'prs',
    labels: ['maintenance', 'maintenance', 'a,b'],
    authors: ['Sample-Author-2'],
    authorTypes: ['agent'],
    ageBand: 30,
    draft: 'non-drafts',
    reviewers: '0',
    approvals: '1',
    agentReviewer: 'yes',
    botReviewer: 'no',
    latestActors: ['agent'],
    branches: ['master'],
    search: 'sample',
  });
  const { query, values } = roundTrip(
    { metric: 'agedPrs', age: '60', sort: 'number', back: ['~age:60'] },
    filters,
  );
  // Free-text labels repeat their key, so a comma inside one stays part of it.
  expect(query).toBe(
    'age=60&metric=agedPrs&authors=sample-author-2&authorTypes=agent&latestActors=agent&labels=maintenance&labels=a,b&branches=master&draft=non-drafts&ageBand=30&reviewers=0&approvals=1&agentReviewer=yes&botReviewer=no&q=sample&sort=number&back=~age:60',
  );
  expect(readRepositoryFilters(values, source, asOf)).toEqual({
    ...filters,
    labels: ['maintenance', 'a,b'],
  });
  // Writing the defaults clears every filter and the search, and keeps everything else.
  const cleared = roundTrip(values, defaultRepositoryFilters('prs'));
  expect(cleared.query).toBe('age=60&metric=agedPrs&sort=number&back=~age:60');
});
it.each<UrlValues>([
  { ageBand: '12' },
  { reviewers: '4' },
  { assignment: 'assigned' },
  { authors: ['bad/name'] },
  { events: 'next-month' },
  { events: '2026-10-05..2026-10-01' },
])('rejects malformed explicit filters: %o', (values) =>
  expect(readRepositoryFilters(values, source, asOf)).toBeNull(),
);
it('validates event ranges against the period and keeps current-only measures current', () => {
  const filters = repositoryPageFiltersSchema.parse({
    kind: 'prs',
    eventRange: range,
    states: ['Merged'],
  });
  const { values } = roundTrip({}, filters);
  expect(values.events).toBe('this-month');
  expect(readRepositoryFilters(values, period, asOf)).toEqual(filters);
  expect(readRepositoryFilters(values, source, asOf)).toBeNull();
  // A range outside the period is rejected; the period an `events` value names resolves at `at`.
  expect(readRepositoryFilters({ events: 'last-month' }, period, asOf)).toBeNull();
  const week = roundTrip(
    {},
    {
      ...filters,
      eventRange: {
        start: '2026-10-05T00:00:00.000Z',
        end: '2026-10-12T00:00:00.000Z',
        endInclusive: false,
      },
    },
  );
  expect(week.values.events).toBe('2026-10-05..2026-10-11');
  expect(readRepositoryFilters(week.values, period, asOf)?.eventRange).toEqual({
    start: '2026-10-05T00:00:00.000Z',
    end: '2026-10-12T00:00:00.000Z',
    endInclusive: false,
  });
  expect(() =>
    repositoryFilterFields(
      {
        ...filters,
        eventRange: { ...range, end: '2026-10-05T06:00:00.000Z', endInclusive: false },
      },
      asOf,
    ),
  ).toThrow('cannot be written as a period');
  for (const values of [{ ageBand: '0' }, { approvals: '0' }, { reviewers: '1' }] as UrlValues[])
    expect(readRepositoryFilters(values, period, asOf)).toBeNull();
});
it('reads only the filters a list kind has and supports known unknown assignments', () => {
  const issues = repositoryPageSample(repo, {
    selection: { scope: 'current', metric: 'openIssues' },
    returnTo: '/repos',
  });
  const filters = repositoryPageFiltersSchema.parse({
    kind: 'issues',
    assignees: ['sample-maintainer'],
    assignment: 'unknown',
    ageBand: 0,
  });
  expect(
    readRepositoryFilters(roundTrip({ view: 'issues' }, filters).values, issues, asOf),
  ).toEqual(filters);
  expect(readRepositoryFilters({ reviewers: '1' }, issues, asOf)).toBeNull();
  const historical = {
    ...issues,
    drilldown: {
      ...issues.drilldown,
      selection: { scope: 'period' as const, metric: 'issuesOpened' as const, range },
    },
  };
  expect(readRepositoryFilters({ states: ['Closed'] }, historical, asOf)).toMatchObject({
    states: ['Closed'],
  });
});
it('says a list is narrowed exactly while a search or a non-default filter applies', () => {
  for (const kind of ['prs', 'issues'] as const)
    expect(repositoryFiltersNarrow(defaultRepositoryFilters(kind))).toBe(false);
  const prs = defaultRepositoryFilters('prs');
  expect(repositoryFiltersNarrow({ ...prs, search: 'keyboard' })).toBe(true);
  expect(repositoryFiltersNarrow({ ...prs, labels: ['maintenance'] })).toBe(true);
  expect(
    repositoryFiltersNarrow(repositoryPageFiltersSchema.parse({ kind: 'prs', draft: 'drafts' })),
  ).toBe(true);
  expect(repositoryFiltersNarrow({ ...prs, eventRange: range })).toBe(true);
  // An explicitly cleared range is the default, not a filter.
  expect(repositoryFiltersNarrow({ ...prs, eventRange: undefined })).toBe(false);
});

// The frozen reader and writer serve old links and the Timeline views that still read them.
it.each([
  'prs.filter.ageBand=',
  'prs.filter.reviewers=4',
  'prs.filter.assignment=assigned',
  'prs.filter.reviewers=0&prs.filter.reviewers=1',
  'prs.filter.retired=true',
  'prs.filter.ageBand=12',
  'prs.filter.authors=bad/name',
  'prs.filter.eventFrom=2026-10-01T00:00:00.000Z',
  'prs.filter.eventFrom=x&prs.filter.eventTo=y&prs.filter.eventInclusive=2',
  'prs.filter.eventFrom=x&prs.filter.eventFrom=y&prs.filter.eventTo=z&prs.filter.eventInclusive=1',
  'prs.q=a&prs.q=b',
])('rejects malformed old filter links: %s', (search) =>
  expect(readRepositoryFilterValues(search, 'prs')).toBeNull(),
);
it('writes and reads old filter keys unchanged', () => {
  const filters = repositoryPageFiltersSchema.parse({
    kind: 'prs',
    labels: ['maintenance', 'maintenance'],
    eventRange: range,
    search: 'sample',
  });
  const search = writeRepositoryFilters('prs.page=3&prs.sort=number&issues.page=7', filters);
  expect(search).toBe(
    'prs.sort=number&issues.page=7&prs.filter.labels=maintenance&prs.filter.eventFrom=2026-10-01T00%3A00%3A00.000Z&prs.filter.eventTo=2026-10-24T12%3A00%3A00.000Z&prs.filter.eventInclusive=1&prs.q=sample',
  );
  expect(readRepositoryFilterValues(search, 'prs')).toEqual({
    ...filters,
    labels: ['maintenance'],
  });
  expect(writeRepositoryFilters(search, defaultRepositoryFilters('prs'))).toBe(
    'prs.sort=number&issues.page=7',
  );
  expect(readRepositoryFilterValues('issues.q=a&issues.q=b', 'issues')).toBeNull();
  expect(readRepositoryFilterValues('prs.q=a', 'prs')?.search).toBe('a');
});
