import 'dotenv/config';
import { DataFetcher } from './services/dataFetcher.js';
import { StorageService } from './services/storageService.js';
import { loadRepositories } from './utils/repoParser.js';
import { Repository } from './types/index.js';

export function validateEnvironment() {
  const requiredEnvVars = ['GITHUB_TOKEN'];
  const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing.join(', '));
    console.error('💡 Copy .env.example to .env and fill in your values');
    return false;
  }
  return true;
}

export async function fetchAllRepositories(options = {}) {
  if (!validateEnvironment()) {
    throw new Error('Missing required environment variables');
  }
  
  const fetcher = new DataFetcher(process.env.GITHUB_TOKEN!, './data');
  
  return await fetcher.fetchAllRepositories({
    state: 'all',
    limit: 100,
    parallel: true,
    maxConcurrent: 3,
    saveToStorage: true,
    incrementalUpdate: true,
    ...options
  });
}

export async function fetchNewItemsOnly(repo?: Repository) {
  if (!validateEnvironment()) {
    throw new Error('Missing required environment variables');
  }
  
  const fetcher = new DataFetcher(process.env.GITHUB_TOKEN!, './data');
  const repositories = repo ? [repo] : loadRepositories();
  
  let totalNew = { prs: 0, issues: 0 };
  
  for (const repository of repositories) {
    const result = await fetcher.fetchNewItemsOnly(repository);
    totalNew.prs += result.newPRs;
    totalNew.issues += result.newIssues;
  }
  
  return totalNew;
}

export async function loadFromStorage(repoName?: string, startDate?: Date, endDate?: Date) {
  const fetcher = new DataFetcher(process.env.GITHUB_TOKEN || '', './data');
  const repositories = loadRepositories();
  
  if (repoName) {
    const repo = repositories.find(r => r.name === repoName);
    if (!repo) {
      throw new Error(`Repository "${repoName}" not found`);
    }
    return await fetcher.loadFromStorage(repo, startDate, endDate);
  }
  
  const allData = [];
  for (const repo of repositories) {
    const data = await fetcher.loadFromStorage(repo, startDate, endDate);
    allData.push(data);
  }
  return allData;
}

export async function getStorageService() {
  return new StorageService('./data');
}

export { DataFetcher, StorageService, loadRepositories };