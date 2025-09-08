import fs from 'fs/promises';
import path from 'path';
import { PRData } from './types/index.js';
import { MonthlyStorage } from './types/storage.js';

interface WeekStats {
  merged: number;
  created: number;
  commits: number;
  weekStart: string;
}

interface MonthStats {
  merged: number;
  created: number;
  commits: number;
}

interface YearStats {
  merged: number;
  created: number;
  commits: number;
}

interface RepoStats {
  weekly: Record<string, WeekStats>;
  monthly: Record<string, MonthStats>;
  yearly: Record<string, YearStats>;
  totals: {
    merged: number;
    created: number;
    commits: number;
  };
}

interface StatsOutput {
  byRepository: Record<string, RepoStats>;
  allRepositories: RepoStats;
  metadata: {
    generatedAt: string;
    repositories: string[];
    dateRange: {
      earliest: string | null;
      latest: string | null;
    };
    totalPRs: number;
    totalCommits: number;
  };
}

// Get ISO week number and year
function getISOWeek(date: Date): { year: number; week: number } {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNumber = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  const year = d.getFullYear();
  
  // Handle week 53 that belongs to next year
  if (weekNumber === 53) {
    const nextYearWeek1 = new Date(year + 1, 0, 4);
    const daysToMonday = (8 - nextYearWeek1.getDay()) % 7;
    const week1Start = new Date(year + 1, 0, 4 - daysToMonday);
    if (d >= week1Start) {
      return { year: year + 1, week: 1 };
    }
  }
  
  return { year, week: weekNumber };
}

// Get the Monday of the ISO week
function getWeekStart(year: number, week: number): string {
  const jan4 = new Date(year, 0, 4);
  const daysToMonday = (8 - jan4.getDay()) % 7;
  const week1Start = new Date(year, 0, 4 - daysToMonday);
  const weekStart = new Date(week1Start);
  weekStart.setDate(week1Start.getDate() + (week - 1) * 7);
  return weekStart.toISOString().split('T')[0];
}

// Parse date string to Date object
function parseDate(dateStr: string): Date {
  return new Date(dateStr);
}

