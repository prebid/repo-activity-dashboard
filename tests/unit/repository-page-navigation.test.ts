import { selectRepositoryPage } from '@/lib/presentation/repository-page';
import { readRepositoryFilters } from '@/lib/presentation/repository-page-query';
import { expect, it } from 'vitest';
import {
  repositoryActivityMode,
  repositoryActivityPeriod,
  repositoryScopeHref,
} from '@/lib/presentation/repository-page-navigation';
import { readRepositoryPageEntry } from '@/lib/presentation/repository-page-entry';
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
it('changes scope with compatible filters and exact branch/date context, always starting at page one', () => {
  expect(repositoryActivityMode(prs)).toBe('current');
  const period = repositoryActivityPeriod(prs);
  expect(period.selection).toEqual({ kind: 'preset', preset: 'this-month' });
  for (const [source, expected] of [
    [prs, ['totalOpenPrs', 'prsOpened', 'prsMerged']],
    [issues, ['openIssues', 'issuesOpened', 'issuesClosed']],
  ] as const) {
    for (const [i, mode] of (['current', 'created', 'completed'] as const).entries()) {
      const search =
        source.kind +
        '.page=3&' +
        source.kind +
        '.q=sample&' +
        source.kind +
        '.sort=number&' +
        source.kind +
        '.dir=desc&' +
        source.kind +
        '.filter.ageBand=30&' +
        source.kind +
        '.filter.labels=maintenance&' +
        source.kind +
        '.columns=ageDays';
      const href = repositoryScopeHref(source, mode, period.range, search),
        params = new URL(href, 'http://localhost').searchParams;
      expect(params.get('metric')).toBe(expected[i]);
      expect(params.has(source.kind + '.page')).toBe(false);
      expect(params.get(source.kind + '.q')).toBe('sample');
      expect(params.get(source.kind + '.sort')).toBe('number');
      expect(params.get(source.kind + '.filter.labels')).toBe('maintenance');
      expect(params.has(source.kind + '.filter.ageBand')).toBe(mode === 'current');
      expect(params.get('branch')).toBe(expected[i] === 'prsMerged' ? repo.primaryBranch : null);
      const entry = readRepositoryPageEntry(params, repo);
      if (entry.status !== 'records') throw new Error('Expected records');
      const next = repositoryPageSample(repo, entry.drilldown);
      expect(repositoryActivityMode(next)).toBe(mode);
      if (mode !== 'current') expect(repositoryActivityPeriod(next)).toEqual(period);
    }
  }
  const next = new URL(
    repositoryScopeHref(
      prs,
      'created',
      period.range,
      'prs.filter.reviewers=1&prs.filter.approvals=0&prs.filter.agentReviewer=yes&prs.filter.botReviewer=no',
    ),
    'http://localhost',
  );
  expect([...next.searchParams.keys()].some((key) => key.includes('.filter.'))).toBe(false);
  expect(repositoryScopeHref(prs, 'current', period.range, 'prs.filter.bad=1')).not.toContain(
    'bad',
  );
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

it('drops incompatible PR restrictions on entering merged activity, preserving compatible filters and context', () => {
  const range = repositoryActivityPeriod(prs).range;
  const created = repositoryPageSample(repo, {
    selection: { scope: 'period', metric: 'prsOpened', range },
    returnTo: '/repos?age=60',
  });
  const href = repositoryScopeHref(
    created,
    'completed',
    range,
    'prs.filter.states=Open&prs.filter.branches=release%2Fv2&prs.filter.draft=drafts&prs.filter.authors=sample-alice&prs.q=adapter&prs.page=4&prs.sort=number&prs.charts=0',
  );
  const p = new URL(href, 'http://local').searchParams;
  expect(p.get('metric')).toBe('prsMerged');
  expect(p.get('branch')).toBe(repo.primaryBranch);
  expect(p.has('prs.filter.states')).toBe(false);
  expect(p.has('prs.filter.branches')).toBe(false);
  expect(p.has('prs.filter.draft')).toBe(false);
  expect(p.get('prs.filter.authors')).toBe('sample-alice');
  expect(p.get('prs.q')).toBe('adapter');
  expect(p.get('prs.sort')).toBe('number');
  expect(p.get('prs.charts')).toBe('0');
  expect(p.has('prs.page')).toBe(false);
  expect(p.get('returnTo')).toBe('/repos?age=60');
  const another = { ...created, repository: { ...repo, primaryBranch: 'main' as const } };
  expect(
    new URL(repositoryScopeHref(another, 'completed', range, ''), 'http://local').searchParams.get(
      'branch',
    ),
  ).toBe('main');
});
it('retains current-state restrictions for period issue closures, including a reopened issue', () => {
  const range = repositoryActivityPeriod(issues).range;
  const opened = repositoryPageSample(repo, {
    selection: { scope: 'period', metric: 'issuesOpened', range },
    returnTo: '/repos',
  });
  const p = new URL(
    repositoryScopeHref(
      opened,
      'completed',
      range,
      'issues.filter.states=Open&issues.filter.assignment=unassigned',
    ),
    'http://local',
  ).searchParams;
  expect(p.get('metric')).toBe('issuesClosed');
  expect(p.get('issues.filter.states')).toBe('Open');
  expect(p.get('issues.filter.assignment')).toBe('unassigned');
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
    selectRepositoryPage(reopened, readRepositoryFilters(p.toString(), reopened)).rows,
  ).toHaveLength(1);
});
