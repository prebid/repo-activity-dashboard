import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

interface ContributorStats {
  [contributor: string]: {
    [repo: string]: {
      w?: { [week: string]: [number, number, number, number, number] };  // week data [openedPRs, mergedPRs, reviewedPRs, mergedCommits, openedIssues]
      m?: { [month: string]: [number, number, number, number, number] }; // month data  
      y?: { [year: string]: [number, number, number, number, number] };  // year data
    }
  }
}

interface PRData {
  number: number;
  author: { login: string };
  reviewers?: Array<{ login: string }>;
  commitAuthors?: Map<string, number> | { [key: string]: number };
  dateUpdated?: string;
  merged_at?: string | null;
  updated_at?: string;
  created_at?: string;
}

interface IssueData {
  number: number;
  author: { login: string };
  dateUpdated?: string;
  updated_at?: string;
  created_at?: string;
  closed_at?: string;
}

const STORE_DIR = './store/repos';
const OUTPUT_FILE = './contributor-repo-timeline.json';

const REPOS = [
  'prebid-js',
  'prebid-server', 
  'prebid-server-java',
  'prebid-mobile-ios',
  'prebid-mobile-android',
  'prebid-github-io'
];

const REPO_DISPLAY_NAMES: Record<string, string> = {
  'prebid-js': 'prebid-js',  // Keep as-is for data compatibility
  'prebid-server': 'prebid-server',
  'prebid-server-java': 'prebid-server-java',
  'prebid-mobile-ios': 'prebid-mobile-ios',
  'prebid-mobile-android': 'prebid-mobile-android',
  'prebid-github-io': 'prebid-github-io'
};

