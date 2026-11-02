import { describe, expect, it } from 'vitest';
import { contributionSample, contributionSampleAsOf } from '@/mocks/contributions';
import {
  readTimelineView,
  resolveTimelineEntry,
  timelineEntryNotices,
  timelinePreferenceSection,
  timelineTarget,
} from '@/lib/presentation/timeline-controls';
import {
  defaultContributionSettings,
  readContributionSettings,
} from '@/lib/presentation/contribution-settings';
import { readRepositoryFilterValues } from '@/lib/presentation/repository-page-query';
import type { TimelineArea, TimelineControlContext } from '@/models/timeline-controls';

const source = contributionSample(),
  asOf = contributionSampleAsOf;
const paths = { matrix: '/repos', repository: '/repos/prebidjs', contribution: '/contributors' };
function context(area: TimelineArea, search: string): TimelineControlContext {
  const params = new URLSearchParams(search);
  const parsed = readTimelineView(params, area, asOf);
  return {
    area,
    path: paths[area],
    href: paths[area] + '?' + params.toString(),
    sample: 'reference',
    preferenceScope: area === 'contribution' ? 'contributors:overview' : area,
    asOf,
    ...parsed,
    repositories: source.repositories,
    ...(area === 'matrix'
      ? { repositoryIds: source.repositories.map((row) => row.id) }
      : area === 'contribution'
        ? { contribution: readContributionSettings(params, source, asOf)! }
        : { filters: readRepositoryFilterValues(search, parsed.view.kind)! }),
  };
}
function entry(
  area: TimelineArea,
  search: string,
  saved: {
    presentation?: string | null;
    scope?: Parameters<typeof resolveTimelineEntry>[2]['scope'];
  } = {},
) {
  return resolveTimelineEntry(search, context(area, search), {
    presentation: saved.presentation === undefined ? '' : saved.presentation,
    scope: saved.scope,
  });
}
function target(result: ReturnType<typeof entry>) {
  if (result.kind !== 'redirect') throw Error('Expected a redirect, got ' + JSON.stringify(result));
  return new URLSearchParams(result.search);
}

describe('Timeline entries without saved preferences', () => {
  it.each([
    [
      'matrix',
      'timeline=1&period=this-year&timeline.state=1&timeline.group=month&timeline.metric=prsOpened&timeline.rank=prsOpened&timeline.sort=repository&timeline.dir=asc&timeline.page=1&timeline.window=1',
    ],
    [
      'repository',
      'timeline=1&period=this-year&timeline.state=1&timeline.group=month&timeline.kind=prs&timeline.family=activity&timeline.metric=prsOpened&timeline.chart=0&timeline.sort=period&timeline.dir=asc&timeline.page=1',
    ],
    [
      'contribution',
      'timeline=1&period=this-year&timeline.state=1&timeline.group=month&timeline.sort=period&timeline.dir=asc&timeline.page=1',
    ],
  ] as const)(
    'redirects a bare %s entry to the explicit-state address it used to rewrite to',
    (area, canonical) => {
      expect(entry(area, 'timeline=1')).toEqual({ kind: 'redirect', search: canonical });
      expect(entry(area, canonical)).toEqual({ kind: 'final' });
    },
  );
  it('never reads saved values for an explicit-state link', () => {
    expect(
      entry('matrix', 'timeline=1&timeline.state=1&timeline.group=day', {
        presentation: 'timeline.group=week',
      }),
    ).toEqual({ kind: 'final' });
    expect(entry('matrix', 'timeline=1&timeline.state=1', { presentation: null })).toEqual({
      kind: 'final',
    });
  });
});

