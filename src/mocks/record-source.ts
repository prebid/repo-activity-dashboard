import type { ReportingAccountType } from '@/models/repository-insights';
import type { RepositoryBacklog } from '@/models/repository-overview';
import { overviewBacklogs } from './overview-backlog';
import { sampleAuthorType, sampleProfileUrl } from './repository-accounts';
import { repositoryWorld, type WorldRepository, type WorldScenario } from './repository-world';
import { overviewAsOf } from './sample-clock';

/**
 * Where repository views read their records. Every repository derivation takes one, so the
 * prepared sample world and the reporting database produce the same display models.
 */
export interface RepositoryRecordSource {
  readonly kind: 'sample' | 'database';
  readonly scenarioId: string;
  readonly asOf: string;
  /** Every enabled catalog repository's record set; a database ignores sample scenarios. */
  repositories(scenario?: WorldScenario, gap?: boolean): ReadonlyMap<string, WorldRepository>;
  /** The current backlog the Summary, the repository header and current record lists share. */
  backlog(repositoryId: string): RepositoryBacklog;
  accountType(login: string): ReportingAccountType;
  profileUrl(login: string): string;
}

/** One repository's record set, or an error for a repository the source does not hold. */
export function sourceRepository(
  source: RepositoryRecordSource,
  id: string,
  scenario?: WorldScenario,
  gap?: boolean,
): WorldRepository {
  const repository = source.repositories(scenario, gap).get(id);
  if (!repository) throw Error('Unknown repository');
  return repository;
}

export const sampleRecordSource: RepositoryRecordSource = {
  kind: 'sample',
  scenarioId: 'reference',
  asOf: overviewAsOf,
  repositories: (scenario, gap) => repositoryWorld(scenario, gap),
  backlog(repositoryId) {
    const backlog = overviewBacklogs[repositoryId];
    if (!backlog) throw new Error('Missing overview sample for ' + repositoryId);
    return backlog;
  },
  accountType: sampleAuthorType,
  profileUrl: sampleProfileUrl,
};
