import type { OverviewRepository } from '@/models/repository-overview';
import type { RepositoryDrilldown } from '@/models/repository-drilldown';
import type {
  RecordSelection,
  RepositoryRecordList,
  RepositoryPullRequest,
  RepositoryIssue,
} from '@/models/repository-records';
import { notConnected } from '@/models/reporting-measurement';
import { matchesCurrentPr, recordListKind } from '@/lib/presentation/repository-records';
import { sampleRecordSource, sourceRepository, type RepositoryRecordSource } from './record-source';
import { periodCount, periodIssues, periodPullRequests } from './repository-activity';
import {
  byText,
  type WorldIssue,
  type WorldPullRequest,
  type WorldRepository,
} from './repository-world';

const day = 86_400_000;
const ageDays = (createdAt: string, asOf: string) =>
  Math.floor((Date.parse(asOf) - Date.parse(createdAt)) / day);
const newestFirst = (
  a: { createdAt: string; number: number },
  b: { createdAt: string; number: number },
) => byText(b.createdAt, a.createdAt) || b.number - a.number;
function pullRequestRow(row: WorldPullRequest, asOf: string): RepositoryPullRequest {
  return {
    id: row.id,
    number: row.number,
    title: row.title,
    author: row.author,
    draft: row.draft,
    humanReviewers: row.humanReviewers,
    approvals: row.approvals,
    ageDays: ageDays(row.createdAt, asOf),
    url: row.url,
    state: row.state,
    labels: [...row.labels],
    createdAt: row.createdAt,
    mergedAt: row.mergedAt,
    baseBranch: row.baseBranch,
    agentReviewer: row.agentReviewer,
    botReviewer: row.botReviewer,
    latestActor: row.latestActor,
  };
}
function issueRow(row: WorldIssue, asOf: string): RepositoryIssue {
  return {
    id: row.id,
    number: row.number,
    title: row.title,
    author: row.author,
    ageDays: ageDays(row.createdAt, asOf),
    url: row.url,
    state: row.state,
    labels: [...row.labels],
    createdAt: row.createdAt,
    closedAt: row.closedAt,
  };
}

/** Today's open pull requests as current record lists show them, before any metric filter. */
export function openPullRequestRows(world: WorldRepository, asOf: string): RepositoryPullRequest[] {
  return world.pullRequests
    .filter((row) => row.state === 'Open')
    .map((row) => pullRequestRow(row, asOf));
}

/** Select records from the repository's one dated record set; never a second set of counts. */
function buildRepositoryRecordSample(
  repo: OverviewRepository,
  drilldown: RepositoryDrilldown & { selection: RecordSelection },
  source: RepositoryRecordSource,
): RepositoryRecordList {
  const selection = drilldown.selection;
  const asOf = source.asOf;
  const context = { repository: repo, asOf, drilldown };
  const world = sourceRepository(source, repo.id);
  const toPr = (row: WorldPullRequest) => pullRequestRow(row, asOf);
  const toIssue = (row: WorldIssue) => issueRow(row, asOf);
  if (selection.scope === 'current') {
    const backlog = source.backlog(repo.id);
    const measurement =
      selection.metric === 'agedPrs'
        ? backlog.agedPrs[selection.ageDays]
        : backlog.counts[selection.metric];
    if (recordListKind(selection) === 'issues')
      return {
        ...context,
        measurement,
        kind: 'issues',
        rows:
          measurement.value === null
            ? []
            : world.issues
                .filter((row) => row.state === 'Open')
                .map(toIssue)
                .sort(newestFirst),
      };
    return {
      ...context,
      measurement,
      kind: 'prs',
      rows:
        measurement.value === null
          ? []
          : openPullRequestRows(world, asOf)
              .filter((row) => matchesCurrentPr(row, selection))
              .sort(newestFirst),
    };
  }
  if (selection.metric === 'prsOpened' || selection.metric === 'prsMerged') {
    const rows = periodPullRequests(world, selection.metric, selection.range);
    const measurement = world.notConnected?.pullRequests
      ? notConnected(world.notConnected.pullRequests)
      : periodCount(world, rows.length, selection.range);
    return {
      ...context,
      measurement,
      kind: 'prs',
      rows: measurement.value === null ? [] : rows.map(toPr).sort(newestFirst),
    };
  }
  const rows = periodIssues(world, selection.metric, selection.range);
  const measurement = world.notConnected?.issues
    ? notConnected(world.notConnected.issues)
    : periodCount(world, rows.length, selection.range);
  return {
    ...context,
    measurement,
    kind: 'issues',
    rows: measurement.value === null ? [] : rows.map(toIssue).sort(newestFirst),
  };
}

export function repositoryRecordSample(
  repo: OverviewRepository,
  drilldown: RepositoryDrilldown & { selection: RecordSelection },
  source: RepositoryRecordSource = sampleRecordSource,
): RepositoryRecordList {
  const result = buildRepositoryRecordSample(repo, drilldown, source);
  if (result.kind === 'prs')
    return {
      ...result,
      rows: result.rows.map((row) => ({ ...row, authorUrl: source.profileUrl(row.author) })),
    };
  return {
    ...result,
    rows: result.rows.map((row) => ({ ...row, authorUrl: source.profileUrl(row.author) })),
  };
}
