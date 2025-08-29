import { Octokit } from '@octokit/rest';
import { Repository, PRData, IssueData, CommitAuthorSummary } from '../types/index.js';

export class GitHubService {
  private octokit: Octokit;
  private requestDelay: number = 100;

  constructor(token: string) {
    this.octokit = new Octokit({
      auth: token,
      baseUrl: process.env.GITHUB_API_URL || 'https://api.github.com',
    });
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
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

  async fetchPRs(repo: Repository, options?: { state?: 'open' | 'closed' | 'all'; limit?: number }): Promise<PRData[]> {
    try {
      const state = options?.state || 'all';
      const perPage = Math.min(options?.limit || 100, 100);
      
      const { data: pulls } = await this.octokit.rest.pulls.list({
        owner: repo.owner,
        repo: repo.repo,
        state,
        per_page: perPage,
        sort: 'updated',
        direction: 'desc'
      });

      const prDataPromises = pulls.map(async (pr) => {
        await this.delay(this.requestDelay);
        
        const [reviewsResponse, commitsResponse] = await Promise.all([
          this.octokit.rest.pulls.listReviews({
            owner: repo.owner,
            repo: repo.repo,
            pull_number: pr.number
          }),
          this.octokit.rest.pulls.listCommits({
            owner: repo.owner,
            repo: repo.repo,
            pull_number: pr.number,
            per_page: 100
          })
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

        // Get linked issues using GitHub's GraphQL or check timeline events
        let relatedIssue: number | undefined;
        try {
          const { data: events } = await this.octokit.rest.issues.listEventsForTimeline({
            owner: repo.owner,
            repo: repo.repo,
            issue_number: pr.number
          });
          
          const connectedEvent = events.find((event: any) => 
            event.event === 'connected' || event.event === 'cross-referenced'
          );
          
          if (connectedEvent && connectedEvent.source?.issue) {
            relatedIssue = connectedEvent.source.issue.number;
          }
        } catch {
          // Timeline API might not be available, fallback to undefined
        }

        const prData: PRData = {
          title: pr.title,
          number: pr.number,
          author: pr.user?.login || 'unknown',
          assignee: pr.assignee?.login,
          reviewers: reviewers.approved.length > 0 || reviewers.pending.length > 0 ? reviewers : undefined,
          dateCreated: new Date(pr.created_at),
          status: pr.merged_at ? 'merged' : pr.state as 'open' | 'closed',
          dateMerged: pr.merged_at ? new Date(pr.merged_at) : undefined,
          dateClosed: pr.closed_at && !pr.merged_at ? new Date(pr.closed_at) : undefined,
          labels: pr.labels.map(label => 
            typeof label === 'string' ? label : label.name || ''
          ).filter(Boolean),
          commits: {
            totalCount: commitsResponse.data.length,
            byAuthor: commitsByAuthor
          },
          relatedIssue,
          baseBranch: pr.base.ref
        };

        return prData;
      });

      return await Promise.all(prDataPromises);
    } catch (error) {
      console.error(`Error fetching PRs for ${repo.owner}/${repo.repo}:`, error);
      throw error;
    }
  }

  async fetchIssues(repo: Repository, options?: { state?: 'open' | 'closed' | 'all'; limit?: number }): Promise<IssueData[]> {
    try {
      const state = options?.state || 'all';
      const perPage = Math.min(options?.limit || 100, 100);
      
      const { data: issues } = await this.octokit.rest.issues.listForRepo({
        owner: repo.owner,
        repo: repo.repo,
        state,
        per_page: perPage,
        sort: 'updated',
        direction: 'desc'
      });

      const issueDataPromises = issues
        .filter(issue => !issue.pull_request)
        .map(async (issue) => {
          await this.delay(this.requestDelay);
          
          // Get timeline events to find linked PRs
          let relatedPRs: number[] = [];
          try {
            const { data: events } = await this.octokit.rest.issues.listEventsForTimeline({
              owner: repo.owner,
              repo: repo.repo,
              issue_number: issue.number
            });
            
            relatedPRs = events
              .filter((event: any) => 
                (event.event === 'cross-referenced' && event.source?.issue?.pull_request) ||
                event.event === 'referenced'
              )
              .map((event: any) => event.source?.issue?.number)
              .filter((num: any) => num !== undefined);
          } catch {
            // Timeline API might not be available, leave empty
          }

          const issueData: IssueData = {
            title: issue.title,
            number: issue.number,
            author: issue.user?.login || 'unknown',
            assignee: issue.assignee?.login,
            dateCreated: new Date(issue.created_at),
            status: issue.state as 'open' | 'closed',
            dateClosed: issue.closed_at ? new Date(issue.closed_at) : undefined,
            closedReason: issue.state === 'closed' ? this.parseIssueClosedReason(issue.state_reason) : undefined,
            labels: issue.labels.map(label => 
              typeof label === 'string' ? label : label.name || ''
            ).filter(Boolean),
            relatedPR: relatedPRs.length > 0 ? relatedPRs : undefined
          };

          return issueData;
        });

      return await Promise.all(issueDataPromises);
    } catch (error) {
      console.error(`Error fetching issues for ${repo.owner}/${repo.repo}:`, error);
      throw error;
    }
  }

  async checkRateLimit(): Promise<{ remaining: number; reset: Date }> {
    const { data } = await this.octokit.rest.rateLimit.get();
    return {
      remaining: data.rate.remaining,
      reset: new Date(data.rate.reset * 1000)
    };
  }
}