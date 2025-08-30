import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StorageService } from '../../src/services/storageService.js';
import { testRepository, mockPRData, mockIssueData, generateMockPRs, generateMockIssues } from '../fixtures/testData.js';
import { TEST_STORE_DIR } from '../setup.js';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

describe('StorageService', () => {
  let storageService: StorageService;

  beforeEach(() => {
    storageService = new StorageService(TEST_STORE_DIR);
  });

  describe('saveOpenPRs', () => {
    it('should save open PRs to correct file path', async () => {
      const prs = generateMockPRs(5);
      
      await storageService.saveOpenPRs(testRepository, prs);
      
      const filePath = join(TEST_STORE_DIR, 'repos', testRepository.name, 'open-prs.json');
      expect(existsSync(filePath)).toBe(true);
      
      const savedData = JSON.parse(readFileSync(filePath, 'utf-8'));
      expect(savedData.metadata.repository).toBe('prebid/test-repo');
      expect(savedData.metadata.itemCount).toBe(5);
      expect(savedData.items).toHaveLength(5);
    });

    it('should preserve dateUpdated field when saving', async () => {
      const pr = { ...mockPRData };
      
      await storageService.saveOpenPRs(testRepository, [pr]);
      
      const loaded = await storageService.loadOpenPRs(testRepository);
      expect(loaded[0].dateUpdated).toBeInstanceOf(Date);
      expect(loaded[0].dateUpdated.toISOString()).toBe(pr.dateUpdated.toISOString());
    });

    it('should handle empty array', async () => {
      await storageService.saveOpenPRs(testRepository, []);
      
      const filePath = join(TEST_STORE_DIR, 'repos', testRepository.name, 'open-prs.json');
      expect(existsSync(filePath)).toBe(true);
      
      const savedData = JSON.parse(readFileSync(filePath, 'utf-8'));
      expect(savedData.metadata.itemCount).toBe(0);
      expect(savedData.items).toHaveLength(0);
    });
  });

  describe('saveOpenIssues', () => {
    it('should save open issues with correct structure', async () => {
      const issues = generateMockIssues(3);
      
      await storageService.saveOpenIssues(testRepository, issues);
      
      const filePath = join(TEST_STORE_DIR, 'repos', testRepository.name, 'open-issues.json');
      expect(existsSync(filePath)).toBe(true);
      
      const savedData = JSON.parse(readFileSync(filePath, 'utf-8'));
      expect(savedData.metadata.repository).toBe('prebid/test-repo');
      expect(savedData.metadata.itemCount).toBe(3);
      expect(savedData.items).toHaveLength(3);
    });

    it('should preserve all date fields', async () => {
      const issue = { ...mockIssueData };
      
      await storageService.saveOpenIssues(testRepository, [issue]);
      
      const loaded = await storageService.loadOpenIssues(testRepository);
      expect(loaded[0].dateCreated).toBeInstanceOf(Date);
      expect(loaded[0].dateUpdated).toBeInstanceOf(Date);
      expect(loaded[0].dateCreated.toISOString()).toBe(issue.dateCreated.toISOString());
      expect(loaded[0].dateUpdated.toISOString()).toBe(issue.dateUpdated.toISOString());
    });
  });

  describe('saveMergedPRs', () => {
    it('should organize merged PRs by month', async () => {
      const prs: PRData[] = [
        { ...mockPRData, number: 1, dateMerged: new Date('2024-01-15') },
        { ...mockPRData, number: 2, dateMerged: new Date('2024-01-20') },
        { ...mockPRData, number: 3, dateMerged: new Date('2024-02-10') }
      ];
      
      await storageService.saveMergedPRs(testRepository, prs);
      
      const janPath = join(TEST_STORE_DIR, 'repos', testRepository.name, 'merged', '2024-01.json');
      const febPath = join(TEST_STORE_DIR, 'repos', testRepository.name, 'merged', '2024-02.json');
      
      expect(existsSync(janPath)).toBe(true);
      expect(existsSync(febPath)).toBe(true);
      
      const janData = JSON.parse(readFileSync(janPath, 'utf-8'));
      const febData = JSON.parse(readFileSync(febPath, 'utf-8'));
      
      expect(janData.items).toHaveLength(2);
      expect(febData.items).toHaveLength(1);
    });

    it('should deduplicate PRs when saving to same month', async () => {
      const pr1 = { ...mockPRData, number: 1, dateMerged: new Date('2024-01-15') };
      const pr2 = { ...mockPRData, number: 1, dateMerged: new Date('2024-01-15'), title: 'Updated Title' };
      
      await storageService.saveMergedPRs(testRepository, [pr1]);
      await storageService.saveMergedPRs(testRepository, [pr2]);
      
      const filePath = join(TEST_STORE_DIR, 'repos', testRepository.name, 'merged', '2024-01.json');
      const savedData = JSON.parse(readFileSync(filePath, 'utf-8'));
      
      expect(savedData.items).toHaveLength(1);
      expect(savedData.items[0].title).toBe('Updated Title');
    });

    it('should skip PRs without merge date', async () => {
      const prs: PRData[] = [
        { ...mockPRData, number: 1, dateMerged: undefined },
        { ...mockPRData, number: 2, dateMerged: new Date('2024-01-20') }
      ];
      
      await storageService.saveMergedPRs(testRepository, prs);
      
      const janPath = join(TEST_STORE_DIR, 'repos', testRepository.name, 'merged', '2024-01.json');
      const savedData = JSON.parse(readFileSync(janPath, 'utf-8'));
      
      expect(savedData.items).toHaveLength(1);
      expect(savedData.items[0].number).toBe(2);
    });
  });

  describe('loadOpenPRs', () => {
    it('should return empty array when file does not exist', async () => {
      const prs = await storageService.loadOpenPRs(testRepository);
      expect(prs).toEqual([]);
    });

    it('should parse dates correctly when loading', async () => {
      const originalPRs = generateMockPRs(2);
      await storageService.saveOpenPRs(testRepository, originalPRs);
      
      const loadedPRs = await storageService.loadOpenPRs(testRepository);
      
      expect(loadedPRs[0].dateCreated).toBeInstanceOf(Date);
      expect(loadedPRs[0].dateUpdated).toBeInstanceOf(Date);
      expect(loadedPRs[0].dateCreated.toISOString()).toBe(originalPRs[0].dateCreated.toISOString());
    });
  });

  describe('saveSyncState', () => {
    it('should save and load sync state correctly', async () => {
      const syncState = {
        lastFullSync: new Date('2024-01-01T12:00:00Z'),
        lastIncrementalSync: new Date('2024-01-02T12:00:00Z'),
        openPRNumbers: new Set([1, 2, 3]),
        openIssueNumbers: new Set([10, 20, 30])
      };
      
      await storageService.saveSyncState(testRepository, syncState);
      
      const loaded = await storageService.loadSyncState(testRepository);
      
      expect(loaded).not.toBeNull();
      expect(loaded!.lastFullSync).toBeInstanceOf(Date);
      expect(loaded!.lastIncrementalSync).toBeInstanceOf(Date);
      expect(loaded!.openPRNumbers).toBeInstanceOf(Set);
      expect(loaded!.openPRNumbers.has(2)).toBe(true);
      expect(loaded!.openIssueNumbers.size).toBe(3);
    });
  });

  describe('updateIndex', () => {
    it('should create and update repository index', async () => {
      const stats = {
        openPRsCount: 10,
        openIssuesCount: 20,
        totalMergedPRs: 100,
        totalClosedIssues: 50
      };
      
      await storageService.updateIndex(testRepository, stats);
      
      const indexPath = join(TEST_STORE_DIR, 'index.json');
      expect(existsSync(indexPath)).toBe(true);
      
      const index = JSON.parse(readFileSync(indexPath, 'utf-8'));
      expect(index.repositories['prebid/test-repo']).toEqual({
        lastSync: expect.any(String),
        ...stats
      });
    });
  });
});