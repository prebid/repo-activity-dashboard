import { PRData, IssueData, Reviewer } from './index';

export interface RepoConfig {
  slug: string;
  key: string;
  storeKey: string;
  name: string;
  displayName: string;
  owner: string;
  repo: string;
  url: string;
  description: string;
  category: 'Client' | 'Server' | 'Mobile' | 'Docs';
}

// Aggregated reviewer stats
export interface ReviewerStats {
  login: string;
  totalAssigned: number;  // Total PRs they are assigned to review
  approved: number;       // PRs they've approved
  changesRequested: number;
  pending: number;        // Requested but haven't reviewed yet
}

// Aggregated assignee stats for issues
export interface AssigneeStats {
  login: string;
  totalAssigned: number;  // Total issues assigned to them
}

// Enhanced PR data for table display
export interface PRTableRow {
  number: number;
  title: string;
  author: string;
  reviewersAssigned: number;      // Total reviewers assigned
  reviewersApproved: number;      // Reviewers who approved
  reviewersPending: number;       // Reviewers who haven't reviewed
  daysSinceOpen: number;
  daysSinceUpdate: number;
  dateCreated: Date;
  dateUpdated: Date;
  githubUrl: string;
  // For sorting priority
  hasNoReviewers: boolean;
}

// Enhanced Issue data for table display
export interface IssueTableRow {
  number: number;
  title: string;
  author: string;
  assignees: string[];           // List of assignee logins
  assigneeCount: number;
  daysSinceOpen: number;
  daysSinceUpdate: number;
  dateCreated: Date;
  dateUpdated: Date;
  githubUrl: string;
}

export interface RepoPageData {
  config: RepoConfig;
  reviewerStats: ReviewerStats[];
  assigneeStats: AssigneeStats[];
  prTableData: PRTableRow[];
  issueTableData: IssueTableRow[];
  lastSync: Date;
}
