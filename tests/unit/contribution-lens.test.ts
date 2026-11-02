import { describe, expect, it, vi } from 'vitest';
import {
  columnSetChange,
  columnSetChoice,
  columnSetOptions,
  contributionBackLabel,
  contributionLensForLocation,
  contributionOverviewPath,
  contributionTableSections,
  contributionTimelineSection,
  noReviewerActivity,
} from '@/lib/presentation/contribution-lens';
import { matchingColumnSet } from '@/lib/presentation/column-selection';
import type { UrlView } from '@/lib/presentation/url/back';
import type { UrlRoute } from '@/lib/presentation/url/registry';
import type { ContributionValues } from '@/models/contributions';
import { preferenceSectionKeys } from '@/models/preferences';
import { reportMetricIds } from '@/models/contribution-metrics';
import {
  columnSetIds,
  columnSetLabels,
  columnSetMetrics,
  contributionLenses,
  isContributionLens,
  lensColumnSet,
  lensDefaultSort,
  lensRole,
  metricPopulationRole,
  roleMetrics,
  type PopulationRole,
} from '@/models/contribution-lens';
import { urlDefaultsV1 } from '@/lib/presentation/url/defaults';

// Written from contributors.md and decision D3, not from the metric lists: credits give a role;
// comment counts and merged-PR volumes are associations and give none.
const stats = [
  'filesChanged',
  'filesAdded',
  'filesRemoved',
  'filesModified',
  'filesRenamed',
  'filesCopied',
  'filesTypeChanged',
  'linesChanged',
  'linesAdded',
  'linesRemoved',
];
const expectedRoles: Record<string, PopulationRole | null> = {
  prsAuthored: 'contributor',
  authoredPrsMerged: 'contributor',
  issuesAuthored: 'contributor',
  reviewerContributions: 'reviewer',
  approvalContributions: 'reviewer',
  mergesPerformed: 'reviewer',
  prComments: null,
  inlineComments: null,
  issueComments: null,
  ...Object.fromEntries(
    ['authored', 'reviewed', 'approved'].flatMap((role) =>
      stats.map((stat) => [role + '.' + stat, null]),
    ),
  ),
};

describe('population roles', () => {
  it('assigns each of the 39 report metrics exactly one role or none', () => {
    expect(new Set(Object.keys(expectedRoles))).toEqual(new Set(reportMetricIds));
    expect(Object.keys(expectedRoles)).toHaveLength(39);
    for (const [metric, role] of Object.entries(expectedRoles))
      expect([metric, metricPopulationRole(metric as (typeof reportMetricIds)[number])]).toEqual([
        metric,
        role,
      ]);
    const counts = { contributor: 0, reviewer: 0, none: 0 };
    for (const metric of reportMetricIds) counts[metricPopulationRole(metric) ?? 'none']++;
    expect(counts).toEqual({ contributor: 3, reviewer: 3, none: 33 });
  });
  it('lists each role in report order, as the frozen v1 lens defaults do', () => {
    expect(roleMetrics).toEqual({
      contributor: [...urlDefaultsV1.contributions.lensMetricColumns.contributors],
      reviewer: [...urlDefaultsV1.contributions.lensMetricColumns.reviewers],
    });
    for (const role of ['contributor', 'reviewer'] as const)
      expect(roleMetrics[role]).toEqual(
        reportMetricIds.filter((metric) => roleMetrics[role].includes(metric as never)),
      );
    for (const lens of contributionLenses) {
      const { sort, descending } = lensDefaultSort[lens];
      expect((descending ? '-' : '') + sort).toBe(urlDefaultsV1.contributions.sort[lens]);
      expect(roleMetrics[lensRole[lens]]).toContain(sort);
    }
  });
  it('names the lenses and their column sets', () => {
    expect(contributionLenses.filter(isContributionLens)).toEqual(['contributors', 'reviewers']);
    expect(isContributionLens('companies')).toBe(false);
    expect(columnSetIds.map((id) => columnSetLabels[id])).toEqual([
      'Contributor',
      'Reviewer',
      'All credits',
      'All columns',
    ]);
    expect(lensColumnSet).toEqual({ contributors: 'contributor', reviewers: 'reviewer' });
    expect(columnSetMetrics.credits).toEqual(reportMetricIds.slice(0, 6));
    expect(columnSetMetrics.reviewer).toBe(roleMetrics.reviewer);
  });
});