describe('saved presentation', () => {
  it.each(['matrix', 'repository', 'contribution'] as const)(
    'applies a saved %s choice and lets explicit fields win',
    (area) => {
      const saved = target(
        entry(area, 'timeline=1', { presentation: 'timeline.dir=desc&timeline.group=week' }),
      );
      expect([saved.get('timeline.dir'), saved.get('timeline.group')]).toEqual(['desc', 'week']);
      const explicit = target(
        entry(area, 'timeline=1&timeline.group=day&period=this-month', {
          presentation: 'timeline.dir=desc&timeline.group=week',
        }),
      );
      expect([explicit.get('timeline.dir'), explicit.get('timeline.group')]).toEqual([
        'desc',
        'day',
      ]);
    },
  );
  it('renders the requested view with the recovery notice when the saved section is invalid', () => {
    expect(entry('matrix', 'timeline=1', { presentation: null })).toEqual({
      kind: 'final',
      notice: timelineEntryNotices.invalid,
      rejected: 'presentation',
    });
  });
  it('keeps compatible choices when a saved metric belongs to the other record kind', () => {
    const view = target(
      entry('repository', 'timeline=1&timeline.kind=issues&timeline.family=activity', {
        presentation: 'timeline.chart=1&timeline.metric=medianMergeDays&timeline.group=quarter',
      }),
    );
    expect([
      view.get('timeline.kind'),
      view.get('timeline.chart'),
      view.get('timeline.group'),
      view.get('timeline.metric'),
    ]).toEqual(['issues', '1', 'quarter', 'issuesOpened']);
  });
  it('ignores saved record filters of the other kind', () => {
    const view = target(
      entry('repository', 'timeline=1&timeline.kind=issues&timeline.family=activity', {
        presentation: 'prs.filter.authors=sample-alice&timeline.kind=prs&timeline.dir=desc',
      }),
    );
    expect(view.has('prs.filter.authors')).toBe(false);
    expect(view.get('timeline.dir')).toBe('asc');
  });
  it('keeps saved matrix metrics when a saved period-column sort is not in this report', () => {
    const view = target(
      entry('matrix', 'timeline=1&timeline.group=month', {
        presentation:
          'timeline.metric=prsOpened&timeline.metric=issuesOpened&timeline.group=week&timeline.sort=week:2026-10-19T00:00:00.000Z',
      }),
    );
    expect(view.getAll('timeline.metric')).toEqual(['prsOpened', 'issuesOpened']);
    expect([view.get('timeline.group'), view.get('timeline.sort')]).toEqual([
      'month',
      'repository',
    ]);
  });
  it('rejects a saved choice that fails on every visit, but not one that fails only here', () => {
    const monthSort = 'timeline.sort=month%3A2026-10-01T00%3A00%3A00.000Z';
    // A weekly report has no month column, but a bare entry does, so the choice stays saved.
    const onlyHere = target(
      entry('matrix', 'timeline=1&timeline.group=week', { presentation: monthSort }),
    );
    expect([onlyHere.get('timeline.group'), onlyHere.get('timeline.sort')]).toEqual([
      'week',
      'repository',
    ]);
    expect(
      target(entry('matrix', 'timeline=1', { presentation: monthSort })).get('timeline.sort'),
    ).toBe('month:2026-10-01T00:00:00.000Z');
    // A saved weekly grouping never has a month column.
    const stale = 'timeline.group=week&' + monthSort;
    const rejected = {
      kind: 'final',
      notice: 'Saved Timeline choices that do not fit this report were skipped.',
      rejected: 'presentation',
    };
    expect(entry('matrix', 'timeline=1', { presentation: stale })).toEqual(rejected);
    expect(entry('matrix', 'timeline=1&period=this-month', { presentation: stale })).toEqual(
      rejected,
    );
    // An explicit grouping the whole saved section fits applies it.
    expect(
      target(entry('matrix', 'timeline=1&timeline.group=month', { presentation: stale })).get(
        'timeline.sort',
      ),
    ).toBe('month:2026-10-01T00:00:00.000Z');
  });
  it('keeps saved columns and sort when a saved grouping cannot cover an explicit long period', () => {
    const view = target(
      entry('contribution', 'timeline=1&period=custom&from=2025-01-01&through=2026-10-24', {
        presentation:
          'timeline.group=day&timeline.columns=prsAuthored&timeline.sort=prsAuthored&timeline.dir=desc',
      }),
    );
    expect([
      view.get('timeline.group'),
      view.getAll('timeline.columns'),
      view.get('timeline.sort'),
      view.get('timeline.dir'),
    ]).toEqual(['month', ['prsAuthored'], 'prsAuthored', 'desc']);
  });
  it('rejects a saved matrix repository that is no longer enabled', () => {
    expect(
      entry('matrix', 'timeline=1', { presentation: 'repo=repo-retired&timeline.dir=desc' }),
    ).toEqual({
      kind: 'final',
      notice: timelineEntryNotices.skipped,
      rejected: 'presentation',
    });
    // An explicit repository selection does not consult the saved one.
    const view = target(
      entry('matrix', 'timeline=1&repo=repo-prebidjs', {
        presentation: 'repo=repo-retired&timeline.dir=desc',
      }),
    );
    expect([view.getAll('repo'), view.get('timeline.dir')]).toEqual([['repo-prebidjs'], 'desc']);
  });
  it('renders a valid incoming URL unchanged when saved choices would exceed the link budget', () => {
    const params = new URLSearchParams('timeline=1&period=this-year');
    params.set('summary', '/repos?x=');
    const padding = 7498 - new TextEncoder().encode('/repos?' + params.toString()).length;
    params.set('summary', '/repos?x=' + 'a'.repeat(padding));
    expect(entry('matrix', params.toString())).toEqual({
      kind: 'final',
      notice: timelineEntryNotices.unfit,
    });
  });
});

