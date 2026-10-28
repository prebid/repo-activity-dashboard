import { repositoryCatalog } from '@/config/repositories';
import { overviewBacklogs } from './overview-backlog';
import type { RepositoryPageNavigation } from '@/models/repository-page';
import type { OverviewRepository } from '@/models/repository-overview';
import type { RepositoryDrilldown } from '@/models/repository-drilldown';
import type { RecordSelection, RepositoryRecordList } from '@/models/repository-records';
import type { LatestRecordActivity, RepositoryPageSource } from '@/models/repository-page';
import { repositoryRecordSample } from './repository-records';
import { sampleAuthorType } from './repository-accounts';

/** Enrich the existing selected fake cohort; never generate a second set of counts or identities. */
export function repositoryPageSample(
  repo: OverviewRepository,
  drilldown: RepositoryDrilldown & { selection: RecordSelection },
): RepositoryPageSource {
  return repositoryPageRecordsSample(repositoryRecordSample(repo, drilldown));
}

/** The same enrichment accepts existing author-filtered and merge-duration record lists. */
export function repositoryPageRecordsSample(list: RepositoryRecordList): RepositoryPageSource {
  const metadata = (author: string, createdAt: string, number: number) => ({
    authorType: sampleAuthorType(author),
    at: new Date(
      Math.max(Date.parse(createdAt), Date.parse(list.asOf) - (number % 14) * 86_400_000),
    ).toISOString(),
  });
  if (list.kind === 'prs')
    return {
      ...list,
      rows: list.rows.map((row) => {
        const { authorType, at } = metadata(row.author, row.createdAt, row.number);
        const latestActivity: LatestRecordActivity | null =
          row.latestActor === 'unknown'
            ? null
            : {
                at,
                category: row.latestActor,
                account:
                  row.latestActor === 'contributor'
                    ? row.author
                    : row.latestActor === 'agent'
                      ? 'sample-prebid-agent-a'
                      : row.latestActor === 'bot'
                        ? 'sample-bot-a'
                        : row.latestActor === 'prebid-reviewer'
                          ? 'sample-reviewer'
                          : 'sample-other-human',
              };
        return { ...row, authorType, latestActivity };
      }),
    };
  return {
    ...list,
    rows: list.rows.map((row) => {
      const { authorType, at } = metadata(row.author, row.createdAt, row.number);
      return {
        ...row,
        authorType,
        latestActivity:
          row.number % 5 === 0
            ? null
            : {
                at: row.closedAt ?? at,
                category: authorType === 'human' ? 'contributor' : authorType,
                account: row.author,
              },
        assignees: row.number % 5 === 0 ? null : row.number % 2 === 0 ? [] : ['sample-maintainer'],
      };
    }),
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
