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
  author: {
    login: string;
    id: number;
  };
  assignees: string[];
  reviewers: string[];
  draft: boolean;
  dateCreated: Date;
  dateUpdated: Date;
  status: 'open' | 'closed' | 'merged';
  dateMerged?: Date;
  dateClosed?: Date;
  commits: Map<string, number>;
}

export interface IssueData {
  title: string;
  number: number;
  author: {
    login: string;
    id: number;
  };
  assignees: string[];
  dateCreated: Date;
  dateUpdated: Date;
  status: 'open' | 'closed';
  dateClosed?: Date;
  closedBy?: string;
  closureReason?: 'completed' | 'duplicate' | 'not_planned' | 'other';
}

export interface RepositoryData {
  repository: Repository;
  prs: PRData[];
  issues: IssueData[];
  fetchedAt: Date;
}

export * from './storage.js';