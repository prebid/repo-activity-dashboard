import { sampleProfileUrl } from './repository-accounts';
import type { OverviewRepository } from '@/models/repository-overview';
import type { RepositoryDrilldown } from '@/models/repository-drilldown';
import type {
  RecordSelection,
  RepositoryRecordList,
  RepositoryPullRequest,
  RepositoryIssue,
} from '@/models/repository-records';
import { matchesCurrentPr, recordListKind } from '@/lib/presentation/repository-records';
import { overviewBacklogs } from './overview-backlog';
import { periodCount, periodIssues, periodPullRequests } from './repository-activity';
import { worldRepository, type WorldIssue, type WorldPullRequest } from './repository-world';
import { overviewAsOf } from './sample-clock';

const day = 86_400_000;
const ageDays = (createdAt: string) =>
  Math.floor((Date.parse(overviewAsOf) - Date.parse(createdAt)) / day);
const newestFirst = (
  a: { createdAt: string; number: number },
  b: { createdAt: string; number: number },
) => b.createdAt.localeCompare(a.createdAt) || b.number - a.number;
function pullRequestRow(row: WorldPullRequest): RepositoryPullRequest {
  return {
    id: row.id,
    number: row.number,
    title: row.title,
    author: row.author,
    draft: row.draft,
    humanReviewers: row.humanReviewers,
    approvals: row.approvals,
    ageDays: ageDays(row.createdAt),
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
function issueRow(row: WorldIssue): RepositoryIssue {
  return {
    id: row.id,
    number: row.number,
    title: row.title,
    author: row.author,
    ageDays: ageDays(row.createdAt),
    url: row.url,
    state: row.state,
    labels: [...row.labels],
    createdAt: row.createdAt,
    closedAt: row.closedAt,
  };
}

/** Select records from the repository's one dated record set; never a second set of counts. */
function buildRepositoryRecordSample(
  repo: OverviewRepository,
  drilldown: RepositoryDrilldown & { selection: RecordSelection },
): RepositoryRecordList {
  const selection = drilldown.selection;
  const context = { repository: repo, asOf: overviewAsOf, drilldown };
  const world = worldRepository(repo.id);
  if (selection.scope === 'current') {
    const backlog = overviewBacklogs[repo.id];
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
                .map(issueRow)
                .sort(newestFirst),
      };
    return {
      ...context,
      measurement,
      kind: 'prs',
      rows:
        measurement.value === null
          ? []
          : world.pullRequests
              .filter((row) => row.state === 'Open')
              .map(pullRequestRow)
              .filter((row) => matchesCurrentPr(row, selection))
              .sort(newestFirst),
    };
  }
  if (selection.metric === 'prsOpened' || selection.metric === 'prsMerged') {
    const rows = periodPullRequests(world, selection.metric, selection.range);
    const measurement = periodCount(world, rows.length, selection.range);
    return {
      ...context,
      measurement,
      kind: 'prs',
      rows: measurement.value === null ? [] : rows.map(pullRequestRow).sort(newestFirst),
    };
  }
  const rows = periodIssues(world, selection.metric, selection.range);
  const measurement = periodCount(world, rows.length, selection.range);
  return {
    ...context,
    measurement,
    kind: 'issues',
    rows: measurement.value === null ? [] : rows.map(issueRow).sort(newestFirst),
  };
}

export function repositoryRecordSample(
  ...args: Parameters<typeof buildRepositoryRecordSample>
): RepositoryRecordList {
  const result = buildRepositoryRecordSample(...args);
  if (result.kind === 'prs')
    return {
      ...result,
      rows: result.rows.map((row) => ({ ...row, authorUrl: sampleProfileUrl(row.author) })),
    };
  return {
    ...result,
    rows: result.rows.map((row) => ({ ...row, authorUrl: sampleProfileUrl(row.author) })),
  };
}
