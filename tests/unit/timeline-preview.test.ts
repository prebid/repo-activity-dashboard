import { repositoryTimelineMetricScope } from '@/models/repository-timeline';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PreferenceSectionKey } from '@/models/preferences';
import {
  encodePreferenceDocument,
  withPreferenceSection,
  type PreferenceDocument,
} from '@/lib/presentation/preference-cookie';
import {
  defaultContributionSettings,
  serializeContributionPreferences,
} from '@/lib/presentation/contribution-settings';
import { contributionSample } from '@/mocks/contributions';
import { preferenceSnapshot } from '@/server/preferences';
const viewer = vi.hoisted(() => vi.fn());
vi.mock('server-only', () => ({}));
// Server composition is checked against the reference cast, whose answers are hand-checkable.
vi.mock('@/mocks/repository-timeline', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/mocks/repository-timeline')>();
  const { onlyCast } = await import('../support/cast-source');
  return {
    ...actual,
    repositoryTimelineSample: (...args: Parameters<typeof actual.repositoryTimelineSample>) => {
      const [kind, repositoryId, scenario = 'reference', gap = false] = args;
      return onlyCast(
        actual.repositoryTimelineSample(
          kind,
          repositoryId,
          scenario === 'calendar' ? 'reference' : scenario,
          gap,
        ),
        scenario,
        gap,
      );
    },
    repositoryTimelineMatrixSample: (
      ...args: Parameters<typeof actual.repositoryTimelineMatrixSample>
    ) => {
      const [kind, scenario = 'reference', gap = false] = args;
      const matrix = actual.repositoryTimelineMatrixSample(
        kind,
        scenario === 'calendar' ? 'reference' : scenario,
        gap,
      );
      return {
        ...matrix,
        repositories: matrix.repositories.map((source) => onlyCast(source, scenario, gap)),
      };
    },
  };
});

