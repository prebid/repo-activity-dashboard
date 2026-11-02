import { describe, expect, it } from 'vitest';
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
