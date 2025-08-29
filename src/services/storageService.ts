import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { PRData, IssueData, Repository } from '../types/index.js';
import { StorageIndex, MonthlyData, RepositoryIndex, IncrementalFetchResult } from '../types/storage.js';

export class StorageService {
  private dataDir: string;
  private index: StorageIndex;
  private indexPath: string;

  constructor(dataDir: string = './data') {
    this.dataDir = dataDir;
    this.indexPath = join(dataDir, 'index.json');
    this.index = this.loadOrCreateIndex();
  }

  private loadOrCreateIndex(): StorageIndex {
    if (existsSync(this.indexPath)) {
      try {
        const content = readFileSync(this.indexPath, 'utf-8');
        const index = JSON.parse(content, (key, value) => {
          if (key === 'itemNumbers' || key === 'all') {
            return new Set(value);
          }
          if (key.includes('Date') || key === 'firstItem' || key === 'lastItem' || key === 'lastUpdated' || key === 'lastFetch') {
            return new Date(value);
          }
          return value;
        });
        return index;
      } catch (error) {
        console.error('Error loading index, creating new one:', error);
      }
    }
    
    return {
      version: '1.0.0',
      lastUpdated: new Date(),
      repositories: {}
    };
  }

  private saveIndex(): void {
    const indexDir = dirname(this.indexPath);
    if (!existsSync(indexDir)) {
      mkdirSync(indexDir, { recursive: true });
    }

    const serializable = JSON.parse(JSON.stringify(this.index, (key, value) => {
      if (value instanceof Set) {
        return Array.from(value);
      }
      if (value instanceof Date) {
        return value.toISOString();
      }
      return value;
    }));

    writeFileSync(this.indexPath, JSON.stringify(serializable, null, 2));
  }

  private getRepoKey(repo: Repository): string {
    return `${repo.owner}/${repo.repo}`;
  }

