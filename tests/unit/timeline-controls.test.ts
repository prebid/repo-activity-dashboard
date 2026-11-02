import { canonicalRoutePath, decodeRouteSegment } from '@/lib/presentation/navigation';
import { companyFocus } from '@/lib/presentation/contribution-navigation';
import { timelineSupportScopeKey } from '@/lib/presentation/timeline-support-query';
import { expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
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
  timelinePreferenceCandidates,
} from '@/lib/presentation/timeline-controls';
import {
  repositoryTimelineEntry,
  matrixRepositoryTimelineHref,
} from '@/lib/presentation/timeline-navigation';
import { contributionTimelineHref } from '@/lib/presentation/contribution-timeline';
import { resolveBack, viewOf } from '@/lib/presentation/url/back';
import { timelineQueryOf } from '../support/timeline-urls';
import { repositoryTimelineFamilyMetrics } from '@/models/repository-timeline';
import { repositoryPageSample } from '@/mocks/repository-page';
import { repositoryOverviewSamples } from '@/mocks/repository-overview';
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
    href: '/repos?timeline',
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
  ['timeline=1&timeline.state=2', 'Invalid Timeline state.'],
  ['timeline=1&timeline.group=bad', 'invalid_value'],
  ['timeline=1&timeline.weird=1', 'Unknown Timeline option.'],
  ['timeline=1&timeline.page=0', 'Invalid Timeline page.'],
  ['timeline=1&timeline.page=-1', 'Invalid Timeline page.'],
  ['timeline=1&timeline.page=1000001', 'too_big'],
  ['timeline=1&timeline.dir=sideways', 'Invalid Timeline ordering.'],
  ['timeline=1&timeline.group=week&timeline.group=day', 'Repeated Timeline option.'],
  ['timeline=1&period=custom', 'Choose a valid reporting period.'],
  ['timeline=1&period=this-year&through=2026-10-24', 'Choose a valid reporting period.'],
  ['timeline=1&timeline.window=2', 'Invalid Timeline period window.'],
  ['timeline=1&timeline.chart=1', 'no chart or column choices'],
  ['timeline=1&timeline.metric=bad', 'invalid_value'],
  ['timeline=1&timeline.sort=missing', 'Invalid Timeline sort column.'],
  ['timeline=1&timeline.columns=prsOpened', 'no chart or column choices'],
  ['timeline=1&timeline.family=snapshot', 'does not accept repository family options'],
])('rejects malformed matrix state: %s', (query, message) =>
  expect(() => parse(query)).toThrow(message),
);
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
it('links a report to its Over time with the report, search and page included, as its parent', () => {
  const settings = defaultContributionSettings({ repositories: repos });
  const report = viewOf('/contributors?sample=large&q=Alice&page=3')!;
  const href = contributionTimelineHref(report, settings)!;
  // The Over time view keeps the report's scope; its search and page belong to the parent.
  expect(href).toBe('/contributors?timeline&sample=large&back=~q:Alice~page:3&v=1');
  const [parent] = resolveBack(viewOf(href)!);
  expect(parent).toEqual({
    available: true,
    view: report,
    href: '/contributors?sample=large&q=Alice&page=3',
  });
  // At the area's defaults the report is the derived parent, and the link pins the defaults.
  expect(contributionTimelineHref(viewOf('/contributors?v=1')!, settings)).toBe(
    '/contributors?timeline&v=1',
  );
});
it('opens a repository Timeline from the matrix with the matrix and its Summary as parents', () => {
  const c = context(),
    href = '/repos?timeline&repo=prebidjs&back=~period:last-week';
  const child = matrixRepositoryTimelineHref(c, 'prebidjs', href)!;
  expect(child).toBe(
    '/repos/prebidjs?timeline&back=/repos~timeline~repo:prebidjs&back=~period:last-week',
  );
  const [matrix, summary] = resolveBack(viewOf(child)!);
  expect(matrix).toMatchObject({
    available: true,
    href: '/repos?timeline&repo=prebidjs&back=~period:last-week',
  });
  expect(summary).toMatchObject({ available: true, href: '/repos?repo=prebidjs&period=last-week' });
  // Only a canonical matrix address can be a parent.
  for (const bad of [
    'https://example.test/repos?timeline',
    '//example.test/repos?timeline',
    '/admin/users',
    '/repos?timeline=1&summary=%2Frepos',
    '/repos?timeline&x=1',
    '/repos/prebidjs?timeline',
  ])
    expect(matrixRepositoryTimelineHref(c, 'prebidjs', bad), bad).toBeNull();
});
it('carries compatible repository filters and activity dates while explaining current review exclusions', () => {
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
  const href = repositoryTimelineEntry(source, filters, '/repos/prebidjs?q=keyword')!;
  // Review and age constraints describe current records only, so they stay with the list.
  expect(href).toBe(
    '/repos/prebidjs?timeline&authors=sample-alice&omitted&q=keyword&back=/repos/prebidjs~q:keyword',
  );
  expect(repositoryTimelineEntry(source, filters, 'https://example.test')).toBeNull();
  const range = {
    start: '2026-10-01T00:00:00.000Z',
    end: '2026-10-02T00:00:00.000Z',
    endInclusive: false,
  };
  const ranged = repositoryTimelineEntry(
    source,
    { ...filters, eventRange: range },
    '/repos/prebidjs',
  )!;
  const view = viewOf(ranged)!;
  expect([view.values.period, view.values.at]).toEqual(['2026-10-01..2026-10-01', '2026-10-02']);
  // The period and snapshot resolve to the list's exact activity range.
  expect(parse(timelineQueryOf(ranged).toString(), 'repository').request.range).toEqual(range);
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
  // A record saved before filters carried their kind keeps only the effective kind's filters.
  const legacy = new URLSearchParams(
    'timeline.kind=issues&timeline.sort=issuesClosed&prs.filter.authors=alice&issues.filter.authors=bob',
  );
  expect(
    mergeTimelinePreferenceParameters(new URLSearchParams('timeline=1'), legacy).toString(),
  ).toBe('timeline=1&timeline.kind=issues&timeline.sort=issuesClosed&issues.filter.authors=bob');
  expect(
    mergeTimelinePreferenceParameters(
      new URLSearchParams('timeline=1'),
      new URLSearchParams('issues.filter.authors=bob&prs.filter.authors=alice'),
    ).toString(),
  ).toBe('timeline=1&prs.filter.authors=alice');
});
it('tries presentation fallbacks first, then saved grouping, filters and repositories', () => {
  const explicit = new URLSearchParams('timeline=1');
  const strings = (merged: string) =>
    timelinePreferenceCandidates(new URLSearchParams(merged), explicit).map((c) => c.toString());
  // Without a saved grouping, filter or repository the candidates are the presentation fallbacks.
  expect(strings('timeline=1&timeline.sort=a&timeline.dir=desc&timeline.metric=m')).toEqual([
    'timeline=1&timeline.sort=a&timeline.dir=desc&timeline.metric=m',
    'timeline=1&timeline.metric=m',
    'timeline=1&timeline.sort=a&timeline.dir=desc',
    'timeline=1',
  ]);
  expect(
    strings(
      'timeline=1&timeline.group=day&timeline.sort=a&timeline.metric=m&repo=r&prs.filter.x=1',
    ),
  ).toEqual([
    'timeline=1&timeline.group=day&timeline.sort=a&timeline.metric=m&repo=r&prs.filter.x=1',
    'timeline=1&timeline.group=day&timeline.metric=m&repo=r&prs.filter.x=1',
    'timeline=1&timeline.group=day&timeline.sort=a&repo=r&prs.filter.x=1',
    'timeline=1&timeline.group=day&repo=r&prs.filter.x=1',
    'timeline=1&timeline.sort=a&timeline.metric=m&repo=r&prs.filter.x=1',
    'timeline=1&repo=r&prs.filter.x=1',
    'timeline=1&timeline.group=day&timeline.sort=a&timeline.metric=m&repo=r',
    'timeline=1&timeline.group=day&repo=r',
    'timeline=1&timeline.group=day&timeline.sort=a&timeline.metric=m&prs.filter.x=1',
    'timeline=1&timeline.group=day&prs.filter.x=1',
    'timeline=1',
  ]);
  // Explicit choices are never removed.
  expect(
    timelinePreferenceCandidates(
      new URLSearchParams('timeline=1&timeline.group=day&timeline.sort=a'),
      new URLSearchParams('timeline=1&timeline.group=day'),
    ).map((c) => c.toString()),
  ).toEqual(['timeline=1&timeline.group=day&timeline.sort=a', 'timeline=1&timeline.group=day']);
});
it('keeps the list a Timeline opens from as its parent and handles author and period cohorts', () => {
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
  const origin =
    '/repos/prebidjs?period=2026-10-01..2026-10-07&at=2026-10-08&metric=prsOpened&q=work&sort=-number&page=2&cols=-createdAt&charts';
  const entry = repositoryTimelineEntry(source, filters, origin)!;
  const [parent] = resolveBack(viewOf(entry)!);
  expect(parent).toMatchObject({ available: true, href: origin });
  expect(viewOf(entry)!.values).toMatchObject({
    period: '2026-10-01..2026-10-07',
    at: '2026-10-08',
  });
  // PRs opened is the Timeline's default metric, which the address leaves out.
  expect(viewOf(entry)!.values.metric).toBeUndefined();
  const reviewed = {
    ...filters,
    kind: 'prs' as const,
    states: [] as ('Open' | 'Merged' | 'Closed')[],
    draft: 'all' as const,
    branches: [],
    approvals: '1' as const,
  };
  expect(viewOf(repositoryTimelineEntry(source, reviewed, origin)!)!.values.omitted).toBe(true);
  source.author = { account: 'sample-alice', returnTo: '/repos/prebidjs' };
  expect(viewOf(repositoryTimelineEntry(source, filters, origin)!)!.values.authors).toEqual([
    'sample-alice',
  ]);
  // A parent whose frame exceeds the 1,000-character frame budget disables the link.
  expect(
    repositoryTimelineEntry(
      source,
      filters,
      '/repos/prebidjs?labels=' +
        'a'.repeat(400) +
        '&labels=' +
        'b'.repeat(400) +
        '&q=' +
        'c'.repeat(300),
    ),
  ).toBeNull();
});
it('holds presentation to the loaded model while routing brings a different scope, never clamping a mismatched window', () => {
  const monthly = context();
  const next = '?timeline&group=day&window=24';
  expect(resolveTimelinePresentation('/repos', next, monthly)).toMatchObject({
    view: monthly.view,
    awaitingData: true,
  });
  const daily = {
    ...monthly,
    ...parse('timeline=1&timeline.group=day&timeline.window=24'),
    href: '/repos' + next,
  };
  expect(
    resolveTimelinePresentation('/repos', '?timeline&group=day&window=25', daily).view.window,
  ).toBe(25);
  expect(resolveTimelinePresentation('/repos/prebidjs', next, daily).awaitingData).toBe(true);
  expect(
    resolveTimelinePresentation('/repos', '?timeline&group=day&sort=bad', daily).awaitingData,
  ).toBe(true);
  expect(
    resolveTimelinePresentation('/repos', '?timeline&repo=prebidjs', monthly).awaitingData,
  ).toBe(true);
  expect(
    resolveTimelinePresentation('/repos', '?timeline&metric=prsMerged', monthly).awaitingData,
  ).toBe(true);
  // An old link the server has not answered yet waits for it.
  expect(resolveTimelinePresentation('/repos', '?timeline=1', monthly).awaitingData).toBe(true);
  const contribution = {
    ...context('contribution'),
    path: '/contributors',
    href: '/contributors?timeline',
  };
  expect(
    resolveTimelinePresentation('/contributors', '?timeline&type=agent', contribution).awaitingData,
  ).toBe(true);
  expect(
    resolveTimelinePresentation('/contributors', '?timeline&account=account-alice', contribution)
      .awaitingData,
  ).toBe(true);
  const repository = {
    ...context('repository'),
    path: '/repos/prebidjs',
    href: '/repos/prebidjs?timeline',
  };
  expect(
    resolveTimelinePresentation('/repos/prebidjs', '?timeline&authors=sample-alice', repository)
      .awaitingData,
  ).toBe(true);
  expect(
    resolveTimelinePresentation('/repos/prebidjs', '?timeline&metric=prsMerged', repository)
      .awaitingData,
  ).toBe(false);
});
it('treats duplicate company IDs as the same data scope when canonicalizing a presentation edit', () => {
  const c = {
    ...context('contribution'),
    path: '/companies',
    href: '/companies?timeline&company=company-acme,company-acme',
  };
  expect(
    resolveTimelinePresentation('/companies', '?timeline&company=company-acme&page=2', c)
      .awaitingData,
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
  // The incoming view names the data scope; chart and column choices keep their defaults.
  expect(matrixRepositoryTimelineHref(context(), 'prebidjs', '/repos?timeline')).toBe(
    '/repos/prebidjs?timeline&back=/repos~timeline',
  );
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
    '/repos/prebidjs?metric=issueAuthors&period=2026-10-01..2026-10-07&at=2026-10-08',
  )!;
  expect(viewOf(href)!.values).toMatchObject({ view: 'issues', metric: 'issueAuthors' });
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
    viewOf(repositoryTimelineEntry(current, defaultRepositoryFilters('prs'), '/repos/prebidjs')!)!
      .values.omitted,
  ).toBe(true);
});
it.each([
  ['matrix', '/repos', '?timeline&period=this-year&metric=prsOpened&sample=reference'],
  ['repository', '/repos/prebidjs', '?timeline&view=prs&family=activity&sort=prsOpened'],
  ['contribution', '/contributors', '?timeline&period=this-year&sort=-period&v=1'],
] as const)(
  'reuses loaded %s facts for presentation-only spellings of the same scope',
  (area, path, same) => {
    const loaded = { ...context(area), path, href: path + '?timeline' };
    expect(resolveTimelinePresentation(path, same, loaded).awaitingData).toBe(false);
    for (const changed of [
      'period=last-month',
      // Resolves to the default this-year range, but the selection the controls show differs.
      'period=2026-01-01..2026-12-31',
      'sample=large',
      'gap',
      'group=week',
    ])
      expect(resolveTimelinePresentation(path, '?timeline&' + changed, loaded).awaitingData).toBe(
        true,
      );
  },
);
it('treats an explicit list of every repository as the default matrix selection', () => {
  const matrix = { ...context('matrix'), path: '/repos', href: '/repos?timeline' };
  const every = matrix.repositories.map((row) => row.slug).reverse();
  expect(
    resolveTimelinePresentation('/repos', '?timeline&repo=' + every.join(','), matrix).awaitingData,
  ).toBe(false);
  expect(
    resolveTimelinePresentation('/repos', '?timeline&repo=' + every[0], matrix).awaitingData,
  ).toBe(true);
});
it('treats changed repository, population and record scope as new facts', () => {
  const matrix = context('matrix');
  expect(resolveTimelinePresentation('/repos', '?timeline', matrix).awaitingData).toBe(false);
  expect(
    resolveTimelinePresentation('/repos', '?timeline&repo=prebidjs', matrix).awaitingData,
  ).toBe(true);
  expect(
    resolveTimelinePresentation('/repos', '?timeline&metric=issuesOpened', matrix).awaitingData,
  ).toBe(true);
  const repository = {
    ...context('repository'),
    path: '/repos/prebidjs',
    href: '/repos/prebidjs?timeline',
  };
  expect(resolveTimelinePresentation('/repos/prebidjs', '?timeline', repository).awaitingData).toBe(
    false,
  );
  expect(
    resolveTimelinePresentation('/repos/prebidjs', '?timeline&view=issues', repository)
      .awaitingData,
  ).toBe(true);
  expect(
    resolveTimelinePresentation('/repos/prebidjs', '?timeline&draft=drafts', repository)
      .awaitingData,
  ).toBe(true);
  const contribution = {
    ...context('contribution'),
    path: '/contributors',
    href: '/contributors?timeline',
  };
  expect(resolveTimelinePresentation('/contributors', '?timeline', contribution).awaitingData).toBe(
    false,
  );
  expect(
    resolveTimelinePresentation('/contributors', '?timeline&type=human', contribution).awaitingData,
  ).toBe(true);
  expect(
    resolveTimelinePresentation('/contributors', '?timeline&exclude=account-alice', contribution)
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
    href: '/repos/prebidjs?timeline',
  };
  expect(
    resolveTimelinePresentation('/repos/%70rebidjs', '?timeline', repository).awaitingData,
  ).toBe(false);
  expect(canonicalRoutePath('/contributors/github:42')).toBe(
    canonicalRoutePath('/contributors/github%3a42'),
  );
  expect(canonicalRoutePath('/contributors/a@b')).toBe('/contributors/a%40b');
  expect(canonicalRoutePath('/contributors/%E0%A4%A')).toBe('/contributors/%E0%A4%A');
  const support =
    '/repos/prebidjs?timeline&detail=prsOpened&interval=month:2026-01-01&snap=repo-v1@2026-10-24T12:00Z';
  expect(timelineSupportScopeKey(support.replace('prebidjs', '%70rebidjs') + '&dq=x&dpage=2')).toBe(
    timelineSupportScopeKey(support),
  );
});
it('keeps an author record list as the Timeline origin and parent', () => {
  const list = repositoryPageSample(repositoryOverviewSamples().repositories[0].repository, {
    selection: { scope: 'current', metric: 'totalOpenPrs' },
    returnTo: '/repos',
  });
  const source = { ...list, author: { account: 'sample-alice', returnTo: '/repos' } };
  const filters = { ...defaultRepositoryFilters('prs'), authors: ['sample-alice'] };
  const path = '/repos/' + source.repository.slug;
  const origin =
    path +
    '/authors/sample-alice?period=this-month&at=2026-10-24T12:00Z&metric=prAuthors&sort=-number';
  const entry = repositoryTimelineEntry(source, filters, origin)!;
  const [parent] = resolveBack(viewOf(entry)!);
  expect(parent).toMatchObject({ available: true, href: origin });
  // Another repository's page cannot be this Timeline's parent.
  expect(repositoryTimelineEntry(source, filters, '/repos/prebidserver?view=issues')).toBeNull();
});
it('decodes route segments once into logical identities', () => {
  expect(decodeRouteSegment('github%3A42')).toBe('github:42');
  expect(decodeRouteSegment('Magnite%2C%20Inc.')).toBe('Magnite, Inc.');
  expect(decodeRouteSegment('%E0%A4%A')).toBeNull();
  expect(companyFocus(['id', decodeRouteSegment('a%40b')!])).toEqual({
    kind: 'company',
    companyId: 'a@b',
  });
});