vi.mock('@/lib/auth/viewer', () => ({ requireViewer: viewer }));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw Error('not-found');
  },
}));
import {
  contributionTimelinePreview,
  repositoryTimelinePreview,
  repositoryTimelineMatrixPreview,
} from '@/server/timeline-preview';
beforeEach(() => {
  viewer.mockReset().mockResolvedValue({ id: 'sample-viewer' });
});
it('guards both sample compositions and returns only their active model', async () => {
  const query = new URLSearchParams('timeline=1&sample=large');
  const result = await contributionTimelinePreview('companies', query);
  expect(viewer).toHaveBeenCalledOnce();
  expect(result.status).toBe('ready');
  expect(JSON.stringify(result)).not.toContain('Sample contributor 250');
  expect(result).not.toHaveProperty('directory');
  const repo = await repositoryTimelinePreview('prebidjs', new URLSearchParams('timeline=1'));
  expect(repo.status).toBe('ready');
  expect(JSON.stringify(repo)).not.toContain('Sample PR');
  viewer.mockRejectedValue(Error('denied'));
  await expect(contributionTimelinePreview('contributors', query)).rejects.toThrow('denied');
  await expect(repositoryTimelinePreview('prebidjs', query)).rejects.toThrow('denied');
  await expect(
    repositoryTimelineMatrixPreview(new URLSearchParams('timeline=bad')),
  ).rejects.toThrow('denied');
});
it('keeps contribution population, exact range and the return report explicit', async () => {
  const query = new URLSearchParams(
    'timeline=1&timeline.group=week&period=this-month&repo=repo-prebidjs&type=human&company=company-acme&exclude=account-alice&report.q=Bob',
  );
  const result = await contributionTimelinePreview('companies', query, {
    kind: 'company',
    companyId: 'company-acme',
  });
  if (result.status !== 'ready') throw Error('Expected timeline');
  expect(result.report.scope.includedAccountCount).toBe(2);
  expect(result.report.request.grouping).toBe('week');
  expect(result.report.summary.prsAuthored.value).toBe(2);
  const back = new URL(result.reportHref, 'https://example.test');
  expect(back.pathname).toBe('/companies/id/company-acme');
  expect(back.searchParams.get('report.q')).toBe('Bob');
  expect(back.searchParams.get('scope')).toBe('1');
  expect(back.searchParams.has('timeline')).toBe(false);
  expect(back.searchParams.getAll('exclude')).toEqual(['account-alice']);
  const empty = await contributionTimelinePreview(
    'contributors',
    new URLSearchParams('timeline=1&repo='),
  );
  expect(empty.status === 'ready' && empty.report.rows.length).toBe(0);
});
it.each([
  'timeline=0',
  'timeline=1&timeline=1',
  'timeline=1&timeline.group=bad',
  'timeline=1&timeline.foo=1',
  'timeline=1&timeline.group=day&timeline.group=week',
  'timeline=1&metric=prsAuthored',
  'timeline=1&sample=bad',
  'timeline=1&sample=mixed',
  'timeline=1&period=bad',
  'timeline=1&repo=missing',
  'timeline=1&timeline.family=snapshot',
  'timeline=1&view=other',
])('rejects invalid contribution preview %s', async (query) =>
  expect(
    (await contributionTimelinePreview('contributors', new URLSearchParams(query))).status,
  ).toBe('invalid'),
);
it('rejects excessive intervals/URL size and unknown entities', async () => {
  const oversized = new URLSearchParams(
    'timeline=1&timeline.group=day&period=custom&from=2020-01-01&through=2026-10-24',
  );
  expect(await contributionTimelinePreview('contributors', oversized)).toMatchObject({
    status: 'invalid',
    message: 'Timeline exceeds 500 intervals; narrow the range or choose a coarser grouping',
  });
  expect((await repositoryTimelinePreview('prebidjs', oversized)).status).toBe('invalid');
  expect(
    (
      await contributionTimelinePreview(
        'contributors',
        new URLSearchParams('timeline=1&report.q=' + 'x'.repeat(8000)),
      )
    ).status,
  ).toBe('invalid');
  await expect(
    contributionTimelinePreview('contributors', new URLSearchParams('timeline=1'), {
      kind: 'contributor',
      accountId: 'absent',
    }),
  ).rejects.toThrow('not-found');
  await expect(
    contributionTimelinePreview('companies', new URLSearchParams('timeline=1'), {
      kind: 'company',
      companyId: 'absent',
    }),
  ).rejects.toThrow('not-found');
  await expect(
    repositoryTimelinePreview('absent', new URLSearchParams('timeline=1')),
  ).rejects.toThrow('not-found');
  expect(
    (
      await contributionTimelinePreview('companies', new URLSearchParams('timeline=1'), {
        kind: 'company',
        companyId: null,
      })
    ).status,
  ).toBe('ready');
});

