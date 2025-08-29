import 'dotenv/config';
import { DataFetcher } from './services/dataFetcher.js';
import { StorageService } from './services/storageService.js';
import { loadRepositories } from './utils/repoParser.js';

export function validateEnvironment(): boolean {
  const requiredEnvVars = ['GITHUB_TOKEN'];
  const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing.join(', '));
    console.error('💡 Copy .env.example to .env and fill in your values');
    return false;
  }
  return true;
}

export async function syncAllRepositories(maxConcurrent: number = 3): Promise<void> {
  if (!validateEnvironment()) {
    throw new Error('Missing required environment variables');
  }
  
  const fetcher = new DataFetcher(process.env.GITHUB_TOKEN!, './store', maxConcurrent);
  await fetcher.syncAllRepositories();
}

export async function incrementalSync(repoName?: string, maxConcurrent: number = 3): Promise<void> {
  if (!validateEnvironment()) {
    throw new Error('Missing required environment variables');
  }
  
  const fetcher = new DataFetcher(process.env.GITHUB_TOKEN!, './store', maxConcurrent);
  const repositories = loadRepositories();
  
  if (repoName) {
    const repo = repositories.find(r => r.name === repoName);
    if (!repo) {
      throw new Error(`Repository "${repoName}" not found`);
    }
    await fetcher.incrementalSync(repo);
  } else {
    for (const repo of repositories) {
      await fetcher.incrementalSync(repo);
    }
  }
}

export async function loadStoredData(repoName: string) {
  const repositories = loadRepositories();
  const repo = repositories.find(r => r.name === repoName);
  
  if (!repo) {
    throw new Error(`Repository "${repoName}" not found`);
  }
  
  const fetcher = new DataFetcher('', './store');
  return await fetcher.loadRepositoryData(repo);
}

export { DataFetcher, StorageService, loadRepositories };