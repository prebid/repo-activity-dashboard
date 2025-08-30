import { z } from 'zod';

export const AuthorSchema = z.object({
  login: z.string().min(1),
  id: z.number().positive()
});

export const PRDataSchema = z.object({
  number: z.number().positive(),
  title: z.string().min(1),
  status: z.enum(['open', 'closed', 'merged']),
  author: AuthorSchema,
  dateCreated: z.date(),
  dateUpdated: z.date(),
  assignees: z.array(z.string()),
  reviewers: z.array(z.string()),
  draft: z.boolean(),
  commits: z.map(z.string(), z.number()),
  dateMerged: z.date().optional(),
  dateClosed: z.date().optional()
});

export const IssueDataSchema = z.object({
  number: z.number().positive(),
  title: z.string().min(1),
  status: z.enum(['open', 'closed']),
  author: AuthorSchema,
  dateCreated: z.date(),
  dateUpdated: z.date(),
  assignees: z.array(z.string()),
  closedBy: z.string().optional(),
  closureReason: z.enum(['completed', 'duplicate', 'not_planned', 'other']).optional(),
  dateClosed: z.date().optional()
});

export const RepositorySchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  name: z.string().min(1),
  category: z.string().min(1),
  url: z.string().url()
});

export const OpenItemsStorageSchema = z.object({
  metadata: z.object({
    repository: z.string(),
    lastSync: z.date(),
    itemCount: z.number().nonnegative()
  }),
  items: z.array(z.union([PRDataSchema, IssueDataSchema]))
});

export const MonthlyStorageSchema = z.object({
  metadata: z.object({
    repository: z.string(),
    year: z.number().min(2024),
    month: z.number().min(1).max(12),
    itemCount: z.number().nonnegative(),
    lastUpdated: z.date()
  }),
  items: z.array(z.union([PRDataSchema, IssueDataSchema]))
});

export const SyncStateSchema = z.object({
  repository: z.string(),
  lastFullSync: z.date(),
  lastIncrementalSync: z.date(),
  openPRNumbers: z.set(z.number()),
  openIssueNumbers: z.set(z.number())
});

export type ValidatedPRData = z.infer<typeof PRDataSchema>;
export type ValidatedIssueData = z.infer<typeof IssueDataSchema>;
export type ValidatedRepository = z.infer<typeof RepositorySchema>;