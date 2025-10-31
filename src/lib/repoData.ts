import { REPO_CONFIG, RepoSlug } from '@/config/repositories';
import { PRData, IssueData } from '@/types';
import { ReviewerStats, AssigneeStats, PRTableRow, IssueTableRow, RepoPageData } from '@/types/repo';

/**
 * Calculate days between two dates
 */
function daysBetween(date1: Date, date2: Date): number {
  const diffTime = Math.abs(date2.getTime() - date1.getTime());
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Aggregate reviewer statistics from open PRs
 */
function aggregateReviewerStats(prs: PRData[]): ReviewerStats[] {
  const statsMap = new Map<string, ReviewerStats>();

  for (const pr of prs) {
    if (!pr.reviewers || pr.reviewers.length === 0) continue;

    for (const reviewer of pr.reviewers) {
      const existing = statsMap.get(reviewer.login) || {
        login: reviewer.login,
        totalAssigned: 0,
        approved: 0,
        changesRequested: 0,
        commented: 0,
        pending: 0,
      };

      existing.totalAssigned++;

      switch (reviewer.state) {
        case 'APPROVED':
          existing.approved++;
          break;
        case 'CHANGES_REQUESTED':
          existing.changesRequested++;
          break;
        case 'COMMENTED':
          existing.commented++;
          break;
        case 'PENDING':
          existing.pending++;
          break;
      }

      statsMap.set(reviewer.login, existing);
    }
  }

  // Convert to array and sort by totalAssigned (descending)
  return Array.from(statsMap.values())
    .sort((a, b) => b.totalAssigned - a.totalAssigned);
}

/**
 * Aggregate assignee statistics from open issues (only those with assignees)
 */
function aggregateAssigneeStats(issues: IssueData[]): AssigneeStats[] {
  const statsMap = new Map<string, AssigneeStats>();

  for (const issue of issues) {
    if (!issue.assignees || issue.assignees.length === 0) continue;

    for (const assignee of issue.assignees) {
      const existing = statsMap.get(assignee) || {
        login: assignee,
        totalAssigned: 0,
      };

      existing.totalAssigned++;
      statsMap.set(assignee, existing);
    }
  }

  // Convert to array and sort by totalAssigned (descending)
  return Array.from(statsMap.values())
    .sort((a, b) => b.totalAssigned - a.totalAssigned);
}

/**
 * Transform PR data for table display with calculated fields
 */
function transformPRsForTable(prs: PRData[], repoUrl: string): PRTableRow[] {
  const now = new Date();

  return prs.map(pr => {
    const reviewersAssigned = pr.reviewers?.length || 0;
    const reviewersApproved = pr.reviewers?.filter(r => r.state === 'APPROVED').length || 0;
    const reviewersChangesRequested = pr.reviewers?.filter(r => r.state === 'CHANGES_REQUESTED').length || 0;
    const reviewersCommented = pr.reviewers?.filter(r => r.state === 'COMMENTED').length || 0;
    const reviewersPending = pr.reviewers?.filter(r => r.state === 'PENDING').length || 0;

    return {
      number: pr.number,
      title: pr.title,
      author: pr.author.login,
      reviewersAssigned,
      reviewersApproved,
      reviewersChangesRequested,
      reviewersCommented,
      reviewersPending,
      daysSinceOpen: daysBetween(pr.dateCreated, now),
      daysSinceUpdate: daysBetween(pr.dateUpdated, now),
      dateCreated: pr.dateCreated,
      dateUpdated: pr.dateUpdated,
      githubUrl: `${repoUrl}/pull/${pr.number}`,
      hasNoReviewers: reviewersAssigned === 0,
    };
  });
}

/**
 * Transform Issue data for table display (only issues with assignees are relevant for display)
 */
function transformIssuesForTable(issues: IssueData[], repoUrl: string): IssueTableRow[] {
  const now = new Date();

  // Filter out issues with no assignees as per requirements
  const issuesWithAssignees = issues.filter(issue =>
    issue.assignees && issue.assignees.length > 0
  );

  return issuesWithAssignees.map(issue => ({
    number: issue.number,
    title: issue.title,
    author: issue.author.login,
    assignees: issue.assignees,
    assigneeCount: issue.assignees.length,
    daysSinceOpen: daysBetween(issue.dateCreated, now),
    daysSinceUpdate: daysBetween(issue.dateUpdated, now),
    dateCreated: issue.dateCreated,
    dateUpdated: issue.dateUpdated,
    githubUrl: `${repoUrl}/issues/${issue.number}`,
  }))
  // Sort by days since update (descending) - most stale first
  .sort((a, b) => b.daysSinceUpdate - a.daysSinceUpdate);
}

/**
 * Fetch and process all repository data for the page
 */
export async function getRepoPageData(slug: RepoSlug): Promise<RepoPageData> {
  const config = REPO_CONFIG[slug];

  // Fetch data in parallel
  const [openPRsResponse, openIssuesResponse, syncStateResponse] = await Promise.all([
    fetch(`/store/repos/${config.storeKey}/open-prs.json`),
    fetch(`/store/repos/${config.storeKey}/open-issues.json`),
    fetch(`/store/repos/${config.storeKey}/sync-state.json`),
  ]);

  const openPRsData = await openPRsResponse.json();
  const openIssuesData = await openIssuesResponse.json();
  const syncState = await syncStateResponse.json();

  // Parse dates in PR and Issue data
  const prs: PRData[] = (openPRsData.items || []).map((pr: any) => ({
    ...pr,
    dateCreated: new Date(pr.dateCreated),
    dateUpdated: new Date(pr.dateUpdated),
  }));

  const issues: IssueData[] = (openIssuesData.items || []).map((issue: any) => ({
    ...issue,
    dateCreated: new Date(issue.dateCreated),
    dateUpdated: new Date(issue.dateUpdated),
  }));

  return {
    config,
    reviewerStats: aggregateReviewerStats(prs),
    assigneeStats: aggregateAssigneeStats(issues),
    prTableData: transformPRsForTable(prs, config.url),
    issueTableData: transformIssuesForTable(issues, config.url),
    lastSync: new Date(syncState.lastIncrementalSync || syncState.lastFullSync),
  };
}
