import { repositoryCatalog } from '@/config/repositories';
import type { RepositorySummary } from '@/models/reporting';
import { overviewBacklogs } from './overview-backlog';
export { repositorySample } from './current-records';
export { overviewAsOf as sampleAsOf } from './sample-clock';

// Legacy default-list summaries share the approved overview's prepared backlog.
export const repositorySummaries: RepositorySummary[] = repositoryCatalog
  .filter((repo) => repo.enabled)
  .map((repo) => {
    const backlog = overviewBacklogs[repo.id],
      c = backlog.counts;
    return {
      repositoryId: repo.id,
      openPrs: c.totalOpenPrs.value!,
      draftPrs: c.draftPrs.value!,
      openIssues: c.openIssues.value!,
      agedPrs: backlog.agedPrs[60].value!,
      approvals: c.humanApprovals0.value === null ? null : 0,
    };
  });
