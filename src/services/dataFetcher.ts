import { GitHubService } from './githubService.js';
import { StorageService } from './storageService.js';
import { Repository, RepositoryData, PRData, IssueData } from '../types/index.js';
import { loadRepositories } from '../utils/repoParser.js';

export class DataFetcher {
  private githubService: GitHubService;
  private storageService: StorageService;

  constructor(token: string, storeDir?: string, maxConcurrent: number = 3) {
    this.githubService = new GitHubService(token, maxConcurrent);
    this.storageService = new StorageService(storeDir);
  }

  async syncRepository(repo: Repository): Promise<void> {
    console.log(`🔄 Syncing ${repo.name}...`);
    
    try {
      let allOpenPRs: PRData[] = [];
      let allOpenIssues: IssueData[] = [];
      let allMergedPRs: PRData[] = [];
      let allClosedIssues: IssueData[] = [];
      
      // Fetch open PRs with batch saving
      const openPRs = await this.githubService.fetchOpenPRs(repo, {
        onBatch: async (batch) => {
          allOpenPRs = [...allOpenPRs, ...batch];
          await this.storageService.saveOpenPRs(repo, allOpenPRs);
        }
      });
      allOpenPRs = openPRs;
      
      // Fetch open issues with batch saving
      const openIssues = await this.githubService.fetchOpenIssues(repo, {
        onBatch: async (batch) => {
          allOpenIssues = [...allOpenIssues, ...batch];
          await this.storageService.saveOpenIssues(repo, allOpenIssues);
        }
      });
      allOpenIssues = openIssues;
      
      // Fetch merged PRs from 2020 onwards (to ensure we capture all 2023+ merged PRs)
      const since2020 = new Date('2020-01-01T00:00:00Z');
      const mergedPRs = await this.githubService.fetchMergedPRs(repo, since2020, {
        onBatch: async (batch) => {
          allMergedPRs = [...allMergedPRs, ...batch];
          await this.storageService.saveMergedPRs(repo, allMergedPRs);
        }
      });
      allMergedPRs = mergedPRs;
      
      // Fetch closed issues from 2020 onwards
      const closedIssues = await this.githubService.fetchClosedIssues(repo, since2020, {
        onBatch: async (batch) => {
          allClosedIssues = [...allClosedIssues, ...batch];
          await this.storageService.saveClosedIssues(repo, allClosedIssues);
        }
      });
      allClosedIssues = closedIssues;

      // Final save to ensure everything is stored
      await Promise.all([
        this.storageService.saveOpenPRs(repo, allOpenPRs),
        this.storageService.saveOpenIssues(repo, allOpenIssues),
        this.storageService.saveMergedPRs(repo, allMergedPRs),
        this.storageService.saveClosedIssues(repo, allClosedIssues)
      ]);

      await this.storageService.updateIndex(repo, {
        openPRsCount: allOpenPRs.length,
        openIssuesCount: allOpenIssues.length,
        totalMergedPRs: allMergedPRs.length,
        totalClosedIssues: allClosedIssues.length
      });

      await this.storageService.saveSyncState(repo, {
        lastFullSync: new Date(),
        lastIncrementalSync: new Date(),
        openPRNumbers: new Set(allOpenPRs.map(pr => pr.number)),
        openIssueNumbers: new Set(allOpenIssues.map(issue => issue.number))
      });

      console.log(`✅ ${repo.name}: ${allOpenPRs.length} open PRs, ${allOpenIssues.length} open issues, ${allMergedPRs.length} merged PRs, ${allClosedIssues.length} closed issues`);
    } catch (error) {
      console.error(`❌ Failed to sync ${repo.name}:`, error);
      throw error;
    }
  }

