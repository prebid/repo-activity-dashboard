export type SortDirection = 'asc' | 'desc';
export interface RepositorySummary {
  repositoryId: string;
  openPrs: number;
  draftPrs: number;
  openIssues: number;
  agedPrs: number;
  approvals: number | null;
}
export interface PullRequestRow {
  id: string;
  number: number;
  title: string;
  author: string;
  draft: boolean;
  humanReviewers: number | null;
  approvals: number | null;
  ageDays: number;
  url: string;
}
export interface IssueRow {
  id: string;
  number: number;
  title: string;
  author: string;
  ageDays: number;
  url: string;
}
export interface ContributionRow {
  id: string;
  name: string;
  company: string;
  authored: number;
  feedback: number;
  approvals: number;
  merges: number;
  issues: number;
}

export interface RepositorySummaryRow extends RepositorySummary {
  id: string;
  name: string;
  slug: string;
}
