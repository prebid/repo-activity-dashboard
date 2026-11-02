import { describe, expect, it } from 'vitest';
import { timelineQuery, timelineParentValues } from '@/lib/presentation/url/timeline';
import { timelineStateValues } from '@/lib/presentation/url/legacy/decode';
import {
  timelineAuthorHref,
  timelineSupportHref,
  timelineSupportScopeKey,
} from '@/lib/presentation/timeline-support-query';
import { contributionSample } from '@/mocks/contributions';
import type { UrlRoute, UrlValues } from '@/lib/presentation/url/registry';

const asOf = '2026-10-24T12:00:00.000Z';
const query = (route: UrlRoute, values: UrlValues, entry = false) => {
  const written = timelineQuery(route, values, asOf, { entry });
  return written === null ? null : Object.fromEntries(new URLSearchParams(written));
};
const source = { source: 'sample' as const, scenarioId: 'rev-1', asOf };

describe('Timeline values in the Timeline query form (decision C9)', () => {
  it('writes an entry without its explicit-state marker or scope, so saved values can apply', () => {
    expect(query('/repos', { timeline: true }, true)).toEqual({ timeline: '1' });
    expect(query('/contributors', { timeline: true }, true)).toEqual({ timeline: '1' });
    expect(query('/contributors', { timeline: true })).toMatchObject({
      timeline: '1',
      'timeline.state': '1',
      scope: '1',
      period: 'this-year',
    });
  });
  it('writes the matrix scope, metrics, ranking, sort, page and window', () => {
    expect(
      query('/repos', {
        timeline: true,
        sample: 'mixed',
        gap: true,
        repo: ['prebidjs'],
        period: '2026-01-01..2026-06-30',
        group: 'week',
        metric: ['prsOpened', 'prsMerged'],
        rank: 'prsMerged',
        sort: '-week:2026-03-02T00:00:00.000Z',
        page: '2',
        window: '3',
      }),
    ).toEqual({
      timeline: '1',
      'timeline.state': '1',
      sample: 'mixed',
      'timeline.gap': '1',
      period: 'custom',
      from: '2026-01-01',
      through: '2026-06-30',
      'timeline.group': 'week',
      repo: 'repo-prebidjs',
      'timeline.metric': 'prsMerged',
      'timeline.rank': 'prsMerged',
      'timeline.sort': 'week:2026-03-02T00:00:00.000Z',
      'timeline.dir': 'desc',
      'timeline.page': '2',
      'timeline.window': '3',
    });
    // Explicit empty lists stay explicit.
    expect(query('/repos', { timeline: true, repo: [], metric: [] })).toMatchObject({
      repo: '',
      'timeline.metric': '',
    });
  });
  it('writes a snapshot as the exact interval its period resolves to there', () => {
    expect(
      query('/repos/[slug]', { timeline: true, period: 'this-month', at: '2026-10-24T12:00Z' }),
    ).toMatchObject({
      period: 'this-month',
      'timeline.from': '2026-10-01T00:00:00.000Z',
      'timeline.to': '2026-10-24T12:00:00.000Z',
      'timeline.inclusive': '1',
    });
    // A snapshot that is no instant resolves to nothing.
    expect(
      query('/repos/[slug]', { timeline: true, period: 'this-month', at: '2026-02-30' }),
    ).toBeNull();
  });
  it('writes a repository Timeline’s kind, family, chart, columns and record filters', () => {
    expect(
      query('/repos/[slug]', {
        timeline: true,
        view: 'issues',
        family: 'snapshot',
        metric: 'openIssues',
        chart: true,
        omitted: true,
        cols: ['-openIssues'],
        authors: ['sample-bob'],
        q: 'fix',
      }),
    ).toMatchObject({
      'timeline.kind': 'issues',
      'timeline.family': 'snapshot',
      'timeline.metric': 'openIssues',
      'timeline.chart': '1',
      'timeline.omitted': 'current',
      'issues.filter.authors': 'sample-bob',
      'issues.q': 'fix',
    });
    expect(query('/repos/[slug]', { timeline: true, cols: ['unknown'] })).toBeNull();
    expect(query('/repos/[slug]', { timeline: true, events: 'nonsense' })).toBeNull();
  });
  it('writes a contribution Timeline’s columns against its lens and refuses an unknown one', () => {
    expect(query('/contributors', { timeline: true, cols: ['prComments'] })).toMatchObject({
      'timeline.columns': 'prComments',
    });
    expect(query('/contributors', { timeline: true, cols: ['unknown'] })).toBeNull();
    expect(query('/contributors', { timeline: true, period: 'bad' })).toBeNull();
  });
  it('writes a supporting view’s cell, origin, author and both tables, and refuses a malformed one', () => {
    const support = {
      timeline: true,
      detail: 'prAuthors',
      interval: 'month:2026-10-01',
      snap: 'rev@1@2026-10-24T12:00Z',
      origin: 'matrix',
      author: 'sample-bob',
      dq: 'fix',
      dsort: '-number',
      dpage: '2',
      listq: 'b',
      listsort: 'account',
      listpage: '3',
    } as const;
    expect(query('/repos/[slug]', support)).toMatchObject({
      'timeline.detail': 'prAuthors',
      'timeline.interval': 'month:2026-10-01T00:00:00.000Z',
      'timeline.revision': 'rev@1',
      'timeline.clock': '2026-10-24T12:00:00.000Z',
      'support.origin': 'matrix',
      'support.author': 'sample-bob',
      'support.records.q': 'fix',
      'support.records.sort': 'number',
      'support.records.dir': 'desc',
      'support.records.page': '2',
      'support.authors.q': 'b',
      'support.authors.sort': 'account',
      'support.authors.dir': 'asc',
      'support.authors.page': '3',
    });
    expect(query('/repos/[slug]', { timeline: true, detail: 'prAuthors' })).toBeNull();
    expect(query('/repos/[slug]', { ...support, interval: 'month:nonsense' })).toBeNull();
    expect(timelineParentValues(support)).toEqual({ timeline: true });
  });
  it('reads a Timeline query back as the same values', () => {
    const directory = { repositories: contributionSample().repositories };
    for (const [route, values] of [
      ['/repos', { timeline: true, repo: ['prebidjs'], group: 'week', sort: '-repository' }],
      ['/repos/[slug]', { timeline: true, view: 'issues', authors: ['sample-bob'], chart: true }],
      ['/contributors', { timeline: true, type: ['human'], cols: ['prComments'] }],
    ] as const) {
      const written = timelineQuery(route, values, asOf)!;
      expect(timelineStateValues(route, written, asOf, directory)).toMatchObject(values);
    }
    expect(timelineStateValues('/repos', 'timeline=1&timeline.group=decade', asOf)).toBeNull();
  });
  it('names the Reviewers lens, whose Over time columns diff against the lens’s metrics', () => {
    const directory = { repositories: contributionSample().repositories };
    expect(query('/reviewers', { timeline: true }, true)).toEqual({
      timeline: '1',
      lens: 'reviewers',
    });
    expect(query('/companies', { timeline: true, lens: 'reviewers' }, true)).toMatchObject({
      lens: 'reviewers',
    });
    expect(query('/companies', { timeline: true }, true)).not.toHaveProperty('lens');
    for (const [route, values] of [
      ['/reviewers', { timeline: true, cols: ['prsAuthored', '-mergesPerformed'] }],
      ['/companies', { timeline: true, lens: 'reviewers', cols: ['prComments'] }],
    ] as const) {
      const written = timelineQuery(route, values, asOf)!;
      // The columns are the lens's: Reviewer contributions and Approval contributions remain.
      expect(new URLSearchParams(written).getAll('timeline.columns')).toEqual(
        route === '/reviewers'
          ? ['prsAuthored', 'reviewerContributions', 'approvalContributions']
          : ['reviewerContributions', 'approvalContributions', 'mergesPerformed', 'prComments'],
      );
      expect(timelineStateValues(route, written, asOf, directory)).toMatchObject(values);
    }
    expect(
      timelineStateValues('/reviewers', 'timeline=1&lens=reviewers', asOf, directory),
    ).not.toHaveProperty('lens');
  });
  it('reads an empty matrix selection without a ranking metric, which it could not sort by', () => {
    const empty = timelineStateValues('/repos', 'timeline=1&timeline.metric=', asOf);
    expect(empty).toMatchObject({ metric: [] });
    expect(empty).not.toHaveProperty('rank');
    expect(timelineQuery('/repos', empty!, asOf)).not.toContain('timeline.rank');
  });
});

describe('supporting view links', () => {
  it('names a Timeline cell, or nothing for another view or a malformed interval', () => {
    expect(timelineSupportHref('/repos/prebidjs?timeline', source, 'prsOpened', 'month:x')).toBe(
      null,
    );
    expect(timelineSupportHref('/repos/prebidjs?timeline', source, 'prsOpened', 'nonsense')).toBe(
      null,
    );
    expect(
      timelineSupportHref('/repos/prebidjs?view=issues', source, 'prsOpened', 'month:2026-10-01'),
    ).toBeNull();
    expect(
      timelineSupportHref('/repos?timeline', source, 'prsOpened', 'month:2026-10-01', 'matrix'),
    ).toBe(
      '/repos?timeline&detail=prsOpened&interval=month:2026-10-01&snap=rev-1@2026-10-24T12:00Z&origin=matrix',
    );
    expect(timelineAuthorHref('/repos/prebidjs?timeline=1', 'alice')).toBeNull();
    // A scope key of an address the codec does not read is the address itself.
    expect(timelineSupportScopeKey('/repos/prebidjs?timeline=1')).toBe(
      '/repos/prebidjs?timeline=1',
    );
  });
});
