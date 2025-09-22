import { Octokit } from '@octokit/rest';
import { Repository, PRData, IssueData, CommitAuthor, Reviewer } from '../types/index.js';
import { RateLimitManager } from './rateLimitManager.js';
import { RequestQueue } from './requestQueue.js';

interface FetchOptions {
  onProgress?: (current: number, total: number) => void;
  onBatch?: (items: any[]) => Promise<void>;
  maxItems?: number;
  since?: Date;
}

export class GitHubService {
  private octokit: Octokit;
  private rateLimitManager: RateLimitManager;
  private requestQueue: RequestQueue;

  constructor(token: string, maxConcurrent: number = 3) {
    this.octokit = new Octokit({
      auth: token,
      baseUrl: process.env.GITHUB_API_URL || 'https://api.github.com',
    });
    
    this.rateLimitManager = new RateLimitManager();
    this.requestQueue = new RequestQueue(maxConcurrent, this.rateLimitManager);
  }

  private async makeRequest<T>(
    endpoint: string,
    requestFn: () => Promise<any>,
    priority: number = 0
  ): Promise<T> {
    return this.requestQueue.add(async () => {
      const response = await requestFn();
      
      // Update rate limit from headers
      if (response.headers) {
        this.rateLimitManager.updateFromHeaders(response.headers);
      }
      
      return response;
    }, priority, endpoint);
  }

  private async fetchAllPages<T>(
    endpoint: string,
    requestFn: (page: number) => Promise<any>,
    options: FetchOptions = {}
  ): Promise<T[]> {
    const results: T[] = [];
    let page = 1;
    let hasMore = true;
    let totalItems = 0;
    
    while (hasMore) {
      const response = await this.makeRequest<any>(
        `${endpoint}-page-${page}`,
        () => requestFn(page),
        1 // Higher priority for pagination
      );
      
      const items = response.data || [];
      
      // For closed PRs or issues, check if we've gone too far back in time
      if ((endpoint.includes('pulls-closed') || endpoint.includes('issues-closed')) && items.length > 0) {
        const lastItem = items[items.length - 1];
        const lastUpdated = new Date(lastItem.updated_at);
        
        // Check against the cutoff date passed in options
        const cutoffDate = options.since || new Date('2020-01-01');
        
        // If the last item is before cutoff, filter and stop
        if (lastUpdated < cutoffDate) {
          console.log(`    ⏹️  Reached items from ${lastUpdated.toISOString().split('T')[0]}, stopping pagination (cutoff: ${cutoffDate.toISOString().split('T')[0]})...`);
          // Only include items updated after cutoff
          const filtered = items.filter((item: any) => new Date(item.updated_at) >= cutoffDate);
          results.push(...filtered);
          totalItems += filtered.length;
          break; // Stop pagination
        }
      }
      
      results.push(...items);
      totalItems += items.length;
      
      // Call progress callback
      if (options.onProgress) {
        const estimatedTotal = this.estimateTotalFromLink(response.headers?.link);
        options.onProgress(totalItems, estimatedTotal || 0);
      }
      
      
      // Check if we've reached the max items limit
      if (options.maxItems && totalItems >= options.maxItems) {
        results.splice(options.maxItems);
        break;
      }
      
      // Check for more pages
      hasMore = response.headers?.link?.includes('rel="next"') || false;
      page++;
      
      if (page > 5 && items.length === 100) {
        console.log(`    📄 Large dataset detected, continuing with pagination...`);
      }
    }
    
    return results;
  }

  private estimateTotalFromLink(linkHeader?: string): number {
    if (!linkHeader) return 0;
    // Don't try to estimate total from last page - it's often wrong for filtered results
    // GitHub's pagination can include total pages for ALL items, not just filtered ones
    return 0;
  }

  private parseIssueClosedReason(stateReason?: string | null): 'completed' | 'duplicate' | 'not_planned' | 'other' {
    switch (stateReason) {
      case 'completed':
        return 'completed';
      case 'duplicate':
        return 'duplicate';
      case 'not_planned':
        return 'not_planned';
      default:
        return 'other';
    }
  }

  async fetchOpenPRs(repo: Repository, options: FetchOptions = {}): Promise<PRData[]> {
    console.log(`  📥 Fetching open PRs for ${repo.name}...`);
    
    const pulls = await this.fetchAllPages<any>(
      `repos/${repo.owner}/${repo.repo}/pulls`,
      (page) => this.octokit.rest.pulls.list({
        owner: repo.owner,
        repo: repo.repo,
        state: 'open',
        per_page: 100,
        page,
        sort: 'updated',
        direction: 'desc'
      }),
      {
        ...options,
        onProgress: (current, total) => {
          // Don't show estimated total since it's often wrong for filtered queries
          if (current > 0 && current % 100 === 0) {
            console.log(`    Progress: ${current} PRs fetched...`);
          }
        }
      }
    );
    
    return this.processPRs(repo, pulls, options);
  }

