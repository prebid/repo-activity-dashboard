import type { ContributionFocus, ContributionValues } from './contributions';
import type { AdditionalValues } from './contribution-activity';
import type { ContributionArea, CompanyBreakdown } from './contribution-page';
import type { ReportMetric } from './contribution-metrics';
import type { ContributionLens } from './contribution-lens';
import { type TableQuery } from '@/models/table-query';
export interface ContributionExportRequest {
  area: ContributionArea;
  focus: ContributionFocus;
  breakdown: CompanyBreakdown;
  layout: 'summary' | 'repositories';
  hideZeroMembers?: boolean;
  identityColumns: ('actorType' | 'company' | 'members')[];
  metrics: ReportMetric[];
  query: TableQuery;
  /** The lens the export was taken in; absent means Contributors. */
  lens?: ContributionLens;
  /** A Reviewers-lens overview export of every account with activity. */
  allAccounts?: boolean;
}
export interface ContributionExportRow {
  id: string;
  entityType: 'contributor' | 'company';
  entityId: string;
  name: string;
  login: string | null;
  memberCount: number | null;
  actorType: string | null;
  companyId: string | null;
  company: string;
  repositoryId: string | null;
  repository: string | null;
  metrics: ContributionValues;
  additionalMetrics: AdditionalValues;
}
