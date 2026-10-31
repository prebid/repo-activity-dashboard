import { canonicalRoutePath } from '@/lib/presentation/navigation';
import { timelineSupportScopeKey } from '@/lib/presentation/timeline-support-query';
import { expect, it } from 'vitest';
import {
  readTimelineView,
  writeTimelineView,
  writeTimelinePeriod,
  timelinePreferenceKey,
  timelinePreferenceFields,
  timelinePreferenceParameters,
  validateTimelineProposal,
  readTimelinePreferences,
  mergeTimelinePreferenceParameters,
  resolveTimelinePresentation,
  readTimelineSource,
} from '@/lib/presentation/timeline-controls';
import {
  contributionTimelineEntry,
  repositoryTimelineEntry,
  repositoryTimelineOrigin,
  matrixRepositoryTimelineHref,
  safeTimelineParent,
} from '@/lib/presentation/timeline-navigation';
import {
  contributionReturnHref,
  withContributionReturn,
} from '@/lib/presentation/contribution-return';
import { repositoryTimelineFamilyMetrics } from '@/models/repository-timeline';
import { repositoryPageSample } from '@/mocks/repository-page';
import { defaultRepositoryFilters } from '@/lib/presentation/repository-page-query';
import { defaultContributionSettings } from '@/lib/presentation/contribution-settings';
import { repositoryCatalog } from '@/config/repositories';
import type { TimelineArea, TimelineControlContext } from '@/models/timeline-controls';
const asOf = '2026-10-24T12:00:00.000Z';
const repos = repositoryCatalog
  .filter((row) => row.enabled)
  .map((row) => ({
    id: row.id,
    name: row.displayName,
    slug: row.slug,
    primaryBranch: row.primaryBranch === 'main' ? ('main' as const) : ('master' as const),
  }));
