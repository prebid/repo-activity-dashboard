import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { 
  PRDataSchema, 
  IssueDataSchema, 
  RepositorySchema,
  AuthorSchema 
} from '../../src/validation/schemas.js';
import {
  StoredPRDataSchema,
  StoredIssueDataSchema,
  validateStoredPRs,
  validateStoredIssues
} from '../../src/validation/storageSchemas.js';
import {
  transformGitHubPRToInternal,
  transformGitHubIssueToInternal,
  GitHubPRResponseSchema,
  GitHubIssueResponseSchema
} from '../../src/validation/githubSchemas.js';
import { mockPRData, mockIssueData, mockGitHubPRResponse, mockGitHubIssueResponse } from '../fixtures/testData.js';

describe('Validation Schemas', () => {
  describe('PRDataSchema', () => {
    it('should validate valid PR data', () => {
      const result = PRDataSchema.safeParse(mockPRData);
      expect(result.success).toBe(true);
    });

    it('should reject PR without required fields', () => {
      const invalidPR = { ...mockPRData };
      delete (invalidPR as any).number;
      
      const result = PRDataSchema.safeParse(invalidPR);
      expect(result.success).toBe(false);
    });

    it('should reject PR with invalid status', () => {
      const invalidPR = { ...mockPRData, status: 'invalid' };
      
      const result = PRDataSchema.safeParse(invalidPR);
      expect(result.success).toBe(false);
    });

    it('should validate PR with Map for commits', () => {
      const pr = {
        ...mockPRData,
        commits: new Map([['user1', 3], ['user2', 5]])
      };
      
      const result = PRDataSchema.safeParse(pr);
      expect(result.success).toBe(true);
    });
  });

  describe('IssueDataSchema', () => {
    it('should validate valid issue data', () => {
      const result = IssueDataSchema.safeParse(mockIssueData);
      expect(result.success).toBe(true);
    });

    it('should validate issue with closure reason', () => {
      const closedIssue = {
        ...mockIssueData,
        status: 'closed' as const,
        closedBy: 'closer',
        closureReason: 'completed' as const,
        dateClosed: new Date()
      };
      
      const result = IssueDataSchema.safeParse(closedIssue);
      expect(result.success).toBe(true);
    });

    it('should reject issue with invalid closure reason', () => {
      const invalidIssue = {
        ...mockIssueData,
        closureReason: 'invalid_reason'
      };
      
      const result = IssueDataSchema.safeParse(invalidIssue);
      expect(result.success).toBe(false);
    });
  });

  describe('AuthorSchema', () => {
    it('should validate valid author', () => {
      const author = { login: 'user', id: 123 };
      const result = AuthorSchema.safeParse(author);
      expect(result.success).toBe(true);
    });

    it('should reject author without login', () => {
      const author = { id: 123 };
      const result = AuthorSchema.safeParse(author);
      expect(result.success).toBe(false);
    });

    it('should reject author with negative id', () => {
      const author = { login: 'user', id: -1 };
      const result = AuthorSchema.safeParse(author);
      expect(result.success).toBe(false);
    });
  });

  describe('RepositorySchema', () => {
    it('should validate valid repository', () => {
      const repo = {
        owner: 'prebid',
        repo: 'test-repo',
        name: 'test-repo',
        category: 'Test',
        url: 'https://github.com/prebid/test-repo'
      };
      
      const result = RepositorySchema.safeParse(repo);
      expect(result.success).toBe(true);
    });

    it('should reject repository with invalid URL', () => {
      const repo = {
        owner: 'prebid',
        repo: 'test-repo',
        name: 'test-repo',
        category: 'Test',
        url: 'not-a-url'
      };
      
      const result = RepositorySchema.safeParse(repo);
      expect(result.success).toBe(false);
    });
  });
});

