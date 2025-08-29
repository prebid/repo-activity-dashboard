export interface Repository {
  owner: string;
  repo: string;
  name: string;
  category: string;
  url: string;
}

export interface CommitAuthorSummary {
  count: number;
  author: string;
}

export interface PRData {
  title: string;
  number: number;
  author: string;
  assignee?: string;
  reviewers?: {
    approved: string[];
    pending: string[];
  };
  dateCreated: Date;
  status: 'open' | 'closed' | 'merged';
  dateMerged?: Date;
  dateClosed?: Date;
  labels: string[];
  commits: {
    totalCount: number;
    byAuthor: Map<string, CommitAuthorSummary>;
  };
  relatedIssue?: number;
  baseBranch: string;
}

export interface IssueData {
  title: string;
  number: number;
  author: string;
  assignee?: string;
  dateCreated: Date;
  status: 'open' | 'closed';
  dateClosed?: Date;
  closedReason?: 'completed' | 'duplicate' | 'not_planned' | 'other';
  labels: string[];
  relatedPR?: number[];
}

export interface RepositoryData {
  repository: Repository;
  prs: PRData[];
  issues: IssueData[];
  fetchedAt: Date;
}

export * from './storage.js';