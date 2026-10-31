import type {
  ContributionAccount,
  ContributionCompany,
  ContributionRepository,
  ContributionRecord,
  ContributionContext,
} from './contributions';
import type { Count } from './reporting-measurement';
import type { ContributionBasis, ReportMetric } from './contribution-metrics';
export interface ContributionSupportingRow {
  id: string;
  account: ContributionAccount;
  company: ContributionCompany | null;
  repository: ContributionRepository;
  record:
    | Omit<Extract<ContributionRecord, { kind: 'pr' }>, 'mergedDiff'>
    | Extract<ContributionRecord, { kind: 'issue' }>;
  value: Count;
  creditedAt: string;
  lastAt: string;
}
export interface ContributionMetricDetails {
  context: ContributionContext;
  metric: ReportMetric;
  measurement: Count;
  basis: ContributionBasis;
  rows: ContributionSupportingRow[];
  distinctRecords: number;
}