function getWeekKey(date: Date): string {
  const year = date.getFullYear();
  const week = Math.floor((date.getTime() - new Date(year, 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));
  return `${year}-${String(week).padStart(2, '0')}`; // Format: 2025-13
}

function getMonthKey(date: Date): string {
  const year = String(date.getFullYear()).slice(-2); // Last 2 digits of year
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`; // Format: 25-03
}

function getYearKey(date: Date): string {
  return String(date.getFullYear()).slice(-2); // Format: 25
}

function processRepository(repoName: string): ContributorStats {
  const stats: ContributorStats = {};
  const repoPath = join(STORE_DIR, repoName);
  
  if (!existsSync(repoPath)) {
    console.log(`  ⚠️  Repository ${repoName} not found in store`);
    return stats;
  }

  const displayName = REPO_DISPLAY_NAMES[repoName];
  
  // Helper to add stats
  function addStat(contributor: string, date: Date, statIndex: number, value: number = 1) {
    if (!stats[contributor]) stats[contributor] = {};
    if (!stats[contributor][displayName]) {
      stats[contributor][displayName] = {
        w: {},
        m: {},
        y: {}
      };
    }
    
    const weekKey = getWeekKey(date);
    const monthKey = getMonthKey(date);
    const yearKey = getYearKey(date);
    
    // Initialize arrays if needed
    if (!stats[contributor][displayName].w![weekKey]) {
      stats[contributor][displayName].w![weekKey] = [0, 0, 0, 0, 0];
    }
    if (!stats[contributor][displayName].m![monthKey]) {
      stats[contributor][displayName].m![monthKey] = [0, 0, 0, 0, 0];
    }
    if (!stats[contributor][displayName].y![yearKey]) {
      stats[contributor][displayName].y![yearKey] = [0, 0, 0, 0, 0];
    }
    
    // Add the stat
    stats[contributor][displayName].w![weekKey][statIndex] += value;
    stats[contributor][displayName].m![monthKey][statIndex] += value;
    stats[contributor][displayName].y![yearKey][statIndex] += value;
  }
  
  // Process open PRs
  const openPRsPath = join(repoPath, 'open-prs.json');
  if (existsSync(openPRsPath)) {
    const data = JSON.parse(readFileSync(openPRsPath, 'utf-8'));
    const prs = data.items || data.prs || data;
    
    for (const pr of prs) {
      if (!pr.author?.login) continue;
      
      const date = new Date(pr.dateUpdated || pr.updated_at || pr.created_at);
      
      // Count as opened PR (index 0)
      addStat(pr.author.login, date, 0);
      
      // Count reviewers (index 2)
      if (pr.reviewers && Array.isArray(pr.reviewers)) {
        for (const reviewer of pr.reviewers) {
          if (reviewer.login) {
            addStat(reviewer.login, date, 2);
          }
        }
      }
    }
  }
  
  // Process merged PRs
  const mergedPath = join(repoPath, 'merged');
  if (existsSync(mergedPath)) {
    const mergedFiles = readdirSync(mergedPath).filter(f => f.endsWith('.json'));
    
    for (const file of mergedFiles) {
      const data = JSON.parse(readFileSync(join(mergedPath, file), 'utf-8'));
      const prs = data.items || data.prs || data;
      
      for (const pr of prs) {
        if (!pr.author?.login) continue;
        
        const mergedDate = new Date(pr.dateMerged || pr.merged_at || pr.dateUpdated || pr.updated_at);
        
        // Count as both opened (index 0) and merged (index 1)
        addStat(pr.author.login, mergedDate, 0);
        addStat(pr.author.login, mergedDate, 1);
        
        // Count reviewers (index 2)
        if (pr.reviewers && Array.isArray(pr.reviewers)) {
          for (const reviewer of pr.reviewers) {
            if (reviewer.login) {
              addStat(reviewer.login, mergedDate, 2);
            }
          }
        }
        
        // Count commit authors (index 3)
        if (pr.commitAuthors) {
          const commitAuthors = pr.commitAuthors;
          const entries = commitAuthors instanceof Map 
            ? Array.from(commitAuthors.entries())
            : Object.entries(commitAuthors);
            
          for (const [, commitData] of entries) {
            // commitData is an object with {identifier, displayName, count, isGitHubUser}
            if (commitData && typeof commitData === 'object' && commitData.displayName && commitData.count) {
              addStat(commitData.displayName, mergedDate, 3, commitData.count);
            }
          }
        }
      }
    }
  }
  
  // Process open issues
  const openIssuesPath = join(repoPath, 'open-issues.json');
  if (existsSync(openIssuesPath)) {
    const data = JSON.parse(readFileSync(openIssuesPath, 'utf-8'));
    const issues = data.items || data.issues || data;
    
    for (const issue of issues) {
      // Issues have author as a string, not an object
      const author = typeof issue.author === 'string' ? issue.author : issue.author?.login;
      if (!author) continue;
      
      const date = new Date(issue.dateUpdated || issue.updated_at || issue.created_at);
      
      // Count as opened issue (index 4)
      addStat(author, date, 4);
    }
  }
  
  // Process closed issues
  const closedPath = join(repoPath, 'closed');
  if (existsSync(closedPath)) {
    const closedFiles = readdirSync(closedPath).filter(f => f.endsWith('.json'));
    
    for (const file of closedFiles) {
      const data = JSON.parse(readFileSync(join(closedPath, file), 'utf-8'));
      const issues = data.items || data.issues || data;
      
      for (const issue of issues) {
        // Issues have author as a string, not an object
        const author = typeof issue.author === 'string' ? issue.author : issue.author?.login;
        if (!author) continue;
        
        const closedDate = new Date(issue.dateClosed || issue.closed_at || issue.dateUpdated || issue.updated_at);
        
        // Count as opened issue (index 4) - issues that are closed were still opened by the author
        addStat(author, closedDate, 4);
      }
    }
  }
  
  return stats;
}

function mergeStats(allStats: ContributorStats, repoStats: ContributorStats): void {
  for (const [contributor, repos] of Object.entries(repoStats)) {
    if (!allStats[contributor]) {
      allStats[contributor] = {};
    }
    
    for (const [repo, timeData] of Object.entries(repos)) {
      if (!allStats[contributor][repo]) {
        allStats[contributor][repo] = timeData;
      } else {
        // Merge week data
        if (timeData.w) {
          if (!allStats[contributor][repo].w) allStats[contributor][repo].w = {};
          for (const [week, values] of Object.entries(timeData.w)) {
            if (!allStats[contributor][repo].w![week]) {
              allStats[contributor][repo].w![week] = [0, 0, 0, 0, 0];
            }
            for (let i = 0; i < 5; i++) {
              allStats[contributor][repo].w![week][i] += values[i] || 0;
            }
          }
        }
        
        // Merge month data
        if (timeData.m) {
          if (!allStats[contributor][repo].m) allStats[contributor][repo].m = {};
          for (const [month, values] of Object.entries(timeData.m)) {
            if (!allStats[contributor][repo].m![month]) {
              allStats[contributor][repo].m![month] = [0, 0, 0, 0, 0];
            }
            for (let i = 0; i < 5; i++) {
              allStats[contributor][repo].m![month][i] += values[i] || 0;
            }
          }
        }
        
        // Merge year data
        if (timeData.y) {
          if (!allStats[contributor][repo].y) allStats[contributor][repo].y = {};
          for (const [year, values] of Object.entries(timeData.y)) {
            if (!allStats[contributor][repo].y![year]) {
              allStats[contributor][repo].y![year] = [0, 0, 0, 0, 0];
            }
            for (let i = 0; i < 5; i++) {
              allStats[contributor][repo].y![year][i] += values[i] || 0;
            }
          }
        }
      }
    }
  }
}

async function main() {
  console.log('🔄 Generating contributor statistics with correct methodology...\n');
  console.log('Methodology:');
  console.log('  - [0] Opened PRs: All PRs authored by user (open + merged)');
  console.log('  - [1] Merged PRs: PRs authored by user that got merged');
  console.log('  - [2] Reviewed PRs: PRs where user was a reviewer');
  console.log('  - [3] Merged Commits: Sum of commits authored by user in merged PRs');
  console.log('  - [4] Opened Issues: All issues opened by user (open + closed)\n');
  
  const allStats: ContributorStats = {};
  
  for (const repo of REPOS) {
    console.log(`📊 Processing ${repo}...`);
    const repoStats = processRepository(repo);
    const contributorCount = Object.keys(repoStats).length;
    console.log(`  ✅ Found ${contributorCount} contributors`);
    mergeStats(allStats, repoStats);
  }
  
  // Create output structure matching existing format
  const output = {
    data: allStats
  };
  
  // Write output
  writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
  
  const totalContributors = Object.keys(allStats).length;
  console.log(`\n✅ Generated statistics for ${totalContributors} contributors`);
  console.log(`💾 Saved to ${OUTPUT_FILE}`);
}

main().catch(console.error);