  async syncOpenItemsOnly(repo: Repository): Promise<void> {
    console.log(`🔄 Updating open items for ${repo.name}...`);
    
    try {
      let allOpenPRs: PRData[] = [];
      let allOpenIssues: IssueData[] = [];
      
      // Fetch open PRs with batch saving
      const openPRs = await this.githubService.fetchOpenPRs(repo, {
        onBatch: async (batch) => {
          allOpenPRs = [...allOpenPRs, ...batch];
          await this.storageService.saveOpenPRs(repo, allOpenPRs);
        }
      });
      allOpenPRs = openPRs;
      
      // Fetch open issues with batch saving
      const openIssues = await this.githubService.fetchOpenIssues(repo, {
        onBatch: async (batch) => {
          allOpenIssues = [...allOpenIssues, ...batch];
          await this.storageService.saveOpenIssues(repo, allOpenIssues);
        }
      });
      allOpenIssues = openIssues;

      // Final save to ensure everything is stored
      await Promise.all([
        this.storageService.saveOpenPRs(repo, allOpenPRs),
        this.storageService.saveOpenIssues(repo, allOpenIssues)
      ]);

      console.log(`✅ ${repo.name}: ${allOpenPRs.length} open PRs, ${allOpenIssues.length} open issues (with dateUpdated)`);
    } catch (error) {
      console.error(`❌ Failed to update ${repo.name}:`, error);
      throw error;
    }
  }

  async syncMergedPRsOnly(repo: Repository, since?: Date): Promise<void> {
    console.log(`🔄 Updating merged PRs for ${repo.name}...`);
    
    try {
      let allMergedPRs: PRData[] = [];
      
      // Use provided date or default to 2024
      const sinceDate = since || new Date('2024-01-01T00:00:00Z');
      
      // Fetch merged PRs
      const mergedPRs = await this.githubService.fetchMergedPRs(repo, sinceDate, {
        onBatch: async (batch) => {
          allMergedPRs = [...allMergedPRs, ...batch];
          await this.storageService.saveMergedPRs(repo, allMergedPRs);
        }
      });
      allMergedPRs = mergedPRs;

      // Final save to ensure everything is stored
      await this.storageService.saveMergedPRs(repo, allMergedPRs);

      console.log(`✅ ${repo.name}: ${allMergedPRs.length} merged PRs (since ${sinceDate.toISOString().split('T')[0]})`);
    } catch (error) {
      console.error(`❌ Failed to update merged PRs for ${repo.name}:`, error);
      throw error;
    }
  }

  async syncClosedIssuesOnly(repo: Repository, since?: Date): Promise<void> {
    console.log(`🔄 Updating closed issues for ${repo.name}...`);
    
    try {
      let allClosedIssues: IssueData[] = [];
      
      // Use provided date or default to 2024
      const sinceDate = since || new Date('2024-01-01T00:00:00Z');
      
      // Fetch closed issues
      const closedIssues = await this.githubService.fetchClosedIssues(repo, sinceDate, {
        onBatch: async (batch) => {
          allClosedIssues = [...allClosedIssues, ...batch];
          await this.storageService.saveClosedIssues(repo, allClosedIssues);
        }
      });
      allClosedIssues = closedIssues;

      // Final save to ensure everything is stored
      await this.storageService.saveClosedIssues(repo, allClosedIssues);

      console.log(`✅ ${repo.name}: ${allClosedIssues.length} closed issues (since ${sinceDate.toISOString().split('T')[0]})`);
    } catch (error) {
      console.error(`❌ Failed to update closed issues for ${repo.name}:`, error);
      throw error;
    }
  }

