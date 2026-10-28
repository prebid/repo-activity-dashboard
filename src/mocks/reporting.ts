import { repositoryCatalog } from '@/config/repositories';
import type { RepositorySummary, ContributionRow } from '@/models/reporting';
import { overviewBacklogs } from './overview-backlog';
export { repositorySample } from './repository-records';
export { overviewAsOf as sampleAsOf } from './repository-overview';

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
// Small prepared contribution scenario; values are supplied, not calculated from GitHub history.
export const contributionRows: ContributionRow[] = [
  {
    id: 'alice',
    name: 'Alice',
    company: 'Example Company A',
    authored: 1,
    feedback: 1,
    approvals: 2,
    merges: 0,
    issues: 0,
  },
  {
    id: 'bob',
    name: 'Bob',
    company: 'Example Company A',
    authored: 2,
    feedback: 0,
    approvals: 0,
    merges: 1,
    issues: 1,
  },
  {
    id: 'carol',
    name: 'Carol',
    company: 'Example Company B',
    authored: 1,
    feedback: 1,
    approvals: 0,
    merges: 1,
    issues: 1,
  },
];
export const companyRows: ContributionRow[] = [
  {
    id: 'company-a',
    name: 'Example Company A',
    company: 'Current mapping',
    authored: 3,
    feedback: 1,
    approvals: 2,
    merges: 1,
    issues: 1,
  },
  {
    id: 'company-b',
    name: 'Example Company B',
    company: 'Current mapping',
    authored: 1,
    feedback: 1,
    approvals: 0,
    merges: 1,
    issues: 1,
  },
];
