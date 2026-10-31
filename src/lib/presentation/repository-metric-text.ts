import type { ActivityMetric, AgingThreshold, BacklogMetric } from '@/models/repository-overview';
import { agingThresholdForColumn } from './overview-aging';
import { metricName } from '@/models/column-selection';

export interface RepositoryMetricText {
  label: string;
  group: string;
  description: string;
}
export type RepositoryActivityTextMetric = ActivityMetric | 'medianMergeDays';

/** One owner for repository metric names: Summary tables, Timeline views and exports read it. */
export const backlogMetricText: Record<BacklogMetric, RepositoryMetricText> = {
  totalOpenPrs: {
    label: 'Total PRs',
    group: 'Pull requests',
    description: 'All currently open PRs, including drafts.',
  },
  draftPrs: { label: 'Drafts', group: 'Pull requests', description: 'Currently open draft PRs.' },
  nonDraftPrs: {
    label: 'Open',
    group: 'Pull requests',
    description: 'Currently open PRs, excluding drafts.',
  },
  openIssues: {
    label: 'Open',
    group: 'Issues',
    description: 'Currently open issues, excluding pull requests.',
  },
  humanApprovals0: {
    label: '0 approvals',
    group: 'Human approvals',
    description: 'Open non-draft PRs with zero current human approvals.',
  },
  humanApprovals1: {
    label: '1 approval',
    group: 'Human approvals',
    description: 'Open non-draft PRs with one current human approver.',
  },
  humanApprovals2: {
    label: '2 approvals',
    group: 'Human approvals',
    description: 'Open non-draft PRs with two current human approvers.',
  },
  humanApprovalsMoreThan2: {
    label: 'More than 2 approvals',
    group: 'Human approvals',
    description: 'Open non-draft PRs with more than two current human approvers.',
  },
  humanReviewers0: {
    label: '0 reviewers',
    group: 'Human reviewers',
    description:
      'Open non-draft PRs with no non-author human comments or requests for changes. An approval alone does not count as reviewer participation.',
  },
  humanReviewers1: {
    label: '1 reviewer',
    group: 'Human reviewers',
    description:
      'Open non-draft PRs with exactly one distinct non-author human who has provided a qualifying comment or request for changes. Approvals are separate.',
  },
  humanReviewers2: {
    label: '2 reviewers',
    group: 'Human reviewers',
    description:
      'Open non-draft PRs with exactly two distinct non-author human reviewers. Repeated comments by the same account do not add reviewers.',
  },
  humanReviewersMoreThan2: {
    label: 'More than 2 reviewers',
    group: 'Human reviewers',
    description:
      'Open non-draft PRs with more than two distinct non-author human reviewers; these values are not capped at two.',
  },
  agentFeedbackPrs: {
    label: 'Prebid agents',
    group: 'Reviewer coverage',
    description: 'Open non-draft PRs with at least one qualifying Prebid agent reviewer.',
  },
  botFeedbackPrs: {
    label: 'Bots',
    group: 'Reviewer coverage',
    description:
      'Open non-draft PRs with at least one qualifying bot reviewer, excluding Prebid agents.',
  },
  lastAgent: {
    label: 'Agent last',
    group: 'Latest activity',
    description:
      'Open non-draft PRs whose latest qualifying activity came from a mapped Prebid agent.',
  },
  lastBot: {
    label: 'Bot last',
    group: 'Latest activity',
    description:
      'Open non-draft PRs whose latest qualifying activity came from another bot, excluding mapped Prebid agents.',
  },
  lastPrebidReviewer: {
    label: 'Reviewer last',
    group: 'Latest activity',
    description:
      'Open non-draft PRs whose latest qualifying activity came from a mapped Prebid human reviewer.',
  },
  lastContributor: {
    label: 'Contributor last',
    group: 'Latest activity',
    description:
      'Open non-draft PRs whose latest qualifying activity came from the PR contributor.',
  },
  lastOtherHuman: {
    label: 'Other human last',
    group: 'Latest activity',
    description:
      'Open non-draft PRs whose latest qualifying activity came from another human account.',
  },
  lastUnknown: {
    label: 'Unknown actor',
    group: 'Latest activity',
    description:
      'Open non-draft PRs with a known latest activity whose actor is unclassified. Unavailable activity history is separate and may make counts partial.',
  },
};
export function agedPrsText(age: AgingThreshold): RepositoryMetricText {
  return {
    label: 'Over ' + age + ' days',
    group: 'PR age',
    description: 'Non-draft PRs created more than ' + age + ' days ago.',
  };
}
export const activityMetricText: Record<RepositoryActivityTextMetric, RepositoryMetricText> = {
  prsOpened: {
    label: 'Opened',
    group: 'Pull requests',
    description: 'PRs created during this period, including drafts.',
  },
  prsMerged: {
    label: 'Merged',
    group: 'Pull requests',
    description: 'PRs merged into each repository’s primary branch during this period.',
  },
  issuesOpened: {
    label: 'Opened',
    group: 'Issues',
    description: 'Issues created during the selected period, excluding pull requests.',
  },
  issuesClosed: {
    label: 'Closed',
    group: 'Issues',
    description: 'Issues closed during the selected period, including those subsequently reopened.',
  },
  prAuthors: {
    label: 'PRs',
    group: 'Unique authors',
    description: 'Distinct accounts that authored PRs in this repository during the period.',
  },
  issueAuthors: {
    label: 'Issues',
    group: 'Unique authors',
    description: 'Distinct accounts that authored issues in this repository during the period.',
  },
  agentFeedbackCredits: {
    label: 'Agent reviewers',
    group: 'Prebid agents',
    description:
      'Reviewer contributions from Prebid agents, counted once per agent and PR in the period of its first qualifying review.',
  },
  agentApprovalCredits: {
    label: 'Agent approvals',
    group: 'Prebid agents',
    description:
      'Approval contributions from Prebid agents, counted once per account and PR on its first approval date; reapprovals do not add credits.',
  },
  botFeedbackCredits: {
    label: 'Bot reviewers',
    group: 'Bots',
    description:
      'Reviewer contributions from other bots, counted once per bot and PR in the period of its first qualifying review.',
  },
  botApprovalCredits: {
    label: 'Bot approvals',
    group: 'Bots',
    description:
      'Approval contributions from other bots, counted once per account and PR on its first approval date; these are separate from current approvals.',
  },
  medianMergeDays: {
    label: 'Median merge time',
    group: 'Duration',
    description:
      'Median time from PR creation to merge. Includes only primary-branch merges in the period.',
  },
};
export function repositoryMetricText(id: string): RepositoryMetricText {
  const age = agingThresholdForColumn(id);
  if (age !== undefined) return agedPrsText(age);
  const text =
    (backlogMetricText as Record<string, RepositoryMetricText>)[id] ??
    (activityMetricText as Record<string, RepositoryMetricText>)[id];
  if (!text) throw Error('Unknown repository metric');
  return text;
}
/** Names a metric outside its table group, as headers, exports and supporting pages do. */
export function repositoryMetricName(id: string): string {
  const text = repositoryMetricText(id);
  return metricName(text);
}
