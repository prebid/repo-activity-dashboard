import { readFileSync } from 'fs';
import { Repository } from '../types/index.js';

export function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  if (!match) return null;
  
  return {
    owner: match[1],
    repo: match[2].replace(/\.git$/, '')
  };
}

export function loadRepositories(filePath: string = './repos.json'): Repository[] {
  try {
    const data = readFileSync(filePath, 'utf-8');
    const repoGroups = JSON.parse(data);
    
    const repositories: Repository[] = [];
    
    for (const [category, repos] of Object.entries(repoGroups)) {
      for (const repoInfo of repos as any[]) {
        const parsed = parseGitHubUrl(repoInfo.url);
        if (parsed) {
          repositories.push({
            owner: parsed.owner,
            repo: parsed.repo,
            name: repoInfo.name,
            category,
            url: repoInfo.url
          });
        }
      }
    }
    
    return repositories;
  } catch (error) {
    console.error('Error loading repositories:', error);
    throw error;
  }
}

export function getRepositoryByName(repositories: Repository[], name: string): Repository | undefined {
  return repositories.find(repo => repo.name === name);
}

export function getRepositoriesByCategory(repositories: Repository[], category: string): Repository[] {
  return repositories.filter(repo => repo.category === category);
}