  async fetchMergedPRs(repo: Repository, since?: Date, options: FetchOptions = {}): Promise<PRData[]> {
    console.log(`  📥 Fetching merged PRs for ${repo.name}${since ? ` (since ${since.toISOString()})` : ''}...`);

    // If we have a recent 'since' date (within last 90 days), use Search API for efficiency
    if (since && since > new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)) {
      const sinceStr = since.toISOString().split('T')[0];
      const query = `repo:${repo.owner}/${repo.repo} is:pr is:merged updated:>${sinceStr}`;

      console.log(`    Using Search API with query: ${query}`);

      let allItems: any[] = [];
      let page = 1;

      while (true) {
        try {
          const response = await this.octokit.search.issuesAndPullRequests({
            q: query,
            per_page: 100,
            page: page,
            sort: 'updated',
            order: 'desc'
          });

          allItems = allItems.concat(response.data.items);
          console.log(`    Fetched page ${page}: ${response.data.items.length} items (total: ${allItems.length}/${response.data.total_count})`);

          if (response.data.items.length < 100 || allItems.length >= response.data.total_count || allItems.length >= 1000) {
            break;
          }

          page++;
          await new Promise(resolve => setTimeout(resolve, 2000)); // Rate limit pause
        } catch (error: any) {
          if (error.status === 403 && error.message?.includes('rate limit')) {
            console.log('    Hit Search API rate limit, waiting 60 seconds...');
            await new Promise(resolve => setTimeout(resolve, 60000));
            continue;
          }
          throw error;
        }
      }

      // Fetch full PR details for each item (Search API returns limited fields)
      const fullPRs = [];
      for (const item of allItems) {
        try {
          const { data: pr } = await this.octokit.rest.pulls.get({
            owner: repo.owner,
            repo: repo.repo,
            pull_number: item.number
          });
          fullPRs.push(pr);
        } catch (error) {
          console.log(`    Warning: Could not fetch full details for PR #${item.number}`);
        }
      }

      console.log(`    Retrieved ${fullPRs.length} merged PRs using Search API`);
      return this.processPRs(repo, fullPRs, options);
    }

    // Fall back to original implementation for older dates or full fetch
    const pulls = await this.fetchAllPages<any>(
      `repos/${repo.owner}/${repo.repo}/pulls-closed`,
      (page) => this.octokit.rest.pulls.list({
        owner: repo.owner,
        repo: repo.repo,
        state: 'closed',
        per_page: 100,
        page,
        sort: 'updated',
        direction: 'desc'
      }),
      { ...options, since }
    );

