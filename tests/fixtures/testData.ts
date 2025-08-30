import { Repository, PRData, IssueData } from '../../src/types/index.js';

export const testRepository: Repository = {
  owner: 'prebid',
  repo: 'test-repo',
  name: 'test-repo',
  category: 'Test',
  url: 'https://github.com/prebid/test-repo'
};

export const mockPRData: PRData = {
  number: 123,
  title: 'Test PR',
  status: 'open',
  author: {
    login: 'testuser',
    id: 1
  },
  dateCreated: new Date('2024-01-01T00:00:00Z'),
  dateUpdated: new Date('2024-01-02T00:00:00Z'),
  assignees: ['user1', 'user2'],
  reviewers: ['reviewer1'],
  draft: false,
  commits: new Map([['author1', 5], ['author2', 3]]),
  dateMerged: undefined,
  dateClosed: undefined
};

export const mockIssueData: IssueData = {
  number: 456,
  title: 'Test Issue',
  status: 'open',
  author: {
    login: 'issueuser',
    id: 2
  },
  dateCreated: new Date('2024-01-01T00:00:00Z'),
  dateUpdated: new Date('2024-01-03T00:00:00Z'),
  assignees: ['assignee1'],
  closedBy: undefined,
  closureReason: undefined,
  dateClosed: undefined
};

export const mockGitHubPRResponse = {
  number: 123,
  title: 'Test PR',
  state: 'open',
  user: {
    login: 'testuser',
    id: 1
  },
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-02T00:00:00Z',
  assignees: [
    { login: 'user1' },
    { login: 'user2' }
  ],
  requested_reviewers: [
    { login: 'reviewer1' }
  ],
  draft: false,
  merged_at: null,
  closed_at: null,
  base: {
    repo: {
      owner: { login: 'prebid' },
      name: 'test-repo'
    }
  }
};

export const mockGitHubIssueResponse = {
  number: 456,
  title: 'Test Issue',
  state: 'open',
  user: {
    login: 'issueuser',
    id: 2
  },
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-03T00:00:00Z',
  assignees: [
    { login: 'assignee1' }
  ],
  closed_at: null,
  closed_by: null,
  state_reason: null
};

export function generateMockPRs(count: number, startNumber: number = 1): PRData[] {
  return Array.from({ length: count }, (_, i) => ({
    ...mockPRData,
    number: startNumber + i,
    title: `Test PR ${startNumber + i}`,
    dateCreated: new Date(Date.now() - (count - i) * 86400000),
    dateUpdated: new Date(Date.now() - (count - i) * 43200000)
  }));
}

export function generateMockIssues(count: number, startNumber: number = 1): IssueData[] {
  return Array.from({ length: count }, (_, i) => ({
    ...mockIssueData,
    number: startNumber + i,
    title: `Test Issue ${startNumber + i}`,
    dateCreated: new Date(Date.now() - (count - i) * 86400000),
    dateUpdated: new Date(Date.now() - (count - i) * 43200000)
  }));
}