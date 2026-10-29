import type { DrilldownSelection, RepositoryDrilldown } from './repository-drilldown';
import type { Count, Measurement, OverviewRepository } from './repository-overview';
import type { RepositoryRecordList } from './repository-records';
import { z } from 'zod';

export const insightMetrics = [
  'prAuthors',
  'issueAuthors',
  'agentFeedbackCredits',
  'agentApprovalCredits',
  'botFeedbackCredits',
  'botApprovalCredits',
  'medianMergeDays',
] as const;
export type InsightMetric = (typeof insightMetrics)[number];
export type InsightSelection = Extract<DrilldownSelection, { scope: 'period' }> & {
  metric: InsightMetric;
};
export type AuthorSelection = InsightSelection & { metric: 'prAuthors' | 'issueAuthors' };
export const authorAccountSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9-]+(?:\[bot\])?$/i)
  .transform((value) => value.toLowerCase());
export const authorTableColumnIds = ['account', 'accountType', 'recordCount', 'records'] as const;
export type ReportingAccountType = 'human' | 'agent' | 'bot';
export interface SupportingRecord {
  id: string;
  number: number;
  title: string;
  url: string;
  state: 'Open' | 'Merged' | 'Closed';
  draft?: boolean;
}
export interface RepositoryAuthor {
  id: string;
  account: string;
  profileUrl?: string;
  accountType: ReportingAccountType;
  recordCount: number;
}
export interface RepositoryContribution {
  id: string;
  account: string;
  profileUrl?: string;
  accountType: 'agent' | 'bot';
  contribution: 'reviewer' | 'approval';
  firstCreditAt: string;
  pr: SupportingRecord;
}
interface InsightContext {
  repository: OverviewRepository;
  asOf: string;
  drilldown: RepositoryDrilldown & { selection: InsightSelection };
  measurement: Count;
}
export type RepositoryInsight = InsightContext &
  (
    | { kind: 'authors'; recordKind: 'prs' | 'issues'; rows: RepositoryAuthor[] }
    | { kind: 'contributions'; rows: RepositoryContribution[] }
    | {
        kind: 'duration';
        days: Measurement;
        records: Extract<RepositoryRecordList, { kind: 'prs' }>;
      }
  );
