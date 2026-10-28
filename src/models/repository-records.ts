import type { IssueRow, PullRequestRow } from './reporting';
import type { Count, OverviewRepository } from './repository-overview';
import type { DrilldownSelection, RepositoryDrilldown } from './repository-drilldown';

export type RecordSelection =
  | Extract<DrilldownSelection, { scope: 'current' }>
  | (Extract<DrilldownSelection, { scope: 'period' }> & {
      metric: 'prsOpened' | 'prsMerged' | 'issuesOpened' | 'issuesClosed';
    });
export type LatestActor =
  'agent' | 'bot' | 'prebid-reviewer' | 'contributor' | 'other-human' | 'unknown';
export interface RepositoryPullRequest extends PullRequestRow {
  state: 'Open' | 'Merged' | 'Closed';
  labels: string[];
  createdAt: string;
  mergedAt: string | null;
  baseBranch: string;
  agentReviewer: boolean | null;
  botReviewer: boolean | null;
  latestActor: LatestActor;
}
export interface RepositoryIssue extends IssueRow {
  state: 'Open' | 'Closed';
  labels: string[];
  createdAt: string;
  closedAt: string | null;
}
interface RecordListContext {
  repository: OverviewRepository;
  asOf: string;
  drilldown: RepositoryDrilldown & { selection: RecordSelection };
  measurement: Count;
}
export type RepositoryRecordList = RecordListContext &
  ({ kind: 'prs'; rows: RepositoryPullRequest[] } | { kind: 'issues'; rows: RepositoryIssue[] });