function parse(query = 'timeline=1', area: TimelineArea = 'matrix') {
  return readTimelineView(new URLSearchParams(query), area, asOf);
}
function context(area: TimelineArea = 'matrix'): TimelineControlContext {
  const parsed = parse('timeline=1', area);
  return {
    area,
    path: '/repos',
    href: '/repos?timeline=1',
    sample: 'reference',
    preferenceScope: area,
    asOf,
    ...parsed,
    repositories: repos,
  };
}
it('round trips each active view with relative dates, independent pages, windows and columns', () => {
  for (const area of ['matrix', 'repository', 'contribution'] as const) {
    const first = parse('timeline=1&timeline.group=day', area);
    const search = writeTimelineView('timeline=1', area, {
      ...first.view,
      page: 2,
      window: 20,
      ...(area === 'matrix' ? {} : { columns: [] }),
    });
    const second = parse(search, area);
    expect(second.view.page).toBe(2);
    expect(second.view.grouping).toBe('day');
    if (area === 'matrix') expect(second.view.window).toBe(20);
    else expect(second.view.columns).toEqual([]);
    expect(second.period).toEqual({ kind: 'preset', preset: 'this-year' });
  }
  expect(parse('timeline=1&timeline.metric=medianMergeDays').view.metric).toBe('medianMergeDays');
  expect(
    parse('timeline=1&timeline.kind=issues&timeline.family=snapshot', 'repository').metricIds,
  ).toEqual(['openIssues']);
  expect(repositoryTimelineFamilyMetrics('issues', 'activity')).toEqual([
    'issuesOpened',
    'issuesClosed',
    'issueAuthors',
  ]);
});
it.each([
  'timeline=0',
  'timeline=1&timeline.state=2',
  'timeline=1&timeline.group=bad',
  'timeline=1&timeline.weird=1',
  'timeline=1&timeline.page=0',
  'timeline=1&timeline.page=-1',
  'timeline=1&timeline.page=1000001',
  'timeline=1&timeline.dir=sideways',
  'timeline=1&timeline.group=week&timeline.group=day',
  'timeline=1&period=custom',
  'timeline=1&period=this-year&through=2026-10-24',
  'timeline=1&timeline.window=2',
  'timeline=1&timeline.chart=1',
  'timeline=1&timeline.metric=bad',
  'timeline=1&timeline.sort=missing',
  'timeline=1&timeline.columns=prsOpened',
  'timeline=1&timeline.family=snapshot',
])('rejects malformed matrix state: %s', (query) => expect(() => parse(query)).toThrow());
it.each([
  'timeline=1&timeline.chart=2',
  'timeline=1&timeline.metric=issuesOpened',
  'timeline=1&timeline.columns=unknown',
  'timeline=1&timeline.window=1',
  'timeline=1&timeline.from=bad',
  'timeline=1&timeline.from=2026-01-01T00:00:00.000Z&timeline.to=2026-10-25T00:00:00.000Z&timeline.inclusive=1',
])('rejects incompatible repository state: %s', (query) =>
  expect(() => parse(query, 'repository')).toThrow(),
);
it.each([
  'timeline=1&timeline.metric=prsAuthored',
  'timeline=1&timeline.chart=0',
  'timeline=1&timeline.kind=issues',
])('keeps contributions table-only: %s', (query) =>
  expect(() => parse(query, 'contribution')).toThrow(),
);
it('preserves exact inherited timestamps until a deliberate period change', () => {
  const query =
    'timeline=1&period=custom&from=2026-10-01&through=2026-10-24&timeline.from=2026-10-02T14:00:00.000Z&timeline.to=2026-10-24T12:00:00.000Z&timeline.inclusive=1';
  const report = parse(query, 'repository');
  expect(report.request.range.start).toBe('2026-10-02T14:00:00.000Z');
  const grouped = parse(
    writeTimelineView(query, 'repository', { ...report.view, grouping: 'week' }),
    'repository',
  );
  expect(grouped.request.range).toEqual(report.request.range);
  const changed = writeTimelinePeriod(query, {
    kind: 'custom',
    from: '2026-09-01',
    through: '2026-09-30',
  });
  expect(changed).not.toContain('timeline.from');
  expect(parse(changed, 'repository').request.range.end).toBe('2026-10-01T00:00:00.000Z');
  expect(writeTimelinePeriod(changed, { kind: 'preset', preset: 'this-month' })).not.toContain(
    'through=',
  );
});
it('rejects incompatible predicates and bounds full ranges before editing state', () => {
  expect(() =>
    validateTimelineProposal('timeline=1&prs.filter.approvals=1', context('repository')),
  ).toThrow('require Backlog at cutoff');
  expect(() =>
    validateTimelineProposal('timeline=1&issues.filter.assignment=assigned', context('repository')),
  ).toThrow('kind');
  expect(() =>
    validateTimelineProposal('timeline=1&prs.filter.fake=1', context('repository')),
  ).toThrow('valid repository filters');
  expect(() => validateTimelineProposal('timeline=1&repo=unknown', context())).toThrow(
    'no longer available',
  );
  expect(() => validateTimelineProposal('timeline=1&q=' + 'x'.repeat(8000), context())).toThrow(
    'too large',
  );
  expect(() =>
    validateTimelineProposal(
      'timeline=1&timeline.group=day&period=custom&from=2020-01-01&through=2026-10-24',
      context(),
    ),
  ).toThrow('500 intervals');
  expect(() =>
    validateTimelineProposal('timeline=1&timeline.group=day', {
      ...context(),
      repositories: Array.from({ length: 40 }, (_, i) => ({ ...repos[0], id: 'future-' + i })),
    }),
  ).toThrow('10000');
  expect(validateTimelineProposal('timeline=1&repo=', context()).view.grouping).toBe('month');
  expect(
    validateTimelineProposal(
      'timeline=1&timeline.family=snapshot&prs.filter.approvals=1',
      context('repository'),
    ).view.family,
  ).toBe('snapshot');
});
it('stores only deliberate defaults, never return snapshots, exact dates or row/window pages', () => {
  const c = context();
  expect(timelinePreferenceKey('a', c)).not.toBe(timelinePreferenceKey('b', c));
  expect(timelinePreferenceKey('a', c)).not.toBe(
    timelinePreferenceKey('a', { ...c, sample: 'large' }),
  );
  const params = timelinePreferenceParameters(
    new URLSearchParams(
      'period=this-month&timeline.group=week&timeline.page=3&timeline.window=4&timeline.from=bad&summary=%2Frepos&repo=x',
    ),
    'matrix',
  );
  expect(params.toString()).toBe('period=this-month&timeline.group=week&repo=x');
  expect(
    timelinePreferenceParameters(
      new URLSearchParams('period=this-month&prs.filter.authors=alice'),
      'contribution',
    ).size,
  ).toBe(0);
  expect(timelinePreferenceFields('repository')).toContain('prs.q');
  expect(readTimelinePreferences(null, 'matrix')!.size).toBe(0);
  expect(
    readTimelinePreferences(
      JSON.stringify({ version: 1, query: params.toString() }),
      'matrix',
    )!.toString(),
  ).toBe(params.toString());
  for (const raw of [
    'bad',
    '{}',
    JSON.stringify({ version: 2, query: '' }),
    JSON.stringify({ version: 1, query: 'timeline.page=2' }),
  ])
    expect(readTimelinePreferences(raw, 'matrix')).toBeNull();
});
it('preserves contribution list search only on the independent return snapshot', () => {
  const settings = defaultContributionSettings({ repositories: repos });
  const entry = contributionTimelineEntry(
    '/contributors?report.q=Alice&report.page=3&sample=large',
    settings,
  )!;
  const query = new URL(entry, 'https://example.test').searchParams;
  expect(query.has('report.q')).toBe(false);
  expect(query.get('sample')).toBe('large');
  const back = contributionReturnHref(query, '/contributors');
  expect(back).toContain('report.q=Alice');
  expect(back).toContain('report.page=3');
  const child = withContributionReturn('/contributors/account-alice', entry)!;
  const restored = contributionReturnHref(
    new URL(child, 'https://example.test').searchParams,
    '/contributors',
  );
  expect(new URL(restored, 'https://example.test').searchParams.get('timeline')).toBe('1');
});
it('restores matrix scope from an individual timeline without nesting new matrices', () => {
  const c = context(),
    href =
      '/repos?timeline=1&timeline.group=month&timeline.sort=repository&repo=repo-prebidjs&summary=%2Frepos%3Fperiod%3Dlast-week';
  const child = matrixRepositoryTimelineHref(c, 'prebidjs', href)!;
  const q = new URL(child, 'https://example.test').searchParams;
  expect(q.has('repo')).toBe(false);
  expect(q.get('timelineParent')).toBe(href);
  expect(q.get('timeline.sort')).toBe('period');
  expect(safeTimelineParent(q.get('timelineParent'), '/repos/prebidjs')).toBe(href);
  for (const bad of [
    'https://example.test',
    '//example.test',
    '/admin/users',
    '/repos?timelineParent=%2Frepos',
    '/repos?q=' + 'a'.repeat(8000),
  ])
    expect(safeTimelineParent(bad, '/repos/prebidjs')).toBeNull();
  expect(safeTimelineParent(null, '/repos/prebidjs')).toBeNull();
  expect(
    matrixRepositoryTimelineHref(c, 'prebidjs', '/repos?timeline=1&x=' + 'x'.repeat(8000)),
  ).toBeNull();
});
it('carries compatible repository filters and exact activity dates while explaining current review exclusions', () => {
  const source = repositoryPageSample(repos[0], {
    selection: { scope: 'current', metric: 'totalOpenPrs' },
    returnTo: '/repos',
  });
  const filters = {
    ...defaultRepositoryFilters('prs'),
    kind: 'prs' as const,
    states: [] as ('Open' | 'Merged' | 'Closed')[],
    draft: 'all' as const,
    branches: [],
    approvals: '1' as const,
    ageBand: 30 as const,
    authors: ['sample-alice'],
    search: 'keyword',
  };
  const href = repositoryTimelineEntry(source, filters, '/repos/prebidjs?prs.q=keyword')!;
  const q = new URL(href, 'https://example.test').searchParams;
  expect(q.get('prs.q')).toBe('keyword');
  expect(q.getAll('prs.filter.authors')).toEqual(['sample-alice']);
  expect(q.has('prs.filter.approvals')).toBe(false);
  expect(q.get('timeline.omitted')).toBe('current');
  expect(repositoryTimelineEntry(source, filters, 'https://example.test')).toBeNull();
  const range = {
    start: '2026-10-01T14:00:00.000Z',
    end: '2026-10-02T00:00:00.000Z',
    endInclusive: false,
  };
  const ranged = repositoryTimelineEntry(
    source,
    { ...filters, eventRange: range },
    '/repos/prebidjs',
  )!;
  expect(new URL(ranged, 'https://example.test').searchParams.get('through')).toBe('2026-10-01');
  expect(
    parse(new URL(ranged, 'https://example.test').search.slice(1), 'repository').request.range,
  ).toEqual(range);
});
it('merges saved domains independently and discards metric dependencies from another family', () => {
  const current = new URLSearchParams(
    'timeline=1&repo=repo-prebidjs&timeline.kind=issues&timeline.family=activity&issues.q=bug',
  );
  const saved = new URLSearchParams(
    'period=last-month&timeline.group=week&timeline.kind=prs&timeline.family=snapshot&timeline.metric=totalOpenPrs&timeline.sort=totalOpenPrs&timeline.columns=totalOpenPrs&prs.filter.authors=alice',
  );
  const merged = mergeTimelinePreferenceParameters(current, saved);
  expect(merged.get('period')).toBe('last-month');
  expect(merged.get('timeline.group')).toBe('week');
  expect(merged.has('timeline.metric')).toBe(false);
  expect(merged.has('timeline.sort')).toBe(false);
  expect(merged.has('prs.filter.authors')).toBe(false);
  const explicit = mergeTimelinePreferenceParameters(
    new URLSearchParams('period=this-year'),
    new URLSearchParams('period=custom&from=2020-01-01&through=2020-01-02'),
  );
  expect(explicit.toString()).toBe('period=this-year');
});
it('captures the full repository list presentation and handles author/period cohort entry', () => {
  const range = {
    start: '2026-10-01T00:00:00.000Z',
    end: '2026-10-08T00:00:00.000Z',
    endInclusive: false,
  };
  const source = repositoryPageSample(repos[0], {
    selection: { scope: 'period', metric: 'prsOpened', range },
    returnTo: '/repos',
  });
  const filters = defaultRepositoryFilters('prs');
  const origin = repositoryTimelineOrigin(
    source,
    filters,
    'scope=period&metric=prsOpened',
    { search: 'work', sort: 'number', descending: true, page: 2 },
    { createdAt: false, number: true },
    ['number', 'createdAt'],
    true,
  );
  expect(origin).toContain('prs.page=2');
  expect(origin).toContain('prs.charts=1');
  expect(origin).toContain('prs.columns=number');
  const entry = repositoryTimelineEntry(source, filters, origin)!;
  expect(new URL(entry, 'https://example.test').searchParams.get('timeline.to')).toBe(range.end);
  const reviewed = {
    ...filters,
    kind: 'prs' as const,
    states: [] as ('Open' | 'Merged' | 'Closed')[],
    draft: 'all' as const,
    branches: [],
    approvals: '1' as const,
  };
  expect(repositoryTimelineEntry(source, reviewed, origin)).toContain('timeline.omitted=current');
  source.author = { account: 'sample-alice', returnTo: '/repos/prebidjs' };
  expect(repositoryTimelineEntry(source, filters, origin)).toContain(
    'prs.filter.authors=sample-alice',
  );
  expect(
    repositoryTimelineEntry(source, filters, '/repos/prebidjs?q=' + '%20'.repeat(2300)),
  ).toBeNull();
});
it('holds presentation to the loaded model while routing brings a different scope, never clamping a mismatched window', () => {
  const monthly = context();
  const next = 'timeline=1&timeline.group=day&timeline.window=24';
  expect(resolveTimelinePresentation('/repos', next, monthly)).toEqual({
    view: monthly.view,
    awaitingData: true,
  });
  const daily = { ...monthly, ...parse(next), href: '/repos?' + next };
  expect(
    resolveTimelinePresentation('/repos', 'timeline=1&timeline.group=day&timeline.window=25', daily)
      .view.window,
  ).toBe(25);
  expect(resolveTimelinePresentation('/repos/prebidjs', next, daily).awaitingData).toBe(true);
  expect(
    resolveTimelinePresentation('/repos', 'timeline=1&timeline.group=day&timeline.sort=bad', daily)
      .awaitingData,
  ).toBe(true);
  expect(
    resolveTimelinePresentation('/repos', 'timeline=1&repo=repo-prebidjs', monthly).awaitingData,
  ).toBe(true);
  expect(
    resolveTimelinePresentation('/repos', 'timeline=1&timeline.metric=prsMerged', monthly)
      .awaitingData,
  ).toBe(true);
  const contribution = {
    ...context('contribution'),
    path: '/contributors',
    href: '/contributors?timeline=1',
  };
  expect(
    resolveTimelinePresentation('/contributors', 'timeline=1&type=agent', contribution)
      .awaitingData,
  ).toBe(true);
  expect(
    resolveTimelinePresentation('/contributors', 'timeline=1&account=account-alice', contribution)
      .awaitingData,
  ).toBe(true);
  const repository = {
    ...context('repository'),
    path: '/repos/prebidjs',
    href: '/repos/prebidjs?timeline=1',
  };
  expect(
    resolveTimelinePresentation(
      '/repos/prebidjs',
      'timeline=1&prs.filter.authors=sample-alice',
      repository,
    ).awaitingData,
  ).toBe(true);
  expect(
    resolveTimelinePresentation(
      '/repos/prebidjs',
      'timeline=1&timeline.metric=prsMerged',
      repository,
    ).awaitingData,
  ).toBe(false);
});
it('treats duplicate company IDs as the same data scope when canonicalizing a presentation edit', () => {
  const c = {
    ...context('contribution'),
    path: '/companies',
    href: '/companies?timeline=1&population=selected&company=company-acme&company=company-acme',
  };
  expect(
    resolveTimelinePresentation(
      '/companies',
      'timeline=1&population=selected&company=company-acme&timeline.page=2',
      c,
    ).awaitingData,
  ).toBe(false);
});
it('an explicit incoming repository scope blocks old record predicates but may restore chart presentation', () => {
  const saved = new URLSearchParams(
    'prs.filter.authors=sample-alice&prs.q=old&timeline.chart=1&timeline.columns=prsMerged',
  );
  const inherited = mergeTimelinePreferenceParameters(
    new URLSearchParams('timeline=1&timeline.kind=prs&timeline.family=activity&period=this-year'),
    saved,
  );
  expect(inherited.has('prs.filter.authors')).toBe(false);
  expect(inherited.has('prs.q')).toBe(false);
  expect(inherited.get('timeline.chart')).toBe('1');
  expect(inherited.getAll('timeline.columns')).toEqual(['prsMerged']);
  const bare = mergeTimelinePreferenceParameters(new URLSearchParams('timeline=1'), saved);
  expect(bare.get('prs.filter.authors')).toBe('sample-alice');
  const href = matrixRepositoryTimelineHref(context(), 'prebidjs', '/repos?timeline=1')!;
  const query = new URL(href, 'https://example.test').searchParams;
  expect(query.has('timeline.state')).toBe(false);
  expect(query.has('timeline.chart')).toBe(false);
  expect(query.get('timeline.kind')).toBe('prs');
});
it('inherits supported author/duration insight metrics and never broadens contradictory author cohorts', () => {
  const range = {
    start: '2026-10-01T00:00:00.000Z',
    end: '2026-10-08T00:00:00.000Z',
    endInclusive: false,
  };
  const scope = {
    repository: repos[0],
    kind: 'issues' as const,
    drilldown: {
      selection: { scope: 'period' as const, metric: 'issueAuthors' as const, range },
      returnTo: '/repos',
    },
  };
  const href = repositoryTimelineEntry(
    scope,
    defaultRepositoryFilters('issues'),
    '/repos/prebidjs?scope=period&metric=issueAuthors',
  )!;
  const query = new URL(href, 'https://example.test').searchParams;
  expect(query.get('timeline.metric')).toBe('issueAuthors');
  expect(query.get('timeline.kind')).toBe('issues');
  expect(
    repositoryTimelineEntry(scope, defaultRepositoryFilters('prs'), '/repos/prebidjs'),
  ).toBeNull();
  expect(
    repositoryTimelineEntry(
      { ...scope, author: { account: 'sample-alice', returnTo: '/repos/prebidjs' } },
      { ...defaultRepositoryFilters('issues'), authors: ['someone-else'] },
      '/repos/prebidjs',
    ),
  ).toBeNull();
  const current = {
    repository: repos[0],
    kind: 'prs' as const,
    drilldown: {
      selection: { scope: 'current' as const, metric: 'humanApprovals1' as const },
      returnTo: '/repos',
    },
  };
  expect(
    repositoryTimelineEntry(current, defaultRepositoryFilters('prs'), '/repos/prebidjs'),
  ).toContain('timeline.omitted=current');
});
it.each([
  [
    'matrix',
    '/repos',
    'timeline=1&period=this-year&timeline.group=month&timeline.metric=prsOpened&sample=reference&timeline.gap=0',
  ],
  [
    'repository',
    '/repos/prebidjs',
    'timeline=1&period=this-year&timeline.kind=prs&timeline.family=activity&timeline.sort=prsOpened',
  ],
  [
    'contribution',
    '/contributors',
    'timeline=1&scope=1&period=this-year&population=all&timeline.dir=desc',
  ],
] as const)(
  'reuses loaded %s facts for presentation-only spellings of the same scope',
  (area, path, same) => {
    const loaded = { ...context(area), path, href: path + '?timeline=1' };
    expect(resolveTimelinePresentation(path, same, loaded).awaitingData).toBe(false);
    for (const changed of [
      'period=last-month',
      'sample=large',
      'timeline.gap=1',
      'timeline.group=week',
    ])
      expect(resolveTimelinePresentation(path, 'timeline=1&' + changed, loaded).awaitingData).toBe(
        true,
      );
  },
);
it('treats changed repository, population and record scope as new facts', () => {
  const matrix = context('matrix');
  expect(
    resolveTimelinePresentation('/repos', 'timeline=1&repo=repo-prebidjs', matrix).awaitingData,
  ).toBe(true);
  expect(
    resolveTimelinePresentation('/repos', 'timeline=1&timeline.metric=issuesOpened', matrix)
      .awaitingData,
  ).toBe(true);
  const repository = {
    ...context('repository'),
    path: '/repos/prebidjs',
    href: '/repos/prebidjs?timeline=1',
  };
  expect(
    resolveTimelinePresentation('/repos/prebidjs', 'timeline=1&timeline.kind=issues', repository)
      .awaitingData,
  ).toBe(true);
  expect(
    resolveTimelinePresentation('/repos/prebidjs', 'timeline=1&prs.filter.draft=drafts', repository)
      .awaitingData,
  ).toBe(true);
  const contribution = {
    ...context('contribution'),
    path: '/contributors',
    href: '/contributors?timeline=1',
  };
  expect(
    resolveTimelinePresentation('/contributors', 'timeline=1&type=human', contribution)
      .awaitingData,
  ).toBe(true);
  expect(
    resolveTimelinePresentation('/contributors', 'timeline=1&exclude=account-alice', contribution)
      .awaitingData,
  ).toBe(true);
  expect(readTimelineSource(new URLSearchParams('sample=mixed'), 'contribution')).toBeNull();
  expect(readTimelineSource(new URLSearchParams('timeline.gap=2'), 'matrix')).toBeNull();
  expect(readTimelineSource(new URLSearchParams('timeline.gap=1'), 'matrix')).toEqual({
    sample: 'reference',
    gap: true,
  });
});
it('treats equivalent route spellings as the loaded page', () => {
  const repository = {
    ...context('repository'),
    path: '/repos/prebidjs',
    href: '/repos/prebidjs?timeline=1',
  };
  expect(
    resolveTimelinePresentation('/repos/%70rebidjs', 'timeline=1', repository).awaitingData,
  ).toBe(false);
  expect(canonicalRoutePath('/contributors/github:42')).toBe(
    canonicalRoutePath('/contributors/github%3a42'),
  );
  expect(canonicalRoutePath('/contributors/a@b')).toBe('/contributors/a%40b');
  expect(canonicalRoutePath('/contributors/%E0%A4%A')).toBe('/contributors/%E0%A4%A');
  expect(timelineSupportScopeKey('/repos/%70rebidjs?timeline=1&support.records.q=x')).toBe(
    timelineSupportScopeKey('/repos/prebidjs?timeline=1'),
  );
});
