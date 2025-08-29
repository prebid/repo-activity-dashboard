import { GitHubService } from './githubService.js';
import { StorageService } from './storageService.js';
import { Repository, RepositoryData, PRData, IssueData } from '../types/index.js';
import { loadRepositories } from '../utils/repoParser.js';

interface FetchOptions {
  state?: 'open' | 'closed' | 'all';
  limit?: number;
  parallel?: boolean;
  maxConcurrent?: number;
  saveToStorage?: boolean;
  incrementalUpdate?: boolean;
}

export class DataFetcher {
  private githubService: GitHubService;
  private storageService: StorageService;

  constructor(token: string, dataDir?: string) {
    this.githubService = new GitHubService(token);
    this.storageService = new StorageService(dataDir);
  }

  async fetchRepositoryData(repo: Repository, options?: FetchOptions): Promise<RepositoryData> {
    console.log(`📊 Fetching data for ${repo.name}...`);
    
    try {
      let prs, issues;
      
      if (options?.incrementalUpdate) {
        const existingPRNumbers = await this.storageService.getExistingItemNumbers(repo, 'prs');
        const existingIssueNumbers = await this.storageService.getExistingItemNumbers(repo, 'issues');
        console.log(`   Existing: ${existingPRNumbers.size} PRs, ${existingIssueNumbers.size} issues`);
      }

      [prs, issues] = await Promise.all([
        this.githubService.fetchPRs(repo, options),
        this.githubService.fetchIssues(repo, options)
      ]);

      console.log(`✅ Successfully fetched ${repo.name}: ${prs.length} PRs, ${issues.length} issues`);

      if (options?.saveToStorage) {
        const prResult = await this.storageService.savePRs(repo, prs);
        const issueResult = await this.storageService.saveIssues(repo, issues);
        console.log(`💾 Stored ${repo.name}: PRs (${prResult.saved} new, ${prResult.updated} updated), Issues (${issueResult.saved} new, ${issueResult.updated} updated)`);
      }

      return {
        repository: repo,
        prs,
        issues,
        fetchedAt: new Date()
      };
    } catch (error) {
      console.error(`❌ Failed to fetch data for ${repo.name}:`, error);
      throw error;
    }
  }

  async fetchAllRepositories(options?: FetchOptions): Promise<RepositoryData[]> {
    const repositories = loadRepositories();
    console.log(`🔍 Found ${repositories.length} repositories to analyze`);

    if (options?.parallel === false) {
      // Sequential fetching (slower but uses less API quota at once)
      const results: RepositoryData[] = [];
      for (const repo of repositories) {
        try {
          const data = await this.fetchRepositoryData(repo, options);
          results.push(data);
        } catch (error) {
          console.error(`⚠️  Skipping ${repo.name} due to error`);
        }
      }
      return results;
    }

    // Parallel fetching with concurrency control
    const maxConcurrent = options?.maxConcurrent || 3;
    const results: RepositoryData[] = [];
    
    for (let i = 0; i < repositories.length; i += maxConcurrent) {
      const batch = repositories.slice(i, i + maxConcurrent);
      const batchPromises = batch.map(repo => 
        this.fetchRepositoryData(repo, options)
          .catch(error => {
            console.error(`⚠️  Skipping ${repo.name} due to error`);
            return null;
          })
      );
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.filter((data): data is RepositoryData => data !== null));
      
      // Check rate limit after each batch
      const rateLimit = await this.githubService.checkRateLimit();
      console.log(`⏱️  API Rate Limit: ${rateLimit.remaining} remaining`);
      
      if (rateLimit.remaining < 100) {
        console.warn(`⚠️  Low API rate limit. Waiting until ${rateLimit.reset}`);
        const waitTime = rateLimit.reset.getTime() - Date.now();
        if (waitTime > 0) {
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }

    return results;
  }

  async fetchByCategory(category: string, options?: FetchOptions): Promise<RepositoryData[]> {
    const repositories = loadRepositories();
    const categoryRepos = repositories.filter(repo => repo.category === category);
    
    console.log(`🔍 Found ${categoryRepos.length} repositories in category "${category}"`);
    
    const results: RepositoryData[] = [];
    for (const repo of categoryRepos) {
      try {
        const data = await this.fetchRepositoryData(repo, options);
        results.push(data);
      } catch (error) {
        console.error(`⚠️  Skipping ${repo.name} due to error`);
      }
    }
    
    return results;
  }

  async fetchNewItemsOnly(repo: Repository, options?: FetchOptions): Promise<{ newPRs: number; newIssues: number }> {
    console.log(`🔄 Checking for new items in ${repo.name}...`);
    
    const [prs, issues] = await Promise.all([
      this.githubService.fetchPRs(repo, { ...options, limit: 50 }),
      this.githubService.fetchIssues(repo, { ...options, limit: 50 })
    ]);

    const prResult = await this.storageService.identifyNewItems(repo, prs, 'prs');
    const issueResult = await this.storageService.identifyNewItems(repo, issues, 'issues');

    if (prResult.newItems.length > 0 || prResult.updatedItems.length > 0) {
      const saveResult = await this.storageService.savePRs(repo, [...prResult.newItems, ...prResult.updatedItems] as PRData[]);
      console.log(`   PRs: ${saveResult.saved} new, ${saveResult.updated} updated`);
    }

    if (issueResult.newItems.length > 0 || issueResult.updatedItems.length > 0) {
      const saveResult = await this.storageService.saveIssues(repo, [...issueResult.newItems, ...issueResult.updatedItems] as IssueData[]);
      console.log(`   Issues: ${saveResult.saved} new, ${saveResult.updated} updated`);
    }

    return {
      newPRs: prResult.newItems.length,
      newIssues: issueResult.newItems.length
    };
  }

  async loadFromStorage(repo: Repository, startDate?: Date, endDate?: Date): Promise<RepositoryData> {
    const prs = await this.storageService.loadPRs(repo, startDate, endDate);
    const issues = await this.storageService.loadIssues(repo, startDate, endDate);
    
    return {
      repository: repo,
      prs,
      issues,
      fetchedAt: new Date()
    };
  }
}