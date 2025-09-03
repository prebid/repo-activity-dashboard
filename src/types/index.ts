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

export interface CommitAuthor {
  identifier: string;  // GitHub ID if available, otherwise login/name
  displayName: string; // login or git name for display
  count: number;
  isGitHubUser: boolean; // true if we have a GitHub ID
}

export interface Reviewer {
  login: string;
  state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'PENDING'; // PENDING = requested but not reviewed
}

export interface PRData {
  title: string;
  number: number;
  author: {
    login: string;
    id: number;
  };
  assignees: string[];
  reviewers: Reviewer[]; // All reviewers with their final states
  dateCreated: Date;
  dateUpdated: Date;
  status: 'open' | 'closed' | 'merged';
  dateMerged?: Date;
  dateClosed?: Date;
  commitAuthors: Map<string, CommitAuthor>; // keyed by identifier (ID or name)
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