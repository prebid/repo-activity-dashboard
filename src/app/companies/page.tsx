'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import contributorData from '../../../contributor-repo-timeline.json';
import githubMapping from '../../../store/sheets/github-mapping.json';

// Dynamic import to avoid SSR issues
const HorizontalBarChart = dynamic(
  () => import('@/components/HorizontalBarChart').then(mod => mod.HorizontalBarChart),
  { 
    ssr: false,
    loading: () => <p>Loading chart...</p>
  }
);

// Repository list with colors and mappings
const repositories = [
  { name: 'Prebid.js', key: 'prebid-js', color: '#10B981' },      // Green
  { name: 'Prebid Server', key: 'prebid-server', color: '#8B5CF6' },   // Purple
  { name: 'Prebid Server Java', key: 'prebid-server-java', color: '#EF4444' }, // Red
  { name: 'Prebid Mobile iOS', key: 'prebid-mobile-ios', color: '#F59E0B' },  // Gold
  { name: 'Prebid Mobile Android', key: 'prebid-mobile-android', color: '#3B82F6' }, // Blue
  { name: 'Prebid Docs', key: 'prebid-github-io', color: '#14B8A6' }      // Teal
];

export default function CompaniesPage() {
  const [timeRange, setTimeRange] = useState('This Year'); // 2025
  const [metric, setMetric] = useState('Merged PRs');
  const [selectedRepo, setSelectedRepo] = useState('All');
  const [memberFilter, setMemberFilter] = useState('All');
  const [resultLimit, setResultLimit] = useState('100');
  const [chartData, setChartData] = useState<any[]>([]);

  // Process data based on selections
  useEffect(() => {
    const processData = () => {
      // First, let's verify the data is loaded
      console.log('=== COMPANIES DATA PROCESSING ===');
      console.log('contributorData loaded:', !!contributorData);
      console.log('githubMapping loaded:', !!githubMapping);
      
      if (!contributorData || !contributorData.data) {
        console.error('No contributor data available!');
        setChartData([]);
        return;
      }
      
      // Company aggregation map
      const companyMap = new Map<string, {
        contributors: Set<string>;
        data: Record<string, number>;
        category: 'member' | 'non-member' | 'prebid';
        isMember: boolean;
      }>();
      
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth() + 1;
      const currentWeek = getWeekNumber(currentDate);

      // Determine time key based on selection
      let timeKey = 'y'; // year
      let targetPeriod = '';
      let targetPeriods: string[] = []; // For quarters, we need multiple periods
      let isQuarterly = false;

      if (timeRange === 'This Quarter' || timeRange === 'Last Quarter') {
        // Handle quarterly aggregation
        isQuarterly = true;
        timeKey = 'm';
        const currentQuarter = Math.floor((currentMonth - 1) / 3) + 1;
        const isThisQuarter = timeRange === 'This Quarter';
        const targetQuarter = isThisQuarter ? currentQuarter : (currentQuarter === 1 ? 4 : currentQuarter - 1);
        const targetYear = (timeRange === 'Last Quarter' && currentQuarter === 1) ? currentYear - 1 : currentYear;
        const targetYearShort = String(targetYear).slice(-2);

        // Calculate months in the quarter
        const quarterStartMonth = (targetQuarter - 1) * 3 + 1;
        let quarterMonths = [quarterStartMonth, quarterStartMonth + 1, quarterStartMonth + 2];

        // For "This Quarter", only include months up to current month
        if (isThisQuarter) {
          quarterMonths = quarterMonths.filter(m => m <= currentMonth);
        }

        targetPeriods = quarterMonths.map(m => `${targetYearShort}-${String(m).padStart(2, '0')}`);
      } else if (timeRange === 'This Week') {
        timeKey = 'w';
        targetPeriod = `${currentYear}-${String(currentWeek).padStart(2, '0')}`;
      } else if (timeRange === 'Last Week') {
        timeKey = 'w';
        const lastWeek = currentWeek > 1 ? currentWeek - 1 : 52;
        const year = currentWeek === 1 ? currentYear - 1 : currentYear;
        targetPeriod = `${year}-${String(lastWeek).padStart(2, '0')}`;
      } else if (timeRange === 'This Month') {
        timeKey = 'm';
        targetPeriod = `${String(currentYear).slice(-2)}-${String(currentMonth).padStart(2, '0')}`;
      } else if (timeRange === 'Last Month') {
        timeKey = 'm';
        const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
        const year = currentMonth === 1 ? currentYear - 1 : currentYear;
        targetPeriod = `${String(year).slice(-2)}-${String(lastMonth).padStart(2, '0')}`;
      } else if (timeRange === 'This Year') {
        timeKey = 'y';
        targetPeriod = String(currentYear).slice(-2);
      } else if (timeRange === 'Last Year') {
        timeKey = 'y';
        targetPeriod = String(currentYear - 1).slice(-2);
      }
      
      // Determine metric index: [openedPRs, mergedPRs, reviewedPRs, mergedCommits, openedIssues]
      let metricIndex = 1; // Default to merged PRs
      if (metric === 'Open PRs') metricIndex = 0;
      else if (metric === 'Merged PRs') metricIndex = 1;
      else if (metric === 'Reviewed PRs') metricIndex = 2;
      else if (metric === 'Merged Commits') metricIndex = 3;
      else if (metric === 'Opened Issues') metricIndex = 4;
      
      // Process contributor data and aggregate by company
      const entries = Object.entries(contributorData.data);
      console.log('Number of contributors in data:', entries.length);
      console.log('Time settings - timeKey:', timeKey, 'targetPeriod:', targetPeriod, 'metricIndex:', metricIndex);
      console.log('Member filter:', memberFilter);
      
      // Repository key mapping
      const repoKeyMap: Record<string, string> = {
        'prebid-js': 'prebidjs',
        'prebid-server': 'prebidserver',
        'prebid-server-java': 'prebidserverjava',
        'prebid-mobile-ios': 'prebidmobileios',
        'prebid-mobile-android': 'prebidmobileandroid',
        'prebid-github-io': 'prebiddocs'
      };
      
      entries.forEach(([contributor, repos]: [string, any]) => {
        // Get company for this contributor
        const userMapping = (githubMapping.mapping as any)[contributor.toLowerCase()];
        const company = userMapping?.company || 'Unknown Organization';
        const category = userMapping?.category || 'non-member';
        const isMember = userMapping?.isMember || false;

        // Apply member filter
        switch (memberFilter) {
          case 'Member':
            // Only members, exclude prebid
            if (!isMember || category === 'prebid') return;
            break;
          case 'Non-Member':
            // Only non-members, exclude prebid
            if (isMember || category === 'prebid') return;
            break;
          case 'Prebid':
            // Only prebid
            if (category !== 'prebid') return;
            break;
          case 'Prebid-As-Member':
            // Members OR prebid (includes both)
            if (!isMember && category !== 'prebid') return;
            break;
          case 'All':
          default:
            // Show all
            break;
        }
        
        // Initialize company data if needed
        if (!companyMap.has(company)) {
          companyMap.set(company, {
            contributors: new Set(),
            data: {
              prebidjs: 0,
              prebidserver: 0,
              prebidserverjava: 0,
              prebidmobileios: 0,
              prebidmobileandroid: 0,
              prebiddocs: 0
            },
            category,
            isMember
          });
        }
        
        const companyData = companyMap.get(company)!;
        companyData.contributors.add(contributor);
        
        // Process each repository
        repositories.forEach(repo => {
          if (selectedRepo === 'All' || selectedRepo === repo.name) {
            const repoKey = repo.key;
            const simplifiedKey = repoKeyMap[repoKey];

            if (isQuarterly) {
              // Aggregate across all months in the quarter
              let quarterTotal = 0;
              targetPeriods.forEach(period => {
                if (repos[repoKey] && repos[repoKey][timeKey] && repos[repoKey][timeKey][period]) {
                  quarterTotal += repos[repoKey][timeKey][period][metricIndex] || 0;
                }
              });
              if (simplifiedKey) {
                companyData.data[simplifiedKey] += quarterTotal;
              }
            } else {
              // Single period (week, month, or year)
              if (repos[repoKey] && repos[repoKey][timeKey] && repos[repoKey][timeKey][targetPeriod]) {
                const value = repos[repoKey][timeKey][targetPeriod][metricIndex] || 0;
                if (simplifiedKey) {
                  companyData.data[simplifiedKey] += value;
                }
              }
            }
          }
        });
      });
      
      // Convert to array and sort by total contributions
      const limit = parseInt(resultLimit) || 100;
      const dataArray = Array.from(companyMap.entries())
        .map(([name, info]) => ({
          name: `${name} (${info.contributors.size})`, // Add contributor count
          ...info.data,
          total: Object.values(info.data).reduce((sum, val) => sum + val, 0)
        }))
        .filter(item => item.total > 0) // Only include companies with contributions
        .sort((a, b) => b.total - a.total)
        .slice(0, limit) // Top N companies based on selector
        .map(({ total, ...rest }) => rest);
      
      console.log('Final processed companies:', dataArray.length);
      console.log('Sample company:', dataArray[0]);
      setChartData(dataArray);
    };
    
    processData();
  }, [timeRange, metric, selectedRepo, memberFilter, resultLimit]);
  
  // Helper function to get week number - must match generateContributorStats.ts
  function getWeekNumber(date: Date): number {
    const year = date.getFullYear();
    const week = Math.floor((date.getTime() - new Date(year, 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));
    return week;
  }
  
  return (
    <div className="w-full py-8" style={{ paddingLeft: '0.1rem', paddingRight: '0.1rem', paddingTop: '2rem' }}>
      {/* Selectors */}
      <div className="flex" style={{ paddingLeft: '1rem', paddingRight: '1rem', marginBottom: '2rem', gap: '2rem' }}>
        {/* Repository Selector */}
        <Select value={selectedRepo} onValueChange={setSelectedRepo}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Select repository" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All</SelectItem>
            {repositories.map((repo) => (
              <SelectItem key={repo.name} value={repo.name}>{repo.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Metric Selector */}
        <Select value={metric} onValueChange={setMetric}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Select metric" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Merged PRs">Merged PRs</SelectItem>
            <SelectItem value="Reviewed PRs">Reviewed PRs</SelectItem>
            <SelectItem value="Merged Commits">Merged Commits</SelectItem>
            <SelectItem value="Opened Issues">Opened Issues</SelectItem>
            <SelectItem value="Open PRs">Open PRs</SelectItem>
          </SelectContent>
        </Select>
        
        {/* Time Range Selector */}
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
        
        {/* Member Filter Selector */}
        <Select value={memberFilter} onValueChange={setMemberFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Member status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Companies</SelectItem>
            <SelectItem value="Member">Member Companies</SelectItem>
            <SelectItem value="Non-Member">Non-Member Companies</SelectItem>
            <SelectItem value="Prebid">Prebid</SelectItem>
            <SelectItem value="Prebid-As-Member">Prebid as Member</SelectItem>
          </SelectContent>
        </Select>
        
        {/* Result Limit Selector */}
        <Select value={resultLimit} onValueChange={setResultLimit}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Number of results" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="5">Top 5</SelectItem>
            <SelectItem value="10">Top 10</SelectItem>
            <SelectItem value="15">Top 15</SelectItem>
            <SelectItem value="20">Top 20</SelectItem>
            <SelectItem value="25">Top 25</SelectItem>
            <SelectItem value="50">Top 50</SelectItem>
            <SelectItem value="100">Top 100</SelectItem>
            <SelectItem value="200">Top 200</SelectItem>
            <SelectItem value="500">Top 500</SelectItem>
            <SelectItem value="1000">Top 1000</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stacked Horizontal Bar Chart */}
      <div style={{ paddingLeft: '1rem', paddingRight: '1rem' }}>
        <Card>
          <CardContent className="pt-6">
            <div className="h-[2400px]">
              <HorizontalBarChart data={chartData} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}