describe('Storage Schemas', () => {
  describe('StoredPRDataSchema', () => {
    it('should parse stored PR with date strings', () => {
      const storedPR = {
        ...mockPRData,
        dateCreated: '2024-01-01T00:00:00Z',
        dateUpdated: '2024-01-02T00:00:00Z',
        commits: { 'author1': 5, 'author2': 3 }
      };
      
      const result = StoredPRDataSchema.safeParse(storedPR);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.dateCreated).toBeInstanceOf(Date);
        expect(result.data.dateUpdated).toBeInstanceOf(Date);
        expect(result.data.commits).toBeInstanceOf(Map);
      }
    });

    it('should handle optional dates correctly', () => {
      const storedPR = {
        ...mockPRData,
        dateCreated: '2024-01-01T00:00:00Z',
        dateUpdated: '2024-01-02T00:00:00Z',
        dateMerged: '2024-01-03T00:00:00Z',
        commits: {}
      };
      
      const result = StoredPRDataSchema.safeParse(storedPR);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.dateMerged).toBeInstanceOf(Date);
      }
    });
  });

  describe('validateStoredPRs', () => {
    it('should validate stored PR file structure', () => {
      const storageData = {
        metadata: {
          repository: 'prebid/test-repo',
          lastSync: '2024-01-01T00:00:00Z',
          itemCount: 1
        },
        items: [{
          ...mockPRData,
          dateCreated: '2024-01-01T00:00:00Z',
          dateUpdated: '2024-01-02T00:00:00Z',
          commits: { 'author1': 5 }
        }]
      };
      
      const result = validateStoredPRs(storageData);
      expect(result.metadata.lastSync).toBeInstanceOf(Date);
      expect(result.items[0].dateCreated).toBeInstanceOf(Date);
      expect(result.items[0].commits).toBeInstanceOf(Map);
    });
  });

  describe('validateStoredIssues', () => {
    it('should validate stored issue file structure', () => {
      const storageData = {
        metadata: {
          repository: 'prebid/test-repo',
          lastSync: '2024-01-01T00:00:00Z',
          itemCount: 1
        },
        items: [{
          ...mockIssueData,
          dateCreated: '2024-01-01T00:00:00Z',
          dateUpdated: '2024-01-02T00:00:00Z'
        }]
      };
      
      const result = validateStoredIssues(storageData);
      expect(result.metadata.lastSync).toBeInstanceOf(Date);
      expect(result.items[0].dateCreated).toBeInstanceOf(Date);
    });
  });
});

describe('GitHub Schema Transformations', () => {
  describe('transformGitHubPRToInternal', () => {
    it('should transform GitHub PR response to internal format', () => {
      const validated = GitHubPRResponseSchema.parse(mockGitHubPRResponse);
      const result = transformGitHubPRToInternal(validated);
      
      expect(result.number).toBe(123);
      expect(result.title).toBe('Test PR');
      expect(result.status).toBe('open');
      expect(result.author.login).toBe('testuser');
      expect(result.dateCreated).toBeInstanceOf(Date);
      expect(result.dateUpdated).toBeInstanceOf(Date);
      expect(result.assignees).toEqual(['user1', 'user2']);
      expect(result.reviewers).toEqual(['reviewer1']);
      expect(result.commits).toBeInstanceOf(Map);
    });

    it('should handle merged PR correctly', () => {
      const mergedPR = {
        ...mockGitHubPRResponse,
        state: 'closed' as const,
        merged_at: '2024-01-03T00:00:00Z'
      };
      
      const validated = GitHubPRResponseSchema.parse(mergedPR);
      const result = transformGitHubPRToInternal(validated);
      
      expect(result.status).toBe('merged');
      expect(result.dateMerged).toBeInstanceOf(Date);
    });
  });

  describe('transformGitHubIssueToInternal', () => {
    it('should transform GitHub issue response to internal format', () => {
      const validated = GitHubIssueResponseSchema.parse(mockGitHubIssueResponse);
      const result = transformGitHubIssueToInternal(validated);
      
      expect(result.number).toBe(456);
      expect(result.title).toBe('Test Issue');
      expect(result.status).toBe('open');
      expect(result.author.login).toBe('issueuser');
      expect(result.dateCreated).toBeInstanceOf(Date);
      expect(result.dateUpdated).toBeInstanceOf(Date);
      expect(result.assignees).toEqual(['assignee1']);
    });

    it('should handle closed issue with reason', () => {
      const closedIssue = {
        ...mockGitHubIssueResponse,
        state: 'closed' as const,
        closed_at: '2024-01-04T00:00:00Z',
        closed_by: { login: 'closer', id: 999 },
        state_reason: 'completed' as const
      };
      
      const validated = GitHubIssueResponseSchema.parse(closedIssue);
      const result = transformGitHubIssueToInternal(validated);
      
      expect(result.status).toBe('closed');
      expect(result.closedBy).toBe('closer');
      expect(result.closureReason).toBe('completed');
      expect(result.dateClosed).toBeInstanceOf(Date);
    });
  });
});