it('composes all repositories or explicit subsets without hidden histories and preserves Summary', async () => {
  const all = await repositoryTimelineMatrixPreview(new URLSearchParams('timeline=1'));
  expect(viewer).toHaveBeenCalledOnce();
  expect(all.status === 'ready' && all.matrix.rows.length).toBe(18);
  expect(JSON.stringify(all)).not.toContain('Sample PR');
  expect(all).not.toHaveProperty('navigation');
  expect(all).not.toHaveProperty('directory');
  const summary =
    '/repos?period=this-week&period2=last-month&age=30&age=60&activity.sort=prsMerged';
  const query = new URLSearchParams({ timeline: '1', repo: 'repo-prebidjs', summary });
  query.append('repo', 'repo-prebidjs');
  const subset = await repositoryTimelineMatrixPreview(query);
  if (subset.status !== 'ready') throw Error('Expected matrix');
  expect(subset.matrix.scope.repositoryIds).toEqual(['repo-prebidjs']);
  expect(subset.matrix.rows[0].values.map((value) => value.value)).toEqual([
    0, 0, 0, 0, 0, 0, 0, 1, 1, 3,
  ]);
  expect(subset.summaryHref).toBe(summary);
  expect(subset.href).toBe('/repos?' + query.toString());
  const none = await repositoryTimelineMatrixPreview(new URLSearchParams('timeline=1&repo='));
  expect(none.status === 'ready' && none.matrix.rows).toEqual([]);
});
it.each([
  ['issuesClosed', 'issues', 'activity', 'count', 'event', 'closedAt'],
  ['medianMergeDays', 'prs', 'activity', 'days', 'duration', 'mergedAt'],
  ['humanApprovals1', 'prs', 'snapshot', 'count', 'snapshot', null],
  ['openIssues', 'issues', 'snapshot', 'count', 'snapshot', null],
] as const)(
  'derives compatible scope from the active %s metric',
  async (metric, recordKind, family, unit, basis, eventDate) => {
    const result = await repositoryTimelineMatrixPreview(
      new URLSearchParams('timeline=1&timeline.metric=' + metric + '&sample=mixed'),
    );
    expect(result.status === 'ready' && result.matrix.scope.metrics).toEqual([metric]);
    expect(repositoryTimelineMetricScope(metric)).toEqual({
      recordKind,
      family,
      unit,
      basis,
      eventDate,
    });
    expect(
      result.status === 'ready' &&
        result.matrix.rows
          .find((row) => row.id === 'repo-prebidserverjava')!
          .values.every((value) => value.status === 'missing'),
    ).toBe(true);
  },
);
it.each([
  'timeline=0',
  'timeline=1&repo=unknown',
  'timeline=1&timeline.metric=invalid',
  'timeline=1&sample=reference&sample=mixed',
  'timeline=1&timeline.kind=issues',
  'timeline=1&timeline.family=snapshot',
  'timeline=1&other=1',
  'timeline=1&summary=https://example.test',
  'timeline=1&summary=%2Frepos&summary=%2Frepos',
  'timeline=1&period=bad',
  'timeline=1&period=custom&from=2020-01-01&through=2026-10-24&timeline.group=day',
  'timeline=1&summary=%2Frepos%3Ftimeline%3D1',
  'timeline=1&summary=' + encodeURIComponent('/repos?q=' + 'a'.repeat(8000)),
])('rejects invalid matrix preview %s', async (query) =>
  expect((await repositoryTimelineMatrixPreview(new URLSearchParams(query))).status).toBe(
    'invalid',
  ),
);
it('composes issue/snapshot/partial previews and applies compatible record filters', async () => {
  const result = await repositoryTimelinePreview(
    'prebidjs',
    new URLSearchParams(
      'timeline=1&timeline.kind=issues&timeline.family=snapshot&timeline.group=day&period=custom&from=2026-10-11&through=2026-10-21',
    ),
  );
  expect(result.status === 'ready' && result.report.summary.openIssues?.value).toBe(2);
  const gap = await contributionTimelinePreview(
    'contributors',
    new URLSearchParams('timeline=1&timeline.gap=1'),
  );
  expect(gap.status === 'ready' && gap.report.summary.prsAuthored.status).toBe('partial');
  const all = await repositoryTimelinePreview('prebidjs', new URLSearchParams('timeline=1'));
  const alice = await repositoryTimelinePreview(
    'prebidjs',
    new URLSearchParams('timeline=1&prs.filter.authors=sample-alice'),
  );
  if (all.status !== 'ready' || alice.status !== 'ready') throw Error('Expected previews');
  expect(all.report.summary.prsOpened).toEqual({ status: 'complete', value: 5 });
  expect(alice.report.summary.prsOpened).toEqual({ status: 'complete', value: 1 });
  expect(
    (
      await repositoryTimelinePreview(
        'prebidjs',
        new URLSearchParams('timeline=1&timeline.kind=bad'),
      )
    ).status,
  ).toBe('invalid');
});
it('rejects ambiguous scalar scope fields rather than broadening a copied contribution report', async () => {
  for (const query of [
    'timeline=1&population=all&population=selected',
    'timeline=1&scope=1&scope=0',
    'timeline=1&view=members&view=repositories',
  ])
    expect(
      (await contributionTimelinePreview('contributors', new URLSearchParams(query))).status,
    ).toBe('invalid');
  expect(
    (
      await repositoryTimelinePreview(
        'prebidjs',
        new URLSearchParams('timeline=1&prs.q=one&prs.q=two'),
      )
    ).status,
  ).toBe('invalid');
});
describe('saved preferences', () => {
  const binding = { accountId: 'sample-viewer', authVersion: 0 };
  function snapshot(
    cookie: 'repositories' | 'contributions',
    sections: Partial<Record<PreferenceSectionKey, unknown>>,
  ) {
    let document: PreferenceDocument | null = null;
    for (const [section, value] of Object.entries(sections))
      document = withPreferenceSection(document, binding, section as PreferenceSectionKey, value);
    return preferenceSnapshot(
      cookie,
      binding,
      document ? encodePreferenceDocument(document) : undefined,
    );
  }
  const query = (href: string) => new URL(href, 'https://dashboard.invalid').searchParams;
  it('redirects an entry to its explicit-state URL with saved presentation applied', async () => {
    const saved = snapshot('repositories', {
      'timeline.matrix': { version: 1, query: 'timeline.dir=desc' },
      'timeline.repository': { version: 1, query: 'timeline.group=week' },
    });
    const matrix = await repositoryTimelineMatrixPreview(new URLSearchParams('timeline=1'), saved);
    if (matrix.status !== 'redirect') throw Error('Expected a redirect');
    expect(matrix.href.startsWith('/repos?timeline=1&')).toBe(true);
    expect(query(matrix.href).get('timeline.dir')).toBe('desc');
    const repository = await repositoryTimelinePreview(
      'prebidjs',
      new URLSearchParams('timeline=1'),
      saved,
    );
    expect(repository.status === 'redirect' && repository.href).toMatch(
      /^\/repos\/prebidjs\?timeline=1&period=this-year&timeline\.state=1&timeline\.group=week&/,
    );
    const contribution = await contributionTimelinePreview(
      'companies',
      new URLSearchParams('timeline=1'),
      { kind: 'company', companyId: 'company-acme' },
      snapshot('contributions', {}),
    );
    expect(contribution.status === 'redirect' && contribution.href).toBe(
      '/companies/id/company-acme?timeline=1&period=this-year&timeline.state=1&timeline.group=month&timeline.sort=period&timeline.dir=asc&timeline.page=1',
    );
  });
  it('hands explicit-state renders their sections without reading saved values', async () => {
    const result = await repositoryTimelineMatrixPreview(
      new URLSearchParams('timeline=1&timeline.state=1'),
      snapshot('repositories', { 'timeline.matrix': { version: 9 } }),
    );
    if (result.status !== 'ready') throw Error('Expected a render');
    expect(result.controls.preferences).toEqual({
      presentation: { section: 'timeline.matrix', binding, value: null },
    });
    const contribution = await contributionTimelinePreview(
      'contributors',
      new URLSearchParams('timeline=1&timeline.state=1'),
      undefined,
      snapshot('contributions', { 'contributions.scope': { version: 9 } }),
    );
    if (contribution.status !== 'ready') throw Error('Expected a render');
    expect(contribution.controls.preferences).toEqual({
      presentation: { section: 'timeline.contributors.overview', binding, value: null },
      scope: { section: 'contributions.scope', binding, value: null },
    });
  });
  it('renders the requested view with the recovery notice and marks only the reported section', async () => {
    const invalid = await repositoryTimelineMatrixPreview(
      new URLSearchParams('timeline=1'),
      snapshot('repositories', { 'timeline.matrix': { version: 9 } }),
    );
    if (invalid.status !== 'ready') throw Error('Expected a render');
    expect(invalid.controls.preferences).toEqual({
      presentation: { section: 'timeline.matrix', binding, value: null, invalid: '{"version":9}' },
      notice: 'Saved Timeline preferences are invalid. Defaults are shown.',
    });
    const scope = defaultContributionSettings(contributionSample());
    const retired = {
      ...scope,
      selection: { ...scope.selection, excludedAccountIds: ['account-retired'] },
    };
    const both = await contributionTimelinePreview(
      'contributors',
      new URLSearchParams('timeline=1'),
      undefined,
      snapshot('contributions', {
        'contributions.scope': JSON.parse(serializeContributionPreferences(retired)) as unknown,
        'timeline.contributors.overview': { version: 9 },
      }),
    );
    if (both.status !== 'ready') throw Error('Expected a render');
    // The invalid presentation is reported first; the scope was not consulted, so it stays.
    expect(both.controls.preferences?.presentation.invalid).toBe('{"version":9}');
    expect(both.controls.preferences?.scope).toEqual({
      section: 'contributions.scope',
      binding,
      value: null,
    });
    const scopeOnly = await contributionTimelinePreview(
      'contributors',
      new URLSearchParams('timeline=1'),
      undefined,
      snapshot('contributions', {
        'contributions.scope': JSON.parse(serializeContributionPreferences(retired)) as unknown,
      }),
    );
    if (scopeOnly.status !== 'ready') throw Error('Expected a render');
    expect(scopeOnly.controls.preferences).toMatchObject({
      notice: 'Saved filters could not be restored. Default filters are shown.',
      presentation: { value: null },
      scope: { value: null },
    });
    expect(scopeOnly.controls.preferences?.presentation).not.toHaveProperty('invalid');
    expect(JSON.parse(scopeOnly.controls.preferences!.scope!.invalid!) as unknown).toEqual(
      JSON.parse(serializeContributionPreferences(retired)) as unknown,
    );
  });
  it('marks a saved presentation that fails on every visit for deletion, and keeps one that fails only here', async () => {
    const stale = await repositoryTimelineMatrixPreview(
      new URLSearchParams('timeline=1'),
      snapshot('repositories', {
        'timeline.matrix': {
          version: 1,
          query: 'timeline.dir=desc&timeline.sort=week:2026-10-19T00:00:00.000Z',
        },
      }),
    );
    if (stale.status !== 'ready') throw Error('Expected a render');
    expect(stale.href).toBe('/repos?timeline=1');
    expect(stale.controls.view.descending).toBe(false);
    expect(stale.controls.preferences).toEqual({
      presentation: {
        section: 'timeline.matrix',
        binding,
        value: null,
        invalid:
          '{"version":1,"query":"timeline.dir=desc&timeline.sort=week:2026-10-19T00:00:00.000Z"}',
      },
      notice: 'Saved Timeline choices that do not fit this report were skipped.',
    });
    const onlyHere = await repositoryTimelineMatrixPreview(
      new URLSearchParams('timeline=1&timeline.group=month'),
      snapshot('repositories', {
        'timeline.matrix': {
          version: 1,
          query:
            'timeline.metric=prsOpened&timeline.metric=issuesOpened&timeline.group=week&timeline.sort=week:2026-10-19T00:00:00.000Z',
        },
      }),
    );
    if (onlyHere.status !== 'redirect') throw Error('Expected a redirect');
    const redirected = query(onlyHere.href);
    expect([redirected.get('timeline.group'), redirected.get('timeline.sort')]).toEqual([
      'month',
      'repository',
    ]);
    expect(redirected.getAll('timeline.metric')).toEqual(['prsOpened', 'issuesOpened']);
  });
  it('applies a saved scope that the directory still resolves, without a client lookup', async () => {
    const scope = defaultContributionSettings(contributionSample());
    const known = {
      ...scope,
      selection: { ...scope.selection, excludedAccountIds: ['account-alice'] },
    };
    const result = await contributionTimelinePreview(
      'contributors',
      new URLSearchParams('timeline=1'),
      undefined,
      snapshot('contributions', {
        'contributions.scope': JSON.parse(serializeContributionPreferences(known)) as unknown,
      }),
    );
    if (result.status !== 'redirect') throw Error('Expected a redirect');
    expect(query(result.href).getAll('exclude')).toEqual(['account-alice']);
  });
});
