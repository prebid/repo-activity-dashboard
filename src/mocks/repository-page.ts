import { repositoryCatalog } from '@/config/repositories';
import { overviewBacklogs } from './overview-backlog';
import type { RepositoryPageNavigation } from '@/models/repository-page';
import type { OverviewRepository } from '@/models/repository-overview';
import type { RepositoryDrilldown } from '@/models/repository-drilldown';
import type { RecordSelection, RepositoryRecordList } from '@/models/repository-records';
import type { RepositoryPageSource } from '@/models/repository-page';
import { repositoryRecordSample } from './repository-records';
import { sampleAuthorType } from './repository-accounts';
import { issueMetadata, pullRequestActivity } from './record-metadata';

/** Enrich the existing selected fake cohort; never generate a second set of counts or identities. */
export function repositoryPageSample(
  repo: OverviewRepository,
  drilldown: RepositoryDrilldown & { selection: RecordSelection },
): RepositoryPageSource {
  return repositoryPageRecordsSample(repositoryRecordSample(repo, drilldown));
}

/** The same enrichment accepts existing author-filtered and merge-duration record lists. */
export function repositoryPageRecordsSample(list: RepositoryRecordList): RepositoryPageSource {
  const period = list.drilldown.selection.scope === 'period';
  if (list.kind === 'prs')
    return {
      ...list,
      rows: list.rows.map((row) => ({
        ...row,
        authorType: sampleAuthorType(row.author),
        latestActivity: pullRequestActivity(row, list.asOf, period),
      })),
    };
  return {
    ...list,
    rows: list.rows.map((row) => ({
      ...row,
      authorType: sampleAuthorType(row.author),
      ...issueMetadata(row, list.asOf),
    })),
  };
}

export function repositoryPageNavigationSample(repo: OverviewRepository): RepositoryPageNavigation {
  const catalog = repositoryCatalog.find((entry) => entry.id === repo.id);
  if (!catalog) throw new Error('Unknown sample repository');
  const counts = overviewBacklogs[repo.id].counts;
  return {
    githubUrl: catalog.url,
    openPrs: { ...counts.totalOpenPrs },
    openIssues: { ...counts.openIssues },
  };
}