describe('lens presentation', () => {
  const query = (search: string) => new URLSearchParams(search);
  it('reads the lens a location shows', () => {
    for (const [path, search, lens] of [
      ['/reviewers', null, 'reviewers'],
      ['/reviewers', query('lens=contributors'), 'reviewers'],
      ['/contributors/account-alice', query('lens=reviewers'), 'reviewers'],
      ['/companies', query('lens=reviewers&timeline'), 'reviewers'],
      ['/companies/id/company-acme', query('view=repositories&lens=reviewers'), 'reviewers'],
      ['/companies', query(''), 'contributors'],
      ['/contributors', null, 'contributors'],
      ['/repos', query('lens=reviewers'), 'contributors'],
      ['/companiesx', query('lens=reviewers'), 'contributors'],
    ] as const)
      expect(contributionLensForLocation(path, search), path).toBe(lens);
  });
  it('names each lens’s overview paths and cookie sections', () => {
    expect(contributionOverviewPath('contributors')).toBe('/contributors');
    expect(contributionOverviewPath('contributors', 'reviewers')).toBe('/reviewers');
    expect(contributionOverviewPath('companies', 'reviewers')).toBe('/companies');
    expect(contributionTableSections('contributors', 'members')).toEqual({
      columns: 'contributions.members.columns',
      sort: 'contributions.members.sort',
    });
    expect(contributionTableSections('reviewers', 'companies')).toEqual({
      columns: 'contributions.reviewers.companies.columns',
      sort: 'contributions.reviewers.companies.sort',
    });
    // Supporting records are shared by both lenses.
    expect(contributionTableSections('reviewers', 'details').sort).toBe(
      'contributions.details.sort',
    );
    expect(contributionTimelineSection('contributors', 'companies', 'company')).toBe(
      'timeline.companies.company',
    );
    expect(contributionTimelineSection('reviewers', 'contributors', 'overview')).toBe(
      'timeline.reviewers.contributors.overview',
    );
    const known: readonly string[] = preferenceSectionKeys.contributions;
    const tables = ['details', 'contributors', 'companies', 'members', 'repositories'] as const;
    for (const lens of contributionLenses) {
      for (const table of tables)
        for (const section of Object.values(contributionTableSections(lens, table)))
          expect(known).toContain(section);
      for (const area of ['contributors', 'companies'] as const)
        for (const focus of ['overview', 'contributor', 'company'] as const)
          expect(known).toContain(contributionTimelineSection(lens, area, focus));
    }
    expect(known).toHaveLength(32);
  });
  it('offers the Column set choice over a table’s metric columns', () => {
    const hideable = ['actorType', 'company', ...reportMetricIds];
    const onChoose = vi.fn();
    const choice = columnSetChoice(hideable, onChoose);
    expect(choice.label).toBe('Column set');
    expect(choice.domain).toEqual(reportMetricIds);
    expect(choice.options.map((option) => [option.id, option.label])).toEqual([
      ['contributor', 'Contributor'],
      ['reviewer', 'Reviewer'],
      ['credits', 'All credits'],
      ['all', 'All columns'],
    ]);
    expect(choice.options[1].columnIds).toEqual(roleMetrics.reviewer);
    expect(choice.options[3].columnIds).toEqual(hideable);
    choice.onChoose('reviewer');
    expect(onChoose).toHaveBeenCalledWith('reviewer');
    expect(columnSetOptions(['prsAuthored'])[3].columnIds).toEqual(['prsAuthored']);
  });
  it('applies a set and, when it hides the sorted metric, that set’s lead sort', () => {
    const visible = Object.fromEntries(
      ['name', 'actorType', ...reportMetricIds].map((id) => [
        id,
        id === 'name' || id === 'prComments',
      ]),
    );
    const by = (sort: string, descending = true) => ({ sort, descending });
    const change = (
      set: Parameters<typeof columnSetChange>[0],
      lens: Parameters<typeof columnSetChange>[1],
      sort: { sort: string; descending: boolean },
      kind: 'report' | 'timeline' = 'report',
    ) => columnSetChange(set, lens, { visible, sort }, kind);
    const contributor = change('contributor', 'reviewers', by('reviewerContributions'));
    expect(Object.keys(contributor.visible).filter((id) => contributor.visible[id])).toEqual([
      'name',
      'prsAuthored',
      'authoredPrsMerged',
      'issuesAuthored',
    ]);
    expect(contributor.sort).toEqual(by('authoredPrsMerged'));
    expect(change('reviewer', 'contributors', by('name', false))).not.toHaveProperty('sort');
    expect(change('reviewer', 'contributors', by('prComments')).sort).toEqual(
      by('reviewerContributions'),
    );
    expect(change('credits', 'reviewers', by('prComments')).sort).toEqual(
      by('reviewerContributions'),
    );
    expect(change('credits', 'contributors', by('prComments')).sort).toEqual(
      by('authoredPrsMerged'),
    );
    const all = change('all', 'reviewers', by('prComments'));
    expect(Object.values(all.visible).every(Boolean)).toBe(true);
    expect(all).not.toHaveProperty('sort');
    // Over time rows are periods: the fallback is Period ascending.
    expect(change('reviewer', 'contributors', by('prsAuthored'), 'timeline').sort).toEqual(
      by('period', false),
    );
    // A set that keeps the sorted metric keeps the sort.
    expect(change('credits', 'contributors', by('mergesPerformed'))).not.toHaveProperty('sort');
  });
  it('matches the visible columns to a set, or to none (Custom)', () => {
    const choice = columnSetChoice(['actorType', ...reportMetricIds], () => {});
    const shown = (...ids: string[]) =>
      Object.fromEntries(
        ['name', 'actorType', ...reportMetricIds].map((id) => [id, ids.includes(id)]),
      );
    expect(
      matchingColumnSet(choice, shown('name', 'actorType', ...roleMetrics.contributor))?.id,
    ).toBe('contributor');
    // An extra metric is Custom; a hidden identity column still matches.
    expect(
      matchingColumnSet(choice, shown('name', 'prComments', ...roleMetrics.contributor)),
    ).toBeUndefined();
    expect(matchingColumnSet(choice, shown('name', ...roleMetrics.contributor))?.id).toBe(
      'contributor',
    );
    expect(matchingColumnSet(choice, reportMetricIds.slice(0, 6))?.id).toBe('credits');
    // All columns requires every hideable column.
    expect(matchingColumnSet(choice, shown(...reportMetricIds))).toBeUndefined();
    expect(matchingColumnSet(choice, ['actorType', ...reportMetricIds])?.id).toBe('all');
  });
  it('names a crumb after an overview parent, else Back to report', () => {
    const at = (route: UrlRoute, values = {}): UrlView => ({ route, segments: {}, values });
    expect(contributionBackLabel(at('/contributors', { period: 'last-month' }))).toBe(
      'Back to Contributors',
    );
    expect(contributionBackLabel(at('/reviewers', { all: true }))).toBe('Back to Reviewers');
    expect(contributionBackLabel(at('/companies', { lens: 'reviewers' }))).toBe(
      'Back to Companies',
    );
    for (const parent of [
      at('/reviewers', { metric: 'mergesPerformed' }),
      at('/companies', { timeline: true }),
      { route: '/companies/[...identity]', segments: { identity: ['unmapped'] }, values: {} },
      null,
      undefined,
    ] as (UrlView | null | undefined)[])
      expect(contributionBackLabel(parent)).toBe('Back to report');
  });
  it('shows "No reviewer activity" only for complete zero reviewer totals', () => {
    const zero = { status: 'complete', value: 0 } as const;
    const totals = Object.fromEntries(
      reportMetricIds.slice(0, 6).map((metric) => [metric, { status: 'complete', value: 3 }]),
    ) as unknown as ContributionValues;
    const reviewing = (value: ContributionValues['mergesPerformed']) => ({
      ...totals,
      reviewerContributions: zero,
      approvalContributions: zero,
      mergesPerformed: value,
    });
    expect(noReviewerActivity(reviewing(zero))).toBe(true);
    expect(noReviewerActivity(totals)).toBe(false);
    expect(noReviewerActivity(reviewing({ status: 'partial', value: 0, reason: 'r' }))).toBe(false);
    expect(noReviewerActivity(reviewing({ status: 'missing', value: null, reason: 'r' }))).toBe(
      false,
    );
  });
});
