import fs from 'fs/promises';
import path from 'path';

// Types for internal tracking
interface RepoActivity {
  prsAuthored: number;
  reviewsApproved: number;
  commitsMade: number;
}

interface ContributorRepoStats {
  weekly: Record<string, Record<string, RepoActivity>>;  // week -> repo -> activity
  monthly: Record<string, Record<string, RepoActivity>>; // month -> repo -> activity
  yearly: Record<string, Record<string, RepoActivity>>;  // year -> repo -> activity
  repoTotals: Record<string, RepoActivity>;             // repo -> lifetime totals
  totals: {
    prsAuthored: number;
    reviewsApproved: number;
    commitsMade: number;
    firstActivity: string | null;
    lastActivity: string | null;
    activeWeeks: Set<string>;
    activeMonths: Set<string>;
    repositories: Set<string>;
  };
}

// Output types for main file
interface MainFileContributor {
  weekly: Record<string, {
    prsAuthored: number;
    reviewsApproved: number;
    commitsMade: number;
    weekStart: string;
  }>;
  monthly: Record<string, {
    prsAuthored: number;
    reviewsApproved: number;
    commitsMade: number;
  }>;
  yearly: Record<string, {
    prsAuthored: number;
    reviewsApproved: number;
    commitsMade: number;
  }>;
  repoTotals: Record<string, [number, number, number]>; // repo -> [pA, rA, cM]
  totals: {
    prsAuthored: number;
    reviewsApproved: number;
    commitsMade: number;
    firstActivity: string | null;
    lastActivity: string | null;
    activeWeeks: number;
    activeMonths: number;
    repositories: string[];
  };
}

// Output types for timeline file
interface TimelineFileStructure {
  data: Record<string, Record<string, {
    w?: Record<string, [number, number, number]>;  // week -> [pA, rA, cM]
    m?: Record<string, [number, number, number]>;  // month -> [pA, rA, cM]
    y?: Record<string, [number, number, number]>;  // year -> [pA, rA, cM]
  }>>;
  index: {
    byRepo: Record<string, string[]>;  // repo -> list of contributors
  };
  metadata: {
    generatedAt: string;
    format: string;
    description: string;
  };
}

