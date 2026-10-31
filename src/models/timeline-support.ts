import type { TimelineInterval, TimelineSourceIdentity } from './reporting-timeline';
import type { Measurement } from './reporting-measurement';
import type { RepositoryPagePr, RepositoryPageIssue } from './repository-page';
import type { RepositoryTimelineDetail } from './repository-timeline';
import type { ContributionMetricDetails } from './contribution-details';
import type { OverviewRepository } from './repository-overview';
export interface TimelineSupportContext {
  source: TimelineSourceIdentity;
  interval: TimelineInterval;
  metric: string;
  measurement: Measurement;
  scope: string;
  parentHref: string;
  href: string;
}
export interface TimelineAuthorRow {
  id: string;
  account: string;
  recordCount: number;
  accountType: string;
}
export type TimelineSupport = { context: TimelineSupportContext } & (
  | {
      kind: 'repository';
      repository: OverviewRepository;
      recordKind: 'prs' | 'issues';
      descriptor: RepositoryTimelineDetail;
      rows: (RepositoryPagePr | RepositoryPageIssue)[];
      author?: string;
    }
  | {
      kind: 'authors';
      repository: OverviewRepository;
      recordKind: 'prs' | 'issues';
      descriptor: RepositoryTimelineDetail;
      rows: TimelineAuthorRow[];
    }
  | { kind: 'contribution'; title: string; details: ContributionMetricDetails }
);
