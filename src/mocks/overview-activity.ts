import type { PeriodPreset } from '@/models/reporting-period';
import { activitySchema, type RepositoryActivity } from '@/models/repository-overview';
import { activity, emptyActivity } from './overview-values';

interface ActivityPair {
  current: RepositoryActivity;
  comparison: RepositoryActivity;
}
// Independently prepared display periods, not sums of monthly headcounts or event simulations.
export const busyPeriods: Record<PeriodPreset, ActivityPair> = {
  'this-week': {
    current: activity(
      {
        prsOpened: 12,
        prsMerged: 9,
        issuesOpened: 14,
        issuesClosed: 10,
        prAuthors: 8,
        issueAuthors: 11,
        agentFeedbackCredits: 4,
        agentApprovalCredits: 2,
        botFeedbackCredits: 3,
        botApprovalCredits: 1,
      },
      4,
    ),
    comparison: activity(
      {
        prsOpened: 10,
        prsMerged: 11,
        issuesOpened: 16,
        issuesClosed: 8,
        prAuthors: 7,
        issueAuthors: 9,
        agentFeedbackCredits: 3,
        agentApprovalCredits: 3,
        botFeedbackCredits: 2,
        botApprovalCredits: 0,
      },
      5,
    ),
  },
  'last-week': {
    current: activity(
      {
        prsOpened: 15,
        prsMerged: 13,
        issuesOpened: 20,
        issuesClosed: 12,
        prAuthors: 10,
        issueAuthors: 12,
        agentFeedbackCredits: 5,
        agentApprovalCredits: 3,
        botFeedbackCredits: 4,
        botApprovalCredits: 0,
      },
      6,
    ),
    comparison: activity(
      {
        prsOpened: 16,
        prsMerged: 12,
        issuesOpened: 19,
        issuesClosed: 12,
        prAuthors: 9,
        issueAuthors: 13,
        agentFeedbackCredits: 6,
        agentApprovalCredits: 2,
        botFeedbackCredits: 4,
        botApprovalCredits: 1,
      },
      7,
    ),
  },
  'this-month': {
    current: activity(
      {
        prsOpened: 47,
        prsMerged: 38,
        issuesOpened: 58,
        issuesClosed: 46,
        prAuthors: 24,
        issueAuthors: 39,
        agentFeedbackCredits: 18,
        agentApprovalCredits: 9,
        botFeedbackCredits: 11,
        botApprovalCredits: 4,
      },
      5.5,
    ),
    comparison: activity(
      {
        prsOpened: 44,
        prsMerged: 35,
        issuesOpened: 55,
        issuesClosed: 43,
        prAuthors: 21,
        issueAuthors: 36,
        agentFeedbackCredits: 15,
        agentApprovalCredits: 6,
        botFeedbackCredits: 8,
        botApprovalCredits: 1,
      },
      7,
    ),
  },
  'last-month': {
    current: activity(
      {
        prsOpened: 61,
        prsMerged: 48,
        issuesOpened: 72,
        issuesClosed: 59,
        prAuthors: 29,
        issueAuthors: 45,
        agentFeedbackCredits: 22,
        agentApprovalCredits: 11,
        botFeedbackCredits: 14,
        botApprovalCredits: 5,
      },
      6.5,
    ),
    comparison: activity(
      {
        prsOpened: 58,
        prsMerged: 52,
        issuesOpened: 71,
        issuesClosed: 63,
        prAuthors: 31,
        issueAuthors: 42,
        agentFeedbackCredits: 18,
        agentApprovalCredits: 10,
        botFeedbackCredits: 16,
        botApprovalCredits: 6,
      },
      8,
    ),
  },
  'this-year': {
    current: activity(
      {
        prsOpened: 529,
        prsMerged: 481,
        issuesOpened: 710,
        issuesClosed: 654,
        prAuthors: 103,
        issueAuthors: 194,
        agentFeedbackCredits: 145,
        agentApprovalCredits: 62,
        botFeedbackCredits: 117,
        botApprovalCredits: 44,
      },
      6,
    ),
    comparison: activity(
      {
        prsOpened: 491,
        prsMerged: 450,
        issuesOpened: 665,
        issuesClosed: 681,
        prAuthors: 98,
        issueAuthors: 181,
        agentFeedbackCredits: 82,
        agentApprovalCredits: 33,
        botFeedbackCredits: 104,
        botApprovalCredits: 40,
      },
      8,
    ),
  },
  'last-year-to-date': {
    current: activity(
      {
        prsOpened: 491,
        prsMerged: 450,
        issuesOpened: 665,
        issuesClosed: 681,
        prAuthors: 98,
        issueAuthors: 181,
        agentFeedbackCredits: 82,
        agentApprovalCredits: 33,
        botFeedbackCredits: 104,
        botApprovalCredits: 40,
      },
      8,
    ),
    comparison: activity(
      {
        prsOpened: 460,
        prsMerged: 432,
        issuesOpened: 610,
        issuesClosed: 590,
        prAuthors: 92,
        issueAuthors: 175,
        agentFeedbackCredits: 0,
        agentApprovalCredits: 0,
        botFeedbackCredits: 93,
        botApprovalCredits: 36,
      },
      9,
    ),
  },
  'last-full-year': {
    current: activity(
      {
        prsOpened: 620,
        prsMerged: 588,
        issuesOpened: 827,
        issuesClosed: 810,
        prAuthors: 116,
        issueAuthors: 211,
        agentFeedbackCredits: 109,
        agentApprovalCredits: 48,
        botFeedbackCredits: 130,
        botApprovalCredits: 51,
      },
      7.5,
    ),
    comparison: activity(
      {
        prsOpened: 581,
        prsMerged: 541,
        issuesOpened: 770,
        issuesClosed: 741,
        prAuthors: 108,
        issueAuthors: 203,
        agentFeedbackCredits: 0,
        agentApprovalCredits: 0,
        botFeedbackCredits: 121,
        botApprovalCredits: 46,
      },
      9,
    ),
  },
};

export const preparedCustomPeriod: ActivityPair = {
  current: activity(
    {
      prsOpened: 7,
      prsMerged: 5,
      issuesOpened: 9,
      issuesClosed: 6,
      prAuthors: 5,
      issueAuthors: 7,
      agentFeedbackCredits: 2,
      agentApprovalCredits: 1,
      botFeedbackCredits: 1,
      botApprovalCredits: 0,
    },
    3.5,
  ),
  comparison: emptyActivity,
};

export const secondPreparedCustomPeriod: ActivityPair = {
  current: activity(
    {
      prsOpened: 5,
      prsMerged: 4,
      issuesOpened: 6,
      issuesClosed: 4,
      prAuthors: 4,
      issueAuthors: 5,
      agentFeedbackCredits: 3,
      agentApprovalCredits: 1,
      botFeedbackCredits: 1,
      botApprovalCredits: 0,
    },
    4,
  ),
  comparison: emptyActivity,
};

for (const pair of [
  ...Object.values(busyPeriods),
  preparedCustomPeriod,
  secondPreparedCustomPeriod,
]) {
  activitySchema.parse(pair.current);
  activitySchema.parse(pair.comparison);
}