async function generateStats(): Promise<void> {
  const storeDir = path.join(process.cwd(), 'store');
  const reposDir = path.join(storeDir, 'repos');
  
  const stats: StatsOutput = {
    byRepository: {},
    allRepositories: {
      weekly: {},
      monthly: {},
      yearly: {},
      totals: {
        merged: 0,
        created: 0,
        commits: 0
      }
    },
    metadata: {
      generatedAt: new Date().toISOString(),
      repositories: [],
      dateRange: {
        earliest: null,
        latest: null
      },
      totalPRs: 0,
      totalCommits: 0
    }
  };

  try {
    // Get all repository directories
    const repoDirs = await fs.readdir(reposDir);
    
    let earliestDate: Date | null = null;
    let latestDate: Date | null = null;
    let totalFiles = 0;
    
    // Process each repository
    for (const repoDir of repoDirs) {
      const mergedDir = path.join(reposDir, repoDir, 'merged');
      
      // Check if merged directory exists
      try {
        await fs.access(mergedDir);
      } catch {
        console.log(`No merged directory for ${repoDir}, skipping...`);
        continue;
      }
      
      // Get all monthly files for this repository
      const files = await fs.readdir(mergedDir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));
      
      if (jsonFiles.length === 0) {
        console.log(`No merged PR files for ${repoDir}`);
        continue;
      }
      
      totalFiles += jsonFiles.length;
      console.log(`Processing ${jsonFiles.length} monthly files for ${repoDir}`);
      
      // Process each monthly file
      for (const file of jsonFiles) {
        const filePath = path.join(mergedDir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const monthlyData = JSON.parse(content);
        
        // Extract PRs from the items array (they come as plain objects from JSON)
        const repoPRs: any[] = monthlyData.items || [];
        
        const repoName = repoDir; // Use directory name as repository name
        // Initialize repository stats if not exists
        if (!stats.byRepository[repoName]) {
          stats.byRepository[repoName] = {
            weekly: {},
            monthly: {},
            yearly: {},
            totals: {
              merged: 0,
              created: 0,
              commits: 0
            }
          };
        }
        
        // Process each PR in the array
        for (const pr of repoPRs) {
          stats.metadata.totalPRs++;
          
          // Calculate total commits from commitAuthors
          let prCommits = 0;
          if (pr.commitAuthors) {
            for (const author of Object.values(pr.commitAuthors)) {
              prCommits += (author as any).count || 0;
            }
          }
          stats.metadata.totalCommits += prCommits;
          
          // Update repository totals
          stats.byRepository[repoName].totals.merged++;
          stats.byRepository[repoName].totals.commits += prCommits;
          
          // Update global totals
          stats.allRepositories.totals.merged++;
          stats.allRepositories.totals.commits += prCommits;
          
          // Parse dates (they're strings in the JSON)
          const mergedDate = parseDate(pr.dateMerged);
          const createdDate = parseDate(pr.dateCreated);
          
          // Update date range
          if (!earliestDate || createdDate < earliestDate) {
            earliestDate = createdDate;
          }
          if (!latestDate || mergedDate > latestDate) {
            latestDate = mergedDate;
          }
          
          // Get time periods for merged date
          const mergedWeek = getISOWeek(mergedDate);
          const mergedWeekKey = `${mergedWeek.year}-W${String(mergedWeek.week).padStart(2, '0')}`;
          const mergedMonth = `${mergedDate.getFullYear()}-${String(mergedDate.getMonth() + 1).padStart(2, '0')}`;
          const mergedYear = String(mergedDate.getFullYear());
          
          // Get time periods for created date
          const createdWeek = getISOWeek(createdDate);
          const createdWeekKey = `${createdWeek.year}-W${String(createdWeek.week).padStart(2, '0')}`;
          const createdMonth = `${createdDate.getFullYear()}-${String(createdDate.getMonth() + 1).padStart(2, '0')}`;
          const createdYear = String(createdDate.getFullYear());
          
          // Update repository weekly stats for merged
          if (!stats.byRepository[repoName].weekly[mergedWeekKey]) {
            stats.byRepository[repoName].weekly[mergedWeekKey] = {
              merged: 0,
              created: 0,
              commits: 0,
              weekStart: getWeekStart(mergedWeek.year, mergedWeek.week)
            };
          }
          stats.byRepository[repoName].weekly[mergedWeekKey].merged++;
          stats.byRepository[repoName].weekly[mergedWeekKey].commits += prCommits;
          
          // Update repository weekly stats for created
          if (!stats.byRepository[repoName].weekly[createdWeekKey]) {
            stats.byRepository[repoName].weekly[createdWeekKey] = {
              merged: 0,
              created: 0,
              commits: 0,
              weekStart: getWeekStart(createdWeek.year, createdWeek.week)
            };
          }
          stats.byRepository[repoName].weekly[createdWeekKey].created++;
          stats.byRepository[repoName].totals.created++;
          stats.allRepositories.totals.created++;
          
          // Update repository monthly stats
          if (!stats.byRepository[repoName].monthly[mergedMonth]) {
            stats.byRepository[repoName].monthly[mergedMonth] = { merged: 0, created: 0, commits: 0 };
          }
          stats.byRepository[repoName].monthly[mergedMonth].merged++;
          stats.byRepository[repoName].monthly[mergedMonth].commits += prCommits;
          
          if (!stats.byRepository[repoName].monthly[createdMonth]) {
            stats.byRepository[repoName].monthly[createdMonth] = { merged: 0, created: 0, commits: 0 };
          }
          stats.byRepository[repoName].monthly[createdMonth].created++;
          
          // Update repository yearly stats
          if (!stats.byRepository[repoName].yearly[mergedYear]) {
            stats.byRepository[repoName].yearly[mergedYear] = { merged: 0, created: 0, commits: 0 };
          }
          stats.byRepository[repoName].yearly[mergedYear].merged++;
          stats.byRepository[repoName].yearly[mergedYear].commits += prCommits;
          
          if (!stats.byRepository[repoName].yearly[createdYear]) {
            stats.byRepository[repoName].yearly[createdYear] = { merged: 0, created: 0, commits: 0 };
          }
          stats.byRepository[repoName].yearly[createdYear].created++;
          
          // Update aggregate weekly stats
          if (!stats.allRepositories.weekly[mergedWeekKey]) {
            stats.allRepositories.weekly[mergedWeekKey] = {
              merged: 0,
              created: 0,
              commits: 0,
              weekStart: getWeekStart(mergedWeek.year, mergedWeek.week)
            };
          }
          stats.allRepositories.weekly[mergedWeekKey].merged++;
          stats.allRepositories.weekly[mergedWeekKey].commits += prCommits;
          
          if (!stats.allRepositories.weekly[createdWeekKey]) {
            stats.allRepositories.weekly[createdWeekKey] = {
              merged: 0,
              created: 0,
              commits: 0,
              weekStart: getWeekStart(createdWeek.year, createdWeek.week)
            };
          }
          stats.allRepositories.weekly[createdWeekKey].created++;
          
          // Update aggregate monthly stats
          if (!stats.allRepositories.monthly[mergedMonth]) {
            stats.allRepositories.monthly[mergedMonth] = { merged: 0, created: 0, commits: 0 };
          }
          stats.allRepositories.monthly[mergedMonth].merged++;
          stats.allRepositories.monthly[mergedMonth].commits += prCommits;
          
          if (!stats.allRepositories.monthly[createdMonth]) {
            stats.allRepositories.monthly[createdMonth] = { merged: 0, created: 0, commits: 0 };
          }
          stats.allRepositories.monthly[createdMonth].created++;
          
          // Update aggregate yearly stats
          if (!stats.allRepositories.yearly[mergedYear]) {
            stats.allRepositories.yearly[mergedYear] = { merged: 0, created: 0, commits: 0 };
          }
          stats.allRepositories.yearly[mergedYear].merged++;
          stats.allRepositories.yearly[mergedYear].commits += prCommits;
          
          if (!stats.allRepositories.yearly[createdYear]) {
            stats.allRepositories.yearly[createdYear] = { merged: 0, created: 0, commits: 0 };
          }
          stats.allRepositories.yearly[createdYear].created++;
        }
      }
    }
    
    console.log(`\nProcessed ${totalFiles} total monthly files`);
    
    // Update metadata
    stats.metadata.repositories = Object.keys(stats.byRepository).sort();
    stats.metadata.dateRange.earliest = earliestDate ? earliestDate.toISOString().split('T')[0] : null;
    stats.metadata.dateRange.latest = latestDate ? latestDate.toISOString().split('T')[0] : null;
    
    // Sort all the keys for better readability
    for (const repo of Object.values(stats.byRepository)) {
      repo.weekly = Object.fromEntries(Object.entries(repo.weekly).sort());
      repo.monthly = Object.fromEntries(Object.entries(repo.monthly).sort());
      repo.yearly = Object.fromEntries(Object.entries(repo.yearly).sort());
    }
    stats.allRepositories.weekly = Object.fromEntries(Object.entries(stats.allRepositories.weekly).sort());
    stats.allRepositories.monthly = Object.fromEntries(Object.entries(stats.allRepositories.monthly).sort());
    stats.allRepositories.yearly = Object.fromEntries(Object.entries(stats.allRepositories.yearly).sort());
    
    // Write to file
    const outputPath = path.join(process.cwd(), 'repo-stats.json');
    await fs.writeFile(outputPath, JSON.stringify(stats, null, 2));
    
    console.log(`\nStats generated successfully!`);
    console.log(`- Total PRs processed: ${stats.metadata.totalPRs}`);
    console.log(`- Total commits: ${stats.metadata.totalCommits}`);
    console.log(`- Repositories: ${stats.metadata.repositories.length}`);
    console.log(`- Date range: ${stats.metadata.dateRange.earliest} to ${stats.metadata.dateRange.latest}`);
    console.log(`- Output saved to: ${outputPath}`);
    
    // Print summary per repository
    console.log('\nRepository Summary:');
    for (const [repo, repoStats] of Object.entries(stats.byRepository)) {
      console.log(`  ${repo}:`);
      console.log(`    - PRs merged: ${repoStats.totals.merged}`);
      console.log(`    - PRs created: ${repoStats.totals.created}`);
      console.log(`    - Total commits: ${repoStats.totals.commits}`);
    }
    
  } catch (error) {
    console.error('Error generating stats:', error);
    throw error;
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generateStats().catch(console.error);
}

export { generateStats };