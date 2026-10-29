import type { ContributionFocus, ContributionValues } from './contributions';
import type { AdditionalValues } from './contribution-activity';
import type { ContributionArea, CompanyBreakdown } from './contribution-page';
import type { ReportMetric } from './contribution-metrics';
import type { TableQuery } from '@/lib/presentation/table-query';
export interface ContributionExportRequest {
  area: ContributionArea;
  focus: ContributionFocus;
  breakdown: CompanyBreakdown;
  layout: 'summary' | 'repositories';
  hideZeroMembers?: boolean;
  metrics: ReportMetric[];
  query: TableQuery;
}
export interface ContributionExportRow {
  id: string;
  entityType: 'contributor' | 'company';
  entityId: string;
  name: string;
  login: string | null;
  actorType: string | null;
  companyId: string | null;
  company: string;
  repositoryId: string | null;
  repository: string | null;
  metrics: ContributionValues;
  additionalMetrics: AdditionalValues;
}
