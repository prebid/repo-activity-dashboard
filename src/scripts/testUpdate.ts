#!/usr/bin/env node
import { config } from 'dotenv';
import { DataFetcher } from '../services/dataFetcher';

config();

const repos: Record<string, any> = {
  'prebid-js': { owner: 'prebid', repo: 'Prebid.js', name: 'prebid-js', category: 'main', url: 'https://github.com/prebid/Prebid.js' },
  'prebid-server': { owner: 'prebid', repo: 'prebid-server', name: 'prebid-server', category: 'main', url: 'https://github.com/prebid/prebid-server' },
  'prebid-server-java': { owner: 'prebid', repo: 'prebid-server-java', name: 'prebid-server-java', category: 'main', url: 'https://github.com/prebid/prebid-server-java' },
  'prebid-mobile-android': { owner: 'prebid', repo: 'prebid-mobile-android', name: 'prebid-mobile-android', category: 'main', url: 'https://github.com/prebid/prebid-mobile-android' },
  'prebid-mobile-ios': { owner: 'prebid', repo: 'prebid-mobile-ios', name: 'prebid-mobile-ios', category: 'main', url: 'https://github.com/prebid/prebid-mobile-ios' },
  'prebid-github-io': { owner: 'prebid', repo: 'prebid.github.io', name: 'prebid-github-io', category: 'main', url: 'https://github.com/prebid/prebid.github.io' },
  'prebid-universal-creative': { owner: 'prebid', repo: 'prebid-universal-creative', name: 'prebid-universal-creative', category: 'main', url: 'https://github.com/prebid/prebid-universal-creative' }
};

async function updateRepo() {
  if (!process.env.GITHUB_TOKEN) {
    console.error('GITHUB_TOKEN not found in .env');
    process.exit(1);
  }

  const repoName = process.argv[2];
  if (!repoName) {
    console.error('Usage: npx tsx src/scripts/testUpdate.ts <repo-name>');
    console.error('\nAvailable repos:');
    Object.keys(repos).forEach(name => console.error(`  - ${name}`));
    process.exit(1);
  }

  const repo = repos[repoName];
  if (!repo) {
    console.error(`Unknown repo: ${repoName}`);
    console.error('\nAvailable repos:');
    Object.keys(repos).forEach(name => console.error(`  - ${name}`));
    process.exit(1);
  }

  const dataFetcher = new DataFetcher(process.env.GITHUB_TOKEN, 'store');

  console.log(`🔄 Incremental sync for ${repo.name}...`);
  console.log(`   Will use last sync date from sync-state.json\n`);

  await dataFetcher.incrementalSync(repo);

  console.log(`\n✅ ${repo.name} updated successfully!`);
}

updateRepo().catch(console.error);