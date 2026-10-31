import { sampleProfileUrl } from './repository-accounts';
import { repositoryCatalog } from '@/config/repositories';
import type { RepositoryBacklog } from '@/models/repository-overview';
import type { Count } from '@/models/reporting-measurement';
import type {
  RepositoryPullRequest,
  RepositoryIssue,
  LatestActor,
} from '@/models/repository-records';
import { agingThresholds } from '@/models/repository-overview';
import { overviewBacklogs } from './overview-backlog';
import { overviewAsOf } from './sample-clock';

const day = 86_400_000;
const instant = (milliseconds: number) => new Date(milliseconds).toISOString();
const ago = (days: number) => instant(Date.parse(overviewAsOf) - days * day);
function known(count: Count): number {
  if (count.value === null) throw new Error('Missing required sample count');
  return count.value;
}
function bucket(index: number, counts: Count[]): number | null {
  if (counts.some((count) => count.status !== 'complete')) return null;
  let boundary = 0;
  return counts.findIndex((count) => index < (boundary += known(count)));
}
function ageAt(rank: number, backlog: RepositoryBacklog): number {
  const total = known(backlog.counts.nonDraftPrs);
  let lower = 0;
  for (const threshold of agingThresholds) {
    if (rank < total - known(backlog.agedPrs[threshold])) return lower + 1;
    lower = threshold;
  }
  return lower + 1;
}
function coverage(index: number, count: Count): boolean | null {
  return count.value !== null && index < count.value
    ? true
    : count.status === 'complete'
      ? false
      : null;
}
function repository(id: string) {
  const repo = repositoryCatalog.find((entry) => entry.id === id && entry.enabled);
  if (!repo) throw new Error('Unknown sample repository');
  return repo;
}
const latest: LatestActor[] = [
  'agent',
  'bot',
  'prebid-reviewer',
  'contributor',
  'other-human',
  'unknown',
];
/** Expand only requested sample lists. Counts are prepared values, never fetched reporting history. */
export function currentPrSample(repositoryId: string): RepositoryPullRequest[] {
  const repo = repository(repositoryId);
  const backlog = overviewBacklogs[repo.id],
    c = backlog.counts;
  const drafts = known(c.draftPrs),
    nonDrafts = known(c.nonDraftPrs);
  return Array.from({ length: drafts + nonDrafts }, (_, index): RepositoryPullRequest => {
    const number = index + 1,
      draft = index < drafts,
      position = index - drafts;
    const ageDays = draft ? 1 + (index % 20) : ageAt(nonDrafts - position - 1, backlog);
    const actor = draft
      ? 3
      : bucket(position, [
          c.lastAgent,
          c.lastBot,
          c.lastPrebidReviewer,
          c.lastContributor,
          c.lastOtherHuman,
          c.lastUnknown,
        ]);
    return {
      id: repo.id + '-pr-' + number,
      number: 1000 + number,
      title:
        'Sample PR ' +
        number +
        ': ' +
        (number % 3 === 0
          ? 'Improve adapter configuration and validation'
          : 'Update integration behavior'),
      author: number % 2 === 0 ? 'sample-alice' : 'sample-bob',
      draft,
      humanReviewers: draft
        ? 0
        : bucket(position, [
            c.humanReviewers0,
            c.humanReviewers1,
            c.humanReviewers2,
            c.humanReviewersMoreThan2,
          ]),
      approvals: draft
        ? 0
        : bucket(position, [
            c.humanApprovals0,
            c.humanApprovals1,
            c.humanApprovals2,
            c.humanApprovalsMoreThan2,
          ]),
      ageDays,
      url: 'https://github.example/example-fixtures/' + repo.slug + '/pull/' + (1000 + number),
      state: 'Open',
      labels: [number % 3 === 0 ? 'maintenance' : 'enhancement'],
      createdAt: ago(ageDays),
      mergedAt: null,
      baseBranch: repo.primaryBranch,
      agentReviewer: draft ? false : coverage(position, c.agentFeedbackPrs),
      botReviewer: draft ? false : coverage(position, c.botFeedbackPrs),
      latestActor: actor === null ? 'unknown' : latest[actor],
    };
  }).sort((a, b) => a.ageDays - b.ageDays || b.number - a.number);
}
export function currentIssueSample(repositoryId: string): RepositoryIssue[] {
  const repo = repository(repositoryId),
    count = known(overviewBacklogs[repo.id].counts.openIssues);
  return Array.from({ length: count }, (_, index): RepositoryIssue => ({
    id: repo.id + '-issue-' + (index + 1),
    number: index + 1,
    title:
      index === 0
        ? 'Oldest sample issue: keyboard navigation'
        : 'Sample issue ' + (index + 1) + ': Improve documentation',
    author: index % 2 === 0 ? 'sample-alice' : 'sample-bob',
    ageDays: count - index,
    url: 'https://github.example/example-fixtures/' + repo.slug + '/issues/' + (index + 1),
    state: 'Open',
    labels: ['documentation'],
    createdAt: ago(count - index),
    closedAt: null,
  })).reverse();
}
/** Today's open records for the legacy default list, from the same backlog cohort. */
export function repositorySample(repositoryId: string) {
  return {
    prs: currentPrSample(repositoryId).map((row) => ({
      ...row,
      authorUrl: sampleProfileUrl(row.author),
    })),
    issues: currentIssueSample(repositoryId).map((row) => ({
      ...row,
      authorUrl: sampleProfileUrl(row.author),
    })),
  };
}
