import { selectRepositoryPage } from '@/lib/presentation/repository-page';
import { readRepositoryFilters } from '@/lib/presentation/repository-page-query';
import { expect, it } from 'vitest';
import {
  repositoryActivityMode,
  repositoryActivityPeriod,
  repositoryScopeValues,
  repositoryValuesAt,
} from '@/lib/presentation/repository-page-navigation';
import { readDrilldownSelection } from '@/lib/presentation/repository-drilldown';
import { repositoryColumnDefaults } from '@/lib/presentation/repository-page-preferences';
import { serializeQuery } from '@/lib/presentation/url/codec';
import type { UrlValues } from '@/lib/presentation/url/registry';
import { repositoryPageSample } from '@/mocks/repository-page';
import { repositoryOverviewSamples } from '@/mocks/repository-overview';
const repo = repositoryOverviewSamples().repositories[0].repository;
const prs = repositoryPageSample(repo, {
  selection: { scope: 'current', metric: 'totalOpenPrs' },
  returnTo: '/repos?age=60',
});
const issues = repositoryPageSample(repo, {
  selection: { scope: 'current', metric: 'openIssues' },
  returnTo: '/repos',
});
const query = (values: UrlValues) => serializeQuery('/repos/[slug]', values);
it('changes scope with compatible filters and exact branch/date context, always starting at page one', () => {
  expect(repositoryActivityMode(prs)).toBe('current');
  const period = repositoryActivityPeriod(prs);
  expect(period.selection).toEqual({ kind: 'preset', preset: 'this-month' });
  for (const [source, expected] of [
    [prs, ['totalOpenPrs', 'prsOpened', 'prsMerged']],
    [issues, ['openIssues', 'issuesOpened', 'issuesClosed']],
  ] as const) {
    const columns = { ...repositoryColumnDefaults(source), ageDays: true, author: false };
    for (const [i, mode] of (['current', 'created', 'completed'] as const).entries()) {
      const values: UrlValues = {
        ...(source.kind === 'issues' ? { view: 'issues' } : {}),
        page: '3',
        q: 'sample',
        sort: '-number',
        ageBand: '30',
        labels: ['maintenance'],
        cols: ['-author'],
        back: ['~age:60'],
      };
      const next = repositoryScopeValues(source, mode, period.range, values, columns);
      expect(next.page).toBeUndefined();
      expect(next.q).toBe('sample');
      expect(next.sort).toBe('-number');
      expect(next.labels).toEqual(['maintenance']);
      expect(next.ageBand).toBe(mode === 'current' ? '30' : undefined);
      // The return context and the chosen columns stay; only the selection changes.
      expect(next.back).toEqual(['~age:60']);
      expect(next.cols).toContain('-author');
      const selection = readDrilldownSelection(next, repo, source.asOf)!;
      expect(selection.metric).toBe(expected[i]);
      expect('branch' in selection ? selection.branch : null).toBe(
        expected[i] === 'prsMerged' ? repo.primaryBranch : null,
      );
      const moved = repositoryPageSample(repo, {
        selection: selection as Parameters<typeof repositoryPageSample>[1]['selection'],
        returnTo: '/repos',
      });
      expect(repositoryActivityMode(moved)).toBe(mode);
      if (mode !== 'current') expect(repositoryActivityPeriod(moved)).toEqual(period);
    }
  }
  const next = repositoryScopeValues(
    prs,
    'created',
    period.range,
    { reviewers: '1', approvals: '0', agentReviewer: 'yes', botReviewer: 'no' },
    repositoryColumnDefaults(prs),
  );
  expect(query(next)).toBe('period=this-month&at=2026-10-24T12:00Z&metric=prsOpened');
  // Filters the list cannot use start over rather than carrying into the new scope.
  expect(
    query(repositoryScopeValues(prs, 'current', period.range, { events: 'this-month' }, {})),
  ).toBe('');
});
it('retains arbitrary exact incoming UTC ranges, including a future unprepared range', () => {
  for (const endInclusive of [false, true]) {
    const range = {
      start: '2027-01-01T06:00:00.000Z',
      end: '2027-01-03T00:00:00.000Z',
      endInclusive,
    };
    const source = {
      ...prs,
      drilldown: {
        ...prs.drilldown,
        selection: { scope: 'period' as const, metric: 'prsOpened' as const, range },
      },
    };
    expect(repositoryActivityPeriod(source).range).toEqual(range);
    expect(repositoryActivityPeriod(source).selection).toEqual({
      kind: 'custom',
      from: '2027-01-01',
      through: endInclusive ? '2027-01-03' : '2027-01-02',
    });
  }
});
it('reads the instant a list is pinned to, else the reporting as-of', () => {
  expect(repositoryValuesAt({ at: '2026-10-01' }, prs.asOf)).toBe('2026-10-01T00:00:00.000Z');
  expect(repositoryValuesAt({ at: '2026-02-30' }, prs.asOf)).toBe(prs.asOf);
  expect(repositoryValuesAt({}, prs.asOf)).toBe(prs.asOf);
});

it('drops incompatible PR restrictions on entering merged activity, preserving compatible filters and context', () => {
  const range = repositoryActivityPeriod(prs).range;
  const created = repositoryPageSample(repo, {
    selection: { scope: 'period', metric: 'prsOpened', range },
    returnTo: '/repos?age=60',
  });
  const next = repositoryScopeValues(
    created,
    'completed',
    range,
    {
      period: 'this-month',
      at: '2026-10-24T12:00Z',
      metric: 'prsOpened',
      states: ['Open'],
      branches: ['release/v2'],
      draft: 'drafts',
      authors: ['sample-alice'],
      q: 'adapter',
      page: '4',
      sort: 'number',
      charts: true,
      back: ['~age:60'],
    },
    repositoryColumnDefaults(created),
  );
  // Without chosen columns, merged pull requests show their own default columns.
  expect(query(next)).toBe(
    'period=this-month&at=2026-10-24T12:00Z&metric=prsMerged&authors=sample-alice&q=adapter&sort=number&charts&back=~age:60',
  );
  expect(readDrilldownSelection(next, repo, created.asOf)).toMatchObject({
    branch: repo.primaryBranch,
  });
  const another = { ...created, repository: { ...repo, primaryBranch: 'main' as const } };
  expect(
    readDrilldownSelection(
      repositoryScopeValues(another, 'completed', range, {}, {}),
      another.repository,
      created.asOf,
    ),
  ).toMatchObject({ branch: 'main' });
});
it('retains current-state restrictions for period issue closures, including a reopened issue', () => {
  const range = repositoryActivityPeriod(issues).range;
  const opened = repositoryPageSample(repo, {
    selection: { scope: 'period', metric: 'issuesOpened', range },
    returnTo: '/repos',
  });
  const next = repositoryScopeValues(
    opened,
    'completed',
    range,
    { states: ['Open'], assignment: 'unassigned' },
    repositoryColumnDefaults(opened),
  );
  expect(next.metric).toBe('issuesClosed');
  expect(next.states).toEqual(['Open']);
  expect(next.assignment).toBe('unassigned');
  const closed = repositoryPageSample(repo, {
    selection: { scope: 'period', metric: 'issuesClosed', range },
    returnTo: '/repos',
  });
  if (closed.kind !== 'issues') throw Error('Expected issues');
  const reopened = {
    ...closed,
    measurement: { status: 'complete' as const, value: 1 },
    rows: [{ ...closed.rows[0], state: 'Open' as const, assignees: [] }],
  };
  expect(
    selectRepositoryPage(reopened, readRepositoryFilters(next, reopened, reopened.asOf)!).rows,
  ).toHaveLength(1);
});
