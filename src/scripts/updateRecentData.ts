#!/usr/bin/env node
/**
 * This script ACTUALLY works with date filtering using GitHub Search API
 */

import { config } from 'dotenv';
import { Octokit } from '@octokit/rest';
import { execSync } from 'child_process';
import { StorageService } from '../services/storageService';
import type { Repository, PRData, IssueData } from '../types/index';

config();

class RecentDataUpdater {
  private octokit: Octokit;
  private storageService: StorageService;

  constructor() {
    if (!process.env.GITHUB_TOKEN) {
      console.error('❌ GITHUB_TOKEN not found in .env');
      process.exit(1);
    }

    this.octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
    this.storageService = new StorageService('store');
  }

  /**
   * Fetch PRs using Search API - THIS ACTUALLY SUPPORTS DATE FILTERING
   */
  async fetchRecentPRs(owner: string, repo: string, since: Date, state: 'merged' | 'open' = 'merged'): Promise<Awaited<ReturnType<typeof this.octokit.search.issuesAndPullRequests>>['data']['items']> {
    const sinceStr = since.toISOString().split('T')[0];
    const stateQuery = state === 'merged' ? 'is:merged' : 'is:open';

    const query = `repo:${owner}/${repo} is:pr ${stateQuery} updated:>${sinceStr}`;

    console.log(`    Search query: ${query}`);

    let allItems: Awaited<ReturnType<typeof this.octokit.search.issuesAndPullRequests>>['data']['items'] = [];
    let page = 1;
    let totalCount = 0;

    try {
      // Search API rate limit: 30 requests per minute
      // But each request can get 100 items, so it's actually efficient

      while (true) {
        const response = await this.octokit.search.issuesAndPullRequests({
          q: query,
          per_page: 100,
          page: page,
          sort: 'updated',
          order: 'desc'
        });

        totalCount = response.data.total_count;
        allItems = allItems.concat(response.data.items);

        console.log(`    Fetched page ${page}: ${response.data.items.length} items (total so far: ${allItems.length}/${totalCount})`);

        // Stop if we got all items or hit the 1000 item limit
        if (allItems.length >= totalCount || allItems.length >= 1000) {
          break;
        }

        // Stop if this page had fewer than 100 items
        if (response.data.items.length < 100) {
          break;
        }

        page++;

        // Rate limit pause (Search API: 30/minute = 1 per 2 seconds)
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      return allItems;
    } catch (error: any) {
      if (error.status === 403 && error.message.includes('rate limit')) {
        console.error('    ⚠️ Hit rate limit for search API. Waiting 1 minute...');
        await new Promise(resolve => setTimeout(resolve, 60000));
        return this.fetchRecentPRs(owner, repo, since, state);
      }
      throw error;
    }
  }

  /**
   * Fetch recent issues - Issues API supports 'since' but only use it for closed issues
   */
  async fetchRecentIssues(owner: string, repo: string, since: Date | null, state: 'open' | 'closed' = 'closed'): Promise<Awaited<ReturnType<typeof this.octokit.issues.listForRepo>>['data']> {
    let allIssues: Awaited<ReturnType<typeof this.octokit.issues.listForRepo>>['data'] = [];
    let page = 1;

    while (true) {
      const params: any = {
        owner,
        repo,
        state,
        per_page: 100,
        page,
        sort: 'updated',
        direction: 'desc'
      };

      // Only use 'since' filter for closed issues with a real date
      // For open issues, we want ALL of them regardless of update date
      if (state === 'closed' && since) {
        params.since = since.toISOString();
      }

      const response = await this.octokit.issues.listForRepo(params);

      // Filter out pull requests (issues API returns both)
      const issues = response.data.filter(item => !item.pull_request);
      allIssues = [...allIssues, ...issues];

      console.log(`    Fetched page ${page}: ${issues.length} issues`);

      if (response.data.length < 100) break;
      page++;
    }

    return allIssues;
  }

  async updateRepo(owner: string, repo: string, name: string, daysBack: number) {
    console.log(`\n📦 Updating ${name}...`);

    const since = new Date();
    since.setDate(since.getDate() - daysBack);
    console.log(`  📅 Fetching data updated since: ${since.toISOString()}`);

    try {
      // Fetch open PRs (these need to be complete)
      console.log('  🔍 Fetching open PRs using Search API...');
      const openPRs = await this.fetchRecentPRs(owner, repo, new Date(0), 'open');
      console.log(`    ✓ Found ${openPRs.length} open PRs`);

      // Fetch recently merged PRs
      console.log(`  🔍 Fetching merged PRs from last ${daysBack} days using Search API...`);
      const mergedPRs = await this.fetchRecentPRs(owner, repo, since, 'merged');
      console.log(`    ✓ Found ${mergedPRs.length} recently merged PRs`);

      // Fetch open issues
      console.log('  📋 Fetching open issues...');
      const openIssues = await this.fetchRecentIssues(owner, repo, null, 'open');
      console.log(`    ✓ Found ${openIssues.length} open issues`);

      // Fetch recently closed issues
      console.log(`  📋 Fetching closed issues from last ${daysBack} days...`);
      const closedIssues = await this.fetchRecentIssues(owner, repo, since, 'closed');
      console.log(`    ✓ Found ${closedIssues.length} recently closed issues`);

      // Convert search results to our format and save
      const repoObj: Repository = { owner, repo, name, category: 'main', url: `https://github.com/${owner}/${repo}` };

      // Save open items (complete replacement)
      await this.storageService.saveOpenPRs(repoObj, this.convertSearchPRsToFormat(openPRs));
      await this.storageService.saveOpenIssues(repoObj, this.convertIssuesToFormat(openIssues));

      // Save closed/merged items
      if (mergedPRs.length > 0) {
        await this.storageService.saveMergedPRs(repoObj, this.convertSearchPRsToFormat(mergedPRs));
      }
      if (closedIssues.length > 0) {
        await this.storageService.saveClosedIssues(repoObj, this.convertIssuesToFormat(closedIssues));
      }

      console.log(`  ✅ ${name} updated successfully!`);

      return {
        openPRs: openPRs.length,
        mergedPRs: mergedPRs.length,
        openIssues: openIssues.length,
        closedIssues: closedIssues.length
      };

    } catch (error) {
      console.error(`  ❌ Error updating ${name}:`, error);
      throw error;
    }
  }

  /**
   * Convert search API PR results to match existing format
   */
  private convertSearchPRsToFormat(searchResults: Awaited<ReturnType<typeof this.octokit.search.issuesAndPullRequests>>['data']['items']): PRData[] {
    return searchResults.map(item => {
      const pr: PRData = {
        title: item.title,
        number: item.number,
        author: {
          login: item.user?.login || 'unknown',
          id: item.user?.id || 0
        },
        assignees: item.assignees?.map(a => a.login) || [],
        reviewers: [], // Search API doesn't provide reviewers
        commitAuthors: new Map(), // Search API doesn't provide commit authors
        dateCreated: new Date(item.created_at),
        dateUpdated: new Date(item.updated_at),
        status: (item.state === 'closed' && item.pull_request?.merged_at ? 'merged' : item.state) as 'open' | 'closed' | 'merged'
      };

      if (item.pull_request?.merged_at) {
        pr.dateMerged = new Date(item.pull_request.merged_at);
      }
      if (item.closed_at) {
        pr.dateClosed = new Date(item.closed_at);
      }

      // For open PRs, reviewers remain empty array (Search API doesn't provide)

      return pr;
    });
  }

  /**
   * Convert issues API results to match IssueData format
   */
  private convertIssuesToFormat(issues: Awaited<ReturnType<typeof this.octokit.issues.listForRepo>>['data']): IssueData[] {
    return issues.map(item => {
      const issue: IssueData = {
        title: item.title,
        number: item.number,
        author: {
          login: item.user?.login || 'unknown',
          id: item.user?.id || 0
        },
        assignees: item.assignees?.map(a => a.login) || [],
        dateCreated: new Date(item.created_at),
        dateUpdated: new Date(item.updated_at),
        status: item.state as 'open' | 'closed'
      };

      if (item.closed_at) {
        issue.dateClosed = new Date(item.closed_at);
      }

      return issue;
    });
  }

  async run(daysBack: number = 14) {
    console.log('🚀 Updating Recent GitHub Data');
    console.log('=' .repeat(50));
    console.log('Using GitHub Search API for efficient date-filtered fetching\n');

    const repos = [
      { owner: 'prebid', repo: 'Prebid.js', name: 'prebid-js' },
      { owner: 'prebid', repo: 'prebid-server', name: 'prebid-server' },
      { owner: 'prebid', repo: 'prebid-server-java', name: 'prebid-server-java' },
      { owner: 'prebid', repo: 'prebid-mobile-android', name: 'prebid-mobile-android' },
      { owner: 'prebid', repo: 'prebid-mobile-ios', name: 'prebid-mobile-ios' },
      { owner: 'prebid', repo: 'prebid.github.io', name: 'prebid-github-io' },
      { owner: 'prebid', repo: 'prebid-universal-creative', name: 'prebid-universal-creative' }
    ];

    const stats = {
      totalOpenPRs: 0,
      totalMergedPRs: 0,
      totalOpenIssues: 0,
      totalClosedIssues: 0
    };

    for (const repo of repos) {
      const repoStats = await this.updateRepo(repo.owner, repo.repo, repo.name, daysBack);
      stats.totalOpenPRs += repoStats.openPRs;
      stats.totalMergedPRs += repoStats.mergedPRs;
      stats.totalOpenIssues += repoStats.openIssues;
      stats.totalClosedIssues += repoStats.closedIssues;

      // Pause between repos to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log('\n' + '=' .repeat(50));
    console.log('📊 Update Complete:');
    console.log(`  • Open PRs: ${stats.totalOpenPRs}`);
    console.log(`  • Merged PRs (last ${daysBack} days): ${stats.totalMergedPRs}`);
    console.log(`  • Open Issues: ${stats.totalOpenIssues}`);
    console.log(`  • Closed Issues (last ${daysBack} days): ${stats.totalClosedIssues}`);
    console.log('=' .repeat(50));

    // Copy to public and regenerate stats
    console.log('\n📂 Copying to public directory...');
    execSync('cp -r store/repos public/store/', { stdio: 'inherit' });

    console.log('📊 Regenerating statistics...');
    await import('./generateContributorStats');

    console.log('\n✅ All done!');
  }
}

// Run it
const updater = new RecentDataUpdater();
const daysBack = process.argv[2] ? parseInt(process.argv[2]) : 14;

console.log(`Will fetch data from last ${daysBack} days\n`);

updater.run(daysBack).catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});