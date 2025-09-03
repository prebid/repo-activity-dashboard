import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { PRData, IssueData, Repository } from '../types/index.js';
import { OpenItemsStorage, MonthlyStorage, SyncState, StorageIndex } from '../types/storage.js';

export class StorageService {
  private storeDir: string;
  private indexPath: string;

  constructor(storeDir: string = './store') {
    this.storeDir = storeDir;
    this.indexPath = join(storeDir, 'index.json');
    this.ensureDirectoryExists(storeDir);
  }

  private ensureDirectoryExists(path: string): void {
    if (!existsSync(path)) {
      mkdirSync(path, { recursive: true });
    }
  }

  private getRepoKey(repo: Repository): string {
    return `${repo.owner}/${repo.repo}`;
  }

  private getSafeFileName(repoName: string): string {
    return repoName.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
  }

  private getRepoPath(repo: Repository): string {
    return join(this.storeDir, 'repos', repo.name);
  }

  private getYearMonth(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  async saveOpenPRs(repo: Repository, prs: PRData[]): Promise<void> {
    const repoPath = this.getRepoPath(repo);
    this.ensureDirectoryExists(repoPath);
    
    const filePath = join(repoPath, 'open-prs.json');
    const storage: OpenItemsStorage<PRData> = {
      metadata: {
        repository: this.getRepoKey(repo),
        lastSync: new Date(),
        itemCount: prs.length
      },
      items: prs
    };

    writeFileSync(filePath, JSON.stringify(storage, (key, value) => {
      if (value instanceof Map) {
        return Object.fromEntries(value);
      }
      return value;
    }, 2));
  }

  async saveOpenIssues(repo: Repository, issues: IssueData[]): Promise<void> {
    const repoPath = this.getRepoPath(repo);
    this.ensureDirectoryExists(repoPath);
    
    const filePath = join(repoPath, 'open-issues.json');
    const storage: OpenItemsStorage<IssueData> = {
      metadata: {
        repository: this.getRepoKey(repo),
        lastSync: new Date(),
        itemCount: issues.length
      },
      items: issues
    };

    writeFileSync(filePath, JSON.stringify(storage, null, 2));
  }

  async saveMergedPRs(repo: Repository, prs: PRData[]): Promise<void> {
    if (prs.length === 0) return;

    const prsByMonth = new Map<string, PRData[]>();
    
    for (const pr of prs) {
      // Only save PRs merged in 2022 or later
      if (pr.dateMerged && pr.dateMerged.getFullYear() >= 2022) {
        const yearMonth = this.getYearMonth(pr.dateMerged);
        if (!prsByMonth.has(yearMonth)) {
          prsByMonth.set(yearMonth, []);
        }
        prsByMonth.get(yearMonth)!.push(pr);
      }
    }

    for (const [yearMonth, monthPrs] of prsByMonth) {
      const mergedPath = join(this.getRepoPath(repo), 'merged');
      this.ensureDirectoryExists(mergedPath);
      
      const filePath = join(mergedPath, `${yearMonth}.json`);
      let existingPrs: PRData[] = [];
      
      if (existsSync(filePath)) {
        const existing: MonthlyStorage<PRData> = JSON.parse(readFileSync(filePath, 'utf-8'));
        existingPrs = existing.items.map(pr => ({
          ...pr,
          dateCreated: new Date(pr.dateCreated),
          dateUpdated: new Date(pr.dateUpdated),
          dateMerged: pr.dateMerged ? new Date(pr.dateMerged) : undefined,
          dateClosed: pr.dateClosed ? new Date(pr.dateClosed) : undefined
        }));
      }

      const prMap = new Map<number, PRData>();
      for (const pr of existingPrs) {
        prMap.set(pr.number, pr);
      }
      for (const pr of monthPrs) {
        prMap.set(pr.number, pr);
      }

      const [year, month] = yearMonth.split('-').map(Number);
      const storage: MonthlyStorage<PRData> = {
        metadata: {
          repository: this.getRepoKey(repo),
          year,
          month,
          itemCount: prMap.size,
          lastUpdated: new Date()
        },
        items: Array.from(prMap.values()).sort((a, b) => 
          (b.dateMerged?.getTime() || 0) - (a.dateMerged?.getTime() || 0)
        )
      };

      writeFileSync(filePath, JSON.stringify(storage, (key, value) => {
        if (value instanceof Map) {
          return Object.fromEntries(value);
        }
        return value;
      }, 2));
    }
  }

  async saveClosedIssues(repo: Repository, issues: IssueData[]): Promise<void> {
    if (issues.length === 0) return;

    const issuesByMonth = new Map<string, IssueData[]>();
    
    for (const issue of issues) {
      if (issue.dateClosed) {
        const yearMonth = this.getYearMonth(issue.dateClosed);
        if (!issuesByMonth.has(yearMonth)) {
          issuesByMonth.set(yearMonth, []);
        }
        issuesByMonth.get(yearMonth)!.push(issue);
      }
    }

    for (const [yearMonth, monthIssues] of issuesByMonth) {
      const closedPath = join(this.getRepoPath(repo), 'closed');
      this.ensureDirectoryExists(closedPath);
      
      const filePath = join(closedPath, `${yearMonth}.json`);
      let existingIssues: IssueData[] = [];
      
      if (existsSync(filePath)) {
        const existing: MonthlyStorage<IssueData> = JSON.parse(readFileSync(filePath, 'utf-8'));
        existingIssues = existing.items.map(issue => ({
          ...issue,
          dateCreated: new Date(issue.dateCreated),
          dateUpdated: new Date(issue.dateUpdated),
          dateClosed: issue.dateClosed ? new Date(issue.dateClosed) : undefined
        }));
      }

      const issueMap = new Map<number, IssueData>();
      for (const issue of existingIssues) {
        issueMap.set(issue.number, issue);
      }
      for (const issue of monthIssues) {
        issueMap.set(issue.number, issue);
      }

      const [year, month] = yearMonth.split('-').map(Number);
      const storage: MonthlyStorage<IssueData> = {
        metadata: {
          repository: this.getRepoKey(repo),
          year,
          month,
          itemCount: issueMap.size,
          lastUpdated: new Date()
        },
        items: Array.from(issueMap.values()).sort((a, b) => 
          (b.dateClosed?.getTime() || 0) - (a.dateClosed?.getTime() || 0)
        )
      };

      writeFileSync(filePath, JSON.stringify(storage, null, 2));
    }
  }

  async loadOpenPRs(repo: Repository): Promise<PRData[]> {
    const filePath = join(this.getRepoPath(repo), 'open-prs.json');
    if (!existsSync(filePath)) {
      return [];
    }

    const storage: OpenItemsStorage<PRData> = JSON.parse(
      readFileSync(filePath, 'utf-8'),
      (key, value) => {
        if (key === 'commits' && typeof value === 'object' && !Array.isArray(value)) {
          return new Map(Object.entries(value));
        }
        if (key.includes('Date') || key === 'dateCreated' || key === 'dateUpdated' || key === 'dateMerged' || key === 'dateClosed' || key === 'lastSync') {
          return new Date(value);
        }
        return value;
      }
    );

    return storage.items;
  }

  async loadOpenIssues(repo: Repository): Promise<IssueData[]> {
    const filePath = join(this.getRepoPath(repo), 'open-issues.json');
    if (!existsSync(filePath)) {
      return [];
    }

    const storage: OpenItemsStorage<IssueData> = JSON.parse(
      readFileSync(filePath, 'utf-8'),
      (key, value) => {
        if (key.includes('Date') || key === 'dateCreated' || key === 'dateUpdated' || key === 'dateClosed' || key === 'lastSync') {
          return new Date(value);
        }
        return value;
      }
    );

    return storage.items;
  }

  async saveSyncState(repo: Repository, state: Partial<SyncState>): Promise<void> {
    const repoPath = this.getRepoPath(repo);
    this.ensureDirectoryExists(repoPath);
    
    const filePath = join(repoPath, 'sync-state.json');
    const fullState: SyncState = {
      repository: this.getRepoKey(repo),
      lastFullSync: state.lastFullSync || new Date(),
      lastIncrementalSync: state.lastIncrementalSync || new Date(),
      openPRNumbers: state.openPRNumbers || new Set(),
      openIssueNumbers: state.openIssueNumbers || new Set()
    };

    writeFileSync(filePath, JSON.stringify(fullState, (key, value) => {
      if (value instanceof Set) {
        return Array.from(value);
      }
      return value;
    }, 2));
  }

  async loadSyncState(repo: Repository): Promise<SyncState | null> {
    const filePath = join(this.getRepoPath(repo), 'sync-state.json');
    if (!existsSync(filePath)) {
      return null;
    }

    return JSON.parse(
      readFileSync(filePath, 'utf-8'),
      (key, value) => {
        if (key === 'openPRNumbers' || key === 'openIssueNumbers') {
          return new Set(value);
        }
        if (key.includes('Sync')) {
          return new Date(value);
        }
        return value;
      }
    );
  }

  async updateIndex(repo: Repository, stats: {
    openPRsCount: number;
    openIssuesCount: number;
    totalMergedPRs: number;
    totalClosedIssues: number;
  }): Promise<void> {
    let index: StorageIndex;
    
    if (existsSync(this.indexPath)) {
      index = JSON.parse(readFileSync(this.indexPath, 'utf-8'));
    } else {
      index = {
        version: '2.0.0',
        lastUpdated: new Date(),
        repositories: {}
      };
    }

    const repoKey = this.getRepoKey(repo);
    index.repositories[repoKey] = {
      lastSync: new Date(),
      ...stats
    };
    index.lastUpdated = new Date();

    writeFileSync(this.indexPath, JSON.stringify(index, null, 2));
  }
}