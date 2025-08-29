import { Octokit } from '@octokit/rest';
import { Repository, PRData, IssueData, CommitAuthorSummary } from '../types/index.js';
import { RateLimitManager } from './rateLimitManager.js';
import { RequestQueue } from './requestQueue.js';

interface FetchOptions {
  onProgress?: (current: number, total: number) => void;
  onBatch?: (items: any[]) => Promise<void>;
  maxItems?: number;
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
      results.push(...items);
      totalItems += items.length;
      
      // Call progress callback
      if (options.onProgress) {
        const estimatedTotal = this.estimateTotalFromLink(response.headers?.link);
        options.onProgress(totalItems, estimatedTotal || totalItems);
      }
      
      // Call batch callback for incremental saving
      if (options.onBatch && items.length > 0) {
        await options.onBatch(items);
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
    const match = linkHeader.match(/page=(\d+)>; rel="last"/);
    if (match) {
      return parseInt(match[1]) * 100;
    }
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
          if (total > current) {
            console.log(`    Progress: ${current}/${total} PRs fetched`);
          }
        }
      }
    );
    
    return this.processPRs(repo, pulls, options);
  }

  async fetchMergedPRs(repo: Repository, since?: Date, options: FetchOptions = {}): Promise<PRData[]> {
    console.log(`  📥 Fetching merged PRs for ${repo.name}${since ? ` (since ${since.toISOString()})` : ''}...`);
    
    const pulls = await this.fetchAllPages<any>(
      `repos/${repo.owner}/${repo.repo}/pulls-closed`,
      (page) => this.octokit.rest.pulls.list({
        owner: repo.owner,
        repo: repo.repo,
        state: 'closed',
        per_page: 100,
        page,
        sort: 'updated',
        direction: 'desc',
        ...(since && { since: since.toISOString() })
      }),
      options
    );
    
    const mergedPulls = pulls.filter(pr => pr.merged_at !== null);
    console.log(`    Filtered ${mergedPulls.length} merged PRs from ${pulls.length} closed PRs`);
    return this.processPRs(repo, mergedPulls, options);
  }

  private async processPRs(repo: Repository, pulls: any[], options: FetchOptions = {}): Promise<PRData[]> {
    const prDataArray: PRData[] = [];
    const batchSize = 10;
    
    if (pulls.length === 0) return [];
    
    console.log(`  🔄 Processing ${pulls.length} PRs with controlled concurrency...`);
    
    for (let i = 0; i < pulls.length; i += batchSize) {
      const batch = pulls.slice(i, Math.min(i + batchSize, pulls.length));
      
      // Process batch in parallel with request queue managing concurrency
      const batchPromises = batch.map(pr => this.processSinglePR(repo, pr));
      const batchResults = await Promise.all(batchPromises);
      
      prDataArray.push(...batchResults);
      
      // Report progress
      console.log(`    Processed ${Math.min(i + batchSize, pulls.length)}/${pulls.length} PRs`);
      
      // Call batch callback for incremental saving
      if (options.onBatch && batchResults.length > 0) {
        await options.onBatch(batchResults);
        console.log(`    💾 Saved batch of ${batchResults.length} PRs`);
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

      const reviewers = {
        approved: [] as string[],
        pending: [] as string[]
      };

      const reviewerStates = new Map<string, string>();
      for (const review of reviewsResponse.data) {
        if (review.user?.login) {
          reviewerStates.set(review.user.login, review.state);
        }
      }

      reviewerStates.forEach((state, reviewer) => {
        if (state === 'APPROVED') {
          reviewers.approved.push(reviewer);
        } else if (state === 'PENDING' || state === 'COMMENTED' || state === 'CHANGES_REQUESTED') {
          reviewers.pending.push(reviewer);
        }
      });

      const commitsByAuthor = new Map<string, CommitAuthorSummary>();
      for (const commit of commitsResponse.data) {
        const authorLogin = commit.author?.login || commit.commit.author?.name || 'unknown';
        
        if (!commitsByAuthor.has(authorLogin)) {
          commitsByAuthor.set(authorLogin, {
            count: 0,
            author: authorLogin
          });
        }
        
        const summary = commitsByAuthor.get(authorLogin)!;
        summary.count++;
      }

    return {
      title: pr.title,
      number: pr.number,
      author: pr.user?.login || 'unknown',
      assignees: pr.assignees ? pr.assignees.map((a: any) => a.login).filter(Boolean) : [],
      reviewers: reviewers.approved.length > 0 || reviewers.pending.length > 0 ? reviewers : undefined,
      dateCreated: new Date(pr.created_at),
      status: pr.merged_at ? 'merged' : pr.state as 'open' | 'closed',
      dateMerged: pr.merged_at ? new Date(pr.merged_at) : undefined,
      dateClosed: pr.closed_at && !pr.merged_at ? new Date(pr.closed_at) : undefined,
      labels: pr.labels.map((label: any) => 
        typeof label === 'string' ? label : label.name || ''
      ).filter(Boolean),
      commits: {
        totalCount: commitsResponse.data.length,
        byAuthor: commitsByAuthor
      },
      relatedIssue: undefined,
      baseBranch: pr.base.ref
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
          if (total > current) {
            console.log(`    Progress: ${current}/${total} issues fetched`);
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
      options
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
        author: issue.user?.login || 'unknown',
        assignees: issue.assignees ? issue.assignees.map((a: any) => a.login).filter(Boolean) : [],
        dateCreated: new Date(issue.created_at),
        status: issue.state as 'open' | 'closed',
        dateClosed: issue.closed_at ? new Date(issue.closed_at) : undefined,
        closedReason: issue.state === 'closed' ? this.parseIssueClosedReason(issue.state_reason) : undefined,
        labels: issue.labels.map((label: any) => 
          typeof label === 'string' ? label : label.name || ''
        ).filter(Boolean),
        relatedPR: undefined
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