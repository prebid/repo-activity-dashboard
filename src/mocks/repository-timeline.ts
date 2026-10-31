import {
  repositoryTimelineSourceSchema,
  type RepositoryTimelineSource,
} from '@/models/repository-timeline';
import type { RepositoryTimelineMatrixSource } from '@/models/repository-timeline-matrix';
import type { ContributionScenario } from './contributions';
import { sampleProfileUrl } from './repository-accounts';
import {
  authorCategory,
  endedAt,
  repositoryWorld,
  reviewStateAt,
  type WorldIssue,
  type WorldPullRequest,
  type WorldRepository,
  type WorldScenario,
} from './repository-world';
import { overviewAsOf } from './sample-clock';

export type RepositoryTimelineScenario = ContributionScenario | 'calendar' | 'mixed';
const day = 86_400_000;
const cutoffs = ['2026-10-12T00:00:00.000Z', '2026-10-22T00:00:00.000Z'];
function worldScenario(scenario: RepositoryTimelineScenario): WorldScenario {
  return scenario === 'partial' ||
    scenario === 'missing' ||
    scenario === 'empty' ||
    scenario === 'mixed'
    ? scenario
    : 'reference';
}
const ageAt = (createdAt: string, at: string) => (Date.parse(at) - Date.parse(createdAt)) / day;
function pullRequestRow(row: WorldPullRequest) {
  return {
    id: row.id,
    number: row.number,
    title: row.title,
    url: row.url,
    author: row.author,
    authorUrl: sampleProfileUrl(row.author),
    authorType: row.authorType,
    createdAt: row.createdAt,
    labels: row.labels,
    ageDays: ageAt(row.createdAt, overviewAsOf),
    latestActivity: row.latestActivity,
    state: row.state,
    draft: row.draft,
    mergedAt: row.mergedAt,
    baseBranch: row.baseBranch,
    humanReviewers: row.humanReviewers,
    approvals: row.approvals,
    agentReviewer: row.agentReviewer,
    botReviewer: row.botReviewer,
    latestActor: row.latestActor,
  };
}
function issueRow(row: WorldIssue) {
  return {
    id: row.id,
    number: row.number,
    title: row.title,
    url: row.url,
    author: row.author,
    authorUrl: sampleProfileUrl(row.author),
    authorType: row.authorType,
    createdAt: row.createdAt,
    labels: row.labels,
    ageDays: ageAt(row.createdAt, overviewAsOf),
    latestActivity: row.latestActivity,
    state: row.state,
    closedAt: row.closedAt,
    assignees: row.assignees,
  };
}
/** The latest dated event before a cutoff: a review, or the record's opening. */
function latestBefore(row: WorldPullRequest, cutoff: string) {
  const review = row.reviews.filter((event) => event.at < cutoff).at(-1);
  const category = !review
    ? authorCategory(row.authorType)
    : review.actorType === 'human'
      ? ('prebid-reviewer' as const)
      : review.actorType;
  return {
    latestActor: category,
    latestActivity: {
      at: review?.at ?? row.createdAt,
      account: review?.account ?? row.author,
      category,
    },
  };
}
const openAt = (row: WorldPullRequest | WorldIssue, cutoff: string) => {
  const ended = endedAt(row);
  return row.createdAt < cutoff && (ended === null || ended >= cutoff);
};
/** Historical snapshots, prepared for the reference cast's two October cutoffs. */
function snapshots(
  repository: WorldRepository,
  kind: 'prs' | 'issues',
  scenario: RepositoryTimelineScenario,
) {
  if (!['reference', 'partial', 'calendar', 'mixed'].includes(scenario)) return [];
  if (scenario === 'mixed' && repository.id === 'repo-prebidserverjava') return [];
  const coverage =
    scenario === 'partial'
      ? { status: 'partial' as const, reason: 'Some historical sample records are unavailable.' }
      : scenario === 'mixed' && repository.id === 'repo-prebidserver'
        ? {
            status: 'partial' as const,
            reason: 'This repository has incomplete prepared historical coverage.',
          }
        : { status: 'complete' as const };
  // Membership, age, review state and latest activity follow each record's dates at the cutoff.
  // Labels, title, draft status, base branch and assignees repeat today's values in this sample.
  return cutoffs.map((at) => ({
    cutoff: { at, inclusive: false },
    coverage,
    rows:
      kind === 'prs'
        ? repository.pullRequests
            .filter((row) => openAt(row, at))
            .map((row) => ({
              ...pullRequestRow(row),
              state: 'Open' as const,
              mergedAt: null,
              ageDays: ageAt(row.createdAt, at),
              ...reviewStateAt(row, at),
              ...latestBefore(row, at),
            }))
        : repository.issues
            .filter((row) => openAt(row, at))
            .map((row) => ({
              ...issueRow(row),
              state: 'Open' as const,
              closedAt: null,
              ageDays: ageAt(row.createdAt, at),
              latestActivity: {
                at: row.createdAt,
                account: row.author,
                category: authorCategory(row.authorType),
              },
            })),
  }));
}
function source(
  repository: WorldRepository,
  kind: 'prs' | 'issues',
  scenario: RepositoryTimelineScenario,
  gap: boolean,
): RepositoryTimelineSource {
  return repositoryTimelineSourceSchema.parse({
    source: 'sample',
    scenarioId: 'repositories-' + scenario + '-v1' + (gap ? '-temporal-gap' : ''),
    asOf: overviewAsOf,
    repository: {
      id: repository.id,
      slug: repository.slug,
      name: repository.name,
      primaryBranch: repository.primaryBranch,
    },
    kind,
    availableRanges: repository.availability,
    rows:
      kind === 'prs'
        ? repository.pullRequests.map(pullRequestRow)
        : repository.issues.map(issueRow),
    snapshots: snapshots(repository, kind, scenario),
  });
}
export function repositoryTimelineSample(
  kind: 'prs' | 'issues' = 'prs',
  repositoryId = 'repo-prebidjs',
  scenario: RepositoryTimelineScenario = 'reference',
  gap = false,
): RepositoryTimelineSource {
  const repository = repositoryWorld(worldScenario(scenario), gap).get(repositoryId);
  if (!repository) throw Error('Unknown sample repository');
  return source(repository, kind, scenario, gap);
}
export function repositoryTimelineMatrixSample(
  kind: 'prs' | 'issues' | 'mixed' = 'prs',
  scenario: RepositoryTimelineScenario = 'reference',
  gap = false,
): RepositoryTimelineMatrixSource {
  const repositories = [...repositoryWorld(worldScenario(scenario), gap).values()];
  return {
    source: 'sample',
    scenarioId: 'repositories-' + scenario + '-v1' + (gap ? '-temporal-gap' : ''),
    asOf: overviewAsOf,
    kind,
    repositories: repositories.flatMap((repository) =>
      kind === 'mixed'
        ? [source(repository, 'prs', scenario, gap), source(repository, 'issues', scenario, gap)]
        : [source(repository, kind, scenario, gap)],
    ),
  };
}
