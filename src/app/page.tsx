'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from 'recharts';
import contributorData from '../../contributor-repo-timeline.json';

// Repository list with keys
const repositories = [
  { name: 'Prebid.js', displayName: 'Prebid.js\n\u00A0', key: 'prebid-js', storeKey: 'prebid-js' },
  { name: 'Prebid Server', displayName: 'Prebid Server\nGo', key: 'prebid-server', storeKey: 'prebid-server' },
  { name: 'Prebid Server Java', displayName: 'Prebid Server\nJava', key: 'prebid-server-java', storeKey: 'prebid-server-java' },
  { name: 'Prebid Mobile iOS', displayName: 'Prebid Mobile\niOS', key: 'prebid-mobile-ios', storeKey: 'prebid-mobile-ios' },
  { name: 'Prebid Mobile Android', displayName: 'Prebid Mobile\nAndroid', key: 'prebid-mobile-android', storeKey: 'prebid-mobile-android' },
  { name: 'Prebid Docs', displayName: 'Prebid\nDocs', key: 'prebid-github-io', storeKey: 'prebid-github-io' },
];

interface RepoStats {
  openPRs: number;
  mergedPRs: number;
  openedIssues: number;
  contributors: number;
}

interface OpenPRData {
  metadata: {
    itemCount: number;
  };
  items: any[];
}

interface ChartDataPoint {
  period: string;
  mergedPRs: number;
  contributors: number;
  openedIssues: number;
}