    let mergedPulls = pulls.filter(pr => pr.merged_at !== null);
    if (since) {
      const originalCount = mergedPulls.length;
      mergedPulls = mergedPulls.filter(pr => new Date(pr.updated_at) >= since);
      console.log(`    Filtered ${mergedPulls.length} merged PRs (from ${originalCount} total merged, ${pulls.length} total closed)`);
    } else {
      console.log(`    Filtered ${mergedPulls.length} merged PRs from ${pulls.length} closed PRs`);
    }
    return this.processPRs(repo, mergedPulls, options);
  }

  private async processPRs(repo: Repository, pulls: any[], options: FetchOptions = {}): Promise<PRData[]> {
    const prDataArray: PRData[] = [];
    const failedPRs: any[] = [];
    const batchSize = 10;
    
    if (pulls.length === 0) return [];
    
    console.log(`  🔄 Processing ${pulls.length} PRs with controlled concurrency...`);
    
    for (let i = 0; i < pulls.length; i += batchSize) {
      const batch = pulls.slice(i, Math.min(i + batchSize, pulls.length));
      
      // Process batch in parallel with request queue managing concurrency
      const batchPromises = batch.map(pr => this.processSinglePR(repo, pr)
        .catch(error => {
          console.log(`      ⚠️  Failed PR #${pr.number}: ${error.message}`);
          failedPRs.push(pr);
          return null;
        }));
      const batchResults = await Promise.all(batchPromises);
      
      // Filter out nulls from failed PRs
      const successfulResults = batchResults.filter(pr => pr !== null) as PRData[];
      prDataArray.push(...successfulResults);
      
      // Report progress
      console.log(`    Processed ${Math.min(i + batchSize, pulls.length)}/${pulls.length} PRs`);
      
      // Call batch callback for incremental saving
      if (options.onBatch && successfulResults.length > 0) {
        await options.onBatch(successfulResults);
        console.log(`    💾 Saved batch of ${successfulResults.length} PRs`);
      }
    }
    
    // Retry failed PRs if any
    const permanentlyFailedPRs: number[] = [];
    if (failedPRs.length > 0) {
      console.log(`\n  🔁 Retrying ${failedPRs.length} failed PRs...`);
      for (const pr of failedPRs) {
        try {
          const result = await this.processSinglePR(repo, pr);
          prDataArray.push(result);
          console.log(`    ✅ Successfully retried PR #${pr.number}`);
        } catch (error: any) {
          console.log(`    ❌ PR #${pr.number} failed again: ${error.message}`);
          permanentlyFailedPRs.push(pr.number);
        }
      }
      
      // Summary of permanently failed PRs
      if (permanentlyFailedPRs.length > 0) {
        console.log(`\n  ⚠️  Summary: ${permanentlyFailedPRs.length} PRs could not be fetched:`);
        console.log(`     Failed PR numbers: ${permanentlyFailedPRs.join(', ')}`);
      } else {
        console.log(`\n  ✅ All initially failed PRs were successfully retried!`);
      }
    }
    
    return prDataArray;
  }

  private async processSinglePR(repo: Repository, pr: any): Promise<PRData> {
    // Fetch reviews and commits in parallel through the queue
    const [reviewsResponse, commitsResponse] = await Promise.all([
      this.makeRequest<any>(
        `pr-reviews-${pr.number}`,
        () => this.octokit.rest.pulls.listReviews({
          owner: repo.owner,
          repo: repo.repo,
          pull_number: pr.number
        }),
        0 // Lower priority for PR details
      ),
      this.makeRequest<any>(
        `pr-commits-${pr.number}`,
        () => this.octokit.rest.pulls.listCommits({
          owner: repo.owner,
          repo: repo.repo,
          pull_number: pr.number,
          per_page: 100
        }),
        0
      )
    ]);

      // Track all reviewers and their final states
      const reviewerMap = new Map<string, Reviewer>();
      
      // First, add requested reviewers (those assigned but haven't reviewed)
      if (pr.requested_reviewers) {
        for (const requestedReviewer of pr.requested_reviewers) {
          if (requestedReviewer.login) {
            reviewerMap.set(requestedReviewer.login, {
              login: requestedReviewer.login,
              state: 'PENDING'
            });
          }
        }
      }
      
      // Then process actual reviews, updating to their final state
      for (const review of reviewsResponse.data) {
        if (review.user?.login && review.state) {
          // Only keep the last review state per user (overwrites PENDING or previous reviews)
          reviewerMap.set(review.user.login, {
            login: review.user.login,
            state: review.state as 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED'
          });
        }
      }
      
      // Convert map to array for storage
      const reviewers = Array.from(reviewerMap.values());

      const commitAuthors = new Map<string, CommitAuthor>();
      
      for (const commit of commitsResponse.data) {
        // If we have a GitHub user, use their ID as identifier
        const hasGitHubUser = commit.author?.id != null;
        const identifier = hasGitHubUser 
          ? commit.author.id.toString()
          : (commit.commit.author?.name || 'unknown');
        const displayName = commit.author?.login || commit.commit.author?.name || 'unknown';
        
        if (!commitAuthors.has(identifier)) {
          commitAuthors.set(identifier, {
            identifier,
            displayName,
            count: 0,
            isGitHubUser: hasGitHubUser
          });
        }
        
        const author = commitAuthors.get(identifier)!;
        author.count++;
      }

    return {
      title: pr.title,
      number: pr.number,
      author: {
        login: pr.user?.login || 'unknown',
        id: pr.user?.id || 0
      },
      assignees: pr.assignees ? pr.assignees.map((a: any) => a.login).filter(Boolean) : [],
      reviewers,
      dateCreated: new Date(pr.created_at),
      dateUpdated: new Date(pr.updated_at),
      status: pr.merged_at ? 'merged' : pr.state as 'open' | 'closed',
      dateMerged: pr.merged_at ? new Date(pr.merged_at) : undefined,
      dateClosed: pr.closed_at && !pr.merged_at ? new Date(pr.closed_at) : undefined,
      commitAuthors
    };
  }

  async fetchOpenIssues(repo: Repository, options: FetchOptions = {}): Promise<IssueData[]> {
    console.log(`  📥 Fetching open issues for ${repo.name}...`);
    
    const issues = await this.fetchAllPages<any>(
      `repos/${repo.owner}/${repo.repo}/issues`,
      (page) => this.octokit.rest.issues.listForRepo({
        owner: repo.owner,
        repo: repo.repo,
        state: 'open',
        per_page: 100,
        page,
        sort: 'updated',
        direction: 'desc'
      }),
      {
        ...options,
        onProgress: (current, total) => {
          // Don't show estimated total since it's often wrong for filtered queries
          if (current > 0 && current % 100 === 0) {
            console.log(`    Progress: ${current} issues fetched...`);
          }
        }
      }
    );
    
    const filteredIssues = issues.filter(issue => !issue.pull_request);
    console.log(`    Filtered ${filteredIssues.length} issues from ${issues.length} items (excluded PRs)`);
    return this.processIssues(filteredIssues, options);
  }

  async fetchClosedIssues(repo: Repository, since?: Date, options: FetchOptions = {}): Promise<IssueData[]> {
    console.log(`  📥 Fetching closed issues for ${repo.name}${since ? ` (since ${since.toISOString()})` : ''}...`);
    
    const issues = await this.fetchAllPages<any>(
      `repos/${repo.owner}/${repo.repo}/issues-closed`,
      (page) => this.octokit.rest.issues.listForRepo({
        owner: repo.owner,
        repo: repo.repo,
        state: 'closed',
        per_page: 100,
        page,
        sort: 'updated',
        direction: 'desc',
        ...(since && { since: since.toISOString() })
      }),
      { ...options, since } // Pass since date for pagination cutoff
    );
    
    const filteredIssues = issues.filter(issue => !issue.pull_request);
    console.log(`    Filtered ${filteredIssues.length} issues from ${issues.length} items (excluded PRs)`);
    return this.processIssues(filteredIssues, options);
  }

  private async processIssues(issues: any[], options: FetchOptions = {}): Promise<IssueData[]> {
    const issueDataArray: IssueData[] = [];
    const batchSize = 20;
    
    if (issues.length === 0) return [];
    
    console.log(`  🔄 Processing ${issues.length} issues...`);
    
    // Issues don't require additional API calls, so we can process them quickly
    for (let i = 0; i < issues.length; i += batchSize) {
      const batch = issues.slice(i, Math.min(i + batchSize, issues.length));
      
      const batchResults = batch.map(issue => this.processSingleIssue(issue));
      issueDataArray.push(...batchResults);
      
      // Report progress
      console.log(`    Processed ${Math.min(i + batchSize, issues.length)}/${issues.length} issues`);
      
      // Call batch callback for incremental saving
      if (options.onBatch && batchResults.length > 0) {
        await options.onBatch(batchResults);
        console.log(`    💾 Saved batch of ${batchResults.length} issues`);
      }
    }
    
    return issueDataArray;
  }

  private processSingleIssue(issue: any): IssueData {
    return {
        title: issue.title,
        number: issue.number,
        author: {
          login: issue.user?.login || 'unknown',
          id: issue.user?.id || 0
        },
        assignees: issue.assignees ? issue.assignees.map((a: any) => a.login).filter(Boolean) : [],
        dateCreated: new Date(issue.created_at),
        dateUpdated: new Date(issue.updated_at),
        status: issue.state as 'open' | 'closed',
        dateClosed: issue.closed_at ? new Date(issue.closed_at) : undefined,
        closedBy: issue.closed_by?.login,
        closureReason: issue.state === 'closed' ? this.parseIssueClosedReason(issue.state_reason) : undefined
      };
    }

  async checkRateLimit(): Promise<{ remaining: number; reset: Date; limit: number }> {
    const { data } = await this.octokit.rest.rateLimit.get();
    this.rateLimitManager.updateFromHeaders({
      'x-ratelimit-limit': data.rate.limit,
      'x-ratelimit-remaining': data.rate.remaining,
      'x-ratelimit-reset': data.rate.reset,
      'x-ratelimit-used': data.rate.used
    });
    
    return {
      limit: data.rate.limit,
      remaining: data.rate.remaining,
      reset: new Date(data.rate.reset * 1000)
    };
  }

  getQueueStats() {
    return this.requestQueue.getStats();
  }

  getRateLimitStatus() {
    return this.rateLimitManager.getStatus();
  }

  setMaxConcurrent(max: number) {
    this.requestQueue.setMaxConcurrent(max);
  }
}