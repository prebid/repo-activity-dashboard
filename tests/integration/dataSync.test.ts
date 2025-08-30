import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupServer } from 'msw/node';
import { handlers } from '../mocks/handlers.js';
import { DataFetcher } from '../../src/services/dataFetcher.js';
import { StorageService } from '../../src/services/storageService.js';
import { DataValidator } from '../../src/validation/dataValidator.js';
import { testRepository } from '../fixtures/testData.js';
import { TEST_STORE_DIR } from '../setup.js';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const server = setupServer(...handlers);

describe('Data Sync Integration', () => {
  let fetcher: DataFetcher;
  let storageService: StorageService;
  let validator: DataValidator;
  
  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' });
    process.env.TEST_MODE = 'true'; // Disable rate limiting for tests
  });
  
  afterAll(() => {
    server.close();
    delete process.env.TEST_MODE;
  });
  
  beforeEach(() => {
    server.resetHandlers();
    fetcher = new DataFetcher('mock-token', TEST_STORE_DIR, 10); // Higher concurrency for tests
    storageService = new StorageService(TEST_STORE_DIR);
    validator = new DataValidator(TEST_STORE_DIR);
  });
  
  describe('Full Repository Sync', () => {
    it('should handle pagination for 100+ items correctly', async () => {
      await fetcher.syncOpenItemsOnly(testRepository);
      
      const openPRs = await storageService.loadOpenPRs(testRepository);
      const openIssues = await storageService.loadOpenIssues(testRepository);
      
      // Verify counts match what our mock returns
      expect(openPRs.length).toBe(150);
      expect(openIssues.length).toBe(75);
      
      // Verify all items have proper structure
      expect(openPRs.every(pr => pr.number > 0)).toBe(true);
      expect(openPRs.every(pr => pr.dateUpdated instanceof Date)).toBe(true);
      expect(openPRs.every(pr => pr.author && pr.author.login && pr.author.id)).toBe(true);
      
      // Verify items are unique
      const prNumbers = openPRs.map(pr => pr.number);
      expect(new Set(prNumbers).size).toBe(prNumbers.length);
      
      const issueNumbers = openIssues.map(issue => issue.number);
      expect(new Set(issueNumbers).size).toBe(issueNumbers.length);
    });
    
    it('should create correct file structure with proper metadata', async () => {
      await fetcher.syncOpenItemsOnly(testRepository);
      
      const repoPath = join(TEST_STORE_DIR, 'repos', testRepository.name);
      const prPath = join(repoPath, 'open-prs.json');
      const issuePath = join(repoPath, 'open-issues.json');
      
      expect(existsSync(prPath)).toBe(true);
      expect(existsSync(issuePath)).toBe(true);
      
      // Verify file structure
      const prData = JSON.parse(readFileSync(prPath, 'utf-8'));
      const issueData = JSON.parse(readFileSync(issuePath, 'utf-8'));
      
      expect(prData.metadata).toBeDefined();
      expect(prData.metadata.repository).toBe('prebid/test-repo');
      expect(prData.metadata.itemCount).toBe(150);
      expect(prData.items).toHaveLength(150);
      
      expect(issueData.metadata).toBeDefined();
      expect(issueData.metadata.repository).toBe('prebid/test-repo');
      expect(issueData.metadata.itemCount).toBe(75);
      expect(issueData.items).toHaveLength(75);
    });
    
    it('should validate all stored data against Zod schemas', async () => {
      await fetcher.syncOpenItemsOnly(testRepository);
      
      const prValidation = await validator.validateStorageFile(testRepository, 'open-prs');
      const issueValidation = await validator.validateStorageFile(testRepository, 'open-issues');
      
      expect(prValidation.valid).toBe(true);
      expect(prValidation.errors).toHaveLength(0);
      
      expect(issueValidation.valid).toBe(true);
      expect(issueValidation.errors).toHaveLength(0);
    });
    
    it('should handle batch saving correctly', async () => {
      // The DataFetcher saves in batches during processing
      // We can verify this works by checking that data is saved correctly
      await fetcher.syncOpenItemsOnly(testRepository);
      
      // Verify all data was saved
      const openPRs = await storageService.loadOpenPRs(testRepository);
      const openIssues = await storageService.loadOpenIssues(testRepository);
      
      expect(openPRs.length).toBe(150);
      expect(openIssues.length).toBe(75);
      
      // Verify data integrity - batch saving should not cause data loss
      const prNumbers = openPRs.map(pr => pr.number);
      const uniquePRs = new Set(prNumbers);
      expect(uniquePRs.size).toBe(150); // No duplicates from batch processing
      
      const issueNumbers = openIssues.map(issue => issue.number);
      const uniqueIssues = new Set(issueNumbers);
      expect(uniqueIssues.size).toBe(75); // No duplicates from batch processing
    });
  });
  
  describe('Incremental Sync', () => {
    it('should preserve existing data during incremental sync', async () => {
      // Initial sync
      await fetcher.syncOpenItemsOnly(testRepository);
      const initialPRs = await storageService.loadOpenPRs(testRepository);
      const initialIssues = await storageService.loadOpenIssues(testRepository);
      
      // Save initial state
      await storageService.saveSyncState(testRepository, {
        lastFullSync: new Date(),
        lastIncrementalSync: new Date(),
        openPRNumbers: new Set(initialPRs.map(pr => pr.number)),
        openIssueNumbers: new Set(initialIssues.map(issue => issue.number))
      });
      
      // Incremental sync
      await fetcher.incrementalSync(testRepository);
      
      const updatedPRs = await storageService.loadOpenPRs(testRepository);
      const updatedIssues = await storageService.loadOpenIssues(testRepository);
      
      // Should maintain same counts since mock doesn't change
      expect(updatedPRs.length).toBe(initialPRs.length);
      expect(updatedIssues.length).toBe(initialIssues.length);
      
      // Verify sync state is updated
      const syncState = await storageService.loadSyncState(testRepository);
      expect(syncState).not.toBeNull();
      expect(syncState!.openPRNumbers.size).toBe(150);
      expect(syncState!.openIssueNumbers.size).toBe(75);
    });
    
    it('should detect newly closed items', async () => {
      // Initial sync
      await fetcher.syncOpenItemsOnly(testRepository);
      
      // Mock fewer open items (simulate some were closed)
      server.use(
        http.get('https://api.github.com/repos/:owner/:repo/pulls', ({ request }) => {
          const url = new URL(request.url);
          const page = parseInt(url.searchParams.get('page') || '1');
          
          if (page === 1) {
            // Return only 100 PRs instead of 150
            return HttpResponse.json(
              Array.from({ length: 100 }, (_, i) => generateMockPR(i + 1)),
              { headers: { 'X-Total-Count': '100' } }
            );
          }
          return HttpResponse.json([]);
        })
      );
      
      await fetcher.incrementalSync(testRepository);
      
      const updatedPRs = await storageService.loadOpenPRs(testRepository);
      expect(updatedPRs.length).toBe(100);
    });
  });
  
  describe('Data Validation', () => {
    it('should ensure all required fields are present and valid', async () => {
      await fetcher.syncOpenItemsOnly(testRepository);
      
      const openPRs = await storageService.loadOpenPRs(testRepository);
      const openIssues = await storageService.loadOpenIssues(testRepository);
      
      // Comprehensive field validation for PRs
      openPRs.forEach(pr => {
        expect(pr.number).toBeTypeOf('number');
        expect(pr.number).toBeGreaterThan(0);
        expect(pr.title).toBeTypeOf('string');
        expect(pr.title.length).toBeGreaterThan(0);
        expect(pr.author).toBeDefined();
        expect(pr.author.login).toBeTypeOf('string');
        expect(pr.author.id).toBeTypeOf('number');
        expect(pr.dateCreated).toBeInstanceOf(Date);
        expect(pr.dateUpdated).toBeInstanceOf(Date);
        expect(pr.dateUpdated.getTime()).toBeGreaterThanOrEqual(pr.dateCreated.getTime());
        expect(pr.status).toMatch(/^(open|closed|merged)$/);
        expect(pr.assignees).toBeInstanceOf(Array);
        expect(pr.reviewers).toBeInstanceOf(Array);
        expect(pr.draft).toBeTypeOf('boolean');
        expect(pr.commits).toBeInstanceOf(Map);
      });
      
      // Comprehensive field validation for Issues
      openIssues.forEach(issue => {
        expect(issue.number).toBeTypeOf('number');
        expect(issue.number).toBeGreaterThan(0);
        expect(issue.title).toBeTypeOf('string');
        expect(issue.title.length).toBeGreaterThan(0);
        expect(issue.author).toBeDefined();
        expect(issue.author.login).toBeTypeOf('string');
        expect(issue.author.id).toBeTypeOf('number');
        expect(issue.dateCreated).toBeInstanceOf(Date);
        expect(issue.dateUpdated).toBeInstanceOf(Date);
        expect(issue.dateUpdated.getTime()).toBeGreaterThanOrEqual(issue.dateCreated.getTime());
        expect(issue.status).toMatch(/^(open|closed)$/);
        expect(issue.assignees).toBeInstanceOf(Array);
      });
    });
    
    it('should generate accurate and complete validation report', async () => {
      await fetcher.syncOpenItemsOnly(testRepository);
      
      const report = await validator.generateFullReport(testRepository);
      
      expect(report.repository).toBe(testRepository.name);
      expect(report.timestamp).toBeInstanceOf(Date);
      expect(report.openPRsValidation.valid).toBe(true);
      expect(report.openIssuesValidation.valid).toBe(true);
      expect(report.completeness.openPRs.stored).toBe(150);
      expect(report.completeness.openIssues.stored).toBe(75);
      expect(report.completeness.dateUpdatedCheck.prsWithoutDateUpdated).toHaveLength(0);
      expect(report.completeness.dateUpdatedCheck.issuesWithoutDateUpdated).toHaveLength(0);
      expect(report.recommendations).toHaveLength(0);
    });
    
    it('should detect missing dateUpdated fields', async () => {
      await fetcher.syncOpenItemsOnly(testRepository);
      
      // Manually corrupt data to remove dateUpdated
      const openPRs = await storageService.loadOpenPRs(testRepository);
      openPRs[0].dateUpdated = undefined as any;
      openPRs[1].dateUpdated = undefined as any;
      await storageService.saveOpenPRs(testRepository, openPRs);
      
      const report = await validator.generateFullReport(testRepository);
      
      expect(report.completeness.dateUpdatedCheck.prsWithoutDateUpdated).toHaveLength(2);
      expect(report.completeness.dateUpdatedCheck.prsWithoutDateUpdated).toContain(openPRs[0].number);
      expect(report.completeness.dateUpdatedCheck.prsWithoutDateUpdated).toContain(openPRs[1].number);
      expect(report.recommendations.length).toBeGreaterThan(0);
    });
  });
  
  describe('Error Handling', () => {
    it('should handle empty repositories gracefully', async () => {
      server.use(
        http.get('https://api.github.com/repos/:owner/:repo/pulls', () => {
          return HttpResponse.json([], { headers: { 'X-Total-Count': '0' } });
        }),
        http.get('https://api.github.com/repos/:owner/:repo/issues', () => {
          return HttpResponse.json([], { headers: { 'X-Total-Count': '0' } });
        })
      );
      
      await expect(fetcher.syncOpenItemsOnly(testRepository)).resolves.not.toThrow();
      
      const openPRs = await storageService.loadOpenPRs(testRepository);
      const openIssues = await storageService.loadOpenIssues(testRepository);
      
      expect(openPRs).toHaveLength(0);
      expect(openIssues).toHaveLength(0);
    });
    
    it('should handle malformed API responses gracefully', async () => {
      server.use(
        http.get('https://api.github.com/repos/:owner/:repo/pulls', () => {
          return HttpResponse.json([
            { 
              number: 1,
              title: 'Test',
              // Missing required fields like user, created_at, etc.
            }
          ]);
        })
      );
      
      // Should not throw, but might have incomplete data
      await expect(fetcher.syncOpenItemsOnly(testRepository)).resolves.not.toThrow();
    });
    
    it('should handle network errors with proper error messages', async () => {
      server.use(
        http.get('https://api.github.com/repos/:owner/:repo/pulls', () => {
          return HttpResponse.error();
        })
      );
      
      // Should throw with meaningful error
      await expect(fetcher.syncOpenItemsOnly(testRepository)).rejects.toThrow();
    });
  });
  
  describe('Storage Operations', () => {
    it('should deduplicate items correctly', async () => {
      await fetcher.syncOpenItemsOnly(testRepository);
      
      // Sync again - should not create duplicates
      await fetcher.syncOpenItemsOnly(testRepository);
      
      const openPRs = await storageService.loadOpenPRs(testRepository);
      const openIssues = await storageService.loadOpenIssues(testRepository);
      
      // Check for unique numbers
      const prNumbers = openPRs.map(pr => pr.number);
      const uniquePRNumbers = new Set(prNumbers);
      expect(uniquePRNumbers.size).toBe(prNumbers.length);
      
      const issueNumbers = openIssues.map(issue => issue.number);
      const uniqueIssueNumbers = new Set(issueNumbers);
      expect(uniqueIssueNumbers.size).toBe(issueNumbers.length);
    });
    
    it('should preserve Map and Set types through save/load cycle', async () => {
      const pr = {
        number: 999,
        title: 'Test PR',
        author: { login: 'test', id: 1 },
        dateCreated: new Date(),
        dateUpdated: new Date(),
        status: 'open' as const,
        assignees: [],
        reviewers: [],
        draft: false,
        commits: new Map([['user1', 5], ['user2', 3]])
      };
      
      await storageService.saveOpenPRs(testRepository, [pr]);
      const loaded = await storageService.loadOpenPRs(testRepository);
      
      expect(loaded[0].commits).toBeInstanceOf(Map);
      expect(loaded[0].commits.get('user1')).toBe(5);
      expect(loaded[0].commits.get('user2')).toBe(3);
    });
  });
});

// Import MSW handlers
import { http, HttpResponse } from 'msw';
import { generateMockPR } from '../mocks/handlers.js';