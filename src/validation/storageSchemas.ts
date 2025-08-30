import { z } from 'zod';
import { PRDataSchema, IssueDataSchema } from './schemas.js';

const dateStringToDate = z.string().transform(str => new Date(str));

const mapFromObject = z.record(z.string(), z.number()).transform(obj => 
  new Map(Object.entries(obj))
);

const setFromArray = z.array(z.number()).transform(arr => new Set(arr));

export const StoredAuthorSchema = z.object({
  login: z.string(),
  id: z.number()
});

export const StoredPRDataSchema = z.object({
  number: z.number(),
  title: z.string(),
  status: z.enum(['open', 'closed', 'merged']),
  author: StoredAuthorSchema,
  dateCreated: dateStringToDate,
  dateUpdated: dateStringToDate,
  assignees: z.array(z.string()),
  reviewers: z.array(z.string()),
  draft: z.boolean(),
  commits: z.union([
    mapFromObject,
    z.map(z.string(), z.number())
  ]),
  dateMerged: dateStringToDate.optional(),
  dateClosed: dateStringToDate.optional()
});

export const StoredIssueDataSchema = z.object({
  number: z.number(),
  title: z.string(),
  status: z.enum(['open', 'closed']),
  author: StoredAuthorSchema,
  dateCreated: dateStringToDate,
  dateUpdated: dateStringToDate,
  assignees: z.array(z.string()),
  closedBy: z.string().optional(),
  closureReason: z.enum(['completed', 'duplicate', 'not_planned', 'other']).optional(),
  dateClosed: dateStringToDate.optional()
});

export const StoredOpenItemsSchema = z.object({
  metadata: z.object({
    repository: z.string(),
    lastSync: dateStringToDate,
    itemCount: z.number()
  }),
  items: z.array(z.union([StoredPRDataSchema, StoredIssueDataSchema]))
});

export const StoredMonthlySchema = z.object({
  metadata: z.object({
    repository: z.string(),
    year: z.number(),
    month: z.number(),
    itemCount: z.number(),
    lastUpdated: dateStringToDate
  }),
  items: z.array(z.union([StoredPRDataSchema, StoredIssueDataSchema]))
});

export const StoredSyncStateSchema = z.object({
  repository: z.string(),
  lastFullSync: dateStringToDate,
  lastIncrementalSync: dateStringToDate,
  openPRNumbers: setFromArray,
  openIssueNumbers: setFromArray
});

export function validateStoredPRs(data: unknown) {
  const schema = z.object({
    metadata: z.object({
      repository: z.string(),
      lastSync: dateStringToDate,
      itemCount: z.number()
    }),
    items: z.array(StoredPRDataSchema)
  });
  return schema.parse(data);
}

export function validateStoredIssues(data: unknown) {
  const schema = z.object({
    metadata: z.object({
      repository: z.string(),
      lastSync: dateStringToDate,
      itemCount: z.number()
    }),
    items: z.array(StoredIssueDataSchema)
  });
  return schema.parse(data);
}