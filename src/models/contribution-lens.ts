// The two lenses over one contribution report (P6): Contributors and Reviewers. Each lens lists the
// accounts of one population role and shows that role's three credit metrics by default.
import { contributionMetricIds, type ContributionMetric } from './contributions';
import type { ReportMetric } from './contribution-metrics';

export const contributionLenses = ['contributors', 'reviewers'] as const;
export type ContributionLens = (typeof contributionLenses)[number];
export function isContributionLens(value: unknown): value is ContributionLens {
  return contributionLenses.some((lens) => lens === value);
}

/** The role a credit gives an account in a lens's population. */
export type PopulationRole = 'contributor' | 'reviewer';
export const lensRole: Readonly<Record<ContributionLens, PopulationRole>> = {
  contributors: 'contributor',
  reviewers: 'reviewer',
};
/**
 * Each role's credit metrics, in report order. A self-merge is a Merges performed credit, so it is
 * reviewer evidence. Comment and merged-volume metrics are associations, not credits: no role.
 */
export const roleMetrics: Readonly<Record<PopulationRole, readonly ContributionMetric[]>> = {
  contributor: ['prsAuthored', 'authoredPrsMerged', 'issuesAuthored'],
  reviewer: ['reviewerContributions', 'approvalContributions', 'mergesPerformed'],
};
/** The population role a report metric establishes, or null for comment and volume metrics. */
export function metricPopulationRole(metric: ReportMetric): PopulationRole | null {
  for (const role of ['contributor', 'reviewer'] as const)
    if ((roleMetrics[role] as readonly string[]).includes(metric)) return role;
  return null;
}
/** A lens's default sort: its lead credit metric, descending. */
export const lensDefaultSort: Readonly<
  Record<ContributionLens, { sort: ContributionMetric; descending: true }>
> = {
  contributors: { sort: 'authoredPrsMerged', descending: true },
  reviewers: { sort: 'reviewerContributions', descending: true },
};

/** The Column set choice: a role's three metrics, the six credits, or every column. */
export const columnSetIds = ['contributor', 'reviewer', 'credits', 'all'] as const;
export type ColumnSetId = (typeof columnSetIds)[number];
export const columnSetLabels: Readonly<Record<ColumnSetId, string>> = {
  contributor: 'Contributor',
  reviewer: 'Reviewer',
  credits: 'All credits',
  all: 'All columns',
};
/** The metric columns a set shows; `all` shows every hideable column, which the table names. */
export const columnSetMetrics: Readonly<
  Record<Exclude<ColumnSetId, 'all'>, readonly ContributionMetric[]>
> = {
  contributor: roleMetrics.contributor,
  reviewer: roleMetrics.reviewer,
  credits: contributionMetricIds,
};
/** The set each lens shows by default. */
export const lensColumnSet: Readonly<Record<ContributionLens, ColumnSetId>> = {
  contributors: 'contributor',
  reviewers: 'reviewer',
};
