import { repositoryCatalog } from '@/config/repositories';
import { overviewBacklogs } from './overview-backlog';
import type { RepositoryPageNavigation } from '@/models/repository-page';
import type { OverviewRepository } from '@/models/repository-overview';
import type { RepositoryDrilldown } from '@/models/repository-drilldown';
import type { RecordSelection, RepositoryRecordList } from '@/models/repository-records';
import type { RepositoryPageSource } from '@/models/repository-page';
import { repositoryRecordSample } from './repository-records';
import { worldRepository, type WorldIssue, type WorldPullRequest } from './repository-world';

/** Enrich the selected records from the same record set; never a second set of identities. */
export function repositoryPageSample(
  repo: OverviewRepository,
  drilldown: RepositoryDrilldown & { selection: RecordSelection },
): RepositoryPageSource {
  return repositoryPageRecordsSample(repositoryRecordSample(repo, drilldown));
}

/** The same enrichment accepts existing author-filtered and merge-duration record lists. */
export function repositoryPageRecordsSample(list: RepositoryRecordList): RepositoryPageSource {
  const world = worldRepository(list.repository.id);
  if (list.kind === 'prs') {
    const records = new Map(world.pullRequests.map((row) => [row.id, row]));
    const record = (id: string): WorldPullRequest => {
      const found = records.get(id);
      if (!found) throw new Error('Unknown sample pull request');
      return found;
    };
    return {
      ...list,
      rows: list.rows.map((row) => ({
        ...row,
        authorType: record(row.id).authorType,
        latestActivity: record(row.id).latestActivity,
      })),
    };
  }
  const records = new Map(world.issues.map((row) => [row.id, row]));
  const record = (id: string): WorldIssue => {
    const found = records.get(id);
    if (!found) throw new Error('Unknown sample issue');
    return found;
  };
  return {
    ...list,
    rows: list.rows.map((row) => ({
      ...row,
      authorType: record(row.id).authorType,
      latestActivity: record(row.id).latestActivity,
      assignees: record(row.id).assignees,
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
