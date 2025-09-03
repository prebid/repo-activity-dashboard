import 'dotenv/config';
import { GitHubService } from './dist/services/githubService.js';
import { StorageService } from './dist/services/storageService.js';
import { parseRepositories } from './dist/services/repoParser.js';

async function syncAllReposMerged() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error('GITHUB_TOKEN environment variable is required');
  }

  const githubService = new GitHubService(token, 5);
  const storageService = new StorageService('./store');
  
  // Load all repositories
  const allRepos = await parseRepositories();
  
  // Filter out Prebid.js since we already have it
  const reposToSync = allRepos.filter(repo => repo.name !== 'prebid-js');
  
  console.log('🚀 Starting merged PRs sync for all repositories (except Prebid.js)');
  console.log(`📋 Will process ${reposToSync.length} repositories`);
  console.log('📅 Fetching PRs updated since 2020-01-01');
  console.log('💾 Will save only PRs merged in 2022 or later\n');
  
  const since2020 = new Date('2020-01-01T00:00:00Z');
  const startTime = Date.now();
  const totalStats = {
    repos: 0,
    totalFetched: 0,
    totalSaved: 0
  };
  
  for (const repo of reposToSync) {
    console.log(`\n📦 Processing ${repo.name} (${repo.owner}/${repo.repo})...`);
    const repoStartTime = Date.now();
    
    try {
      let processedCount = 0;
      let savedCount = 0;
      let allMergedPRs = [];
      
      const mergedPRs = await githubService.fetchMergedPRs(repo, since2020, {
        onBatch: async (batch) => {
          processedCount += batch.length;
          allMergedPRs = [...allMergedPRs, ...batch];
          
          // Count how many will actually be saved (2022+)
          const toSave = batch.filter(pr => pr.dateMerged && pr.dateMerged.getFullYear() >= 2022);
          savedCount += toSave.length;
          
          // Save every 10 PRs
          if (processedCount % 10 === 0) {
            await storageService.saveMergedPRs(repo, allMergedPRs);
            process.stdout.write(`\r   Processed: ${processedCount} PRs, Will save: ${savedCount} (2022+)...`);
          }
        }
      });
      
      // Final save for this repo
      await storageService.saveMergedPRs(repo, mergedPRs);
      
      // Calculate stats for this repo
      let saved2022Plus = 0;
      for (const pr of mergedPRs) {
        if (pr.dateMerged && pr.dateMerged.getFullYear() >= 2022) {
          saved2022Plus++;
        }
      }
      
      const repoElapsed = Math.round((Date.now() - repoStartTime) / 1000);
      console.log(`\n   ✅ ${repo.name}: Fetched ${mergedPRs.length}, Saved ${saved2022Plus} (${repoElapsed}s)`);
      
      totalStats.repos++;
      totalStats.totalFetched += mergedPRs.length;
      totalStats.totalSaved += saved2022Plus;
      
    } catch (error) {
      console.error(`\n   ❌ Failed to sync ${repo.name}:`, error.message);
    }
    
    // Check rate limit after each repo
    const rateLimit = await githubService.checkRateLimit();
    if (rateLimit.remaining < 100) {
      console.log(`\n⚠️  Low API quota: ${rateLimit.remaining} remaining. Stopping.`);
      break;
    }
  }
  
  // Final summary
  const totalElapsed = Math.round((Date.now() - startTime) / 1000);
  console.log('\n' + '='.repeat(60));
  console.log('📊 FINAL SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Processed ${totalStats.repos}/${reposToSync.length} repositories`);
  console.log(`📥 Total fetched: ${totalStats.totalFetched} merged PRs`);
  console.log(`💾 Total saved: ${totalStats.totalSaved} PRs (2022+)`);
  console.log(`⏱️  Total time: ${Math.floor(totalElapsed / 60)}m ${totalElapsed % 60}s`);
  
  // Show final rate limit
  const finalRateLimit = await githubService.checkRateLimit();
  console.log(`\n📊 API Rate Limit: ${finalRateLimit.remaining}/${finalRateLimit.limit} remaining`);
  console.log(`   Resets at: ${finalRateLimit.reset.toLocaleTimeString()}`);
}

syncAllReposMerged().catch(console.error);