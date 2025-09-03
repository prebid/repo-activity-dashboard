import 'dotenv/config';
import { GitHubService } from './dist/services/githubService.js';
import { StorageService } from './dist/services/storageService.js';

async function syncPrebidClean() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error('GITHUB_TOKEN environment variable is required');
  }

  const githubService = new GitHubService(token, 5);
  const storageService = new StorageService('./store');
  
  // Sync professor-prebid repo
  const repo = {
    name: 'professor-prebid',
    owner: 'prebid',
    repo: 'professor-prebid',
    url: 'https://github.com/prebid/professor-prebid'
  };
  
  console.log('🚀 Starting clean sync for professor-prebid merged PRs');
  console.log('📅 Fetching PRs updated since 2020-01-01');
  console.log('💾 Will save only PRs merged in 2022 or later');
  console.log('⏳ This will take several minutes...\n');
  
  const since2020 = new Date('2020-01-01T00:00:00Z');
  const startTime = Date.now();
  
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
    
    // Final save
    await storageService.saveMergedPRs(repo, mergedPRs);
    
    // Summary
    const prsByYear = new Map();
    let saved2022Plus = 0;
    
    for (const pr of mergedPRs) {
      if (pr.dateMerged) {
        const year = pr.dateMerged.getFullYear();
        prsByYear.set(year, (prsByYear.get(year) || 0) + 1);
        if (year >= 2022) {
          saved2022Plus++;
        }
      }
    }
    
    console.log(`\n\n✅ Completed!`);
    console.log(`📊 Total fetched: ${mergedPRs.length} merged PRs`);
    console.log(`💾 Total saved: ${saved2022Plus} PRs (2022-2025)`);
    console.log('\n📈 Breakdown by year:');
    
    Array.from(prsByYear.entries())
      .sort((a, b) => a[0] - b[0])
      .forEach(([year, count]) => {
        if (year >= 2022) {
          console.log(`  ${year}: ${count} PRs ✅ (saved to store)`);
        } else {
          console.log(`  ${year}: ${count} PRs ⏭️  (skipped - before 2022)`);
        }
      });
    
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`\n⏱️  Completed in ${Math.floor(elapsed / 60)}m ${elapsed % 60}s`);
    
    // Show rate limit status
    const rateLimit = await githubService.checkRateLimit();
    console.log(`\n📊 API Rate Limit: ${rateLimit.remaining}/${rateLimit.limit} remaining`);
    console.log(`   Resets at: ${rateLimit.reset.toLocaleTimeString()}`);
    
  } catch (error) {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  }
}

syncPrebidClean();