// Helper functions
function getISOWeek(date: Date): { year: number; week: number } {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNumber = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  const year = d.getFullYear();
  
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

function getWeekStart(year: number, week: number): string {
  const jan4 = new Date(year, 0, 4);
  const daysToMonday = (8 - jan4.getDay()) % 7;
  const week1Start = new Date(year, 0, 4 - daysToMonday);
  const weekStart = new Date(week1Start);
  weekStart.setDate(week1Start.getDate() + (week - 1) * 7);
  return weekStart.toISOString().split('T')[0];
}

function parseDate(dateStr: string): Date {
  return new Date(dateStr);
}

function initContributor(): ContributorRepoStats {
  return {
    weekly: {},
    monthly: {},
    yearly: {},
    repoTotals: {},
    totals: {
      prsAuthored: 0,
      reviewsApproved: 0,
      commitsMade: 0,
      firstActivity: null,
      lastActivity: null,
      activeWeeks: new Set(),
      activeMonths: new Set(),
      repositories: new Set()
    }
  };
}

function updateActivityDates(contributor: ContributorRepoStats, dateStr: string): void {
  if (!contributor.totals.firstActivity || dateStr < contributor.totals.firstActivity) {
    contributor.totals.firstActivity = dateStr;
  }
  if (!contributor.totals.lastActivity || dateStr > contributor.totals.lastActivity) {
    contributor.totals.lastActivity = dateStr;
  }
}

// Initialize or get repo activity object
function getOrInitRepoActivity(record: Record<string, RepoActivity>, repo: string): RepoActivity {
  if (!record[repo]) {
    record[repo] = { prsAuthored: 0, reviewsApproved: 0, commitsMade: 0 };
  }
  return record[repo];
}

// Initialize period repo tracking
function getOrInitPeriodRepo(
  contributor: ContributorRepoStats,
  period: 'weekly' | 'monthly' | 'yearly',
  periodKey: string,
  repo: string
): RepoActivity {
  if (!contributor[period][periodKey]) {
    contributor[period][periodKey] = {};
  }
  return getOrInitRepoActivity(contributor[period][periodKey], repo);
}

async function generateContributorStats(): Promise<void> {
  const storeDir = path.join(process.cwd(), 'store');
  const reposDir = path.join(storeDir, 'repos');
  
  const contributors: Record<string, ContributorRepoStats> = {};
  const repoContributors: Record<string, Set<string>> = {}; // For index
  
  let earliestDate: Date | null = null;
  let latestDate: Date | null = null;
  const allRepositories = new Set<string>();
  
  try {
    const repoDirs = await fs.readdir(reposDir);
    let totalPRsProcessed = 0;
    
    // Process each repository
    for (const repoDir of repoDirs) {
      const mergedDir = path.join(reposDir, repoDir, 'merged');
      allRepositories.add(repoDir);
      
      if (!repoContributors[repoDir]) {
        repoContributors[repoDir] = new Set();
      }
      
      try {
        await fs.access(mergedDir);
      } catch {
        console.log(`No merged directory for ${repoDir}, skipping...`);
        continue;
      }
      
      const files = await fs.readdir(mergedDir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));
      
      if (jsonFiles.length === 0) continue;
      
      console.log(`Processing ${jsonFiles.length} monthly files for ${repoDir}`);
      
      for (const file of jsonFiles) {
        const filePath = path.join(mergedDir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const monthlyData = JSON.parse(content);
        const repoPRs: any[] = monthlyData.items || [];
        
        for (const pr of repoPRs) {
          totalPRsProcessed++;
          
          const mergedDate = parseDate(pr.dateMerged);
          const mergedDateStr = pr.dateMerged.split('T')[0];
          
          if (!earliestDate || mergedDate < earliestDate) earliestDate = mergedDate;
          if (!latestDate || mergedDate > latestDate) latestDate = mergedDate;
          
          // Get time periods
          const week = getISOWeek(mergedDate);
          const weekKey = `${week.year}-W${String(week.week).padStart(2, '0')}`;
          const monthKey = `${mergedDate.getFullYear()}-${String(mergedDate.getMonth() + 1).padStart(2, '0')}`;
          const yearKey = String(mergedDate.getFullYear());
          
          // Process PR author
          const authorLogin = pr.author?.login;
          if (authorLogin) {
            if (!contributors[authorLogin]) {
              contributors[authorLogin] = initContributor();
            }
            const author = contributors[authorLogin];
            
            // Update totals
            author.totals.prsAuthored++;
            author.totals.repositories.add(repoDir);
            updateActivityDates(author, mergedDateStr);
            repoContributors[repoDir].add(authorLogin);
            
            // Update repo totals
            const repoTotal = getOrInitRepoActivity(author.repoTotals, repoDir);
            repoTotal.prsAuthored++;
            
            // Update period-repo breakdown
            author.totals.activeWeeks.add(weekKey);
            const weekRepo = getOrInitPeriodRepo(author, 'weekly', weekKey, repoDir);
            weekRepo.prsAuthored++;
            
            author.totals.activeMonths.add(monthKey);
            const monthRepo = getOrInitPeriodRepo(author, 'monthly', monthKey, repoDir);
            monthRepo.prsAuthored++;
            
            const yearRepo = getOrInitPeriodRepo(author, 'yearly', yearKey, repoDir);
            yearRepo.prsAuthored++;
          }
          
          // Process reviewers who approved
          if (pr.reviewers && Array.isArray(pr.reviewers)) {
            for (const reviewer of pr.reviewers) {
              if (reviewer.state === 'APPROVED' && reviewer.login) {
                if (!contributors[reviewer.login]) {
                  contributors[reviewer.login] = initContributor();
                }
                const reviewerStats = contributors[reviewer.login];
                
                // Update totals
                reviewerStats.totals.reviewsApproved++;
                reviewerStats.totals.repositories.add(repoDir);
                updateActivityDates(reviewerStats, mergedDateStr);
                repoContributors[repoDir].add(reviewer.login);
                
                // Update repo totals
                const repoTotal = getOrInitRepoActivity(reviewerStats.repoTotals, repoDir);
                repoTotal.reviewsApproved++;
                
                // Update period-repo breakdown
                reviewerStats.totals.activeWeeks.add(weekKey);
                const weekRepo = getOrInitPeriodRepo(reviewerStats, 'weekly', weekKey, repoDir);
                weekRepo.reviewsApproved++;
                
                reviewerStats.totals.activeMonths.add(monthKey);
                const monthRepo = getOrInitPeriodRepo(reviewerStats, 'monthly', monthKey, repoDir);
                monthRepo.reviewsApproved++;
                
                const yearRepo = getOrInitPeriodRepo(reviewerStats, 'yearly', yearKey, repoDir);
                yearRepo.reviewsApproved++;
              }
            }
          }
          
          // Process commit authors
          if (pr.commitAuthors) {
            for (const [, author] of Object.entries(pr.commitAuthors)) {
              const commitAuthor = author as any;
              
              let username: string | null = null;
              if (commitAuthor.isGitHubUser && commitAuthor.displayName) {
                username = commitAuthor.displayName;
              } else if (commitAuthor.displayName) {
                username = commitAuthor.displayName;
              }
              
              if (username && commitAuthor.count > 0) {
                if (!contributors[username]) {
                  contributors[username] = initContributor();
                }
                const committer = contributors[username];
                
                // Update totals
                committer.totals.commitsMade += commitAuthor.count;
                committer.totals.repositories.add(repoDir);
                updateActivityDates(committer, mergedDateStr);
                repoContributors[repoDir].add(username);
                
                // Update repo totals
                const repoTotal = getOrInitRepoActivity(committer.repoTotals, repoDir);
                repoTotal.commitsMade += commitAuthor.count;
                
                // Update period-repo breakdown
                committer.totals.activeWeeks.add(weekKey);
                const weekRepo = getOrInitPeriodRepo(committer, 'weekly', weekKey, repoDir);
                weekRepo.commitsMade += commitAuthor.count;
                
                committer.totals.activeMonths.add(monthKey);
                const monthRepo = getOrInitPeriodRepo(committer, 'monthly', monthKey, repoDir);
                monthRepo.commitsMade += commitAuthor.count;
                
                const yearRepo = getOrInitPeriodRepo(committer, 'yearly', yearKey, repoDir);
                yearRepo.commitsMade += commitAuthor.count;
              }
            }
          }
        }
      }
    }
    
    console.log(`\nProcessed ${totalPRsProcessed} total PRs`);
    console.log(`Found ${Object.keys(contributors).length} unique contributors`);
    
    // Generate main file with aggregated totals
    const mainFileData: any = {
      byContributor: {},
      rankings: {},
      aggregates: { weekly: {}, monthly: {}, yearly: {} },
      metadata: {}
    };
    
    // Generate timeline file data
    const timelineData: TimelineFileStructure = {
      data: {},
      index: { byRepo: {} },
      metadata: {
        generatedAt: new Date().toISOString(),
        format: 'Arrays are [prsAuthored, reviewsApproved, commitsMade]',
        description: 'Sparse repository-specific contributor activity timeline'
      }
    };
    
    // Build both files
    for (const [username, stats] of Object.entries(contributors)) {
      // Main file: aggregate totals per period
      const mainContributor: MainFileContributor = {
        weekly: {},
        monthly: {},
        yearly: {},
        repoTotals: {},
        totals: {
          prsAuthored: stats.totals.prsAuthored,
          reviewsApproved: stats.totals.reviewsApproved,
          commitsMade: stats.totals.commitsMade,
          firstActivity: stats.totals.firstActivity,
          lastActivity: stats.totals.lastActivity,
          activeWeeks: stats.totals.activeWeeks.size,
          activeMonths: stats.totals.activeMonths.size,
          repositories: Array.from(stats.totals.repositories).sort()
        }
      };
      
      // Add repo totals to main file
      for (const [repo, activity] of Object.entries(stats.repoTotals)) {
        mainContributor.repoTotals[repo] = [
          activity.prsAuthored,
          activity.reviewsApproved,
          activity.commitsMade
        ];
      }
      
      // Timeline file: per-repo breakdown
      timelineData.data[username] = {};
      
      // Process weekly data
      for (const [weekKey, repoData] of Object.entries(stats.weekly)) {
        let weekTotal = { prsAuthored: 0, reviewsApproved: 0, commitsMade: 0 };
        
        for (const [repo, activity] of Object.entries(repoData)) {
          weekTotal.prsAuthored += activity.prsAuthored;
          weekTotal.reviewsApproved += activity.reviewsApproved;
          weekTotal.commitsMade += activity.commitsMade;
          
          // Add to timeline file (sparse - only if non-zero)
          if (activity.prsAuthored || activity.reviewsApproved || activity.commitsMade) {
            if (!timelineData.data[username][repo]) {
              timelineData.data[username][repo] = {};
            }
            if (!timelineData.data[username][repo].w) {
              timelineData.data[username][repo].w = {};
            }
            
            // Use abbreviated week key (extract from existing weekKey format)
            const [yearPart, weekPart] = weekKey.split('-W');
            const weekAbbr = `${yearPart}-${weekPart}`;
            timelineData.data[username][repo].w[weekAbbr] = [
              activity.prsAuthored,
              activity.reviewsApproved,
              activity.commitsMade
            ];
          }
        }
        
        // Add to main file (totals only)
        // weekKey is already in format "2024-W01", need to extract year and week
        const [yearStr, weekStr] = weekKey.split('-W');
        const year = parseInt(yearStr);
        const week = parseInt(weekStr);
        mainContributor.weekly[weekKey] = {
          prsAuthored: weekTotal.prsAuthored,
          reviewsApproved: weekTotal.reviewsApproved,
          commitsMade: weekTotal.commitsMade,
          weekStart: getWeekStart(year, week)
        };
      }
      
      // Process monthly data
      for (const [monthKey, repoData] of Object.entries(stats.monthly)) {
        let monthTotal = { prsAuthored: 0, reviewsApproved: 0, commitsMade: 0 };
        
        for (const [repo, activity] of Object.entries(repoData)) {
          monthTotal.prsAuthored += activity.prsAuthored;
          monthTotal.reviewsApproved += activity.reviewsApproved;
          monthTotal.commitsMade += activity.commitsMade;
          
          // Add to timeline file (sparse)
          if (activity.prsAuthored || activity.reviewsApproved || activity.commitsMade) {
            if (!timelineData.data[username][repo]) {
              timelineData.data[username][repo] = {};
            }
            if (!timelineData.data[username][repo].m) {
              timelineData.data[username][repo].m = {};
            }
            
            // Use abbreviated month key
            const [year, month] = monthKey.split('-');
            const monthAbbr = `${year.slice(2)}-${month}`;
            timelineData.data[username][repo].m[monthAbbr] = [
              activity.prsAuthored,
              activity.reviewsApproved,
              activity.commitsMade
            ];
          }
        }
        
        mainContributor.monthly[monthKey] = monthTotal;
      }
      
      // Process yearly data
      for (const [yearKey, repoData] of Object.entries(stats.yearly)) {
        let yearTotal = { prsAuthored: 0, reviewsApproved: 0, commitsMade: 0 };
        
        for (const [repo, activity] of Object.entries(repoData)) {
          yearTotal.prsAuthored += activity.prsAuthored;
          yearTotal.reviewsApproved += activity.reviewsApproved;
          yearTotal.commitsMade += activity.commitsMade;
          
          // Add to timeline file (sparse)
          if (activity.prsAuthored || activity.reviewsApproved || activity.commitsMade) {
            if (!timelineData.data[username][repo]) {
              timelineData.data[username][repo] = {};
            }
            if (!timelineData.data[username][repo].y) {
              timelineData.data[username][repo].y = {};
            }
            
            const yearAbbr = yearKey.slice(2);
            timelineData.data[username][repo].y[yearAbbr] = [
              activity.prsAuthored,
              activity.reviewsApproved,
              activity.commitsMade
            ];
          }
        }
        
        mainContributor.yearly[yearKey] = yearTotal;
      }
      
      // Sort keys for readability
      mainContributor.weekly = Object.fromEntries(Object.entries(mainContributor.weekly).sort());
      mainContributor.monthly = Object.fromEntries(Object.entries(mainContributor.monthly).sort());
      mainContributor.yearly = Object.fromEntries(Object.entries(mainContributor.yearly).sort());
      
      mainFileData.byContributor[username] = mainContributor;
    }
    
    // Build repository index for timeline file
    for (const [repo, contributorSet] of Object.entries(repoContributors)) {
      timelineData.index.byRepo[repo] = Array.from(contributorSet).sort();
    }
    
    // Calculate aggregates for main file
    const activeContributorsByPeriod = {
      weekly: {} as Record<string, Set<string>>,
      monthly: {} as Record<string, Set<string>>,
      yearly: {} as Record<string, Set<string>>
    };
    
    for (const [username, contributor] of Object.entries(mainFileData.byContributor)) {
      // Weekly aggregates
      for (const [weekKey, weekStats] of Object.entries((contributor as any).weekly)) {
        if (!mainFileData.aggregates.weekly[weekKey]) {
          mainFileData.aggregates.weekly[weekKey] = {
            totalPRsAuthored: 0,
            totalReviewsApproved: 0,
            totalCommitsMade: 0,
            activeContributors: 0
          };
        }
        mainFileData.aggregates.weekly[weekKey].totalPRsAuthored += (weekStats as any).prsAuthored;
        mainFileData.aggregates.weekly[weekKey].totalReviewsApproved += (weekStats as any).reviewsApproved;
        mainFileData.aggregates.weekly[weekKey].totalCommitsMade += (weekStats as any).commitsMade;
        
        if (!activeContributorsByPeriod.weekly[weekKey]) {
          activeContributorsByPeriod.weekly[weekKey] = new Set();
        }
        activeContributorsByPeriod.weekly[weekKey].add(username);
      }
      
      // Monthly aggregates
      for (const [monthKey, monthStats] of Object.entries((contributor as any).monthly)) {
        if (!mainFileData.aggregates.monthly[monthKey]) {
          mainFileData.aggregates.monthly[monthKey] = {
            totalPRsAuthored: 0,
            totalReviewsApproved: 0,
            totalCommitsMade: 0,
            activeContributors: 0
          };
        }
        mainFileData.aggregates.monthly[monthKey].totalPRsAuthored += (monthStats as any).prsAuthored;
        mainFileData.aggregates.monthly[monthKey].totalReviewsApproved += (monthStats as any).reviewsApproved;
        mainFileData.aggregates.monthly[monthKey].totalCommitsMade += (monthStats as any).commitsMade;
        
        if (!activeContributorsByPeriod.monthly[monthKey]) {
          activeContributorsByPeriod.monthly[monthKey] = new Set();
        }
        activeContributorsByPeriod.monthly[monthKey].add(username);
      }
      
      // Yearly aggregates
      for (const [yearKey, yearStats] of Object.entries((contributor as any).yearly)) {
        if (!mainFileData.aggregates.yearly[yearKey]) {
          mainFileData.aggregates.yearly[yearKey] = {
            totalPRsAuthored: 0,
            totalReviewsApproved: 0,
            totalCommitsMade: 0,
            activeContributors: 0
          };
        }
        mainFileData.aggregates.yearly[yearKey].totalPRsAuthored += (yearStats as any).prsAuthored;
        mainFileData.aggregates.yearly[yearKey].totalReviewsApproved += (yearStats as any).reviewsApproved;
        mainFileData.aggregates.yearly[yearKey].totalCommitsMade += (yearStats as any).commitsMade;
        
        if (!activeContributorsByPeriod.yearly[yearKey]) {
          activeContributorsByPeriod.yearly[yearKey] = new Set();
        }
        activeContributorsByPeriod.yearly[yearKey].add(username);
      }
    }
    
    // Set active contributor counts
    for (const [period, data] of Object.entries(activeContributorsByPeriod.weekly)) {
      mainFileData.aggregates.weekly[period].activeContributors = data.size;
    }
    for (const [period, data] of Object.entries(activeContributorsByPeriod.monthly)) {
      mainFileData.aggregates.monthly[period].activeContributors = data.size;
    }
    for (const [period, data] of Object.entries(activeContributorsByPeriod.yearly)) {
      mainFileData.aggregates.yearly[period].activeContributors = data.size;
    }
    
    // Create rankings for main file
    const prAuthorRanking = Object.entries(contributors)
      .map(([username, stats]) => ({ username, count: stats.totals.prsAuthored }))
      .filter(e => e.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 50);
    
    const reviewerRanking = Object.entries(contributors)
      .map(([username, stats]) => ({ username, count: stats.totals.reviewsApproved }))
      .filter(e => e.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 50);
    
    const committerRanking = Object.entries(contributors)
      .map(([username, stats]) => ({ username, count: stats.totals.commitsMade }))
      .filter(e => e.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 50);
    
    const overallRanking = Object.entries(contributors)
      .map(([username, stats]) => ({
        username,
        score: stats.totals.prsAuthored + stats.totals.reviewsApproved + stats.totals.commitsMade
      }))
      .filter(e => e.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 50);
    
    mainFileData.rankings = {
      byPRsAuthored: prAuthorRanking,
      byReviewsApproved: reviewerRanking,
      byCommitsMade: committerRanking,
      byTotalContributions: overallRanking
    };
    
    // Calculate metadata totals
    let totalPRsAuthored = 0;
    let totalReviewsApproved = 0;
    let totalCommitsMade = 0;
    
    for (const stats of Object.values(contributors)) {
      totalPRsAuthored += stats.totals.prsAuthored;
      totalReviewsApproved += stats.totals.reviewsApproved;
      totalCommitsMade += stats.totals.commitsMade;
    }
    
    mainFileData.metadata = {
      generatedAt: new Date().toISOString(),
      totalContributors: Object.keys(contributors).length,
      dateRange: {
        earliest: earliestDate ? earliestDate.toISOString().split('T')[0] : null,
        latest: latestDate ? latestDate.toISOString().split('T')[0] : null
      },
      totals: {
        prsAuthored: totalPRsAuthored,
        reviewsApproved: totalReviewsApproved,
        commitsMade: totalCommitsMade
      },
      repositories: Array.from(allRepositories).sort()
    };
    
    // Sort aggregate keys
    mainFileData.aggregates.weekly = Object.fromEntries(Object.entries(mainFileData.aggregates.weekly).sort());
    mainFileData.aggregates.monthly = Object.fromEntries(Object.entries(mainFileData.aggregates.monthly).sort());
    mainFileData.aggregates.yearly = Object.fromEntries(Object.entries(mainFileData.aggregates.yearly).sort());
    
    // Write main file
    const mainOutputPath = path.join(process.cwd(), 'contributor-stats.json');
    await fs.writeFile(mainOutputPath, JSON.stringify(mainFileData, null, 2));
    
    // Write timeline file
    const timelineOutputPath = path.join(process.cwd(), 'contributor-repo-timeline.json');
    await fs.writeFile(timelineOutputPath, JSON.stringify(timelineData, null, 2));
    
    console.log(`\nContributor stats generated successfully!`);
    console.log(`Main file stats:`);
    console.log(`- Total contributors: ${Object.keys(contributors).length}`);
    console.log(`- Total PRs authored: ${totalPRsAuthored}`);
    console.log(`- Total reviews approved: ${totalReviewsApproved}`);
    console.log(`- Total commits made: ${totalCommitsMade}`);
    console.log(`- Main file saved to: ${mainOutputPath}`);
    
    // Get file sizes
    const mainFileStats = await fs.stat(mainOutputPath);
    const timelineFileStats = await fs.stat(timelineOutputPath);
    
    console.log(`\nFile sizes:`);
    console.log(`- Main file: ${(mainFileStats.size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`- Timeline file: ${(timelineFileStats.size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`- Timeline file saved to: ${timelineOutputPath}`);
    
    // Print sample of top contributors with repo breakdown
    console.log('\nTop 3 Contributors with Repository Breakdown:');
    for (let i = 0; i < Math.min(3, overallRanking.length); i++) {
      const contrib = overallRanking[i];
      const stats = contributors[contrib.username];
      console.log(`\n${i + 1}. ${contrib.username} (Total: ${contrib.score}):`);
      
      // Show top repos for this contributor
      const repoTotals = Object.entries(stats.repoTotals)
        .map(([repo, activity]) => ({
          repo,
          total: activity.prsAuthored + activity.reviewsApproved + activity.commitsMade
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 3);
      
      for (const { repo, total } of repoTotals) {
        const activity = stats.repoTotals[repo];
        console.log(`   ${repo}: ${total} (PRs: ${activity.prsAuthored}, Reviews: ${activity.reviewsApproved}, Commits: ${activity.commitsMade})`);
      }
    }
    
  } catch (error) {
    console.error('Error generating contributor stats:', error);
    throw error;
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generateContributorStats().catch(console.error);
}

export { generateContributorStats };