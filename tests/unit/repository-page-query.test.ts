import { readRepositoryFilterValues } from '@/lib/presentation/repository-page-query';
import { expect, it } from 'vitest';
import { repositoryPageSample } from '@/mocks/repository-page';
import { repositoryOverviewSamples } from '@/mocks/repository-overview';
import {
  readRepositoryFilters,
  writeRepositoryFilters,
  defaultRepositoryFilters,
} from '@/lib/presentation/repository-page-query';
import { repositoryPageFiltersSchema } from '@/models/repository-page';
const repo = repositoryOverviewSamples().repositories[0].repository;
const source = repositoryPageSample(repo, {
  selection: { scope: 'current', metric: 'totalOpenPrs' },
  returnTo: '/repos?age=60',
});
const range = {
  start: '2026-10-01T00:00:00.000Z',
  end: '2026-10-24T12:00:00.000Z',
  endInclusive: true,
};
const period = repositoryPageSample(repo, {
  selection: { scope: 'period', metric: 'prsOpened', range },
  returnTo: '/repos',
});
it('round-trips combined filters without changing the incoming scope, sort, or return path', () => {
  const filters = repositoryPageFiltersSchema.parse({
    kind: 'prs',
    labels: ['maintenance', 'maintenance'],
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
  const search = writeRepositoryFilters(
    'scope=current&metric=agedPrs&age=60&prs.page=3&prs.sort=number&prs.dir=desc&returnTo=%2Frepos%3Fage%3D60&issues.page=7',
    filters,
  );
  const params = new URLSearchParams(search);
  expect(params.getAll('prs.filter.labels')).toEqual(['maintenance']);
  expect(params.get('age')).toBe('60');
  expect(params.get('returnTo')).toBe('/repos?age=60');
  expect(params.get('prs.sort')).toBe('number');
  expect(params.get('issues.page')).toBe('7');
  expect(params.has('prs.page')).toBe(false);
  expect(readRepositoryFilters(search, source)).toEqual({ ...filters, labels: ['maintenance'] });

  expect(writeRepositoryFilters(search, defaultRepositoryFilters('prs'))).not.toContain(
    'prs.filter.',
  );
});
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
])('rejects malformed explicit filters: %s', (search) =>
  expect(readRepositoryFilters(search, source)).toBeNull(),
);
it('validates exact event range boundaries and current-only measures', () => {
  const filters = repositoryPageFiltersSchema.parse({
    kind: 'prs',
    eventRange: range,
    states: ['Merged'],
  });
  const search = writeRepositoryFilters('', filters);
  expect(readRepositoryFilters(search, period)).toEqual(filters);
  expect(readRepositoryFilters(search, source)).toBeNull();
  for (const eventRange of [
    { ...range, start: '2026-09-30T00:00:00.000Z' },
    { ...range, end: '2026-10-25T00:00:00.000Z' },
  ])
    expect(
      readRepositoryFilters(writeRepositoryFilters('', { ...filters, eventRange }), period),
    ).toBeNull();
  const exclusive = {
    ...period,
    drilldown: {
      ...period.drilldown,
      selection: {
        scope: 'period' as const,
        metric: 'prsOpened' as const,
        range: { ...range, endInclusive: false },
      },
    },
  };
  expect(readRepositoryFilters(search, exclusive)).toBeNull();
  expect(
    readRepositoryFilters(
      writeRepositoryFilters('', { ...filters, eventRange: { ...range, endInclusive: false } }),
      exclusive,
    ),
  ).not.toBeNull();
  for (const query of [
    'prs.filter.ageBand=0',
    'prs.filter.approvals=0',
    'prs.filter.reviewers=1',
    'prs.filter.agentReviewer=yes',
    'prs.filter.botReviewer=no',
  ])
    expect(readRepositoryFilters(query, period)).toBeNull();
});
it('keeps issue and PR namespaces separate and supports known unknown assignments', () => {
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
    readRepositoryFilters(writeRepositoryFilters('prs.filter.reviewers=1', filters), issues),
  ).toEqual(filters);
  expect(readRepositoryFilters('issues.filter.reviewers=1', issues)).toBeNull();
  const historical = {
    ...issues,
    drilldown: {
      ...issues.drilldown,
      selection: { scope: 'period' as const, metric: 'issuesOpened' as const, range },
    },
  };
  expect(readRepositoryFilters('issues.filter.states=Closed', historical)).toMatchObject({
    states: ['Closed'],
  });
});
it('rejects a repeated record search instead of choosing one of its values', () => {
  expect(readRepositoryFilterValues('prs.q=a&prs.q=b', 'prs')).toBeNull();
  expect(readRepositoryFilterValues('issues.q=a&issues.q=b', 'issues')).toBeNull();
  expect(readRepositoryFilterValues('prs.q=a', 'prs')?.search).toBe('a');
});
