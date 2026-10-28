import {
  agingThresholds,
  backlogSchema,
  type Count,
  type RepositoryBacklog,
} from '@/models/repository-overview';
import { complete, missing, partial } from './overview-values';

type Buckets = readonly [zero: number, one: number, two: number, moreThanTwo: number];
type Ages = readonly [
  over30: number,
  over60: number,
  over90: number,
  over120: number,
  over180: number,
  over360: number,
];
type Latest = readonly [
  agent: number,
  bot: number,
  reviewer: number,
  contributor: number,
  other: number,
  unknown: number,
];
interface BacklogSeed {
  drafts: number;
  nonDrafts: number;
  issues: number;
  ages: Ages;
  reviewers?: Buckets;
  approvals?: Buckets;
  agent?: number;
  bot?: number;
  latest?: Latest;
}
// Direct display values. Defaults explicitly describe a sample with no feedback or approvals.
function backlog(seed: BacklogSeed): RepositoryBacklog {
  const reviewers = seed.reviewers ?? [seed.nonDrafts, 0, 0, 0];
  const approvals = seed.approvals ?? [seed.nonDrafts, 0, 0, 0];
  const latest = seed.latest ?? [0, 0, 0, seed.nonDrafts, 0, 0];
  return backlogSchema.parse({
    counts: {
      totalOpenPrs: complete(seed.drafts + seed.nonDrafts),
      draftPrs: complete(seed.drafts),
      nonDraftPrs: complete(seed.nonDrafts),
      openIssues: complete(seed.issues),
      humanReviewers0: complete(reviewers[0]),
      humanReviewers1: complete(reviewers[1]),
      humanReviewers2: complete(reviewers[2]),
      humanReviewersMoreThan2: complete(reviewers[3]),
      humanApprovals0: complete(approvals[0]),
      humanApprovals1: complete(approvals[1]),
      humanApprovals2: complete(approvals[2]),
      humanApprovalsMoreThan2: complete(approvals[3]),
      agentFeedbackPrs: complete(seed.agent ?? 0),
      botFeedbackPrs: complete(seed.bot ?? 0),
      lastAgent: complete(latest[0]),
      lastBot: complete(latest[1]),
      lastPrebidReviewer: complete(latest[2]),
      lastContributor: complete(latest[3]),
      lastOtherHuman: complete(latest[4]),
      lastUnknown: complete(latest[5]),
    },
    agedPrs: Object.fromEntries(agingThresholds.map((days, i) => [days, complete(seed.ages[i])])),
  });
}

export const overviewBacklogs: Record<string, RepositoryBacklog> = {
  'repo-prebidjs': backlog({
    drafts: 17,
    nonDrafts: 120,
    issues: 834,
    ages: [90, 60, 30, 0, 0, 0],
    reviewers: [39, 40, 40, 1],
    approvals: [60, 40, 19, 1],
    agent: 48,
    bot: 30,
    latest: [18, 12, 36, 52, 1, 1],
  }),
  'repo-prebidserver': backlog({
    drafts: 7,
    nonDrafts: 30,
    issues: 86,
    ages: [15, 12, 8, 6, 3, 1],
    reviewers: [15, 10, 5, 0],
    approvals: [24, 4, 2, 0],
    agent: 10,
    bot: 8,
    latest: [4, 3, 9, 14, 0, 0],
  }),
  'repo-prebidserverjava': backlog({
    drafts: 3,
    nonDrafts: 13,
    issues: 31,
    ages: [7, 4, 2, 1, 0, 0],
    reviewers: [5, 6, 2, 0],
    approvals: [8, 4, 1, 0],
    agent: 3,
    bot: 4,
    latest: [1, 2, 4, 6, 0, 0],
  }),
  'repo-prebiddocs': backlog({
    drafts: 4,
    nonDrafts: 19,
    issues: 12345,
    ages: [10, 8, 6, 4, 2, 1],
  }),
  'repo-prebidmobileandroid': backlog({
    drafts: 4,
    nonDrafts: 20,
    issues: 64,
    ages: [12, 9, 6, 3, 2, 0],
  }),
  'repo-prebidmobileios': backlog({
    drafts: 2,
    nonDrafts: 10,
    issues: 27,
    ages: [6, 4, 2, 0, 0, 0],
  }),
  'repo-prebid-mobile-ios-sdk': backlog({
    drafts: 0,
    nonDrafts: 0,
    issues: 0,
    ages: [0, 0, 0, 0, 0, 0],
  }),
  'repo-prebid-universal-creative': backlog({
    drafts: 1,
    nonDrafts: 7,
    issues: 15,
    ages: [4, 3, 2, 1, 0, 0],
  }),
  'repo-professor-prebid': backlog({
    drafts: 0,
    nonDrafts: 4,
    issues: 9,
    ages: [3, 2, 1, 0, 0, 0],
  }),
  'repo-salesagent': backlog({
    drafts: 3,
    nonDrafts: 16,
    issues: 18,
    ages: [8, 5, 3, 1, 0, 0],
    reviewers: [10, 4, 2, 0],
    approvals: [12, 3, 1, 0],
    agent: 14,
    bot: 4,
    latest: [10, 1, 2, 3, 0, 0],
  }),
  'repo-prebid-agent-skills': backlog({
    drafts: 1,
    nonDrafts: 6,
    issues: 22,
    ages: [3, 2, 1, 0, 0, 0],
  }),
  'repo-line-item-manager': backlog({
    drafts: 0,
    nonDrafts: 4,
    issues: 4,
    ages: [3, 1, 1, 0, 0, 0],
  }),
  'repo-go-gdpr': backlog({ drafts: 0, nonDrafts: 3, issues: 5, ages: [3, 2, 2, 1, 0, 0] }),
  'repo-prebid-cache-java': backlog({
    drafts: 1,
    nonDrafts: 7,
    issues: 11,
    ages: [5, 3, 1, 0, 0, 0],
  }),
  'repo-repo-activity-dashboard': backlog({
    drafts: 1,
    nonDrafts: 4,
    issues: 7,
    ages: [2, 1, 0, 0, 0, 0],
  }),
  'repo-openrtb': backlog({ drafts: 0, nonDrafts: 2, issues: 3, ages: [2, 2, 1, 0, 0, 0] }),
  'repo-github-activity-db': backlog({
    drafts: 0,
    nonDrafts: 1,
    issues: 2,
    ages: [1, 0, 0, 0, 0, 0],
  }),
  'repo-prebid-integration-monitor': backlog({
    drafts: 0,
    nonDrafts: 0,
    issues: 0,
    ages: [0, 0, 0, 0, 0, 0],
  }),
};

const unavailableApproval = missing('Current approval state is missing in this invented sample.');
const agentSkills = overviewBacklogs['repo-prebid-agent-skills'].counts;
agentSkills.humanApprovals0 = unavailableApproval;
agentSkills.humanApprovals1 = unavailableApproval;
agentSkills.humanApprovals2 = unavailableApproval;
agentSkills.humanApprovalsMoreThan2 = unavailableApproval;
const partialCoverage: Count = partial(
  2,
  'Only part of the agent feedback history is available in this sample.',
);
overviewBacklogs['repo-prebid-cache-java'].counts.agentFeedbackPrs = partialCoverage;
