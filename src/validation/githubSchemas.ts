import { z } from 'zod';

export const GitHubUserSchema = z.object({
  login: z.string(),
  id: z.number()
});

export const GitHubPRResponseSchema = z.object({
  number: z.number(),
  title: z.string(),
  state: z.enum(['open', 'closed']),
  user: GitHubUserSchema,
  created_at: z.string(),
  updated_at: z.string(),
  assignees: z.array(z.object({ login: z.string() })),
  requested_reviewers: z.array(z.object({ login: z.string() })),
  draft: z.boolean(),
  merged_at: z.string().nullable(),
  closed_at: z.string().nullable(),
  base: z.object({
    repo: z.object({
      owner: z.object({ login: z.string() }),
      name: z.string()
    })
  })
});

export const GitHubIssueResponseSchema = z.object({
  number: z.number(),
  title: z.string(),
  state: z.enum(['open', 'closed']),
  user: GitHubUserSchema,
  created_at: z.string(),
  updated_at: z.string(),
  assignees: z.array(z.object({ login: z.string() })),
  closed_at: z.string().nullable(),
  closed_by: z.object({ login: z.string() }).nullable(),
  state_reason: z.enum(['completed', 'not_planned', 'reopened']).nullable(),
  pull_request: z.object({
    url: z.string()
  }).optional()
});

export const GitHubCommitResponseSchema = z.object({
  sha: z.string(),
  commit: z.object({
    author: z.object({
      name: z.string().nullable(),
      email: z.string().nullable()
    })
  }),
  author: z.object({
    login: z.string()
  }).nullable()
});

export const GitHubReviewResponseSchema = z.object({
  id: z.number(),
  user: GitHubUserSchema.nullable(),
  state: z.enum(['PENDING', 'COMMENTED', 'APPROVED', 'CHANGES_REQUESTED', 'DISMISSED'])
});

export function transformGitHubPRToInternal(githubPR: z.infer<typeof GitHubPRResponseSchema>) {
  return {
    number: githubPR.number,
    title: githubPR.title,
    status: githubPR.state === 'closed' && githubPR.merged_at ? 'merged' as const : githubPR.state,
    author: {
      login: githubPR.user.login,
      id: githubPR.user.id
    },
    dateCreated: new Date(githubPR.created_at),
    dateUpdated: new Date(githubPR.updated_at),
    assignees: githubPR.assignees.map(a => a.login),
    reviewers: githubPR.requested_reviewers.map(r => r.login),
    draft: githubPR.draft,
    commits: new Map<string, number>(),
    dateMerged: githubPR.merged_at ? new Date(githubPR.merged_at) : undefined,
    dateClosed: githubPR.closed_at ? new Date(githubPR.closed_at) : undefined
  };
}

export function transformGitHubIssueToInternal(githubIssue: z.infer<typeof GitHubIssueResponseSchema>) {
  let closureReason: 'completed' | 'duplicate' | 'not_planned' | 'other' | undefined;
  if (githubIssue.state_reason === 'completed') closureReason = 'completed';
  else if (githubIssue.state_reason === 'not_planned') closureReason = 'not_planned';
  
  return {
    number: githubIssue.number,
    title: githubIssue.title,
    status: githubIssue.state,
    author: {
      login: githubIssue.user.login,
      id: githubIssue.user.id
    },
    dateCreated: new Date(githubIssue.created_at),
    dateUpdated: new Date(githubIssue.updated_at),
    assignees: githubIssue.assignees.map(a => a.login),
    closedBy: githubIssue.closed_by?.login,
    closureReason,
    dateClosed: githubIssue.closed_at ? new Date(githubIssue.closed_at) : undefined
  };
}