export default function Home() {
  const [activeMetric, setActiveMetric] = useState('');
  const [timeRange, setTimeRange] = useState('This Month');
  const [repoStats, setRepoStats] = useState<Record<string, RepoStats>>({});
  const [openPRCounts, setOpenPRCounts] = useState<Record<string, number>>({});
  const [chartDataByRepo, setChartDataByRepo] = useState<Record<string, ChartDataPoint[]>>({});

  // Load open PR counts on mount
  useEffect(() => {
    const loadOpenPRs = async () => {
      const counts: Record<string, number> = {};
      
      for (const repo of repositories) {
        try {
          const response = await fetch(`/store/repos/${repo.storeKey}/open-prs.json`);
          if (response.ok) {
            const data: OpenPRData = await response.json();
            counts[repo.key] = data.metadata?.itemCount || data.items?.length || 0;
          } else {
            counts[repo.key] = 0;
          }
        } catch (error) {
          console.error(`Failed to load open PRs for ${repo.name}:`, error);
          counts[repo.key] = 0;
        }
      }
      
      setOpenPRCounts(counts);
    };
    
    loadOpenPRs();
  }, []);

  // Process data based on time range
  useEffect(() => {
    const processData = () => {
      if (!contributorData || !contributorData.data) {
        console.error('No contributor data available!');
        return;
      }

      const stats: Record<string, RepoStats> = {};
      const chartData: Record<string, ChartDataPoint[]> = {};
      
      // Initialize stats for each repo
      repositories.forEach(repo => {
        stats[repo.key] = {
          openPRs: openPRCounts[repo.key] || 0,
          mergedPRs: 0,
          openedIssues: 0,
          contributors: 0
        };
        chartData[repo.key] = [];
      });

      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth() + 1;
      const currentWeek = getWeekNumber(currentDate);
      
      // Process based on time range
      if (timeRange === 'This Quarter' || timeRange === 'Last Quarter') {
        // Monthly view for quarter ranges (3 months)
        const currentQuarterInfo = getQuarterInfo(currentDate);
        const isThisQuarter = timeRange === 'This Quarter';
        const targetQuarter = isThisQuarter ? currentQuarterInfo.quarter : (currentQuarterInfo.quarter === 1 ? 4 : currentQuarterInfo.quarter - 1);
        const targetYear = (timeRange === 'Last Quarter' && currentQuarterInfo.quarter === 1) ? currentYear - 1 : currentYear;
        const targetYearShort = String(targetYear).slice(-2);

        const quarterMonths = getQuarterMonths(targetQuarter);
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        // For "This Quarter", only show months up to current month
        let monthsToShow = quarterMonths;
        if (isThisQuarter) {
          monthsToShow = quarterMonths.filter(m => m <= currentMonth);
        }

        repositories.forEach(repo => {
          const monthlyData: ChartDataPoint[] = [];

          monthsToShow.forEach(month => {
            const monthKey = `${targetYearShort}-${String(month).padStart(2, '0')}`;
            let monthMerged = 0;
            let monthIssues = 0;
            const monthContributors = new Set<string>();

            // Aggregate data for this month
            Object.entries(contributorData.data).forEach(([contributor, repos]: [string, any]) => {
              const repoData = repos[repo.key];
              if (repoData && repoData.m && repoData.m[monthKey]) {
                const metrics = repoData.m[monthKey];
                const openedPRs = metrics[0] || 0;
                const merged = metrics[1] || 0;
                const issues = metrics[4] || 0;

                // Count as contributor if they have any activity
                if (openedPRs > 0 || merged > 0 || issues > 0) {
                  monthContributors.add(contributor);
                }

                // Always count merged PRs and issues
                monthMerged += merged;
                monthIssues += issues;
              }
            });

            monthlyData.push({
              period: monthNames[month - 1],
              mergedPRs: monthMerged,
              contributors: monthContributors.size,
              openedIssues: monthIssues
            });

            // Add to totals
            stats[repo.key].mergedPRs += monthMerged;
            stats[repo.key].openedIssues += monthIssues;
          });

          chartData[repo.key] = monthlyData;
        });
      } else if (timeRange === 'This Year' || timeRange === 'Last Year') {
        // Monthly view for year ranges
        const targetYear = timeRange === 'This Year' ? currentYear : currentYear - 1;
        const targetYearShort = String(targetYear).slice(-2);
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        // Determine the last month to show (don't show future months for current year)
        const lastMonth = (timeRange === 'This Year') ? currentMonth : 12;
        
        repositories.forEach(repo => {
          const monthlyData: ChartDataPoint[] = [];
          
          for (let month = 1; month <= lastMonth; month++) {
            const monthKey = `${targetYearShort}-${String(month).padStart(2, '0')}`;
            let monthMerged = 0;
            let monthIssues = 0;
            const monthContributors = new Set<string>();
            
            // Aggregate data for this month
            Object.entries(contributorData.data).forEach(([contributor, repos]: [string, any]) => {
              const repoData = repos[repo.key];
              if (repoData && repoData.m && repoData.m[monthKey]) {
                const metrics = repoData.m[monthKey];
                const openedPRs = metrics[0] || 0; // All PRs (open + merged)
                const merged = metrics[1] || 0;
                const issues = metrics[4] || 0;

                // Count as contributor if they have any activity
                if (openedPRs > 0 || merged > 0 || issues > 0) {
                  monthContributors.add(contributor);
                }

                // Always count merged PRs and issues
                monthMerged += merged;
                monthIssues += issues;
              }
            });
            
            monthlyData.push({
              period: monthNames[month - 1],
              mergedPRs: monthMerged,
              contributors: monthContributors.size,
              openedIssues: monthIssues
            });
            
            // Add to totals
            stats[repo.key].mergedPRs += monthMerged;
            stats[repo.key].openedIssues += monthIssues;
          }
          
          chartData[repo.key] = monthlyData;
        });
      } else if (timeRange === 'This Month' || timeRange === 'Last Month') {
        // Monthly data for card stats, weekly view for charts
        const targetMonth = timeRange === 'This Month' ? currentMonth : (currentMonth === 1 ? 12 : currentMonth - 1);
        const targetYear = (timeRange === 'Last Month' && currentMonth === 1) ? currentYear - 1 : currentYear;
        const targetYearShort = String(targetYear).slice(-2);
        const monthKey = `${targetYearShort}-${String(targetMonth).padStart(2, '0')}`;

        repositories.forEach(repo => {
          // Use month data for card stats (total merged PRs and issues)
          let monthMerged = 0;
          let monthIssues = 0;
          const monthContributors = new Set<string>();

          Object.entries(contributorData.data).forEach(([contributor, repos]: [string, any]) => {
            const repoData = repos[repo.key];
            if (repoData && repoData.m && repoData.m[monthKey]) {
              const metrics = repoData.m[monthKey];
              const openedPRs = metrics[0] || 0;
              const merged = metrics[1] || 0;
              const issues = metrics[4] || 0;

              if (openedPRs > 0 || merged > 0 || issues > 0) {
                monthContributors.add(contributor);
              }

              monthMerged += merged;
              monthIssues += issues;
            }
          });

          // Set card totals using month data
          stats[repo.key].mergedPRs = monthMerged;
          stats[repo.key].openedIssues = monthIssues;

          // Build weekly chart data for visualization
          const weeklyData: ChartDataPoint[] = [];
          const weekTotals: { [week: string]: { merged: number; issues: number; contributors: Set<string> } } = {};

          // Get the first and last day of the month
          const firstDay = new Date(targetYear, targetMonth - 1, 1);
          let lastDay = new Date(targetYear, targetMonth, 0);

          // For "This Month", don't go beyond current date
          if (timeRange === 'This Month' && lastDay > currentDate) {
            lastDay = currentDate;
          }

          // Calculate week numbers for the month
          const firstWeek = getWeekNumber(firstDay);
          const lastWeek = getWeekNumber(lastDay);

          // Initialize weeks
          for (let week = firstWeek; week <= lastWeek; week++) {
            const weekKey = `${targetYear}-${String(week).padStart(2, '0')}`;
            weekTotals[weekKey] = { merged: 0, issues: 0, contributors: new Set() };
          }

          // Aggregate weekly data for chart only
          Object.entries(contributorData.data).forEach(([contributor, repos]: [string, any]) => {
            const repoData = repos[repo.key];
            if (repoData && repoData.w) {
              for (let week = firstWeek; week <= lastWeek; week++) {
                const weekKey = `${targetYear}-${String(week).padStart(2, '0')}`;
                if (repoData.w[weekKey]) {
                  const metrics = repoData.w[weekKey];
                  const openedPRs = metrics[0] || 0;
                  const merged = metrics[1] || 0;
                  const issues = metrics[4] || 0;

                  if (openedPRs > 0 || merged > 0 || issues > 0) {
                    weekTotals[weekKey].contributors.add(contributor);
                  }

                  weekTotals[weekKey].merged += merged;
                  weekTotals[weekKey].issues += issues;
                }
              }
            }
          });

          // Convert to chart data
          let weekNum = 1;
          for (let week = firstWeek; week <= lastWeek; week++) {
            const weekKey = `${targetYear}-${String(week).padStart(2, '0')}`;
            const totals = weekTotals[weekKey];

            weeklyData.push({
              period: `Week ${weekNum}`,
              mergedPRs: totals.merged,
              contributors: totals.contributors.size,
              openedIssues: totals.issues
            });

            weekNum++;
          }

          chartData[repo.key] = weeklyData;
        });
      } else if (timeRange === 'This Week' || timeRange === 'Last Week') {
        // Weekly aggregation for This Week and Last Week
        const targetWeek = timeRange === 'This Week' ? currentWeek : (currentWeek > 1 ? currentWeek - 1 : 52);
        const targetYear = (timeRange === 'Last Week' && currentWeek === 1) ? currentYear - 1 : currentYear;
        const weekKey = `${targetYear}-${String(targetWeek).padStart(2, '0')}`;

        repositories.forEach(repo => {
          let weekMerged = 0;
          let weekIssues = 0;
          const weekContributors = new Set<string>();

          // Aggregate weekly data
          Object.entries(contributorData.data).forEach(([contributor, repos]: [string, any]) => {
            const repoData = repos[repo.key];
            if (repoData && repoData.w && repoData.w[weekKey]) {
              const metrics = repoData.w[weekKey];
              const openedPRs = metrics[0] || 0;
              const merged = metrics[1] || 0;
              const issues = metrics[4] || 0;

              if (openedPRs > 0 || merged > 0 || issues > 0) {
                weekContributors.add(contributor);
              }

              weekMerged += merged;
              weekIssues += issues;
            }
          });

          // For weekly view, show just the single week's data
          const weeklyData: ChartDataPoint[] = [{
            period: timeRange === 'This Week' ? 'This Week' : 'Last Week',
            mergedPRs: weekMerged,
            contributors: weekContributors.size,
            openedIssues: weekIssues
          }];

          // Update stats
          stats[repo.key].mergedPRs = weekMerged;
          stats[repo.key].openedIssues = weekIssues;

          chartData[repo.key] = weeklyData;
        });
      }

      // Calculate total unique contributors for the period
      repositories.forEach(repo => {
        const allContributors = new Set<string>();

        if (timeRange === 'This Quarter' || timeRange === 'Last Quarter') {
          // For quarters, aggregate across all months in the quarter
          const currentQuarterInfo = getQuarterInfo(currentDate);
          const isThisQuarter = timeRange === 'This Quarter';
          const targetQuarter = isThisQuarter ? currentQuarterInfo.quarter : (currentQuarterInfo.quarter === 1 ? 4 : currentQuarterInfo.quarter - 1);
          const targetYear = (timeRange === 'Last Quarter' && currentQuarterInfo.quarter === 1) ? currentYear - 1 : currentYear;
          const targetYearShort = String(targetYear).slice(-2);

          let quarterMonths = getQuarterMonths(targetQuarter);
          if (isThisQuarter) {
            quarterMonths = quarterMonths.filter(m => m <= currentMonth);
          }

          quarterMonths.forEach(month => {
            const monthKey = `${targetYearShort}-${String(month).padStart(2, '0')}`;
            Object.entries(contributorData.data).forEach(([contributor, repos]: [string, any]) => {
              const repoData = repos[repo.key];
              if (repoData && repoData.m && repoData.m[monthKey]) {
                const metrics = repoData.m[monthKey];
                const openedPRs = metrics[0] || 0;
                const merged = metrics[1] || 0;
                const issues = metrics[4] || 0;
                if (openedPRs > 0 || merged > 0 || issues > 0) {
                  allContributors.add(contributor);
                }
              }
            });
          });
        } else {
          const timeKey = (timeRange === 'This Year' || timeRange === 'Last Year') ? 'y' :
                         (timeRange === 'This Month' || timeRange === 'Last Month') ? 'm' : 'w';
          let targetPeriod = '';

          if (timeRange === 'This Week') {
            targetPeriod = `${currentYear}-${String(currentWeek).padStart(2, '0')}`;
          } else if (timeRange === 'Last Week') {
            const lastWeek = currentWeek > 1 ? currentWeek - 1 : 52;
            const year = currentWeek === 1 ? currentYear - 1 : currentYear;
            targetPeriod = `${year}-${String(lastWeek).padStart(2, '0')}`;
          } else if (timeRange === 'This Month') {
            targetPeriod = `${String(currentYear).slice(-2)}-${String(currentMonth).padStart(2, '0')}`;
          } else if (timeRange === 'Last Month') {
            const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
            const year = currentMonth === 1 ? currentYear - 1 : currentYear;
            targetPeriod = `${String(year).slice(-2)}-${String(lastMonth).padStart(2, '0')}`;
          } else if (timeRange === 'This Year') {
            targetPeriod = String(currentYear).slice(-2);
          } else if (timeRange === 'Last Year') {
            targetPeriod = String(currentYear - 1).slice(-2);
          }

          Object.entries(contributorData.data).forEach(([contributor, repos]: [string, any]) => {
            const repoData = repos[repo.key];
            if (repoData && repoData[timeKey] && repoData[timeKey][targetPeriod]) {
              const metrics = repoData[timeKey][targetPeriod];
              const openedPRs = metrics[0] || 0;
              const merged = metrics[1] || 0;
              const issues = metrics[4] || 0;
              // Count as contributor if they have any activity
              if (openedPRs > 0 || merged > 0 || issues > 0) {
                allContributors.add(contributor);
              }
            }
          });
        }

        stats[repo.key].contributors = allContributors.size;
      });

      setRepoStats(stats);
      setChartDataByRepo(chartData);
    };
    
    processData();
  }, [timeRange, openPRCounts]);

  // Helper function to get ISO week number
  function getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }

  // Helper function to get quarter number (1-4) from month
  function getQuarter(month: number): number {
    return Math.floor((month - 1) / 3) + 1;
  }

  // Helper function to get quarter info
  function getQuarterInfo(date: Date): { quarter: number; year: number } {
    return {
      quarter: getQuarter(date.getMonth() + 1),
      year: date.getFullYear()
    };
  }

  // Helper function to get months in a quarter
  function getQuarterMonths(quarter: number): number[] {
    const startMonth = (quarter - 1) * 3 + 1;
    return [startMonth, startMonth + 1, startMonth + 2];
  }

  const renderRepoCard = (repo: typeof repositories[0]) => {
    const stats = repoStats[repo.key] || { openPRs: 0, mergedPRs: 0, openedIssues: 0, contributors: 0 };
    const chartData = chartDataByRepo[repo.key] || [];
    
    return (
      <div key={repo.key} style={{ width: 'calc(33.333% - 0.5rem)' }}>
        <Card>
          <div className="flex flex-row items-stretch space-y-0 border-b p-0">
            <div className="flex flex-1 flex-col justify-center gap-1 py-3" style={{ paddingLeft: '1.5rem' }}>
              <h3 className="text-base font-semibold" style={{ transform: 'scale(1.5) translate(1rem, 0.5rem)', transformOrigin: 'left center', whiteSpace: 'pre-line' }}>
                {repo.displayName || repo.name}
              </h3>
              <p className="text-xs text-muted-foreground" style={{ visibility: 'hidden' }}>
                Showing total activity
              </p>
            </div>
            <div className="flex">
              <button
                type="button"
                data-active={activeMetric === 'open'}
                onClick={() => setActiveMetric('open')}
                className={`relative z-30 flex flex-col items-center justify-center border-l px-5 py-5 bg-primary/10 hover:bg-muted/70 ${
                  activeMetric === 'open' ? 'ring-1 ring-primary/20' : ''
                }`}
              >
                <span style={{ fontSize: '12px', marginBottom: '6px' }} className="text-muted-foreground">Open PRs</span>
                <span style={{ fontSize: '36px', fontWeight: 'bold', lineHeight: 1, color: '#10B981' }}>{stats.openPRs}</span>
              </button>
              
              <button
                type="button"
                data-active={activeMetric === 'merged'}
                onClick={() => setActiveMetric('merged')}
                className={`relative z-30 flex flex-col items-center justify-center border-l px-5 py-5 bg-primary/10 hover:bg-muted/70 ${
                  activeMetric === 'merged' ? 'ring-1 ring-primary/20' : ''
                }`}
              >
                <span style={{ fontSize: '12px', marginBottom: '6px' }} className="text-muted-foreground">Merged PRs</span>
                <span style={{ fontSize: '36px', fontWeight: 'bold', lineHeight: 1, color: '#3B82F6' }}>{stats.mergedPRs}</span>
              </button>
              
              <button
                type="button"
                data-active={activeMetric === 'issues'}
                onClick={() => setActiveMetric('issues')}
                className={`relative z-30 flex flex-col items-center justify-center border-l px-5 py-5 bg-primary/10 hover:bg-muted/70 ${
                  activeMetric === 'issues' ? 'ring-1 ring-primary/20' : ''
                }`}
              >
                <span style={{ fontSize: '12px', marginBottom: '6px' }} className="text-muted-foreground">Opened Issues</span>
                <span style={{ fontSize: '36px', fontWeight: 'bold', lineHeight: 1, color: '#F59E0B' }}>{stats.openedIssues}</span>
              </button>
              
              <button
                type="button"
                data-active={activeMetric === 'contributors'}
                onClick={() => setActiveMetric('contributors')}
                className={`relative z-30 flex flex-col items-center justify-center border-l px-5 py-5 bg-primary/10 hover:bg-muted/70 rounded-tr-lg ${
                  activeMetric === 'contributors' ? 'ring-1 ring-primary/20' : ''
                }`}
              >
                <span style={{ fontSize: '12px', marginBottom: '6px' }} className="text-muted-foreground">Contributors</span>
                <span style={{ fontSize: '36px', fontWeight: 'bold', lineHeight: 1, color: '#8B5CF6' }}>{stats.contributors}</span>
              </button>
            </div>
          </div>
          
          <CardContent className="pt-6">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 30, bottom: 0, left: 0 }}>
                  <CartesianGrid 
                    strokeDasharray="3 3" 
                    vertical={false}
                    horizontal={true}
                    strokeOpacity={0.3}
                  />
                  <XAxis 
                    dataKey="period"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 10 }}
                    stroke="#888888"
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 10 }}
                    stroke="#888888"
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 'var(--radius)',
                    }}
                  />
                  <Legend 
                    wrapperStyle={{ 
                      fontSize: '13px',
                      paddingTop: '5px',
                      marginTop: '-20px'
                    }}
                    verticalAlign="bottom"
                    height={40}
                  />
                  <Bar
                    dataKey="mergedPRs"
                    fill="#3B82F6"
                    name="Merged PRs"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="openedIssues"
                    fill="#F59E0B"
                    name="Issues"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="w-full py-8" style={{ paddingLeft: '0.1rem', paddingRight: '0.1rem', paddingTop: '2rem' }}>
      {/* Time Range Selector */}
      <div style={{ paddingLeft: '1rem', paddingRight: '1rem', marginBottom: '2rem' }}>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Select time range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="This Week">This Week</SelectItem>
            <SelectItem value="Last Week">Last Week</SelectItem>
            <SelectItem value="This Month">This Month</SelectItem>
            <SelectItem value="Last Month">Last Month</SelectItem>
            <SelectItem value="This Quarter">This Quarter</SelectItem>
            <SelectItem value="Last Quarter">Last Quarter</SelectItem>
            <SelectItem value="This Year">This Year</SelectItem>
            <SelectItem value="Last Year">Last Year</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      {/* First Row of Charts */}
      <div className="flex flex-row justify-between" style={{ gap: '0.75rem' }}>
        {repositories.slice(0, 3).map((repo) => renderRepoCard(repo))}
      </div>

      {/* Second Row of Charts */}
      <div className="flex flex-row justify-between" style={{ gap: '0.75rem', marginTop: '4rem' }}>
        {repositories.slice(3, 6).map((repo) => renderRepoCard(repo))}
      </div>
    </div>
  );
}