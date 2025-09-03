import 'dotenv/config';
import { GitHubService } from './dist/services/githubService.js';
import { StorageService } from './dist/services/storageService.js';

async function fetchMergedPrebidPRs() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error('GITHUB_TOKEN environment variable is required');
  }

  const githubService = new GitHubService(token, 5);
  const storageService = new StorageService('./store');
  
  const prebidRepo = {
    name: 'prebid-js',
    owner: 'prebid',
    repo: 'Prebid.js',
    url: 'https://github.com/prebid/Prebid.js'
  };
  
  console.log('🚀 Fetching merged PRs for Prebid.js...');
  console.log('📅 Using since: 2020-01-01 (to capture all 2023+ merged PRs)\n');
  
  try {
    const since2020 = new Date('2020-01-01T00:00:00Z');
    let processedCount = 0;
    let allMergedPRs = [];
    
    // Fetch merged PRs with progress updates
    const mergedPRs = await githubService.fetchMergedPRs(prebidRepo, since2020, {
      onBatch: async (batch) => {
        processedCount += batch.length;
        allMergedPRs = [...allMergedPRs, ...batch];
        console.log(`   Processed ${processedCount} merged PRs...`);
        // Save incrementally to avoid memory issues
        await storageService.saveMergedPRs(prebidRepo, allMergedPRs);
      }
    });
    
    // Final save to ensure everything is stored
    await storageService.saveMergedPRs(prebidRepo, mergedPRs);
    
    // Quick summary
    const prsByYear = new Map();
    for (const pr of mergedPRs) {
      if (pr.dateMerged) {
        const year = pr.dateMerged.getFullYear();
        prsByYear.set(year, (prsByYear.get(year) || 0) + 1);
      }
    }
    
    console.log(`\n✅ Completed! Total: ${mergedPRs.length} merged PRs`);
    console.log('\nBreakdown by year:');
    Array.from(prsByYear.entries())
      .sort((a, b) => a[0] - b[0])
      .forEach(([year, count]) => {
        if (year >= 2023) {
          console.log(`  ${year}: ${count} PRs (saved to store/repos/prebid-js/merged/${year}-XX.json files)`);
        } else {
          console.log(`  ${year}: ${count} PRs (fetched but not saved - before 2023)`);
        }
      });
    
    // Show sample of data structure for verification
    if (mergedPRs.length > 0) {
      const samplePR = mergedPRs.find(pr => pr.dateMerged?.getFullYear() === 2024) || mergedPRs[0];
      console.log('\nSample PR data structure:');
      console.log('  Title:', samplePR.title);
      console.log('  Number:', samplePR.number);
      console.log('  Author:', samplePR.author);
      console.log('  Assignees:', samplePR.assignees);
      console.log('  Reviewers (new structure):');
      if (samplePR.reviewers && samplePR.reviewers.length > 0) {
        samplePR.reviewers.slice(0, 3).forEach(r => {
          console.log(`    - ${r.login}: ${r.state}`);
        });
      }
      console.log('  Commit Authors (with ID correlation):');
      if (samplePR.commitAuthors) {
        const authors = Array.from(samplePR.commitAuthors.values()).slice(0, 3);
        authors.forEach(a => {
          console.log(`    - ${a.displayName}: ${a.count} commits (${a.isGitHubUser ? 'GitHub user ID: ' + a.identifier : 'Git name'})`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Failed:', error);
  }
}

fetchMergedPrebidPRs();