import type { DrilldownSelection } from '@/models/repository-drilldown';
import type {
  RecordSelection,
  RepositoryPullRequest,
  LatestActor,
} from '@/models/repository-records';

export function isRecordSelection(selection: DrilldownSelection): selection is RecordSelection {
  return (
    selection.scope === 'current' ||
    ['prsOpened', 'prsMerged', 'issuesOpened', 'issuesClosed'].includes(selection.metric)
  );
}
export function recordListKind(selection: RecordSelection): 'prs' | 'issues' {
  return ['openIssues', 'issuesOpened', 'issuesClosed'].includes(selection.metric)
    ? 'issues'
    : 'prs';
}
const labels: Record<Exclude<RecordSelection['metric'], 'agedPrs'>, string> = {
  totalOpenPrs: 'Open pull requests',
  draftPrs: 'Draft pull requests',
  nonDraftPrs: 'Open non-draft pull requests',
  openIssues: 'Open issues',
  humanReviewers0: 'PRs with 0 human reviewers',
  humanReviewers1: 'PRs with 1 human reviewer',
  humanReviewers2: 'PRs with 2 human reviewers',
  humanReviewersMoreThan2: 'PRs with more than 2 human reviewers',
  humanApprovals0: 'PRs with 0 human approvals',
  humanApprovals1: 'PRs with 1 human approval',
  humanApprovals2: 'PRs with 2 human approvals',
  humanApprovalsMoreThan2: 'PRs with more than 2 human approvals',
  agentFeedbackPrs: 'PRs with Prebid agent reviewers',
  botFeedbackPrs: 'PRs with other bot reviewers',
  lastAgent: 'PRs last updated by an agent',
  lastBot: 'PRs last updated by a bot',
  lastPrebidReviewer: 'PRs last updated by a Prebid reviewer',
  lastContributor: 'PRs last updated by the contributor',
  lastOtherHuman: 'PRs last updated by another human',
  lastUnknown: 'PRs with an unknown latest actor',
  prsOpened: 'PRs opened during the period',
  prsMerged: 'PRs merged during the period',
  issuesOpened: 'Issues opened during the period',
  issuesClosed: 'Issues closed during the period',
};
export function recordListTitle(selection: RecordSelection, author?: string): string {
  if (author) return (recordListKind(selection) === 'prs' ? 'PRs' : 'Issues') + ' by ' + author;
  return selection.metric === 'agedPrs'
    ? 'PRs older than ' + selection.ageDays + ' days'
    : labels[selection.metric];
}
const actors: Partial<Record<RecordSelection['metric'], LatestActor>> = {
  lastAgent: 'agent',
  lastBot: 'bot',
  lastPrebidReviewer: 'prebid-reviewer',
  lastContributor: 'contributor',
  lastOtherHuman: 'other-human',
  lastUnknown: 'unknown',
};
/** The open-PR field a current selection reads; when it is unknown, membership is unknown. */
export function currentPrAttribute(
  selection: Extract<RecordSelection, { scope: 'current' }>,
): 'humanReviewers' | 'approvals' | 'agentReviewer' | 'botReviewer' | null {
  const metric = selection.metric;
  if (metric.startsWith('humanReviewers')) return 'humanReviewers';
  if (metric.startsWith('humanApprovals')) return 'approvals';
  if (metric === 'agentFeedbackPrs') return 'agentReviewer';
  if (metric === 'botFeedbackPrs') return 'botReviewer';
  return null;
}
export function matchesCurrentPr(
  row: RepositoryPullRequest,
  selection: Extract<RecordSelection, { scope: 'current' }>,
): boolean {
  if (row.state !== 'Open') return false;
  const metric = selection.metric;
  if (metric === 'totalOpenPrs') return true;
  if (metric === 'draftPrs') return row.draft;
  if (row.draft) return false;
  switch (metric) {
    case 'nonDraftPrs':
      return true;
    case 'agedPrs':
      return row.ageDays > selection.ageDays;
    case 'humanReviewers0':
      return row.humanReviewers === 0;
    case 'humanReviewers1':
      return row.humanReviewers === 1;
    case 'humanReviewers2':
      return row.humanReviewers === 2;
    case 'humanReviewersMoreThan2':
      return row.humanReviewers !== null && row.humanReviewers > 2;
    case 'humanApprovals0':
      return row.approvals === 0;
    case 'humanApprovals1':
      return row.approvals === 1;
    case 'humanApprovals2':
      return row.approvals === 2;
    case 'humanApprovalsMoreThan2':
      return row.approvals !== null && row.approvals > 2;
    case 'agentFeedbackPrs':
      return row.agentReviewer === true;
    case 'botFeedbackPrs':
      return row.botReviewer === true;
    default:
      return actors[metric] !== undefined && row.latestActor === actors[metric];
  }
}
