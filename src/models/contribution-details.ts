import type {
  ContributionAccount,
  ContributionCompany,
  ContributionRepository,
  ContributionRecord,
  ContributionContext,
} from './contributions';
import type { Count } from './reporting-measurement';
import type { ReportMetric } from './contribution-metrics';
export interface ContributionSupportingRow {
  id: string;
  account: ContributionAccount;
  company: ContributionCompany | null;
  repository: ContributionRepository;
  record: ContributionRecord;
  value: Count;
  creditedAt: string;
  lastAt: string;
}
export interface ContributionMetricDetails {
  context: ContributionContext;
  metric: ReportMetric;
  measurement: Count;
  basis: 'credit' | 'comments' | 'merged-volume';
  rows: ContributionSupportingRow[];
  distinctRecords: number;
}