describe('saved contribution scope', () => {
  const scope = defaultContributionSettings(source);
  const agents = { ...scope, selection: { ...scope.selection, actorTypes: ['agent' as const] } };
  it('applies a checked scope only when the URL names none', () => {
    expect(target(entry('contribution', 'timeline=1', { scope: agents })).getAll('type')).toEqual([
      'agent',
    ]);
    expect(
      target(entry('contribution', 'timeline=1&type=human', { scope: agents })).getAll('type'),
    ).toEqual(['human']);
    expect(target(entry('contribution', 'timeline=1', { scope: undefined })).has('type')).toBe(
      false,
    );
  });
  it('reports a scope the server rejected and one too large for this Timeline', () => {
    expect(entry('contribution', 'timeline=1', { scope: null })).toEqual({
      kind: 'final',
      notice: timelineEntryNotices.scopeInvalid,
      rejected: 'scope',
    });
    const large = {
      ...scope,
      selection: {
        ...scope.selection,
        excludedAccountIds: Array.from({ length: 1000 }, (_, index) => 'long-account-' + index),
      },
    };
    expect(entry('contribution', 'timeline=1', { scope: large })).toEqual({
      kind: 'final',
      notice: timelineEntryNotices.scopeUnfit,
    });
  });
  it('rejects a saved Timeline column that no longer exists and applies the scope once it is gone', () => {
    const lastMonth = {
      ...scope,
      period: { kind: 'preset' as const, preset: 'last-month' as const },
    };
    expect(
      entry('contribution', 'timeline=1', {
        presentation: 'timeline.columns=retiredMetric&timeline.dir=desc',
        scope: lastMonth,
      }),
    ).toEqual({ kind: 'final', notice: timelineEntryNotices.skipped, rejected: 'presentation' });
    expect(target(entry('contribution', 'timeline=1', { scope: lastMonth })).get('period')).toBe(
      'last-month',
    );
  });
  it('keeps a saved scope when a saved Timeline grouping does not fit only this report', () => {
    const long = {
      ...scope,
      period: { kind: 'custom' as const, from: '2025-01-01', through: '2026-10-24' },
    };
    // Daily intervals cannot cover the saved long period, but they fit a bare entry.
    const view = target(
      entry('contribution', 'timeline=1', {
        presentation: 'timeline.group=day&timeline.dir=desc',
        scope: long,
      }),
    );
    expect([view.get('period'), view.get('timeline.group'), view.get('timeline.dir')]).toEqual([
      'custom',
      'month',
      'desc',
    ]);
  });
});

describe('Timeline sections and targets', () => {
  it('keeps one presentation section per area and contribution view kind', () => {
    expect(timelinePreferenceSection('matrix', 'matrix')).toBe('timeline.matrix');
    expect(timelinePreferenceSection('repository', 'repo-prebidjs')).toBe('timeline.repository');
    expect(timelinePreferenceSection('contribution', 'companies:company')).toBe(
      'timeline.companies.company',
    );
    expect(() => timelinePreferenceSection('contribution', 'contributors:unknown')).toThrow(
      'Unknown contribution Timeline view',
    );
  });
  it('rejects a target too long for a link', () => {
    const search = 'timeline=1&summary=' + '%2F'.repeat(2600);
    expect(() => timelineTarget(search, context('matrix', 'timeline=1'))).toThrow('too large');
  });
});
