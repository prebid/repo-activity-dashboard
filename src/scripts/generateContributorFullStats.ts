import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

interface ContributorStats {
  byContributor: {
    [contributor: string]: {
      weekly: Record<string, {
        prsAuthored: number;
        reviewsGiven: number;
        commitsMade: number;
        weekStart?: string;
      }>;
      monthly: Record<string, {
        prsAuthored: number;
        reviewsGiven: number;
        commitsMade: number;
      }>;
      yearly: Record<string, {
        prsAuthored: number;
        reviewsGiven: number;
        commitsMade: number;
      }>;
      repoTotals: Record<string, [number, number, number]>; // [authored, reviews, commits]
      totals: {
        prsAuthored: number;
        reviewsGiven: number;
        commitsMade: number;
        firstActivity: string | null;
        lastActivity: string | null;
        activeWeeks: number;
        activeMonths: number;
        repositories: string[];
      };
    };
  };
  metadata: {
    generated: string;
    totalContributors: number;
    methodology: {
      prsAuthored: string;
      reviewsGiven: string;
      commitsMade: string;
    };
  };
}

interface PRData {
  number: number;
  author: { login: string };
  reviewers?: Array<{ login: string }>;
  commitAuthors?: Map<string, number> | { [key: string]: number };
  dateUpdated?: string;
  dateMerged?: string;
  merged_at?: string | null;
  updated_at?: string;
  created_at?: string;
  dateCreated?: string;
}

const STORE_DIR = './store/repos';
const OUTPUT_FILE = './contributor-stats.json';

const REPOS = [
  'prebid-js',
  'prebid-server', 
  'prebid-server-java',
  'prebid-mobile-ios',
  'prebid-mobile-android',
  'prebid-github-io'
];