  private getYearMonth(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  private getSafeFileName(repoName: string): string {
    return repoName.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
  }

  private getFilePath(repo: Repository, type: 'prs' | 'issues', yearMonth: string): string {
    const safeRepoName = this.getSafeFileName(repo.repo);
    return join(this.dataDir, 'repos', safeRepoName, type, `${yearMonth}.json`);
  }

  async getExistingItemNumbers(repo: Repository, type: 'prs' | 'issues'): Promise<Set<number>> {
    const repoKey = this.getRepoKey(repo);
    const repoIndex = this.index.repositories[repoKey];
    
    if (!repoIndex) {
      return new Set();
    }

    return type === 'prs' ? repoIndex.prs.all : repoIndex.issues.all;
  }

  async getLastFetchDate(repo: Repository): Promise<Date | null> {
    const repoKey = this.getRepoKey(repo);
    const repoIndex = this.index.repositories[repoKey];
    
    if (!repoIndex) {
      return null;
    }

    return repoIndex.lastFetch;
  }

  async identifyNewItems(
    repo: Repository,
    fetchedItems: PRData[] | IssueData[],
    type: 'prs' | 'issues'
  ): Promise<IncrementalFetchResult> {
    const existingNumbers = await this.getExistingItemNumbers(repo, type);
    
    const newItems: (PRData | IssueData)[] = [];
    const updatedItems: (PRData | IssueData)[] = [];

    for (const item of fetchedItems) {
      if (!existingNumbers.has(item.number)) {
        newItems.push(item);
      } else {
        const existingItem = await this.getItemByNumber(repo, type, item.number);
        if (existingItem) {
          const fetchedDate = type === 'prs' 
            ? (item as PRData).dateMerged || (item as PRData).dateClosed || item.dateCreated
            : (item as IssueData).dateClosed || item.dateCreated;
          
          const existingDate = type === 'prs'
            ? (existingItem as PRData).dateMerged || (existingItem as PRData).dateClosed || existingItem.dateCreated
            : (existingItem as IssueData).dateClosed || existingItem.dateCreated;

          if (fetchedDate > existingDate || item.status !== existingItem.status) {
            updatedItems.push(item);
          }
        }
      }
    }

    return {
      newItems,
      updatedItems,
      repository: this.getRepoKey(repo),
      type,
      fetchedAt: new Date()
    };
  }

  private async getItemByNumber(
    repo: Repository,
    type: 'prs' | 'issues',
    number: number
  ): Promise<PRData | IssueData | null> {
    const repoKey = this.getRepoKey(repo);
    const repoIndex = this.index.repositories[repoKey];
    
    if (!repoIndex) return null;

    const monthlyData = type === 'prs' ? repoIndex.prs : repoIndex.issues;
    
    for (const [yearMonth, entry] of Object.entries(monthlyData)) {
      if (yearMonth === 'all') continue;
      if (entry.itemNumbers.has(number)) {
        const filePath = this.getFilePath(repo, type, yearMonth);
        if (existsSync(filePath)) {
          const data: MonthlyData<PRData | IssueData> = JSON.parse(
            readFileSync(filePath, 'utf-8'),
            (key, value) => {
              if (key.includes('Date') || key === 'dateCreated' || key === 'dateMerged' || key === 'dateClosed') {
                return new Date(value);
              }
              if (key === 'byAuthor' && typeof value === 'object') {
                return new Map(Object.entries(value));
              }
              return value;
            }
          );
          return data.items.find(item => item.number === number) || null;
        }
      }
    }
    
    return null;
  }

  async savePRs(repo: Repository, prs: PRData[]): Promise<{ saved: number; updated: number }> {
    return this.saveItems(repo, prs, 'prs');
  }

  async saveIssues(repo: Repository, issues: IssueData[]): Promise<{ saved: number; updated: number }> {
    return this.saveItems(repo, issues, 'issues');
  }

  private async saveItems(
    repo: Repository,
    items: PRData[] | IssueData[],
    type: 'prs' | 'issues'
  ): Promise<{ saved: number; updated: number }> {
    if (items.length === 0) return { saved: 0, updated: 0 };

    const repoKey = this.getRepoKey(repo);
    
    if (!this.index.repositories[repoKey]) {
      this.index.repositories[repoKey] = {
        prs: { all: new Set() },
        issues: { all: new Set() },
        lastFetch: new Date(),
        lastModified: { prs: new Date(), issues: new Date() },
        totalPRs: 0,
        totalIssues: 0
      };
    }

    const repoIndex = this.index.repositories[repoKey];
    const itemsByMonth = new Map<string, (PRData | IssueData)[]>();
    const existingNumbers = type === 'prs' ? repoIndex.prs.all : repoIndex.issues.all;
    
    let newCount = 0;
    let updatedCount = 0;

    for (const item of items) {
      const yearMonth = this.getYearMonth(item.dateCreated);
      if (!itemsByMonth.has(yearMonth)) {
        itemsByMonth.set(yearMonth, []);
      }
      itemsByMonth.get(yearMonth)!.push(item);
      
      if (existingNumbers.has(item.number)) {
        updatedCount++;
      } else {
        newCount++;
        if (type === 'prs') {
          repoIndex.prs.all.add(item.number);
        } else {
          repoIndex.issues.all.add(item.number);
        }
      }
    }

    for (const [yearMonth, monthItems] of itemsByMonth) {
      const filePath = this.getFilePath(repo, type, yearMonth);
      const fileDir = dirname(filePath);
      
      if (!existsSync(fileDir)) {
        mkdirSync(fileDir, { recursive: true });
      }

      let existingData: MonthlyData<PRData | IssueData> | null = null;
      if (existsSync(filePath)) {
        existingData = JSON.parse(
          readFileSync(filePath, 'utf-8'),
          (key, value) => {
            if (key.includes('Date') || key === 'dateCreated' || key === 'dateMerged' || key === 'dateClosed') {
              return new Date(value);
            }
            if (key === 'byAuthor' && typeof value === 'object') {
              return new Map(Object.entries(value));
            }
            return value;
          }
        );
      }

      const existingItems = existingData?.items || [];
      const existingNumbersInFile = new Set(existingItems.map(item => item.number));
      
      const mergedItems = [...existingItems];
      for (const newItem of monthItems) {
        if (existingNumbersInFile.has(newItem.number)) {
          const index = mergedItems.findIndex(item => item.number === newItem.number);
          if (index !== -1) {
            mergedItems[index] = newItem;
          }
        } else {
          mergedItems.push(newItem);
        }
      }

      mergedItems.sort((a, b) => b.dateCreated.getTime() - a.dateCreated.getTime());

      const [year, month] = yearMonth.split('-').map(Number);
      const monthlyData: MonthlyData<PRData | IssueData> = {
        metadata: {
          repository: repoKey,
          year,
          month,
          itemCount: mergedItems.length,
          lastUpdated: new Date(),
          dateRange: {
            start: new Date(year, month - 1, 1),
            end: new Date(year, month, 0)
          },
          itemNumbers: mergedItems.map(item => item.number)
        },
        items: mergedItems
      };

      const serializable = JSON.parse(JSON.stringify(monthlyData, (key, value) => {
        if (value instanceof Map) {
          return Object.fromEntries(value);
        }
        if (value instanceof Date) {
          return value.toISOString();
        }
        return value;
      }));

      writeFileSync(filePath, JSON.stringify(serializable, null, 2));

      const monthlyIndex = type === 'prs' ? repoIndex.prs : repoIndex.issues;
      monthlyIndex[yearMonth] = {
        count: mergedItems.length,
        file: filePath,
        firstItem: mergedItems[mergedItems.length - 1].dateCreated,
        lastItem: mergedItems[0].dateCreated,
        lastUpdated: new Date(),
        itemNumbers: new Set(mergedItems.map(item => item.number)),
        highestNumber: Math.max(...mergedItems.map(item => item.number)),
        oldestNumber: Math.min(...mergedItems.map(item => item.number))
      };
    }

    repoIndex.lastFetch = new Date();
    repoIndex.lastModified[type] = new Date();
    repoIndex[type === 'prs' ? 'totalPRs' : 'totalIssues'] = 
      (type === 'prs' ? repoIndex.prs.all : repoIndex.issues.all).size;

    this.index.lastUpdated = new Date();
    this.saveIndex();

    return { saved: newCount, updated: updatedCount };
  }

  async loadPRs(repo: Repository, startDate?: Date, endDate?: Date): Promise<PRData[]> {
    return this.loadItems(repo, 'prs', startDate, endDate) as Promise<PRData[]>;
  }

  async loadIssues(repo: Repository, startDate?: Date, endDate?: Date): Promise<IssueData[]> {
    return this.loadItems(repo, 'issues', startDate, endDate) as Promise<IssueData[]>;
  }

  private async loadItems(
    repo: Repository,
    type: 'prs' | 'issues',
    startDate?: Date,
    endDate?: Date
  ): Promise<(PRData | IssueData)[]> {
    const repoKey = this.getRepoKey(repo);
    const repoIndex = this.index.repositories[repoKey];
    
    if (!repoIndex) {
      return [];
    }

    const monthlyData = type === 'prs' ? repoIndex.prs : repoIndex.issues;
    const allItems: (PRData | IssueData)[] = [];

    for (const [yearMonth, entry] of Object.entries(monthlyData)) {
      if (yearMonth === 'all') continue;
      
      const [year, month] = yearMonth.split('-').map(Number);
      const monthStart = new Date(year, month - 1, 1);
      const monthEnd = new Date(year, month, 0);

      if (startDate && monthEnd < startDate) continue;
      if (endDate && monthStart > endDate) continue;

      const filePath = this.getFilePath(repo, type, yearMonth);
      if (existsSync(filePath)) {
        const data: MonthlyData<PRData | IssueData> = JSON.parse(
          readFileSync(filePath, 'utf-8'),
          (key, value) => {
            if (key.includes('Date') || key === 'dateCreated' || key === 'dateMerged' || key === 'dateClosed') {
              return new Date(value);
            }
            if (key === 'byAuthor' && typeof value === 'object') {
              return new Map(Object.entries(value));
            }
            return value;
          }
        );

        let items = data.items;
        if (startDate || endDate) {
          items = items.filter(item => {
            const itemDate = item.dateCreated;
            if (startDate && itemDate < startDate) return false;
            if (endDate && itemDate > endDate) return false;
            return true;
          });
        }

        allItems.push(...items);
      }
    }

    return allItems.sort((a, b) => b.dateCreated.getTime() - a.dateCreated.getTime());
  }
}