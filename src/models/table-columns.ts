// Column IDs of the report tables, in table order. The URL codec and the server read these pure
// lists; the column definitions live in client modules, and a unit test keeps the two equal.
import { reportMetricIds } from './contribution-metrics';

/** Pull request record lists: repository pages, author records and supporting records. */
export const recordPrColumnIds = [
  'number',
  'title',
  'author',
  'humanReviewers',
  'approvals',
  'ageDays',
  'state',
  'labels',
  'createdAt',
  'mergeDays',
  'baseBranch',
  'mergedAt',
  'agentReviewer',
  'botReviewer',
  'latestActor',
  'authorType',
  'latestActivity',
] as const;
/** Issue record lists. */
export const recordIssueColumnIds = [
  'number',
  'title',
  'author',
  'ageDays',
  'state',
  'labels',
  'createdAt',
  'closedAt',
  'authorType',
  'latestActivity',
  'assignees',
] as const;
/** The merge-duration insight's merged pull requests. */
export const mergedPrColumnIds = recordPrColumnIds.filter((id) => id !== 'latestActivity');
/** The repository credit insights (agent and bot feedback and approval credits). */
export const insightCreditColumnIds = ['account', 'pr', 'title', 'firstCreditAt'] as const;
/** Contribution supporting details (a metric's credited records). */
export const contributionDetailColumnIds = [
  'record',
  'account',
  'actorType',
  'company',
  'repository',
  'state',
  'creditedAt',
  'lastAt',
  'value',
] as const;
/** Contribution report tables: identity columns, then every report metric. */
export const contributionTableColumnIds = {
  contributors: ['name', 'actorType', 'company', ...reportMetricIds],
  companies: ['name', 'members', ...reportMetricIds],
  members: ['name', 'actorType', ...reportMetricIds],
  repositories: ['name', ...reportMetricIds],
} as const satisfies Record<string, readonly string[]>;
export type ContributionTableKind = keyof typeof contributionTableColumnIds;
/** All repositories tables; their visibility is a viewer preference, never a URL field. */
export const overviewBacklogColumnIds = [
  'name',
  'totalOpenPrs',
  'draftPrs',
  'nonDraftPrs',
  'openIssues',
  'agedPrs30',
  'agedPrs60',
  'agedPrs90',
  'agedPrs120',
  'agedPrs180',
  'agedPrs360',
  'humanApprovals0',
  'humanApprovals1',
  'humanApprovals2',
  'humanApprovalsMoreThan2',
  'humanReviewers0',
  'humanReviewers1',
  'humanReviewers2',
  'humanReviewersMoreThan2',
  'agentFeedbackPrs',
  'botFeedbackPrs',
  'lastAgent',
  'lastBot',
  'lastPrebidReviewer',
  'lastContributor',
  'lastOtherHuman',
  'lastUnknown',
] as const;
export const overviewActivityColumnIds = [
  'name',
  'prsOpened',
  'prsMerged',
  'issuesOpened',
  'issuesClosed',
  'prAuthors',
  'issueAuthors',
  'medianMergeDays',
  'agentFeedbackCredits',
  'agentApprovalCredits',
  'botFeedbackCredits',
  'botApprovalCredits',
] as const;
