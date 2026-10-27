import { repositoryCatalog } from '@/config/repositories';
import type {
  RepositorySummary,
  PullRequestRow,
  IssueRow,
  ContributionRow,
} from '@/models/reporting';

export const sampleAsOf = '2026-10-24T12:00:00Z';
const summaryValues: Record<string, Omit<RepositorySummary, 'repositoryId'>> = {
  'repo-prebidjs': {
    openPrs: 137,
    draftPrs: 17,
    openIssues: 834,
    agedPrs: 60,
    approvals: 0,
  },
  'repo-prebidserver': {
    openPrs: 37,
    draftPrs: 7,
    openIssues: 86,
    agedPrs: 0,
    approvals: 0,
  },
  'repo-prebidserverjava': {
    openPrs: 16,
    draftPrs: 3,
    openIssues: 31,
    agedPrs: 0,
    approvals: 0,
  },
  'repo-prebiddocs': {
    openPrs: 23,
    draftPrs: 4,
    openIssues: 150,
    agedPrs: 0,
    approvals: 0,
  },
  'repo-prebidmobileandroid': {
    openPrs: 24,
    draftPrs: 4,
    openIssues: 64,
    agedPrs: 0,
    approvals: 0,
  },
  'repo-prebidmobileios': {
    openPrs: 12,
    draftPrs: 2,
    openIssues: 27,
    agedPrs: 0,
    approvals: 0,
  },
  'repo-prebid-mobile-ios-sdk': {
    openPrs: 0,
    draftPrs: 0,
    openIssues: 0,
    agedPrs: 0,
    approvals: 0,
  },
  'repo-prebid-universal-creative': {
    openPrs: 8,
    draftPrs: 1,
    openIssues: 15,
    agedPrs: 0,
    approvals: 0,
  },
  'repo-professor-prebid': {
    openPrs: 4,
    draftPrs: 0,
    openIssues: 9,
    agedPrs: 0,
    approvals: 0,
  },
  'repo-salesagent': {
    openPrs: 19,
    draftPrs: 3,
    openIssues: 18,
    agedPrs: 0,
    approvals: 0,
  },
  'repo-prebid-agent-skills': {
    openPrs: 7,
    draftPrs: 1,
    openIssues: 22,
    agedPrs: 0,
    approvals: null,
  },
  'repo-line-item-manager': {
    openPrs: 4,
    draftPrs: 0,
    openIssues: 4,
    agedPrs: 0,
    approvals: 0,
  },
  'repo-go-gdpr': {
    openPrs: 3,
    draftPrs: 0,
    openIssues: 5,
    agedPrs: 0,
    approvals: 0,
  },
  'repo-prebid-cache-java': {
    openPrs: 8,
    draftPrs: 1,
    openIssues: 11,
    agedPrs: 0,
    approvals: 0,
  },
  'repo-repo-activity-dashboard': {
    openPrs: 5,
    draftPrs: 1,
    openIssues: 7,
    agedPrs: 0,
    approvals: 0,
  },
  'repo-openrtb': {
    openPrs: 2,
    draftPrs: 0,
    openIssues: 3,
    agedPrs: 0,
    approvals: 0,
  },
  'repo-github-activity-db': {
    openPrs: 1,
    draftPrs: 0,
    openIssues: 2,
    agedPrs: 0,
    approvals: 0,
  },
  'repo-prebid-integration-monitor': {
    openPrs: 0,
    draftPrs: 0,
    openIssues: 0,
    agedPrs: 0,
    approvals: 0,
  },
};
export const repositorySummaries: RepositorySummary[] = repositoryCatalog
  .filter((repo) => repo.enabled)
  .map((repo) => {
    const sample = summaryValues[repo.id];
    if (!sample) throw new Error('Missing display sample for ' + repo.id);
    return { repositoryId: repo.id, ...sample };
  });
export function repositorySample(repositoryId: string): {
  prs: PullRequestRow[];
  issues: IssueRow[];
} {
  const summary = repositorySummaries.find((row) => row.repositoryId === repositoryId);
  const repo = repositoryCatalog.find((row) => row.id === repositoryId);
  if (!summary || !repo) throw new Error('Unknown sample repository');
  const prs = Array.from({ length: summary.openPrs }, (_, i): PullRequestRow => {
    const number = i + 1;
    const draft = number <= summary.draftPrs;
    return {
      id: repo.id + '-pr-' + number,
      number: 1000 + number,
      title:
        'Sample PR ' +
        number +
        ': ' +
        (number % 3 === 0
          ? 'Improve adapter configuration and validation'
          : 'Update integration behavior'),
      author: number % 2 === 0 ? 'sample-alice' : 'sample-bob',
      draft,
      humanReviewers: draft
        ? 0
        : repo.id === 'repo-prebidjs'
          ? number < 58
            ? 0
            : number < 98
              ? 1
              : 2
          : number % 3,
      approvals: repo.id === 'repo-prebid-agent-skills' ? null : 0,
      ageDays: summary.openPrs - i,
      url: 'https://github.example/example-fixtures/' + repo.slug + '/pull/' + (1000 + number),
    };
  });
  const issues = Array.from({ length: summary.openIssues }, (_, i): IssueRow => ({
    id: repo.id + '-issue-' + (i + 1),
    number: i + 1,
    title:
      i === 0
        ? 'Oldest sample issue: keyboard navigation'
        : 'Sample issue ' + (i + 1) + ': Improve documentation',
    author: i % 2 === 0 ? 'sample-alice' : 'sample-bob',
    ageDays: summary.openIssues - i,
    url: 'https://github.example/example-fixtures/' + repo.slug + '/issues/' + (i + 1),
  }));
  return { prs: prs.reverse(), issues: issues.reverse() };
}
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