  async incrementalSync(repo: Repository): Promise<void> {
    console.log(`🔄 Incremental sync for ${repo.name}...`);
    
    const syncState = await this.storageService.loadSyncState(repo);
    const since = syncState?.lastIncrementalSync || new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    
    try {
      let allCurrentOpenPRs: PRData[] = [];
      let allCurrentOpenIssues: IssueData[] = [];
      let allRecentMergedPRs: PRData[] = [];
      let allRecentClosedIssues: IssueData[] = [];
      
      // Fetch current open PRs with batch saving
      const currentOpenPRs = await this.githubService.fetchOpenPRs(repo, {
        onBatch: async (batch) => {
          allCurrentOpenPRs = [...allCurrentOpenPRs, ...batch];
          await this.storageService.saveOpenPRs(repo, allCurrentOpenPRs);
        }
      });
      allCurrentOpenPRs = currentOpenPRs;
      
      // Fetch current open issues with batch saving
      const currentOpenIssues = await this.githubService.fetchOpenIssues(repo, {
        onBatch: async (batch) => {
          allCurrentOpenIssues = [...allCurrentOpenIssues, ...batch];
          await this.storageService.saveOpenIssues(repo, allCurrentOpenIssues);
        }
      });
      allCurrentOpenIssues = currentOpenIssues;
      
      // Fetch recently merged PRs
      const recentMergedPRs = await this.githubService.fetchMergedPRs(repo, since, {
        onBatch: async (batch) => {
          allRecentMergedPRs = [...allRecentMergedPRs, ...batch];
        }
      });
      allRecentMergedPRs = recentMergedPRs;
      
      // Fetch recently closed issues
      const recentClosedIssues = await this.githubService.fetchClosedIssues(repo, since, {
        onBatch: async (batch) => {
          allRecentClosedIssues = [...allRecentClosedIssues, ...batch];
        }
      });
      allRecentClosedIssues = recentClosedIssues;

      const existingOpenPRs = await this.storageService.loadOpenPRs(repo);
      const existingOpenIssues = await this.storageService.loadOpenIssues(repo);

      const currentOpenPRNumbers = new Set(allCurrentOpenPRs.map(pr => pr.number));
      
      const newlyMergedPRs = existingOpenPRs.filter(pr => 
        !currentOpenPRNumbers.has(pr.number) && pr.status === 'open'
      );

      const currentOpenIssueNumbers = new Set(allCurrentOpenIssues.map(issue => issue.number));
      
      const newlyClosedIssues = existingOpenIssues.filter(issue => 
        !currentOpenIssueNumbers.has(issue.number) && issue.status === 'open'
      );

      // Final save with all data
      await Promise.all([
        this.storageService.saveOpenPRs(repo, allCurrentOpenPRs),
        this.storageService.saveOpenIssues(repo, allCurrentOpenIssues),
        this.storageService.saveMergedPRs(repo, [...allRecentMergedPRs, ...newlyMergedPRs]),
        this.storageService.saveClosedIssues(repo, [...allRecentClosedIssues, ...newlyClosedIssues])
      ]);

      await this.storageService.saveSyncState(repo, {
        lastIncrementalSync: new Date(),
        openPRNumbers: currentOpenPRNumbers,
        openIssueNumbers: currentOpenIssueNumbers
      });

      console.log(`✅ ${repo.name}: Updated open items, found ${allRecentMergedPRs.length} recently merged PRs, ${allRecentClosedIssues.length} recently closed issues`);
    } catch (error) {
      console.error(`❌ Failed incremental sync for ${repo.name}:`, error);
      throw error;
    }
  }

  async syncAllRepositories(): Promise<void> {
    const repositories = loadRepositories();
    console.log(`🔍 Found ${repositories.length} repositories to sync\n`);
    console.log(`⚙️  Processing repositories sequentially for stability\n`);
    
    for (let i = 0; i < repositories.length; i++) {
      const repo = repositories[i];
      console.log(`\n[${i + 1}/${repositories.length}] Processing ${repo.name}`);
      await this.syncRepository(repo);
      
      const rateLimit = await this.githubService.checkRateLimit();
      const queueStats = this.githubService.getQueueStats();
      console.log(`  API Rate Limit: ${rateLimit.remaining}/${rateLimit.limit} requests remaining`);
      console.log(`  Queue Stats: ${queueStats.active} active, ${queueStats.queued} queued`);
      
      if (rateLimit.remaining < 100) {
        console.warn(`⚠️  Low API rate limit. Waiting until ${rateLimit.reset}`);
        const waitTime = rateLimit.reset.getTime() - Date.now();
        if (waitTime > 0) {
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      } else if (i < repositories.length - 1) {
        // Brief pause between repositories
        console.log(`  Waiting 2 seconds before next repository...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    console.log(`\n✅ All ${repositories.length} repositories synced successfully!`);
  }

  async loadRepositoryData(repo: Repository): Promise<RepositoryData> {
    const [openPRs, openIssues] = await Promise.all([
      this.storageService.loadOpenPRs(repo),
      this.storageService.loadOpenIssues(repo)
    ]);

    return {
      repository: repo,
      prs: openPRs,
      issues: openIssues,
      fetchedAt: new Date()
    };
  }
}