function getWeekKey(date: Date): string {
  const year = date.getFullYear();
  const week = Math.floor((date.getTime() - new Date(year, 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));
  return `${year}-W${String(week).padStart(2, '0')}`;
}

function getWeekStart(date: Date): string {
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
  const weekStart = new Date(date.setDate(diff));
  return weekStart.toISOString().split('T')[0];
}

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function getYearKey(date: Date): string {
  return String(date.getFullYear());
}

function processRepository(repoName: string, stats: ContributorStats['byContributor']): void {
  const repoPath = join(STORE_DIR, repoName);
  
  if (!existsSync(repoPath)) {
    console.log(`  ⚠️  Repository ${repoName} not found in store`);
    return;
  }
  
  // Helper to update contributor stats
  function updateContributorStats(
    login: string, 
    date: Date, 
    type: 'authored' | 'reviewed' | 'committed',
    commitCount: number = 1
  ) {
    if (!stats[login]) {
      stats[login] = {
        weekly: {},
        monthly: {},
        yearly: {},
        repoTotals: {},
        totals: {
          prsAuthored: 0,
          reviewsGiven: 0,
          commitsMade: 0,
          firstActivity: null,
          lastActivity: null,
          activeWeeks: 0,
          activeMonths: 0,
          repositories: []
        }
      };
    }
    
    const contributor = stats[login];
    const weekKey = getWeekKey(date);
    const monthKey = getMonthKey(date);
    const yearKey = getYearKey(date);
    const dateStr = date.toISOString().split('T')[0];
    
    // Initialize periods if needed
    if (!contributor.weekly[weekKey]) {
      contributor.weekly[weekKey] = {
        prsAuthored: 0,
        reviewsGiven: 0,
        commitsMade: 0,
        weekStart: getWeekStart(date)
      };
    }
    if (!contributor.monthly[monthKey]) {
      contributor.monthly[monthKey] = {
        prsAuthored: 0,
        reviewsGiven: 0,
        commitsMade: 0
      };
    }
    if (!contributor.yearly[yearKey]) {
      contributor.yearly[yearKey] = {
        prsAuthored: 0,
        reviewsGiven: 0,
        commitsMade: 0
      };
    }
    if (!contributor.repoTotals[repoName]) {
      contributor.repoTotals[repoName] = [0, 0, 0];
    }
    
    // Update counts based on type
    if (type === 'authored') {
      contributor.weekly[weekKey].prsAuthored++;
      contributor.monthly[monthKey].prsAuthored++;
      contributor.yearly[yearKey].prsAuthored++;
      contributor.repoTotals[repoName][0]++;
      contributor.totals.prsAuthored++;
    } else if (type === 'reviewed') {
      contributor.weekly[weekKey].reviewsGiven++;
      contributor.monthly[monthKey].reviewsGiven++;
      contributor.yearly[yearKey].reviewsGiven++;
      contributor.repoTotals[repoName][1]++;
      contributor.totals.reviewsGiven++;
    } else if (type === 'committed') {
      contributor.weekly[weekKey].commitsMade += commitCount;
      contributor.monthly[monthKey].commitsMade += commitCount;
      contributor.yearly[yearKey].commitsMade += commitCount;
      contributor.repoTotals[repoName][2] += commitCount;
      contributor.totals.commitsMade += commitCount;
    }
    
    // Update activity dates
    if (!contributor.totals.firstActivity || dateStr < contributor.totals.firstActivity) {
      contributor.totals.firstActivity = dateStr;
    }
    if (!contributor.totals.lastActivity || dateStr > contributor.totals.lastActivity) {
      contributor.totals.lastActivity = dateStr;
    }
    
    // Track repository
    if (!contributor.totals.repositories.includes(repoName)) {
      contributor.totals.repositories.push(repoName);
    }
  }
  
  // Process open PRs
  const openPRsPath = join(repoPath, 'open-prs.json');
  if (existsSync(openPRsPath)) {
    const data = JSON.parse(readFileSync(openPRsPath, 'utf-8'));
    const prs = data.items || data.prs || data;
    
    for (const pr of prs) {
      if (!pr.author?.login) continue;
      
      const date = new Date(pr.dateCreated || pr.created_at || pr.dateUpdated || pr.updated_at);
      
      // Count as authored PR
      updateContributorStats(pr.author.login, date, 'authored');
      
      // Count reviewers
      if (pr.reviewers && Array.isArray(pr.reviewers)) {
        for (const reviewer of pr.reviewers) {
          if (reviewer.login) {
            updateContributorStats(reviewer.login, date, 'reviewed');
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
        
        // Count as authored PR
        updateContributorStats(pr.author.login, mergedDate, 'authored');
        
        // Count reviewers
        if (pr.reviewers && Array.isArray(pr.reviewers)) {
          for (const reviewer of pr.reviewers) {
            if (reviewer.login) {
              updateContributorStats(reviewer.login, mergedDate, 'reviewed');
            }
          }
        }
        
        // Count commit authors
        if (pr.commitAuthors) {
          const commitAuthors = pr.commitAuthors;
          const entries = commitAuthors instanceof Map 
            ? Array.from(commitAuthors.entries())
            : Object.entries(commitAuthors);
            
          for (const [, commitData] of entries) {
            // commitData is an object with {identifier, displayName, count, isGitHubUser}
            if (commitData && typeof commitData === 'object' && commitData.displayName && commitData.count) {
              updateContributorStats(commitData.displayName, mergedDate, 'committed', commitData.count);
            }
          }
        }
      }
    }
  }
}

async function main() {
  console.log('🔄 Generating comprehensive contributor statistics...\n');
  console.log('Methodology:');
  console.log('  - PRs Authored: All PRs created by the user (open + merged)');
  console.log('  - Reviews Given: PRs where user was a reviewer');
  console.log('  - Commits Made: Sum of commits authored by user in merged PRs\n');
  
  const stats: ContributorStats = {
    byContributor: {},
    metadata: {
      generated: new Date().toISOString(),
      totalContributors: 0,
      methodology: {
        prsAuthored: "All PRs created by the user (open + merged)",
        reviewsGiven: "PRs where user was a reviewer",
        commitsMade: "Sum of commits authored by user in merged PRs"
      }
    }
  };
  
  // Process each repository
  for (const repo of REPOS) {
    console.log(`📊 Processing ${repo}...`);
    processRepository(repo, stats.byContributor);
    console.log(`  ✅ Processed ${repo}`);
  }
  
  // Calculate active weeks/months for each contributor
  for (const contributor of Object.values(stats.byContributor)) {
    contributor.totals.activeWeeks = Object.keys(contributor.weekly).length;
    contributor.totals.activeMonths = Object.keys(contributor.monthly).length;
  }
  
  // Update metadata
  stats.metadata.totalContributors = Object.keys(stats.byContributor).length;
  
  // Write output
  writeFileSync(OUTPUT_FILE, JSON.stringify(stats, null, 2));
  
  console.log(`\n✅ Generated statistics for ${stats.metadata.totalContributors} contributors`);
  console.log(`💾 Saved to ${OUTPUT_FILE}`);
  
  // Show top contributors
  const topContributors = Object.entries(stats.byContributor)
    .map(([name, data]) => ({
      name,
      total: data.totals.prsAuthored + data.totals.reviewsGiven
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);
  
  console.log('\nTop 10 Contributors (by PRs authored + reviews given):');
  topContributors.forEach((c, i) => {
    const contributor = stats.byContributor[c.name];
    console.log(`  ${i + 1}. ${c.name}: ${contributor.totals.prsAuthored} PRs, ${contributor.totals.reviewsGiven} reviews, ${contributor.totals.commitsMade} commits`);
  });
}

main().catch(console.error);