import 'dotenv/config';
import { DataFetcher } from './src/services/dataFetcher.js';
import { loadRepositories } from './src/utils/repoParser.js';

async function testPrebidSync() {
  console.log('🧪 Testing Prebid.js sync\n');
  
  try {
    const repositories = loadRepositories();
    const prebidRepo = repositories.find(r => r.name === 'Prebid.js');
    
    if (!prebidRepo) {
      console.error('Prebid.js repository not found in repos.json');
      return;
    }
    
    console.log(`Found repository: ${prebidRepo.owner}/${prebidRepo.repo}\n`);
    
    // Use conservative delays: 1.5s between API calls, 3s between batches
    const fetcher = new DataFetcher(process.env.GITHUB_TOKEN!, './store', 1500, 3000);
    
    console.log('Starting sync with sequential processing...\n');
    console.log('Config: 1.5s between API calls, 3s pause every 10 PRs / 20 issues\n');
    await fetcher.syncRepository(prebidRepo);
    
    console.log('\n📂 Loading stored data to verify...');
    const storedData = await fetcher.loadRepositoryData(prebidRepo);
    
    console.log(`\n📊 Summary:`);
    console.log(`  Open PRs: ${storedData.prs.length}`);
    console.log(`  Open Issues: ${storedData.issues.length}`);
    
    if (storedData.prs.length > 0) {
      console.log('\n📝 Sample Open PRs:');
      storedData.prs.slice(0, 3).forEach(pr => {
        console.log(`  - #${pr.number}: ${pr.title}`);
        console.log(`    Author: ${pr.author}, Status: ${pr.status}`);
      });
    }
    
    if (storedData.issues.length > 0) {
      console.log('\n📋 Sample Open Issues:');
      storedData.issues.slice(0, 3).forEach(issue => {
        console.log(`  - #${issue.number}: ${issue.title}`);
        console.log(`    Author: ${issue.author}, Status: ${issue.status}`);
      });
    }
    
    console.log('\n✅ Test completed successfully!');
    console.log('📁 Check ./store/repos/prebid-js/ for stored files');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testPrebidSync();