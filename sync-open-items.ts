import 'dotenv/config';
import { DataFetcher } from './src/services/dataFetcher.js';
import { loadRepositories } from './src/utils/repoParser.js';

async function syncOpenItemsOnly() {
  console.log('🔍 Syncing only open items for all repositories\n');
  
  const repositories = loadRepositories();
  const fetcher = new DataFetcher(process.env.GITHUB_TOKEN!, './store', 5);
  
  for (let i = 0; i < repositories.length; i++) {
    const repo = repositories[i];
    console.log(`[${i + 1}/${repositories.length}] ${repo.name}`);
    
    try {
      // Only fetch open items, not historical data
      const openPRs = await fetcher['githubService'].fetchOpenPRs(repo);
      const openIssues = await fetcher['githubService'].fetchOpenIssues(repo);
      
      await fetcher['storageService'].saveOpenPRs(repo, openPRs);
      await fetcher['storageService'].saveOpenIssues(repo, openIssues);
      
      console.log(`  ✅ ${openPRs.length} open PRs, ${openIssues.length} open issues\n`);
    } catch (error) {
      console.error(`  ❌ Failed: ${error}\n`);
    }
  }
  
  console.log('✅ Open items sync complete!');
}

syncOpenItemsOnly();